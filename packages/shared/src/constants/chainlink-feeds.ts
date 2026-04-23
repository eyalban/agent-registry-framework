/**
 * Chainlink AggregatorV3 price-feed addresses per chain.
 *
 * Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=base
 *
 * When a feed is unavailable on a chain (common on testnets), the price-oracle
 * helper falls back to CoinGecko historical API using the token's `coingeckoId`
 * from `tokens.ts`. We never fall back to assumed peg values — if neither
 * source returns a price, the caller is responsible for handling the null.
 */

export interface ChainlinkFeed {
  address: `0x${string}`
  decimals: number
  description: string
}

/**
 * Feed addresses verified on 2026-04 against the Chainlink docs.
 * `null` = no Chainlink feed available on this chain; use CoinGecko.
 */
export const CHAINLINK_FEEDS = {
  84532: {
    ETH_USD: null,
    USDC_USD: null,
  },
  8453: {
    ETH_USD: {
      address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
      decimals: 8,
      description: 'ETH / USD',
    },
    USDC_USD: {
      address: '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
      decimals: 8,
      description: 'USDC / USD',
    },
  },
} as const satisfies Record<number, Record<string, ChainlinkFeed | null>>

export type ChainlinkFeedChainId = keyof typeof CHAINLINK_FEEDS

export function getFeed(
  chainId: number,
  pair: 'ETH_USD' | 'USDC_USD',
): ChainlinkFeed | null {
  const chain = CHAINLINK_FEEDS[chainId as ChainlinkFeedChainId]
  if (!chain) return null
  return chain[pair]
}

/**
 * Chainlink AggregatorV3Interface ABI (just the functions we need).
 * See https://docs.chain.link/data-feeds/api-reference
 */
export const chainlinkAggregatorV3Abi = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint80', name: '_roundId', type: 'uint80' }],
    name: 'getRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const
