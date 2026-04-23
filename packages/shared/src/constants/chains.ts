/**
 * Supported blockchain network configurations.
 */

export const SUPPORTED_CHAINS = {
  84532: {
    id: 84532,
    name: 'Base Sepolia',
    network: 'base-sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    isTestnet: true,
  },
  8453: {
    id: 8453,
    name: 'Base',
    network: 'base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    isTestnet: false,
  },
} as const

export type SupportedChain = (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS]

export const DEFAULT_CHAIN_ID = 84532

export const BLOCK_EXPLORER_URL = (chainId: number): string => {
  const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS]
  return chain?.blockExplorer ?? 'https://sepolia.basescan.org'
}

export const TX_EXPLORER_URL = (chainId: number, txHash: string): string =>
  `${BLOCK_EXPLORER_URL(chainId)}/tx/${txHash}`

export const ADDRESS_EXPLORER_URL = (chainId: number, address: string): string =>
  `${BLOCK_EXPLORER_URL(chainId)}/address/${address}`
