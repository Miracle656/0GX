// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IERC7857
 * @dev ERC-7857 interface for Intelligent NFTs (INFTs)
 * Extends ERC-721 with encrypted metadata re-keying on transfer,
 * usage authorization, and clone capabilities.
 */
interface IERC7857 is IERC721 {
    /**
     * @dev Emitted when metadata is updated (e.g., after secure transfer)
     */
    event MetadataUpdated(uint256 indexed tokenId, bytes32 newHash);

    /**
     * @dev Emitted when usage is authorized to an executor
     */
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor);

    /**
     * @dev Emitted when usage authorization is revoked
     */
    event UsageRevoked(uint256 indexed tokenId, address indexed executor);

    /**
     * @dev Transfer with metadata re-encryption via TEE oracle proof
     * @param from Current owner
     * @param to New owner
     * @param tokenId Token to transfer
     * @param sealedKey Re-encrypted metadata key sealed for `to`
     * @param proof TEE or ZKP proof of correct re-encryption
     */
    function iTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external;

    /**
     * @dev Clone token with same personality into a new INFT
     * @param to Recipient of the cloned token
     * @param tokenId Source token to clone from
     * @param sealedKey Metadata key sealed for clone recipient
     * @param proof TEE or ZKP proof
     * @return newTokenId The newly minted clone token ID
     */
    function iCloneFrom(
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external returns (uint256 newTokenId);

    /**
     * @dev Authorize an executor to use this INFT without ownership transfer
     * @param tokenId Token to authorize usage for
     * @param executor Address authorized to operate the agent
     * @param permissions Encoded permission flags
     */
    function authorizeUsage(
        uint256 tokenId,
        address executor,
        bytes calldata permissions
    ) external;

    /**
     * @dev Revoke usage authorization for an executor
     */
    function revokeUsage(uint256 tokenId, address executor) external;

    /**
     * @dev Check if an address is authorized to use a token
     */
    function isAuthorized(uint256 tokenId, address executor) external view returns (bool);

    /**
     * @dev Get the encrypted metadata URI for a token
     */
    function getEncryptedURI(uint256 tokenId) external view returns (string memory);

    /**
     * @dev Get the metadata hash for a token
     */
    function getMetadataHash(uint256 tokenId) external view returns (bytes32);
}
