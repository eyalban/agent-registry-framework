import { z } from 'zod'

/** Schema for agent list query parameters */
export const agentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tags: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .optional(),
  search: z.string().max(200).optional(),
  featured: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
  sortBy: z.enum(['registered', 'activity', 'reputation', 'name']).default('registered'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/** Schema for feedback input (canonical 8-param signature) */
export const giveFeedbackSchema = z.object({
  agentId: z.coerce.bigint(),
  value: z.number().min(-100).max(100),
  valueDecimals: z.number().int().min(0).max(18).default(0),
  tag1: z.string().max(64).default(''),
  tag2: z.string().max(64).default(''),
  endpoint: z.string().max(256).default(''),
  feedbackURI: z.string().optional(),
  feedbackHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
})

/** Schema for validation request input */
export const requestValidationSchema = z.object({
  agentId: z.coerce.bigint(),
  validatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  requestURI: z.url(),
  requestHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
})

/** Schema for API key creation */
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(50),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().min(1),
})

/** Schema for search query */
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})
