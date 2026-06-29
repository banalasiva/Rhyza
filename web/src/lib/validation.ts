import { z } from "zod";
import {
  DIMENSION_KEYS,
  STAGE_KEYS,
  STAKE_DIMENSION_KEYS,
  QUORUM_DIMENSION_KEYS,
  QUORUM_MAX_RANK,
} from "@/lib/constants";

export const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name is too short").max(80),
});

export const createGardenSchema = z.object({
  name: z.string().min(2, "Garden name is too short").max(80),
  description: z.string().max(500).optional(),
  emoji: z.string().max(8).optional(),
  visibility: z.enum(["public", "private"]).optional().default("public"),
});

export const visibilityEnum = z.enum(["public", "private"]);

export const createSeedSchema = z.object({
  title: z.string().min(4, "Give your seed a clear question").max(200),
  content: z.string().max(5000).optional().default(""),
  visibility: visibilityEnum.optional().default("public"),
});

export const setSeedVisibilitySchema = z.object({
  visibility: visibilityEnum,
});

// PATCH a seed: any of visibility, title, or framing (content). All optional so
// the same endpoint serves both the visibility toggle and the edit form.
export const patchSeedSchema = z
  .object({
    visibility: visibilityEnum.optional(),
    title: z.string().min(4, "Give your seed a clear question").max(200).optional(),
    content: z.string().max(5000).optional(),
  })
  .refine((d) => d.visibility !== undefined || d.title !== undefined || d.content !== undefined, {
    message: "Nothing to update",
  });

// Attachments are only ever our own Vercel Blob uploads. Pinning the host stops
// a crafted attachment URL from making the AI providers fetch arbitrary URLs
// server-side (SSRF) when the image is passed to them as a vision input.
function isUploadedFileUrl(u: string): boolean {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === "https:" && hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export const attachmentSchema = z.object({
  url: z.string().url().max(2000).refine(isUploadedFileUrl, "Attachments must be uploaded files"),
  type: z.enum(["image", "video", "file"]),
  name: z.string().max(200).optional(),
});

export const dimensionEnum = z.enum(DIMENSION_KEYS as [string, ...string[]]);

export const retagContributionSchema = z.object({
  dimension: dimensionEnum,
});

export const createContributionSchema = z
  .object({
    // Optional now: people just write, and Claude classifies the dimension after
    // posting. Defaults to a neutral provisional label until then.
    dimension: dimensionEnum.optional().default("understanding"),
    text: z.string().max(5000).optional().default(""),
    parentId: z.string().uuid().optional(),
    attachments: z.array(attachmentSchema).max(10).optional().default([]),
  })
  .refine((d) => d.text.trim().length > 0 || d.attachments.length > 0, {
    message: "Add a message or an attachment",
    path: ["text"],
  });

export const reactionSchema = z.object({
  reactionKey: z.string().min(1).max(40),
});

export const stageVoteSchema = z.object({
  stage: z.enum(STAGE_KEYS as [string, ...string[]]),
});

export const createBloomSchema = z.object({
  title: z.string().min(4).max(200),
  summary: z.string().min(1).max(5000),
});

export const editContributionSchema = z.object({
  text: z.string().min(1, "Contribution can't be empty").max(5000),
});

export const updateBloomSchema = z.object({
  title: z.string().min(4).max(200).optional(),
  summary: z.string().min(1).max(8000).optional(),
});

export const updateGardenSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  emoji: z.string().max(8).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

export const inviteSchema = z.object({
  // Optional: omit for a shareable link not tied to a specific person.
  email: z.string().email("Enter a valid email").max(200).optional(),
});

// ── Stake-weighted quorum ──
const stakeDimEnum = z.enum(STAKE_DIMENSION_KEYS as [string, ...string[]]);

export const submitStakeSchema = z.object({
  ratings: z
    .array(
      z.object({
        rateeId: z.string().uuid(),
        scores: z.record(stakeDimEnum, z.number().min(0).max(100)),
      }),
    )
    .max(50),
  submit: z.boolean().optional().default(false),
});

export const stakeConfigSchema = z.object({
  // Consensus action — set the active (non-N/A) dimensions.
  activeDimensions: z.array(stakeDimEnum).optional(),
  // Self action — opt in/out of carrying stake ("not required for me").
  optedOut: z.boolean().optional(),
  // Peer action — cross out (or un-cross) another participant.
  cross: z.object({ rateeId: z.string().uuid(), crossed: z.boolean() }).optional(),
  // Manager action — reveal the map early, or lock it for the bloom vote.
  phase: z.enum(["collecting", "revealed", "locked"]).optional(),
});

// ── Polls ──
export const createPollSchema = z.object({
  question: z.string().min(3, "Ask a clear question").max(300),
  options: z.array(z.string().min(1).max(200)).min(2, "Add at least two options").max(8),
  weightMode: z.enum(["equal", "stake"]).optional().default("equal"),
  attachments: z.array(attachmentSchema).max(6).optional().default([]),
});

export const pollVoteSchema = z.object({
  optionId: z.string().uuid(),
});

export const admissionVoteSchema = z.object({
  candidateId: z.string().uuid(),
  approve: z.boolean(),
});

export const aiActionSchema = z.object({
  provider: z.enum(["claude", "chatgpt"]),
});

export const seedMemberActionSchema = z.object({
  targetId: z.string().uuid(),
  action: z.enum(["promote", "demote", "remove"]),
});

// ── Quorum v2 ──
const quorumDimEnum = z.enum(QUORUM_DIMENSION_KEYS as [string, ...string[]]);

// Save/submit a weigh-in: dimension -> ordered list of people, best first.
export const quorumWeighInSchema = z.object({
  ballots: z.record(quorumDimEnum, z.array(z.string().uuid()).max(QUORUM_MAX_RANK)),
  submit: z.boolean().optional().default(false),
});

// Admin hardcode of a measurable dimension: userId -> non-negative share.
export const quorumHardcodeSchema = z.object({
  dimension: quorumDimEnum,
  shares: z.record(z.string().uuid(), z.number().min(0)).optional(),
  clear: z.boolean().optional().default(false),
});

export const quorumPhaseSchema = z.object({
  phase: z.enum(["collecting", "revealed", "locked"]),
});
