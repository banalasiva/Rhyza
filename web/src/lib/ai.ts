// Claude integration for ThinkThru. Two jobs:
//   1. synthesizeBloom() — distill a seed's whole thread into the durable summary
//      when it blooms.
//   2. claudeReply() — answer when a member tags @claude inside a conversation.
//
// Everything here is gated behind aiConfigured(): if ANTHROPIC_API_KEY is unset
// the app still works (the bloom falls back to a deterministic summary, and
// @claude mentions simply don't get a reply).

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { STAGE_KEYS } from "@/lib/constants";

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

// A web source the AI actually cited — the durable, checkable material that
// makes a reply trustworthy enough to carry into a bloom.
export type Source = { url: string; title: string };

// The latest server-side web search tool (dynamic filtering), supported on
// Opus 4.8. The model decides when to reach for it; we just make it available.
const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20260209 = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 5,
};

// Collect the unique web pages Claude cited, in first-seen order, capped.
function citedSources(msg: Anthropic.Message, cap = 6): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const block of msg.content) {
    if (block.type !== "text" || !block.citations) continue;
    for (const c of block.citations) {
      if (c.type !== "web_search_result_location") continue;
      if (seen.has(c.url)) continue;
      seen.add(c.url);
      out.push({ url: c.url, title: (c.title || c.url).trim() });
      if (out.length >= cap) return out;
    }
  }
  return out;
}

// One Claude completion WITH web search available, so @claude can answer
// questions about the current, real world (today's prices, what's open near
// someone, recent events). Returns the prose plus whatever it cited. THROWS on
// API error like complete().
async function completeSearched(
  system: string,
  prompt: string | Anthropic.ContentBlockParam[],
  maxTokens = 1536,
): Promise<{ text: string; sources: Source[] }> {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [WEB_SEARCH_TOOL],
  });
  const msg = await stream.finalMessage();
  return { text: textFromMessage(msg), sources: citedSources(msg) };
}

// Render cited sources as a compact footer appended to an AI reply. Empty when
// nothing was searched, so non-search replies look exactly as before.
export function sourcesFooter(sources: Source[]): string {
  if (sources.length === 0) return "";
  const lines = sources.map((s) => `- [${s.title}](${s.url})`);
  return `\n\nSources:\n${lines.join("\n")}`;
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
      "You are the synthesis engine for ThinkThru, a collaborative learning garden. " +
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
  // thread are attached as vision blocks so Claude can actually see them. Web
  // search is available so questions about the current, real world (today's
  // prices, what's open nearby, recent events) get a real answer instead of "I
  // can't access that" — the model decides when to search.
  const { text, sources } = await completeSearched(
    "You are Claude, a thoughtful participant in a ThinkThru learning conversation — a " +
      "collaborative knowledge garden where members explore a topic together. Someone " +
      "tagged you with @claude. Answer their question or add genuinely useful, specific " +
      "insight grounded in the discussion so far (including any images shown). Don't just " +
      "repeat what's been said. You have a web_search tool: whenever the question is about " +
      "specific places, shops, businesses, prices, products, availability, addresses, or " +
      "anything local, recent, or real-world (e.g. 'names and locations of stores near X'), " +
      "you MUST search the web first and answer with concrete specifics — real names, " +
      "neighbourhoods, and links — not generic advice like 'try Google Maps'. Be concise " +
      "(1–3 short paragraphs), warm, and direct. Output only your reply — no greeting like " +
      "'Sure!', no sign-off, and don't refer to yourself in the third person.",
    userMessage(prompt, collectImages(input.contributions)),
  );
  if (!text) return null;
  return text + sourcesFooter(sources);
}

// Shared mediator brief, parameterised by which AI is speaking.
function mediatorSystem(name: string): string {
  return (
    `You are ${name}, acting as a neutral mediator in a ThinkThru discussion where ` +
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
      "You classify a message in a ThinkThru discussion into exactly one of five dimensions. " +
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

// Build the Responses-API input for a single user turn, attaching images as
// input_image parts when present. The Responses API (not chat.completions) is
// what carries the web_search tool, so the @chatgpt reply path uses it.
function openaiResponseInput(
  text: string,
  images: string[],
): OpenAI.Responses.ResponseInput {
  const parts: OpenAI.Responses.ResponseInputContent[] = [
    { type: "input_text", text },
    ...images.map(
      (url): OpenAI.Responses.ResponseInputContent => ({
        type: "input_image",
        image_url: url,
        detail: "auto",
      }),
    ),
  ];
  return [{ role: "user", content: parts }];
}

// Collect the web pages ChatGPT cited (url_citation annotations on its output
// text), unique and capped — the OpenAI mirror of citedSources().
function openaiCitedSources(resp: OpenAI.Responses.Response, cap = 6): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const item of resp.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const a of part.annotations) {
        if (a.type !== "url_citation") continue;
        if (seen.has(a.url)) continue;
        seen.add(a.url);
        out.push({ url: a.url, title: (a.title || a.url).trim() });
        if (out.length >= cap) return out;
      }
    }
  }
  return out;
}

// ChatGPT's reply when a member tags @chatgpt. Returns null if AI isn't
// configured or the reply is empty; THROWS on API error so the route can show
// the real reason (mirrors claudeReply). Uses the Responses API with web search
// so @chatgpt can answer current/real-world questions the way the consumer app
// can, and surfaces the sources it used.
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

  const system =
    "You are ChatGPT, a thoughtful participant in a ThinkThru learning conversation — a " +
    "collaborative knowledge garden where members explore a topic together. Someone tagged " +
    "you with @chatgpt. Answer their question or add genuinely useful, specific insight " +
    "grounded in the discussion so far (including any images shown). Don't just repeat what's " +
    "been said. You have a web search tool: whenever the question is about specific places, " +
    "shops, businesses, prices, products, availability, addresses, or anything local, recent, " +
    "or real-world (e.g. 'names and locations of stores near X'), you MUST search the web first " +
    "and answer with concrete specifics — real names, neighbourhoods, and links — not generic " +
    "advice like 'try Google Maps'. Be concise (1–3 short paragraphs), warm, and direct. Output " +
    "only your reply — no greeting like 'Sure!', no sign-off, and don't refer to yourself in the third person.";
  const images = collectImages(input.contributions);

  try {
    const resp = await getOpenAI().responses.create({
      model: OPENAI_MODEL,
      instructions: system,
      input: openaiResponseInput(prompt, images),
      tools: [{ type: "web_search" }],
    });
    const text = resp.output_text.trim();
    if (text) return text + sourcesFooter(openaiCitedSources(resp));
  } catch (err) {
    // Some OpenAI models don't support the Responses web_search tool. Rather
    // than leave the mention unanswered, fall back to a plain reply below.
    console.error("chatgptReply web search failed, falling back", err);
  }

  const resp = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: openaiUserContent(prompt, images) },
    ],
  });
  const text = resp.choices[0]?.message?.content?.trim() ?? "";
  return text || null;
}

// Warm, personal copy for an impact-moment email — written by Claude or
// ChatGPT so "your thought took root" reads like a real human noticing, not a
// templated alert. Returns { heading, intro } or null (caller uses static copy
// when AI is off or the call fails). Kept short and gated, so it's cheap.
export async function composeImpactCopy(
  provider: "claude" | "chatgpt",
  input: {
    kind: "bloom" | "endorsement";
    recipientName: string;
    seedTitle: string;
    actorName?: string;
    snippet?: string;
  },
): Promise<{ heading: string; intro: string } | null> {
  const who = provider === "chatgpt" ? "ChatGPT" : "Claude";
  const moment =
    input.kind === "bloom"
      ? `A seed they helped grow, "${input.seedTitle}", just bloomed into durable knowledge in the Sacred Tree. Their contribution mattered to the outcome.`
      : `${input.actorName || "Someone"} marked their contribution in "${input.seedTitle}" as genuinely valuable${
          input.snippet ? ` — the point was: "${input.snippet}"` : ""
        }. They were understood.`;
  const system =
    `You are ${who}, writing a tiny, heartfelt notification email for ThinkThru — a garden ` +
    `where people grow ideas into shared knowledge. Celebrate the person's real impact ` +
    `without flattery or hype. Warm, specific, human. No emojis, no exclamation spam. ` +
    `Reply in exactly two lines:\nHEADING: <max 8 words>\nINTRO: <1–2 warm sentences to ${
      input.recipientName || "them"
    }>`;
  const prompt = `The moment: ${moment}\nWrite the heading and intro.`;

  try {
    let text = "";
    if (provider === "chatgpt") {
      if (!openaiConfigured()) return null;
      const resp = await getOpenAI().chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });
      text = resp.choices[0]?.message?.content ?? "";
    } else {
      if (!aiConfigured()) return null;
      text = await complete(system, prompt, 200);
    }
    const heading = text.match(/HEADING:\s*(.+)/i)?.[1]?.trim().slice(0, 80);
    const intro = text.match(/INTRO:\s*([\s\S]+)/i)?.[1]?.trim().replace(/\s+/g, " ").slice(0, 400);
    if (!heading || !intro) return null;
    return { heading, intro };
  } catch (err) {
    console.error("composeImpactCopy failed", err);
    return null;
  }
}

// On-demand summary of a whole discussion, organised by dimension — so people
// don't navigate dimension tabs themselves; they ask an AI to lay the thread
// out for them. Read-only (never posted). Returns null if the provider isn't
// configured; throws on API error so the route can surface the real reason.
export async function summarizeThread(
  provider: "claude" | "chatgpt",
  input: { title: string; content: string; contributions: ContribForAI[] },
): Promise<string | null> {
  const who = provider === "chatgpt" ? "ChatGPT" : "Claude";
  const system =
    `You are ${who}, catching someone up on a ThinkThru discussion fast. Read the whole ` +
    "thread and distill it — accurate to what was actually said, never invented. Lay it out " +
    "under these labels, but include a label ONLY if there's real content for it:\n" +
    "**Foundations** — what's really being asked and the assumptions in play.\n" +
    "**Understanding** — the mental models and framings people are using.\n" +
    "**In practice** — concrete examples, applications, or recommendations raised.\n" +
    "**Open debate** — the genuine disagreements and trade-offs still live.\n" +
    "**Where it stands** — one line on how close the group is to a decision.\n" +
    "Use the exact **bold** labels above, each followed by 1–3 tight sentences. No preamble, " +
    "no 'Here is' — output only the summary.";
  const prompt = [
    `SEED: ${input.title}`,
    input.content.trim() ? `\nFRAMING:\n${input.content.trim()}` : "",
    `\nTHE DISCUSSION:\n${renderThread(input.contributions)}`,
    `\nSummarize.`,
  ]
    .filter(Boolean)
    .join("\n");
  const images = collectImages(input.contributions);

  if (provider === "chatgpt") {
    if (!openaiConfigured()) return null;
    const resp = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: openaiUserContent(prompt, images) },
      ],
    });
    return resp.choices[0]?.message?.content?.trim() || null;
  }
  if (!aiConfigured()) return null;
  const text = await complete(system, userMessage(prompt, images), 700);
  return text || null;
}

// An AI casts its read on how mature the discussion is — a real quorum vote.
// Returns { stage, note } or null if that provider isn't configured / failed.
const STAGE_GUIDE =
  "seed: just asked, no real exploration yet. " +
  "germinating: early, scattered exploration. " +
  "sprouting: ideas taking shape, some structure. " +
  "growing: substantial discussion, the group is converging. " +
  "bloomed: genuinely converged — ready to be finalised into a durable answer.";

export async function aiStageVote(
  provider: "claude" | "chatgpt",
  input: { title: string; content: string; contributions: ContribForAI[] },
): Promise<{ stage: string; note: string } | null> {
  const who = provider === "chatgpt" ? "ChatGPT" : "Claude";
  const system =
    `You are ${who}, a member of a ThinkThru decision circle casting your honest read on how ` +
    `mature this discussion is. The growth stages — ${STAGE_GUIDE} ` +
    `Only say "bloomed" if the group has actually converged enough to finalise. ` +
    `Reply in exactly two lines:\nSTAGE: <seed|germinating|sprouting|growing|bloomed>\nWHY: <one sentence>`;
  const prompt = [
    `SEED: ${input.title}`,
    input.content.trim() ? `\nFRAMING:\n${input.content.trim()}` : "",
    `\nTHE DISCUSSION:\n${renderThread(input.contributions)}`,
    `\nWhat stage is this, and why?`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    let text = "";
    if (provider === "chatgpt") {
      if (!openaiConfigured()) return null;
      const resp = await getOpenAI().chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });
      text = resp.choices[0]?.message?.content ?? "";
    } else {
      if (!aiConfigured()) return null;
      text = await complete(system, prompt, 200);
    }

    const tagged = text.match(/STAGE:\s*(seed|germinating|sprouting|growing|bloomed)/i);
    const loose = text.match(/seed|germinating|sprouting|growing|bloomed/i);
    const stage = (tagged?.[1] ?? loose?.[0] ?? "").toLowerCase();
    if (!(STAGE_KEYS as string[]).includes(stage)) return null;
    const why = text.match(/WHY:\s*(.+)/i)?.[1] ?? "";
    const note = (why || "Based on where the discussion stands.").trim().slice(0, 240);
    return { stage, note };
  } catch (err) {
    console.error("aiStageVote failed", err);
    return null;
  }
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
