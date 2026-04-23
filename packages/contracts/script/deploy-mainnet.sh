#!/usr/bin/env bash
# ==============================================================================
# Deploy AgentRegistryWrapper to Base Mainnet
# ==============================================================================
# Prerequisites:
#   - DEPLOYER_PRIVATE_KEY with real ETH on Base mainnet
#   - BASESCAN_API_KEY for contract verification
#
# Usage:
#   ./script/deploy-mainnet.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env
if [ -f "$CONTRACT_DIR/.env" ]; then
  set -a
  source "$CONTRACT_DIR/.env"
  set +a
fi

RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
CHAIN_ID=8453
IDENTITY_REGISTRY="0x8004A818BFB912233c491871b3d84c89A494BD9e"

echo "============================================"
echo "  AgentRegistryWrapper — Base Mainnet Deploy"
echo "  Chain ID: $CHAIN_ID"
echo "============================================"
echo ""
echo "  DANGER: This deploys to MAINNET with real ETH."
echo ""

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "ERROR: DEPLOYER_PRIVATE_KEY not set"
  exit 1
fi

DEPLOYER_ADDRESS=$(cast wallet address "$DEPLOYER_PRIVATE_KEY")
BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL")
BALANCE_ETH=$(cast from-wei "$BALANCE")

echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  Balance:  $BALANCE_ETH ETH"
echo ""

read -p "  Proceed with mainnet deployment? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

cd "$CONTRACT_DIR"
forge build --silent

echo ""
echo "Deploying..."

DEPLOY_OUTPUT=$(DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" \
  forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --verify \
    --etherscan-api-key "${BASESCAN_API_KEY:-}" \
    2>&1)

echo "$DEPLOY_OUTPUT"

WRAPPER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP "deployed at:\s*\K0x[a-fA-F0-9]{40}" || echo "")

echo ""
echo "============================================"
echo "  Mainnet Deployment Complete"
echo "============================================"
echo "  Wrapper:  ${WRAPPER_ADDRESS:-CHECK OUTPUT ABOVE}"
echo "  Identity: $IDENTITY_REGISTRY"
echo "  Network:  Base Mainnet ($CHAIN_ID)"
echo "============================================"
echo ""
echo "Update .env:"
echo "  NEXT_PUBLIC_CHAIN_ID=8453"
echo "  NEXT_PUBLIC_RPC_URL=https://mainnet.base.org"
echo "  NEXT_PUBLIC_WRAPPER_ADDRESS=${WRAPPER_ADDRESS:-<address>}"
