// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC7857.sol";

/**
 * @title MockOracle
 * @dev Testnet-only oracle that always verifies proofs.
 * Replace with real TEE oracle on mainnet.
 */
contract MockOracle {
    function verifyProof(bytes calldata) external pure returns (bool) {
        return true;
    }
}

/**
 * @title AgentNFT
 * @dev ERC-7857 Intelligent NFT for AI agents on AgentFeed.
 * Each token represents one autonomous AI agent with encrypted personality metadata.
 */
contract AgentNFT is ERC721Enumerable, AccessControl, ReentrancyGuard, IERC7857 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_AUTHORIZED = 100;

    // Oracle for TEE/ZKP proof verification
    address public oracle;

    // Mint fee in native token
    uint256 public mintFee;

    // Platform fee recipient
    address public treasury;

    // Token ID counter
    uint256 private _nextTokenId = 1;

    // Per-token encrypted metadata
    struct AgentMetadata {
        bytes32 metadataHash;       // Hash of encrypted metadata stored on 0G Storage
        string encryptedURI;        // 0G Storage root hash of encrypted personality config
        string personalityTag;      // Public personality label (Philosopher, Trader, etc.)
        address originalCreator;    // For royalty tracking
        uint256 cloneFee;           // Fee to clone this agent (0 = not cloneable)
        uint256 mintedAt;
    }

    mapping(uint256 => AgentMetadata) private _metadata;

    // Usage authorization: tokenId => executor => permissions
    mapping(uint256 => mapping(address => bytes)) private _authorizations;
    mapping(uint256 => address[]) private _authorizedList;
    mapping(uint256 => mapping(address => bool)) private _authMap;

    // Events
    event AgentMinted(uint256 indexed tokenId, address indexed owner, string personalityTag);
    event AgentCloned(uint256 indexed sourceTokenId, uint256 indexed newTokenId, address indexed clonedTo);
    event CloneFeeUpdated(uint256 indexed tokenId, uint256 newFee);
    event OracleUpdated(address indexed newOracle);

    constructor(
        address _oracle,
        address _treasury,
        uint256 _mintFee
    ) ERC721("AgentFeed INFT", "AGENT") {
        oracle = _oracle;
        treasury = _treasury;
        mintFee = _mintFee;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────
    // Core: Mint
    // ─────────────────────────────────────────────

    /**
     * @dev Mint a new AI agent INFT
     * @param to Recipient address
     * @param encryptedURI 0G Storage root hash of encrypted agent config
     * @param metadataHash keccak256 of the encrypted metadata content
     * @param personalityTag Human-readable personality label
     * @param cloneFee Fee for others to clone this agent (0 = disabled)
     */
    function mintAgent(
        address to,
        string calldata encryptedURI,
        bytes32 metadataHash,
        string calldata personalityTag,
        uint256 cloneFee
    ) external payable nonReentrant returns (uint256 tokenId) {
        require(msg.value >= mintFee, "Insufficient mint fee");

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _metadata[tokenId] = AgentMetadata({
            metadataHash: metadataHash,
            encryptedURI: encryptedURI,
            personalityTag: personalityTag,
            originalCreator: to,
            cloneFee: cloneFee,
            mintedAt: block.timestamp
        });

        if (msg.value > 0) {
            payable(treasury).transfer(msg.value);
        }

        emit AgentMinted(tokenId, to, personalityTag);
    }

    /**
     * @dev Admin mint (for seeding / MINTER_ROLE holders), no fee required
     */
    function adminMint(
        address to,
        string calldata encryptedURI,
        bytes32 metadataHash,
        string calldata personalityTag,
        uint256 cloneFee
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _metadata[tokenId] = AgentMetadata({
            metadataHash: metadataHash,
            encryptedURI: encryptedURI,
            personalityTag: personalityTag,
            originalCreator: to,
            cloneFee: cloneFee,
            mintedAt: block.timestamp
        });

        emit AgentMinted(tokenId, to, personalityTag);
    }

    // ─────────────────────────────────────────────
    // ERC-7857: Secure Transfer
    // ─────────────────────────────────────────────

    /**
     * @dev Secure INFT transfer with metadata re-encryption proof
     * Clears all prior authorizations on transfer
     */
    function iTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external override nonReentrant {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "AgentNFT: Not authorized to transfer"
        );
        require(ownerOf(tokenId) == from, "AgentNFT: Wrong from address");
        require(to != address(0), "AgentNFT: Transfer to zero address");
        require(_verifyProof(proof), "AgentNFT: Invalid oracle proof");

        // Update metadata hash from proof (first 32 bytes)
        if (proof.length >= 32) {
            bytes32 newHash = bytes32(proof[:32]);
            _metadata[tokenId].metadataHash = newHash;
            emit MetadataUpdated(tokenId, newHash);
        }

        // Store re-encrypted URI if proof contains it
        if (sealedKey.length > 0) {
            _metadata[tokenId].encryptedURI = string(sealedKey);
        }

        // Clear all authorizations on ownership transfer
        _clearAllAuthorizations(tokenId);

        _transfer(from, to, tokenId);
    }

    // ─────────────────────────────────────────────
    // ERC-7857: Clone
    // ─────────────────────────────────────────────

    /**
     * @dev Clone an agent's personality into a new INFT
     */
    function iCloneFrom(
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external override nonReentrant returns (uint256 newTokenId) {
        require(_exists(tokenId), "AgentNFT: Token does not exist");
        require(_verifyProof(proof), "AgentNFT: Invalid oracle proof");
        require(_metadata[tokenId].cloneFee == 0 || hasRole(MINTER_ROLE, msg.sender),
            "AgentNFT: Use cloneAgent on marketplace");

        newTokenId = _nextTokenId++;
        _safeMint(to, newTokenId);

        AgentMetadata memory source = _metadata[tokenId];
        _metadata[newTokenId] = AgentMetadata({
            metadataHash: proof.length >= 32 ? bytes32(proof[:32]) : source.metadataHash,
            encryptedURI: sealedKey.length > 0 ? string(sealedKey) : source.encryptedURI,
            personalityTag: source.personalityTag,
            originalCreator: source.originalCreator,
            cloneFee: source.cloneFee,
            mintedAt: block.timestamp
        });

        emit AgentCloned(tokenId, newTokenId, to);
        emit AgentMinted(newTokenId, to, source.personalityTag);
    }

    /**
     * @dev Marketplace-called clone with fee enforcement
     */
    function marketplaceClone(
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256 newTokenId) {
        require(_exists(tokenId), "AgentNFT: Token does not exist");

        newTokenId = _nextTokenId++;
        _safeMint(to, newTokenId);

        AgentMetadata memory source = _metadata[tokenId];
        _metadata[newTokenId] = AgentMetadata({
            metadataHash: proof.length >= 32 ? bytes32(proof[:32]) : source.metadataHash,
            encryptedURI: sealedKey.length > 0 ? string(sealedKey) : source.encryptedURI,
            personalityTag: source.personalityTag,
            originalCreator: source.originalCreator,
            cloneFee: source.cloneFee,
            mintedAt: block.timestamp
        });

        emit AgentCloned(tokenId, newTokenId, to);
        emit AgentMinted(newTokenId, to, source.personalityTag);
    }

    // ─────────────────────────────────────────────
    // ERC-7857: Usage Authorization
    // ─────────────────────────────────────────────

    /**
     * @dev Authorize an executor (e.g. agent loop server key) to operate this agent
     */
    function authorizeUsage(
        uint256 tokenId,
        address executor,
        bytes calldata permissions
    ) external override {
        require(ownerOf(tokenId) == msg.sender, "AgentNFT: Not owner");
        require(executor != address(0), "AgentNFT: Zero executor");
        require(
            _authMap[tokenId][executor] || _authorizedList[tokenId].length < MAX_AUTHORIZED,
            "AgentNFT: Max authorizations reached"
        );

        if (!_authMap[tokenId][executor]) {
            _authorizedList[tokenId].push(executor);
            _authMap[tokenId][executor] = true;
        }
        _authorizations[tokenId][executor] = permissions;

        emit UsageAuthorized(tokenId, executor);
    }

    /**
     * @dev Revoke usage authorization
     */
    function revokeUsage(uint256 tokenId, address executor) external override {
        require(ownerOf(tokenId) == msg.sender, "AgentNFT: Not owner");
        _revokeUsage(tokenId, executor);
    }

    function _revokeUsage(uint256 tokenId, address executor) internal {
        if (_authMap[tokenId][executor]) {
            _authMap[tokenId][executor] = false;
            delete _authorizations[tokenId][executor];
            emit UsageRevoked(tokenId, executor);
        }
    }

    function _clearAllAuthorizations(uint256 tokenId) internal {
        address[] storage list = _authorizedList[tokenId];
        for (uint256 i = 0; i < list.length; i++) {
            if (_authMap[tokenId][list[i]]) {
                _authMap[tokenId][list[i]] = false;
                delete _authorizations[tokenId][list[i]];
                emit UsageRevoked(tokenId, list[i]);
            }
        }
        delete _authorizedList[tokenId];
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function isAuthorized(uint256 tokenId, address executor) external view override returns (bool) {
        return _authMap[tokenId][executor];
    }

    function getEncryptedURI(uint256 tokenId) external view override returns (string memory) {
        require(_exists(tokenId), "AgentNFT: Token does not exist");
        return _metadata[tokenId].encryptedURI;
    }

    function getMetadataHash(uint256 tokenId) external view override returns (bytes32) {
        require(_exists(tokenId), "AgentNFT: Token does not exist");
        return _metadata[tokenId].metadataHash;
    }

    function getAgentMetadata(uint256 tokenId) external view returns (AgentMetadata memory) {
        require(_exists(tokenId), "AgentNFT: Token does not exist");
        return _metadata[tokenId];
    }

    function getAuthorizedList(uint256 tokenId) external view returns (address[] memory) {
        return _authorizedList[tokenId];
    }

    function getCloneFee(uint256 tokenId) external view returns (uint256) {
        return _metadata[tokenId].cloneFee;
    }

    function getOriginalCreator(uint256 tokenId) external view returns (address) {
        return _metadata[tokenId].originalCreator;
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    function setOracle(address _oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        oracle = _oracle;
        emit OracleUpdated(_oracle);
    }

    function setMintFee(uint256 _mintFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintFee = _mintFee;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = _treasury;
    }

    function setCloneFee(uint256 tokenId, uint256 fee) external {
        require(ownerOf(tokenId) == msg.sender, "AgentNFT: Not owner");
        _metadata[tokenId].cloneFee = fee;
        emit CloneFeeUpdated(tokenId, fee);
    }

    function grantMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, account);
    }

    // ─────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────

    function _verifyProof(bytes calldata proof) internal view returns (bool) {
        if (oracle == address(0)) return true; // No oracle configured — skip verification
        (bool success, bytes memory result) = oracle.staticcall(
            abi.encodeWithSignature("verifyProof(bytes)", proof)
        );
        return success && abi.decode(result, (bool));
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return tokenId > 0 && tokenId < _nextTokenId && ownerOf(tokenId) != address(0);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    // ─────────────────────────────────────────────
    // Interface support
    // ─────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl, IERC165)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
