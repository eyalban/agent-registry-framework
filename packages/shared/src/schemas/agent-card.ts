import { z } from 'zod'

import { ERC8004_REGISTRATION_TYPE } from '../constants'

const serviceTypeSchema = z.enum(['a2a', 'mcp', 'oasf', 'ens', 'did', 'email', 'custom'])

const agentServiceSchema = z.object({
  type: serviceTypeSchema,
  url: z.url(),
  description: z.string().optional(),
})

const trustModelSchema = z.object({
  type: z.string().min(1),
  details: z.string().optional(),
})

const onChainRegistrationSchema = z.object({
  chainId: z.number().int().positive(),
  registryAddress: z.string().min(1),
  agentId: z.string().min(1),
})

/**
 * Zod schema for ERC-8004 Agent Registration File ("Agent Card").
 * Used to validate agent card JSON fetched from IPFS or any URI.
 */
export const agentCardSchema = z.object({
  type: z.literal(ERC8004_REGISTRATION_TYPE),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  image: z.url(),
  services: z.array(agentServiceSchema).optional(),
  x402Support: z.boolean().optional(),
  active: z.boolean().optional(),
  registrations: z.array(onChainRegistrationSchema).optional(),
  supportedTrust: z.array(trustModelSchema).optional(),
})

export type AgentCardInput = z.input<typeof agentCardSchema>
export type AgentCardOutput = z.output<typeof agentCardSchema>
