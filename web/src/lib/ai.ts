// Claude integration for Rhyza. Two jobs:
//   1. synthesizeBloom() — distill a seed's whole thread into the durable summary
//      when it blooms.
//   2. claudeReply() — answer when a member tags @claude inside a conversation.
//
// Everything here is gated behind aiConfigured(): if ANTHROPIC_API_KEY is unset
// the app still works (the bloom falls back to a deterministic summary, and
// @claude mentions simply don't get a reply).

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;

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

export type ContribForAI = {
  dimension: string;
  author: string;
  text: string;
};

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
      return `[${dim}] ${c.author}: ${c.text}`;
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

    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You are the synthesis engine for Rhyza, a collaborative learning garden. " +
        "A 'seed' is a question the community explores across five dimensions " +
        "(Foundations, Understanding, Application, Debate, Bloom). When a seed blooms, " +
        "you distill the entire thread into one durable summary capturing the collective " +
        "understanding — accurate to what was actually said, weaving the strongest points " +
        "together and noting genuine open debates. Write in clear, warm, encyclopedic prose: " +
        "2–4 short paragraphs. No headings, no preamble, no 'Here is' — output only the summary.",
      messages: [{ role: "user", content: prompt }],
    });
    const msg = await stream.finalMessage();
    const text = textFromMessage(msg);
    return text || null;
  } catch (err) {
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
  try {
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

    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You are Claude, a thoughtful participant in a Rhyza learning conversation — a " +
        "collaborative knowledge garden where members explore a topic together. Someone " +
        "tagged you with @claude. Answer their question or add genuinely useful, specific " +
        "insight grounded in the discussion so far. Don't just repeat what's been said. " +
        "Be concise (1–3 short paragraphs), warm, and direct. Output only your reply — no " +
        "greeting like 'Sure!', no sign-off, and don't refer to yourself in the third person.",
      messages: [{ role: "user", content: prompt }],
    });
    const msg = await stream.finalMessage();
    const text = textFromMessage(msg);
    return text || null;
  } catch (err) {
    console.error("claudeReply failed", err);
    return null;
  }
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
  try {
    const prompt = [
      `SEED: ${input.title}`,
      input.content.trim() ? `\nFRAMING:\n${input.content.trim()}` : "",
      `\nTHE DISCUSSION:\n${renderThread(input.contributions)}`,
      `\nMediate.`,
    ]
      .filter(Boolean)
      .join("\n");

    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You are Claude, acting as a neutral mediator in a Rhyza discussion where " +
        "people may disagree. Your job is conflict resolution: (1) briefly and fairly " +
        "restate the main positions without taking sides, (2) name the genuine points of " +
        "tension, (3) surface the common ground people actually share, and (4) propose a " +
        "concrete, even-handed path forward (or a synthesis both sides could accept). Be " +
        "warm, balanced, and specific. Never declare a winner. Keep it tight — a few short " +
        "paragraphs or compact bullets. Output only the mediation.",
      messages: [{ role: "user", content: prompt }],
    });
    const msg = await stream.finalMessage();
    const text = textFromMessage(msg);
    return text || null;
  } catch (err) {
    console.error("mediate failed", err);
    return null;
  }
}

// Does this text tag Claude? Matches "@claude" as a whole word, case-insensitive.
export function mentionsClaude(text: string): boolean {
  return /(^|[^a-zA-Z0-9])@claude\b/i.test(text);
}
