// Claude integration for Rhyza. Two jobs:
//   1. synthesizeBloom() — distill a seed's whole thread into the durable summary
//      when it blooms.
//   2. claudeReply() — answer when a member tags @claude inside a conversation.
//
// Everything here is gated behind aiConfigured(): if ANTHROPIC_API_KEY is unset
// the app still works (the bloom falls back to a deterministic summary, and
// @claude mentions simply don't get a reply).

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const MODEL = "claude-opus-4-8";
// ChatGPT model — overridable via env so the exact OpenAI model is a config
// choice, not a hardcode that can drift out of date.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

let client: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

function textFromMessage(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// One Claude completion. THROWS on API error (bad key, model access, network)
// so callers can surface the real reason — callers that want a graceful
// fallback (e.g. bloom synthesis) wrap this in their own try/catch.
async function complete(
  system: string,
  prompt: string | Anthropic.ContentBlockParam[],
  maxTokens = 1024,
): Promise<string> {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const msg = await stream.finalMessage();
  return textFromMessage(msg);
}

export type ContribForAI = {
  dimension: string;
  author: string;
  text: string;
  reactions?: string; // e.g. "🤔 Still confused ×2, 💥 It clicked ×1"
  images?: string[]; // URLs of image attachments so Claude can actually see them
};

// Collect image URLs across a thread (most recent first wins), capped so the
// request stays reasonable.
function collectImages(contributions: ContribForAI[], cap = 6): string[] {
  const urls: string[] = [];
  for (const c of contributions) for (const u of c.images ?? []) urls.push(u);
  return urls.slice(-cap);
}

// Build a user message that includes images as vision blocks when present.
function userMessage(text: string, images: string[]): string | Anthropic.ContentBlockParam[] {
  if (images.length === 0) return text;
  return [
    { type: "text", text },
    ...images.map(
      (url): Anthropic.ContentBlockParam => ({
        type: "image",
        source: { type: "url", url },
      }),
    ),
  ];
}

const DIMENSION_LABEL: Record<string, string> = {
  foundations: "Foundations (why it exists, core assumptions)",
  understanding: "Understanding (mental models, analogies)",
  application: "Application (real-world practice)",
  debate: "Debate (trade-offs, counter-arguments)",
  bloom: "Bloom (distilled answers)",
};

function renderThread(contributions: ContribForAI[]): string {
  if (contributions.length === 0) return "(no contributions yet)";
  return contributions
    .map((c) => {
      const dim = DIMENSION_LABEL[c.dimension] ?? c.dimension;
      const img = c.images?.length ? ` [${c.images.length} image(s) attached — shown below]` : "";
      const base = `[${dim}] ${c.author}: ${c.text}${img}`;
      return c.reactions ? `${base}\n   (community reactions: ${c.reactions})` : base;
    })
    .join("\n\n");
}

// Distill a bloomed seed into its durable summary. Returns null if AI isn't
// configured or the call fails, so the caller can fall back deterministically.
export async function synthesizeBloom(input: {
  title: string;
  content: string;
  contributions: ContribForAI[];
}): Promise<string | null> {
  if (!aiConfigured()) return null;
  try {
    const prompt = [
      `SEED: ${input.title}`,
      input.content.trim() ? `\nFRAMING:\n${input.content.trim()}` : "",
      `\nTHE COMMUNITY'S THREAD (grouped by dimension):\n${renderThread(input.contributions)}`,
      `\nWrite the bloom: the distilled, durable answer this community converged on.`,
    ]
      .filter(Boolean)
      .join("\n");

    const text = await complete(
      "You are the synthesis engine for Rhyza, a collaborative learning garden. " +
        "A 'seed' is a question the community explores across five dimensions " +
        "(Foundations, Understanding, Application, Debate, Bloom). When a seed blooms, " +
        "you distill the entire thread into one durable summary capturing the collective " +
        "understanding — accurate to what was actually said, weaving the strongest points " +
        "together and noting genuine open debates. Write in clear, warm, encyclopedic prose: " +
        "2–4 short paragraphs. No headings, no preamble, no 'Here is' — output only the summary.",
      prompt,
    );
    return text || null;
  } catch (err) {
    // Bloom synthesis falls back to the deterministic summary on any failure.
    console.error("synthesizeBloom failed", err);
    return null;
  }
}

// Claude's reply when a member tags @claude. Returns null if AI isn't configured
// or the call fails (the mention just goes unanswered in that case).
export async function claudeReply(input: {
  title: string;
  content: string;
  dimension: string;
  mention: string;
  contributions: ContribForAI[];
}): Promise<string | null> {
  if (!aiConfigured()) return null;
  const dim = DIMENSION_LABEL[input.dimension] ?? input.dimension;
  const prompt = [
    `SEED: ${input.title}`,
    input.content.trim() ? `\nFRAMING:\n${input.content.trim()}` : "",
    `\nCONVERSATION SO FAR:\n${renderThread(input.contributions)}`,
    `\nYou were tagged in the "${dim}" dimension. The message tagging you:\n"${input.mention}"`,
    `\nReply as a participant.`,
  ]
    .filter(Boolean)
    .join("\n");

  // Throws on API error so the route can show the real reason. Images in the
  // thread are attached as vision blocks so Claude can actually see them.
  const text = await complete(
    "You are Claude, a thoughtful participant in a Rhyza learning conversation — a " +
      "collaborative knowledge garden where members explore a topic together. Someone " +
      "tagged you with @claude. Answer their question or add genuinely useful, specific " +
      "insight grounded in the discussion so far (including any images shown). Don't just " +
      "repeat what's been said. Be concise (1–3 short paragraphs), warm, and direct. Output " +
      "only your reply — no greeting like 'Sure!', no sign-off, and don't refer to yourself " +
      "in the third person.",
    userMessage(prompt, collectImages(input.contributions)),
  );
  return text || null;
}

// Shared mediator brief, parameterised by which AI is speaking.
function mediatorSystem(name: string): string {
  return (
    `You are ${name}, acting as a neutral mediator in a Rhyza discussion where ` +
    "people may disagree. Some messages include community reactions (e.g. 'Still " +
    "confused', 'It clicked', 'Changed thinking') — treat these as real signal: points " +
    "people found confusing deserve clarification, points that landed are common ground. " +
    "Your job is conflict resolution: (1) briefly and fairly restate the main positions " +
    "without taking sides, (2) name the genuine points of tension (and what people found " +
    "confusing), (3) surface the common ground people actually share, and (4) propose a " +
    "concrete, even-handed path forward (or a synthesis both sides could accept). Be " +
    "warm, balanced, and specific. Never declare a winner. Keep it tight — a few short " +
    "paragraphs or compact bullets. Output only the mediation."
  );
}

function mediatePrompt(input: { title: string; content: string; contributions: ContribForAI[] }): string {
  return [
    `SEED: ${input.title}`,
    input.content.trim() ? `\nFRAMING:\n${input.content.trim()}` : "",
    `\nTHE DISCUSSION:\n${renderThread(input.contributions)}`,
    `\nMediate.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Claude as neutral mediator: read the discussion, surface where people
// disagree, find common ground, and propose a fair path forward. Returns null
// if AI isn't configured or the call fails.
export async function mediate(input: {
  title: string;
  content: string;
  contributions: ContribForAI[];
}): Promise<string | null> {
  if (!aiConfigured()) return null;
  const prompt = mediatePrompt(input);

  // Throws on API error so the route can show the real reason.
  const text = await complete(
    mediatorSystem("Claude"),
    userMessage(prompt, collectImages(input.contributions)),
  );
  return text || null;
}

// Classify a posted message into one of the five dimensions, so people can just
// write and Claude organizes the conversation. Returns null if AI is off or the
// answer isn't a known dimension (caller keeps the provisional label).
export async function classifyDimension(input: {
  title: string;
  content: string;
  text: string;
}): Promise<string | null> {
  if (!aiConfigured()) return null;
  try {
    const prompt = [
      `SEED (the question): ${input.title}`,
      input.content.trim() ? `FRAMING: ${input.content.trim()}` : "",
      `\nMESSAGE:\n"${input.text}"`,
      `\nWhich single dimension best fits this message?`,
    ]
      .filter(Boolean)
      .join("\n");
    const out = await complete(
      "You classify a message in a Rhyza discussion into exactly one of five dimensions. " +
        "Definitions — foundations: why the topic exists, core ideas, assumptions, definitions. " +
        "understanding: mental models, analogies, how to think about it. " +
        "application: how it's used in practice, real examples, implementation, recommendations. " +
        "debate: trade-offs, disagreements, counter-arguments, where it breaks down. " +
        "bloom: a distilled conclusion or the community's settled answer. " +
        "Reply with ONLY one word: foundations, understanding, application, debate, or bloom.",
      prompt,
      12,
    );
    const k = out.trim().toLowerCase().replace(/[^a-z]/g, "");
    return ["foundations", "understanding", "application", "debate", "bloom"].includes(k)
      ? k
      : null;
  } catch (err) {
    console.error("classifyDimension failed", err);
    return null;
  }
}

// Does this text tag Claude? Matches "@claude" as a whole word, case-insensitive.
export function mentionsClaude(text: string): boolean {
  return /(^|[^a-zA-Z0-9])@claude\b/i.test(text);
}

// ─────────────────────────────────────────────────────────────
// ChatGPT (OpenAI) — a second AI participant alongside Claude. Gated behind
// OPENAI_API_KEY exactly like Claude: when unset, @chatgpt mentions go
// unanswered and nothing else changes.
// ─────────────────────────────────────────────────────────────

export function openaiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function getOpenAI(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI();
  return openaiClient;
}

// Does this text tag ChatGPT? Matches @chatgpt / @openai / @gpt.
export function mentionsChatGpt(text: string): boolean {
  return /(^|[^a-zA-Z0-9])@(chatgpt|openai|gpt)\b/i.test(text);
}

// Build an OpenAI user message, attaching images as vision parts when present.
function openaiUserContent(
  text: string,
  images: string[],
): string | OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  if (images.length === 0) return text;
  return [
    { type: "text", text },
    ...images.map(
      (url): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
        type: "image_url",
        image_url: { url },
      }),
    ),
  ];
}

// ChatGPT's reply when a member tags @chatgpt. Returns null if AI isn't
// configured or the reply is empty; THROWS on API error so the route can show
// the real reason (mirrors claudeReply).
export async function chatgptReply(input: {
  title: string;
  content: string;
  dimension: string;
  mention: string;
  contributions: ContribForAI[];
}): Promise<string | null> {
  if (!openaiConfigured()) return null;
  const dim = DIMENSION_LABEL[input.dimension] ?? input.dimension;
  const prompt = [
    `SEED: ${input.title}`,
    input.content.trim() ? `\nFRAMING:\n${input.content.trim()}` : "",
    `\nCONVERSATION SO FAR:\n${renderThread(input.contributions)}`,
    `\nYou were tagged in the "${dim}" dimension. The message tagging you:\n"${input.mention}"`,
    `\nReply as a participant.`,
  ]
    .filter(Boolean)
    .join("\n");

  const resp = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are ChatGPT, a thoughtful participant in a Rhyza learning conversation — a " +
          "collaborative knowledge garden where members explore a topic together. Someone tagged " +
          "you with @chatgpt. Answer their question or add genuinely useful, specific insight " +
          "grounded in the discussion so far (including any images shown). Don't just repeat what's " +
          "been said. Be concise (1–3 short paragraphs), warm, and direct. Output only your reply — " +
          "no greeting like 'Sure!', no sign-off, and don't refer to yourself in the third person.",
      },
      { role: "user", content: openaiUserContent(prompt, collectImages(input.contributions)) },
    ],
  });
  const text = resp.choices[0]?.message?.content?.trim() ?? "";
  return text || null;
}

// ChatGPT as neutral mediator (mirrors mediate). Returns null if not configured
// or empty; throws on API error.
export async function openaiMediate(input: {
  title: string;
  content: string;
  contributions: ContribForAI[];
}): Promise<string | null> {
  if (!openaiConfigured()) return null;
  const resp = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: mediatorSystem("ChatGPT") },
      {
        role: "user",
        content: openaiUserContent(mediatePrompt(input), collectImages(input.contributions)),
      },
    ],
  });
  return resp.choices[0]?.message?.content?.trim() || null;
}
