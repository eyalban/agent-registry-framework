// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIdentityRegistry
 * @dev Interface for the canonical ERC-8004 Identity Registry (IdentityRegistryUpgradeable).
 * @notice This is a minimal interface covering the functions used by the wrapper.
 *         Sourced from https://github.com/erc-8004/erc-8004-contracts
 */
interface IIdentityRegistry {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    /// @notice Register a new agent identity with URI and metadata
    /// @param agentURI URI pointing to the agent's registration file
    /// @param metadata Initial metadata key-value pairs
    /// @return agentId The newly minted agent's token ID
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId);

    /// @notice Register with URI only
    /// @param agentURI URI pointing to the agent's registration file
    /// @return agentId The newly minted agent's token ID
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice Get the URI for an agent (ERC-721 tokenURI)
    /// @param tokenId The token ID
    /// @return The token URI string
    function tokenURI(uint256 tokenId) external view returns (string memory);

    /// @notice Get the owner of an agent token
    /// @param tokenId The token ID
    /// @return The owner address
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Update an agent's URI
    /// @param agentId The agent's token ID
    /// @param newURI The new URI
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /// @notice Set metadata for an agent
    /// @param agentId The agent's token ID
    /// @param metadataKey The metadata key
    /// @param metadataValue The metadata value
    function setMetadata(
        uint256 agentId,
        string calldata metadataKey,
        bytes calldata metadataValue
    ) external;

    /// @notice Get metadata for an agent
    /// @param agentId The agent's token ID
    /// @param metadataKey The metadata key
    /// @return The metadata value
    function getMetadata(
        uint256 agentId,
        string calldata metadataKey
    ) external view returns (bytes memory);

    /// @notice Get the agent's wallet address
    /// @param agentId The agent's token ID
    /// @return The wallet address
    function getAgentWallet(uint256 agentId) external view returns (address);

    /// @notice Transfer an agent NFT (ERC-721 transferFrom)
    /// @param from Current owner
    /// @param to New owner
    /// @param tokenId The token ID
    function transferFrom(address from, address to, uint256 tokenId) external;
}
