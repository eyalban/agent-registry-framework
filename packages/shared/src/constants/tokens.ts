/**
 * Whitelisted tokens per chain.
 *
 * `address === null` denotes the chain's native token (ETH on Base / Base Sepolia).
 * Only listed tokens appear in financial statements. To add a token, list its
 * on-chain address, decimals, and (optionally) its Chainlink USD feed in
 * `chainlink-feeds.ts`.
 */

export interface TokenInfo {
  address: `0x${string}` | null
  symbol: string
  decimals: number
  isNative: boolean
  coingeckoId: string
}

export const SUPPORTED_TOKENS = {
  84532: {
    ETH: {
      address: null,
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
      coingeckoId: 'ethereum',
    },
    USDC: {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      decimals: 6,
      isNative: false,
      coingeckoId: 'usd-coin',
    },
  },
  8453: {
    ETH: {
      address: null,
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
      coingeckoId: 'ethereum',
    },
    USDC: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      decimals: 6,
      isNative: false,
      coingeckoId: 'usd-coin',
    },
  },
} as const satisfies Record<number, Record<string, TokenInfo>>

export type SupportedTokenChainId = keyof typeof SUPPORTED_TOKENS

export function getTokenBySymbol(
  chainId: number,
  symbol: string,
): TokenInfo | undefined {
  const chain = SUPPORTED_TOKENS[chainId as SupportedTokenChainId]
  if (!chain) return undefined
  return (chain as Record<string, TokenInfo>)[symbol]
}

export function getTokenByAddress(
  chainId: number,
  address: string | null,
): TokenInfo | undefined {
  const chain = SUPPORTED_TOKENS[chainId as SupportedTokenChainId]
  if (!chain) return undefined
  const lower = address?.toLowerCase() ?? null
  for (const token of Object.values(chain) as TokenInfo[]) {
    if (token.address === null && lower === null) return token
    if (token.address && lower && token.address.toLowerCase() === lower) return token
  }
  return undefined
}

export function listTokens(chainId: number): TokenInfo[] {
  const chain = SUPPORTED_TOKENS[chainId as SupportedTokenChainId]
  if (!chain) return []
  return Object.values(chain) as TokenInfo[]
}
