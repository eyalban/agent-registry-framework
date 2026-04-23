/**
 * ABI for the InvoiceRegistry contract.
 * Deployed Base Sepolia: 0x645acDD5f85B52AD0CcE55B1c4f4Ac8BA00EC0Ac
 */
export const invoiceRegistryAbi = [
  // Writes
  {
    type: 'function',
    name: 'createInvoice',
    inputs: [
      { name: 'payer', type: 'address' },
      { name: 'issuerCompanyId', type: 'uint256' },
      { name: 'payerCompanyId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'dueBlock', type: 'uint256' },
      { name: 'memoURI', type: 'string' },
      { name: 'memoHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'id', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'payInvoiceETH',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'payInvoiceERC20',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelInvoice',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestInvoice',
    inputs: [
      { name: 'issuerSuggested', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'memoURI', type: 'string' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },

  // Reads
  {
    type: 'function',
    name: 'nextInvoiceId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'statusOf',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getInvoice',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'issuer', type: 'address' },
          { name: 'payer', type: 'address' },
          { name: 'issuerCompanyId', type: 'uint256' },
          { name: 'payerCompanyId', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'dueBlock', type: 'uint256' },
          { name: 'memoHash', type: 'bytes32' },
          { name: 'memoURI', type: 'string' },
          { name: 'status', type: 'uint8' },
          { name: 'issuedAt', type: 'uint256' },
          { name: 'paidAt', type: 'uint256' },
          { name: 'paidTxHash', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },

  // Events
  {
    type: 'event',
    name: 'InvoiceCreated',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'issuer', type: 'address', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'issuerCompanyId', type: 'uint256', indexed: false },
      { name: 'payerCompanyId', type: 'uint256', indexed: false },
      { name: 'dueBlock', type: 'uint256', indexed: false },
      { name: 'memoURI', type: 'string', indexed: false },
      { name: 'memoHash', type: 'bytes32', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'InvoicePaid',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'issuer', type: 'address', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'InvoiceCancelled',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'issuer', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'InvoiceRequested',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'requester', type: 'address', indexed: true },
      { name: 'issuerSuggested', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memoURI', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
] as const
