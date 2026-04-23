export {
  IDENTITY_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ADDRESS,
  CONTRACT_ADDRESSES,
  type SupportedChainId,
} from './addresses'

export {
  SUPPORTED_CHAINS,
  DEFAULT_CHAIN_ID,
  BLOCK_EXPLORER_URL,
  TX_EXPLORER_URL,
  ADDRESS_EXPLORER_URL,
  type SupportedChain,
} from './chains'

export {
  SUPPORTED_TOKENS,
  getTokenBySymbol,
  getTokenByAddress,
  listTokens,
  type TokenInfo,
  type SupportedTokenChainId,
} from './tokens'

export {
  CHAINLINK_FEEDS,
  getFeed,
  chainlinkAggregatorV3Abi,
  type ChainlinkFeed,
  type ChainlinkFeedChainId,
} from './chainlink-feeds'

/** Maximum number of tags per agent */
export const MAX_TAGS = 10

/** Maximum length of an agent URI */
export const MAX_URI_LENGTH = 2048

/** Maximum length of a single tag */
export const MAX_TAG_LENGTH = 32

/** IPFS gateway base URL */
export const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

/** ERC-8004 registration file type identifier */
export const ERC8004_REGISTRATION_TYPE =
  'https://eips.ethereum.org/EIPS/eip-8004#registration-v1' as const
