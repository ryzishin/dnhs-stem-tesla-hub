// src/validations/index.js
// v2-P1-4: Zod schemas for every POST/PUT/PATCH route.
// Use via the validate() middleware in src/middleware/validate.js.
import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(128),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_.-]+$/, "Username must be 3–20 chars (letters, digits, _, ., -)"),
  name: z.string().min(1).max(60),
  password: z.string().min(6).max(128),
  confirm: z.string().optional(),
});

export const createFlashcardSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(2000),
  unit_id: z.string().optional(),
  image_url: z.union([z.string().url(), z.literal("")]).optional(),
});

export const updateFlashcardSchema = createFlashcardSchema.partial();

export const createQuizSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  kind: z.enum(["practice", "live"]).default("practice"),
  unit_id: z.string().optional(),
  shuffle_items: z.boolean().default(true),
  shuffle_options: z.boolean().default(true),
  time_limit_min: z.number().int().min(1).max(180).optional(),
  deadline: z.string().optional(),
  mastery_mode: z.boolean().default(false), // v3-P1-4
});

export const updateQuizSchema = createQuizSchema.partial();

export const createQuizItemSchema = z.object({
  type: z.enum(["multiple_choice", "true_false", "identification", "open_ended"]),
  question: z.string().min(1).max(1000),
  image_url: z.union([z.string().url(), z.literal("")]).optional(),
  correct_answer: z.string().max(500).optional(),
  explanation: z.string().max(1000).optional(),
  points: z.number().int().min(1).max(10).default(1),
  options: z.array(z.object({
    text: z.string().min(1).max(500),
    image_url: z.union([z.string().url(), z.literal("")]).optional(),
    is_correct: z.boolean(),
  })).optional(),
});

export const promoteSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["student", "moderator", "administrator"]),
});

export const settingsSchema = z.object({
  anti_cheat: z.object({
    blockTabSwitch: z.boolean(),
    requireFullscreen: z.boolean(),
    blockCopy: z.boolean(),
    blockRightClick: z.boolean(),
    maxWarnings: z.number().int().min(1).max(10),
  }),
  time_limit_min: z.number().int().min(1).max(180).optional(),
  quiz_id: z.string().optional(),
});

export const startSessionSchema = z.object({
  quizId: z.string().min(1),
});

export const advanceItemSchema = z.object({
  itemIndex: z.number().int().min(0),
});

export const flashcardReviewSchema = z.object({
  cardId: z.string().min(1),
});

// v3-P1-3: Graded review — student picks Again (1) or Got it (3).
// Hard (2) and Easy (4) are reserved for moderators/power-users (per spec D1).
export const reviewGradedSchema = z.object({
  cardId: z.string().min(1),
  grade: z.number().int().min(1).max(4),
});

// v3-P2-6: Password-reset request + reset.
export const forgotPasswordSchema = z.object({
  username: z.string().min(1).max(60),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  newPassword: z.string().min(6).max(128),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(60),
  bio: z.string().max(280).optional(),
  avatarColor: z.number().int().min(0).max(360).optional(),
  socials: z.object({
    twitter: z.string().max(60).optional(),
    instagram: z.string().max(60).optional(),
    github: z.string().max(60).optional(),
    facebook: z.string().max(60).optional(),
    tiktok: z.string().max(60).optional(),
    youtube: z.string().max(60).optional(),
    website: z.string().max(200).optional(),
  }).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
});
