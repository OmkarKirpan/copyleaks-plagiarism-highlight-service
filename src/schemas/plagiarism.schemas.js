const { z } = require("zod");

/**
 * Schema for scan submission request
 */
const SubmitScanSchema = z.object({
  text: z
    .string()
    .min(1, "Text is required")
    .max(100000, "Text must not exceed 100,000 characters")
    .trim(),
  options: z
    .object({
      sensitivityLevel: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .default(3)
        .describe("Sensitivity level for plagiarism detection (1-5)"),
      includeHtml: z.boolean().optional().default(true).describe("Include HTML in results"),
      expiration: z.string().optional().describe("Expiration time for scan results"),
    })
    .optional()
    .default({}),
});

/**
 * Schema for scan ID parameter
 */
const ScanIdParamSchema = z.object({
  scanId: z.string().min(1, "Scan ID is required"),
});

/**
 * Schema for result ID parameter
 */
const ResultIdParamSchema = z.object({
  scanId: z.string().min(1, "Scan ID is required"),
  resultId: z.string().min(1, "Result ID is required"),
});

/**
 * Schema for webhook status parameter
 */
const WebhookStatusParamSchema = z.object({
  status: z.enum(["completed", "error", "creditsChecked"]),
  scanId: z.string().min(1, "Scan ID is required"),
});

/**
 * Response schemas
 */
const ScanResponseSchema = z.object({
  scanId: z.string(),
  status: z.enum(["queued", "pending", "completed", "error"]),
  message: z.string().optional(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  requestId: z.string().optional(),
});

module.exports = {
  SubmitScanSchema,
  ScanIdParamSchema,
  ResultIdParamSchema,
  WebhookStatusParamSchema,
  ScanResponseSchema,
  ErrorResponseSchema,
};
