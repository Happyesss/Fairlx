import { z } from "zod";

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

export const singleBugSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be under 200 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must be under 5000 characters"),
  imageFileIds: z.array(z.string()).optional().default([]),
  imageUrls: z.array(z.string()).optional().default([]),
});

export const submitBugReportsSchema = z.object({
  bugs: z.array(singleBugSchema).min(1, "At least one bug report is required"),
});
