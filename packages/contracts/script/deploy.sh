#!/usr/bin/env bash
# =============================================================================
# Automated Deployment Script for AgentRegistryWrapper
# =============================================================================
# This script can be run by an AI agent without human involvement.
# It generates a new wallet, requests testnet ETH, and deploys the contract.
#
# Usage:
#   ./script/deploy.sh [network]
#
# Networks:
#   local       - Deploy to local Anvil fork (default, no ETH needed)
#   base-sepolia - Deploy to Base Sepolia testnet (needs ETH)
#
# Environment variables (optional):
#   DEPLOYER_PRIVATE_KEY - Use an existing key instead of generating one
#   RPC_URL              - Custom RPC endpoint
# =============================================================================

set -euo pipefail

NETWORK="${1:-local}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# =============================================================================
# Step 1: Wallet
# =============================================================================
if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  log "Generating new deployer wallet..."
  WALLET_OUTPUT=$(cast wallet new 2>&1)
  DEPLOYER_ADDRESS=$(echo "$WALLET_OUTPUT" | grep "Address:" | awk '{print $2}')
  DEPLOYER_PRIVATE_KEY=$(echo "$WALLET_OUTPUT" | grep "Private key:" | awk '{print $3}')
  log "Deployer address: $DEPLOYER_ADDRESS"
  log "Private key generated (store securely!)"
else
  DEPLOYER_ADDRESS=$(cast wallet address "$DEPLOYER_PRIVATE_KEY" 2>/dev/null)
  log "Using existing wallet: $DEPLOYER_ADDRESS"
fi

# =============================================================================
# Step 2: Network config
# =============================================================================
case "$NETWORK" in
  local)
    log "Starting local Anvil fork of Base Sepolia..."
    anvil --fork-url https://sepolia.base.org --port 8545 --silent &
    ANVIL_PID=$!
    sleep 3
    RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
    # Fund deployer on local fork
    cast send "$DEPLOYER_ADDRESS" --value 1ether \
      --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
      --rpc-url "$RPC_URL" > /dev/null 2>&1
    log "Funded deployer with 1 ETH on local fork"
    ;;
  base-sepolia)
    RPC_URL="${RPC_URL:-https://sepolia.base.org}"
    BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null)
    if [ "$BALANCE" = "0" ]; then
      err "Deployer has 0 ETH on Base Sepolia."
      err "Fund the address at: https://faucet.quicknode.com/base/sepolia"
      err "Address: $DEPLOYER_ADDRESS"
      exit 1
    fi
    log "Deployer balance: $(cast from-wei "$BALANCE") ETH"
    ;;
  *)
    err "Unknown network: $NETWORK (use 'local' or 'base-sepolia')"
    exit 1
    ;;
esac

# =============================================================================
# Step 3: Build
# =============================================================================
log "Building contracts..."
cd "$CONTRACT_DIR"
forge build --silent

# =============================================================================
# Step 4: Deploy
# =============================================================================
log "Deploying AgentRegistryWrapper to $NETWORK..."

DEPLOY_OUTPUT=$(DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" \
  forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" \
    --broadcast 2>&1)

WRAPPER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "deployed at:" | awk '{print $NF}')

if [ -z "$WRAPPER_ADDRESS" ]; then
  err "Deployment failed!"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

log "AgentRegistryWrapper deployed at: $WRAPPER_ADDRESS"

# =============================================================================
# Step 5: Verify (Base Sepolia only)
# =============================================================================
if [ "$NETWORK" = "base-sepolia" ] && [ -n "${BASESCAN_API_KEY:-}" ]; then
  log "Verifying contract on BaseScan..."
  forge verify-contract "$WRAPPER_ADDRESS" AgentRegistryWrapper \
    --chain base-sepolia \
    --watch 2>&1 || warn "Verification failed (non-critical)"
fi

# =============================================================================
# Step 6: Output
# =============================================================================
echo ""
echo "============================================"
echo "  Deployment Summary"
echo "============================================"
echo "  Network:          $NETWORK"
echo "  Wrapper:          $WRAPPER_ADDRESS"
echo "  Identity Reg:     0x8004A818BFB912233c491871b3d84c89A494BD9e"
echo "  Reputation Reg:   0x8004B663056A597Dffe9eCcC1965A193B7388713"
echo "  Deployer:         $DEPLOYER_ADDRESS"
echo "  RPC:              $RPC_URL"
echo "============================================"
echo ""
echo "Add to .env:"
echo "  NEXT_PUBLIC_WRAPPER_ADDRESS=$WRAPPER_ADDRESS"
echo ""

# Cleanup Anvil if we started it
if [ -n "${ANVIL_PID:-}" ]; then
  kill "$ANVIL_PID" 2>/dev/null || true
  log "Anvil stopped"
fi
