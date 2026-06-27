import { z } from "zod";
import { DIMENSION_KEYS, STAGE_KEYS } from "@/lib/constants";

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

export const attachmentSchema = z.object({
  url: z.string().url().max(2000),
  type: z.enum(["image", "video", "file"]),
  name: z.string().max(200).optional(),
});

export const createContributionSchema = z
  .object({
    dimension: z.enum(DIMENSION_KEYS as [string, ...string[]]),
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
