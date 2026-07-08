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

// Claude model — Sonnet 4.6 is the cost-effective default for these
// conversational, mediation, and classification tasks (~40% cheaper than Opus,
// with a small quality gap on this kind of work). Overridable via env so
// switching back to Opus is a config change, not a code edit.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
// A cheaper, faster model for the high-frequency, low-stakes internal tasks
// (dimension classification on every message, topic tagging, quick
// observations). ~5× cheaper than Sonnet with ample quality for these. The
// user-facing reasoning (replies, mediation, blooms) stays on MODEL.
const MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5";
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
  model: string = MODEL,
): Promise<string> {
  const stream = getClient().messages.stream({
    model,
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
  // Capped: thread text is user-controlled and could try to steer the model into
  // many searches. Two keeps a searching reply reasonably fast (each Anthropic
  // search is a slow round-trip) while still answering real-world questions with
  // real links; pure-discussion replies don't search at all and stay fast.
  max_uses: 2,
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
      "repeat what's been said. You have a web_search tool — use it whenever a good answer needs " +
      "real, current, or specific outside facts the reader would actually want: products and " +
      "where to buy them, gift ideas, prices, shops or businesses and their locations, recent " +
      "events, or anything local or up-to-date. In those cases search and answer with concrete " +
      "specifics — real names, neighbourhoods, and clickable links — never vague advice like " +
      "'try Google Maps'. Skip searching only for pure discussion, opinions, or reasoning that " +
      "needs no outside facts. Never mention searching, the tool, or any limits in your reply; " +
      "if a search finds nothing, just answer as best you can. Be concise " +
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
      MODEL_FAST,
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

// One grounded observation about a person's thinking in an "Understand together"
// thread — Claude as a *spotter* of real human contribution, not an explainer.
export type LearningMoment = {
  person: string; // an actual participant's name
  kind: string; // which strength it shows, e.g. "Opened it up"
  quote: string; // a short, real quote/paraphrase from their contribution
  note: string; // one line on why it mattered
};

// Read an Understand-together thread and surface the human moments that opened
// it up / made it click / showed real understanding — attributed by name and
// grounded in what was ACTUALLY said. Deliberately NOT an explainer (that's a
// commodity) and deliberately NOT a flatterer: it must quote real text, and it's
// told to return fewer — or none — rather than manufacture praise. Best-effort:
// returns [] if AI is off, nothing genuine stands out, or anything fails.
export async function spotLearningMoments(input: {
  title: string;
  content: string;
  contributions: ContribForAI[];
  participants: string[];
}): Promise<LearningMoment[]> {
  if (!aiConfigured() || input.contributions.length === 0) return [];
  try {
    const prompt = [
      `TOPIC: ${input.title}`,
      input.content.trim() ? `FRAMING: ${input.content.trim().slice(0, 600)}` : "",
      `\nPARTICIPANTS (attribute only to these exact names): ${input.participants.join(", ")}`,
      `\nTHE THREAD:\n${renderThread(input.contributions)}`,
      `\nReturn the genuine standout moments as a JSON array (max 5), each:`,
      `{"person":"<exact name>","kind":"Opened it up|Made it click|Really gets it|Leveling up|Lifted others","quote":"<short real quote or close paraphrase from their words>","note":"<one line on why it moved the group's understanding>"}`,
      `Return ONLY the JSON array. If nothing genuinely stands out, return [].`,
    ]
      .filter(Boolean)
      .join("\n");
    const out = await complete(
      "You are a careful observer of how a group thinks together — you spot the people whose " +
        "contributions actually moved everyone's understanding. You are NOT here to explain the " +
        "topic, and you are NOT here to make anyone feel good: empty praise is worse than silence. " +
        "Every moment you surface MUST be anchored to something the person really said (quote or close " +
        "paraphrase). Prefer fewer, truer moments over many. If a contribution was ordinary, leave it " +
        "out. Never invent a quote, never attribute to someone not listed. Output only a JSON array.",
      prompt,
      1024,
      MODEL_FAST,
    );
    const start = out.indexOf("[");
    const end = out.lastIndexOf("]");
    if (start === -1 || end === -1 || end < start) return [];
    const parsed: unknown = JSON.parse(out.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(input.participants);
    return parsed
      .filter(
        (m): m is LearningMoment =>
          !!m &&
          typeof m === "object" &&
          typeof (m as LearningMoment).person === "string" &&
          valid.has((m as LearningMoment).person) &&
          typeof (m as LearningMoment).quote === "string" &&
          (m as LearningMoment).quote.trim().length > 0,
      )
      .slice(0, 5)
      .map((m) => ({
        person: m.person,
        kind: typeof m.kind === "string" ? m.kind : "Stood out",
        quote: m.quote.trim().slice(0, 240),
        note: typeof m.note === "string" ? m.note.trim().slice(0, 200) : "",
      }));
  } catch (err) {
    console.error("spotLearningMoments failed", err);
    return [];
  }
}

// Parse Claude's newline list of topic labels into clean, de-duplicated,
// capped strings — strips bullets/numbering and trailing punctuation.
function parseTopicLines(out: string, cap: number): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const raw of out.split(/\r?\n/)) {
    const t = raw
      .replace(/^[\s\-*•\d.)]+/, "")
      .replace(/[.,;]+$/, "")
      .trim()
      .slice(0, 40);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(t);
    if (topics.length >= cap) break;
  }
  return topics;
}

// Infer the free-form topics a seed is about, so people browsing Explore can
// discover it. Claude names them naturally (no fixed taxonomy), reusing common
// wording so the same topic groups across seeds. Best-effort: returns [] if AI
// is off or anything fails — Explore still works untagged.
export async function inferSeedTopics(input: {
  title: string;
  content: string;
}): Promise<string[]> {
  if (!aiConfigured()) return [];
  try {
    const prompt = [
      `SEED (the question): ${input.title}`,
      input.content.trim() ? `FRAMING: ${input.content.trim().slice(0, 800)}` : "",
      `\nName the 1–4 topics this is about, as short labels people could browse by.`,
    ]
      .filter(Boolean)
      .join("\n");
    const out = await complete(
      "You tag a community discussion with 1–4 topics so people browsing can discover it. " +
        "Each topic is a short, natural label: 1–3 words, Title Case, concrete and human " +
        "(e.g. 'Weekend Travel', 'Personal Finance', 'Parenting', 'Home Renovation', 'Cooking'). " +
        "Choose only clearly-relevant topics — fewer is better than a loose fit. Reuse common, " +
        "obvious wording so the same topic groups across seeds. Output ONLY the labels, one per " +
        "line, no numbering, no extra text.",
      prompt,
      80,
      MODEL_FAST,
    );
    return parseTopicLines(out, 4);
  } catch (err) {
    console.error("inferSeedTopics failed", err);
    return [];
  }
}

// Split a block of prose into sentence-sized points — the fallback for when the
// model (or a legacy stored reflection) returns one paragraph instead of lines.
function splitIntoSentences(s: string): string[] {
  return s
    .split(/(?<=[.!?])\s+(?=["'“(]?[A-Z0-9])/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
}

// Parse a reflection into clean points, one per line — strips bullets/numbering,
// and if it arrives as a single long paragraph (model didn't break it up, or a
// legacy stored value), splits it into sentence-sized points. Caps each point's
// length and the number of points.
export function parseReflectionPoints(out: string, cap = 6): string {
  let lines = out
    .split(/\r?\n/)
    .map((raw) => raw.replace(/^[\s\-*•·–]+/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter((t) => t.length > 1);

  // One long block → break it into sentences so it's readable as points.
  if (lines.length <= 1) {
    const whole = lines[0] ?? out.trim();
    if (whole.length > 160) lines = splitIntoSentences(whole);
    else if (whole) lines = [whole];
    else lines = [];
  }

  return lines.map((t) => t.slice(0, 300)).slice(0, cap).join("\n");
}

// Infer the free-form topics a *person* is most involved in, from the titles of
// the seeds they've created and joined. Unlike inferSeedTopics (which maps to a
// fixed 14-key taxonomy for Explore discovery), this lets Claude group and name
// the areas naturally — the 10–20 concise topics that describe where someone
// actually spends their thinking here. Best-effort: returns [] if AI is off,
// there's nothing to read, or anything fails.
export async function inferPersonTopics(items: string[]): Promise<string[]> {
  const clean = items.map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!aiConfigured() || clean.length === 0) return [];
  try {
    const list = clean.map((s, i) => `${i + 1}. ${s.slice(0, 160)}`).join("\n");
    const prompt = [
      `Here are the questions/discussions this person has started or taken part in:`,
      list,
      `\nName the areas this person is most involved in, as short topic labels.`,
    ].join("\n");
    const out = await complete(
      "You read the questions and discussions a person takes part in on ThinkThru and name " +
        "the areas they're most involved in — as a person browsing their profile would want to " +
        "see them. Group naturally and merge near-duplicates; each label is 1–3 words, Title " +
        "Case, concrete and human (e.g. 'Family Trips', 'Home Renovation', 'Personal Finance', " +
        "'Parenting', 'Career Moves', 'Health', 'Cooking'). Return between 10 and 20 labels when " +
        "there's enough material, fewer if there genuinely isn't. Output ONLY the labels, one per " +
        "line, no numbering, no extra text.",
      prompt,
      400,
      MODEL_FAST,
    );
    return parseTopicLines(out, 20);
  } catch (err) {
    console.error("inferPersonTopics failed", err);
    return [];
  }
}

// One of a person's real messages, with just enough context to read how they
// engage: which seed it was in, which dimension, and what they said.
export type PersonMessage = { seedTitle: string; dimension: string; text: string };

// Write an honest, grounded reflection of HOW a person shows up in conversations
// — what they actually bring to the table — by reading their real messages. Not
// flattery and not a résumé: a mirror. It should name their real patterns (e.g.
// grounds discussions in concrete examples, asks the clarifying question, plays
// devil's advocate, bridges disagreements, brings data, tells the story) using
// what's actually in the text. Returns "" if AI is off, there's too little to go
// on, or anything fails.
export async function describeContributionStyle(
  name: string,
  messages: PersonMessage[],
): Promise<string> {
  const clean = messages.filter((m) => m.text.trim().length > 0).slice(0, 60);
  if (!aiConfigured() || clean.length < 3) return "";
  const first = (name || "This person").trim().split(/\s+/)[0];
  try {
    const body = clean
      .map((m, i) => {
        const dim = DIMENSION_LABEL[m.dimension] ?? m.dimension;
        return `${i + 1}. [in "${m.seedTitle}" · ${dim}] ${m.text.trim().slice(0, 400)}`;
      })
      .join("\n");
    const prompt = [
      `Here are ${clean.length} real messages ${first} has written across ThinkThru discussions:`,
      body,
      `\nWrite the points on how ${first} shows up and what they bring to the table.`,
    ].join("\n");
    const system =
      "You read a person's real messages across many group discussions and mirror HOW they show " +
      "up — what they actually bring to a conversation — as a short list of points. Ground every " +
      "point in what's really in their messages: do they bring concrete examples and specifics, " +
      "ask the clarifying question, challenge assumptions, find common ground, bring data or " +
      "sources, tell the human story, push for a decision, add warmth? Name genuine patterns and " +
      "strengths kindly. Do NOT flatter, do NOT invent traits the text doesn't support, do NOT " +
      `list topics (shown separately). Refer to the person as "${first}" (e.g. "${first} tends to…"). ` +
      "Write 3–5 short points, ONE PER LINE, each a single crisp sentence (~12–20 words). No " +
      "numbering, no bullet characters, no heading, no preamble — output only the points, one per line.";
    const text = await complete(system, prompt, 320, MODEL_FAST);
    return parseReflectionPoints(text);
  } catch (err) {
    console.error("describeContributionStyle failed", err);
    return "";
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

// Image model. dall-e-3 is the default because it works on any OpenAI account
// with no extra setup; gpt-image-1 (what the ChatGPT app uses — better quality)
// needs organisation verification, so switch to it via env once verified.
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";

// Does this message ask an AI to *make* a picture (rather than discuss one)?
// A verb of creation near an image noun — deliberately broad but anchored so a
// mention like "what do you think of this image" doesn't trigger a generation.
export function wantsImage(text: string): boolean {
  return /\b(draw|sketch|illustrate|generate|create|make|design|render|paint|imagine|show me)\b[^.?!\n]{0,40}\b(image|picture|photo|drawing|illustration|logo|art|artwork|design|visual|poster|icon|mockup|graphic|scene|wallpaper)\b/i.test(
    text,
  );
}

// Generate an image from a prompt. Returns a PNG buffer (uploadable to Blob) or
// null on failure — model-agnostic: reads b64 for gpt-image-1, or fetches the
// URL dall-e returns. THROWS are caught and logged, never surfaced raw.
export async function generateImage(prompt: string): Promise<Buffer | null> {
  if (!openaiConfigured() || !prompt.trim()) return null;
  try {
    const res = await getOpenAI().images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt: prompt.trim().slice(0, 900),
      size: "1024x1024",
      n: 1,
    });
    const item = res.data?.[0];
    if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
    if (item?.url) {
      const r = await fetch(item.url);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    }
    return null;
  } catch (err) {
    console.error("[ai] image generation failed", err);
    return null;
  }
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
    "been said. You have a web search tool — use it whenever a good answer needs real, current, " +
    "or specific outside facts the reader would actually want: products and where to buy them, " +
    "gift ideas, prices, shops or businesses and their locations, recent events, or anything " +
    "local or up-to-date. In those cases search and answer with concrete specifics — real names, " +
    "neighbourhoods, and clickable links — never vague advice like 'try Google Maps'. Skip " +
    "searching only for pure discussion, opinions, or reasoning that needs no outside facts. " +
    "Never mention searching, the tool, or any limits in your reply; if a search finds nothing, " +
    "just answer as best you can. Be concise " +
    "(1–3 short paragraphs), warm, and direct. Output " +
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
