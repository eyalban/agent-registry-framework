/**
 * Contract addresses for each supported network.
 * Canonical ERC-8004 contracts are deterministically deployed across chains.
 * The wrapper contract address is network-specific and set via env vars.
 */

export const IDENTITY_REGISTRY_ADDRESS =
  '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const

export const REPUTATION_REGISTRY_ADDRESS =
  '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const

export const CONTRACT_ADDRESSES = {
  84532: {
    identityRegistry: IDENTITY_REGISTRY_ADDRESS,
    reputationRegistry: REPUTATION_REGISTRY_ADDRESS,
    wrapper: (process.env.NEXT_PUBLIC_WRAPPER_ADDRESS ?? '0x') as `0x${string}`,
    companyRegistry: (process.env.NEXT_PUBLIC_COMPANY_REGISTRY_ADDRESS ??
      '0x') as `0x${string}`,
    invoiceRegistry: (process.env.NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS ??
      '0x') as `0x${string}`,
  },
  8453: {
    identityRegistry: IDENTITY_REGISTRY_ADDRESS,
    reputationRegistry: REPUTATION_REGISTRY_ADDRESS,
    wrapper: (process.env.NEXT_PUBLIC_WRAPPER_ADDRESS ?? '0x') as `0x${string}`,
    companyRegistry: (process.env.NEXT_PUBLIC_COMPANY_REGISTRY_ADDRESS ??
      '0x') as `0x${string}`,
    invoiceRegistry: (process.env.NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS ??
      '0x') as `0x${string}`,
  },
} as const satisfies Record<
  number,
  {
    identityRegistry: `0x${string}`
    reputationRegistry: `0x${string}`
    wrapper: `0x${string}`
    companyRegistry: `0x${string}`
    invoiceRegistry: `0x${string}`
  }
>

export type SupportedChainId = keyof typeof CONTRACT_ADDRESSES
