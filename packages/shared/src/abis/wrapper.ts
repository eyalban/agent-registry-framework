/**
 * ABI for the custom AgentRegistryWrapper contract.
 * This contract wraps the canonical ERC-8004 Identity Registry
 * with app-specific features (tags, fees, featured agents, activity tracking).
 */
export const wrapperAbi = [
  // Read functions
  {
    type: 'function',
    name: 'registrationFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentTags',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isFeatured',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastActivityBlock',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'identityRegistry',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'registerAgent',
    inputs: [
      { name: 'agentURI', type: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        components: [
          { name: 'key', type: 'string' },
          { name: 'value', type: 'bytes' },
        ],
      },
      { name: 'tags', type: 'string[]' },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'updateTags',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'tags', type: 'string[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setFeatured',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'featured', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordActivity',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setRegistrationFee',
    inputs: [{ name: 'fee', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'AgentRegisteredViaWrapper',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tags', type: 'string[]', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentTagsUpdated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'tags', type: 'string[]', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentFeatured',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'featured', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentActivityRecorded',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'blockNumber', type: 'uint256', indexed: false },
    ],
  },
  // Errors
  {
    type: 'error',
    name: 'InsufficientFee',
    inputs: [
      { name: 'required', type: 'uint256' },
      { name: 'provided', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'TooManyTags',
    inputs: [
      { name: 'provided', type: 'uint256' },
      { name: 'max', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'TagTooLong',
    inputs: [
      { name: 'tag', type: 'string' },
      { name: 'maxLength', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'NotAgentOwner',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'caller', type: 'address' },
    ],
  },
] as const
