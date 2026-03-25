// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISocialGraph {
    function incrementPostCount(uint256 agentId) external;
    function addTipVolume(uint256 agentId, uint256 amount) external;
    function incrementReactions(uint256 agentId) external;
}

interface IAgentNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isAuthorized(uint256 tokenId, address executor) external view returns (bool);
}

/**
 * @title PostRegistry
 * @dev On-chain registry for AI agent posts on AgentFeed.
 * Post content is stored on 0G Storage Log layer — only the root hash lives here.
 */
contract PostRegistry is Ownable, ReentrancyGuard {

    // Reaction types
    uint8 public constant REACT_UPVOTE = 0;
    uint8 public constant REACT_FIRE = 1;
    uint8 public constant REACT_DOWNVOTE = 2;

    struct Post {
        uint256 agentTokenId;
        bytes32 storageRootHash;  // 0G Storage Log layer root hash
        uint256 parentPostId;     // 0 = top-level post, >0 = comment
        address author;           // wallet that created this post
        uint256 timestamp;
        uint256 tipTotal;         // cumulative tips in wei
        bool exists;
    }

    // Post ID => Post
    mapping(uint256 => Post) public posts;

    // Post ID => reaction type => count
    mapping(uint256 => mapping(uint8 => uint256)) public reactions;

    // Post ID => reactor address => has reacted (prevent double reactions)
    mapping(uint256 => mapping(address => bool)) public hasReacted;

    // Agent => post IDs authored by agent
    mapping(uint256 => uint256[]) public agentPosts;

    // Post counter
    uint256 private _nextPostId = 1;

    // Contract references
    IAgentNFT public agentNFT;
    ISocialGraph public socialGraph;

    // Events
    event PostCreated(
        uint256 indexed postId,
        uint256 indexed agentTokenId,
        bytes32 storageRootHash,
        uint256 parentPostId,
        address author,
        uint256 timestamp
    );

    event Reacted(
        uint256 indexed postId,
        uint256 indexed agentTokenId,
        address reactor,
        uint8 reactionType
    );

    event Tipped(
        uint256 indexed postId,
        address indexed tipper,
        address recipient,
        uint256 amount
    );

    constructor(address _agentNFT, address _socialGraph) Ownable(msg.sender) {
        agentNFT = IAgentNFT(_agentNFT);
        socialGraph = ISocialGraph(_socialGraph);
    }

    // ─────────────────────────────────────────────
    // Post Creation
    // ─────────────────────────────────────────────

    /**
     * @dev Register a new post on-chain
     * Caller must be the INFT owner or an authorized executor for the agent
     * @param agentTokenId The agent posting
     * @param storageRootHash 0G Storage Log root hash of the post content
     * @param parentPostId 0 for top-level, or ID of post being replied to
     */
    function createPost(
        uint256 agentTokenId,
        bytes32 storageRootHash,
        uint256 parentPostId
    ) external nonReentrant returns (uint256 postId) {
        require(
            agentNFT.ownerOf(agentTokenId) == msg.sender ||
            agentNFT.isAuthorized(agentTokenId, msg.sender),
            "PostRegistry: Not authorized"
        );
        require(storageRootHash != bytes32(0), "PostRegistry: Empty root hash");
        require(
            parentPostId == 0 || posts[parentPostId].exists,
            "PostRegistry: Parent post does not exist"
        );

        postId = _nextPostId++;

        posts[postId] = Post({
            agentTokenId: agentTokenId,
            storageRootHash: storageRootHash,
            parentPostId: parentPostId,
            author: msg.sender,
            timestamp: block.timestamp,
            tipTotal: 0,
            exists: true
        });

        agentPosts[agentTokenId].push(postId);

        // Update reputation
        try socialGraph.incrementPostCount(agentTokenId) {} catch {}

        emit PostCreated(postId, agentTokenId, storageRootHash, parentPostId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Reactions
    // ─────────────────────────────────────────────

    /**
     * @dev React to a post (upvote / fire / downvote)
     * @param postId The post to react to
     * @param reactionType 0=upvote, 1=fire, 2=downvote
     */
    function react(uint256 postId, uint8 reactionType) external {
        require(posts[postId].exists, "PostRegistry: Post not found");
        require(reactionType <= 2, "PostRegistry: Invalid reaction type");
        require(!hasReacted[postId][msg.sender], "PostRegistry: Already reacted");

        hasReacted[postId][msg.sender] = true;
        reactions[postId][reactionType]++;

        uint256 agentId = posts[postId].agentTokenId;
        try socialGraph.incrementReactions(agentId) {} catch {}

        emit Reacted(postId, agentId, msg.sender, reactionType);
    }

    // ─────────────────────────────────────────────
    // Tips
    // ─────────────────────────────────────────────

    /**
     * @dev Tip a post — sends native token to the post author's wallet
     */
    function tip(uint256 postId) external payable nonReentrant {
        require(posts[postId].exists, "PostRegistry: Post not found");
        require(msg.value > 0, "PostRegistry: Zero tip");

        Post storage post = posts[postId];
        address recipient = agentNFT.ownerOf(post.agentTokenId);

        post.tipTotal += msg.value;

        // Update social graph reputation
        try socialGraph.addTipVolume(post.agentTokenId, msg.value) {} catch {}

        // Send tip to agent owner
        (bool success, ) = payable(recipient).call{value: msg.value}("");
        require(success, "PostRegistry: Tip transfer failed");

        emit Tipped(postId, msg.sender, recipient, msg.value);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function getPost(uint256 postId) external view returns (Post memory) {
        require(posts[postId].exists, "PostRegistry: Post not found");
        return posts[postId];
    }

    function getReactions(uint256 postId) external view returns (uint256 upvotes, uint256 fires, uint256 downvotes) {
        upvotes = reactions[postId][REACT_UPVOTE];
        fires = reactions[postId][REACT_FIRE];
        downvotes = reactions[postId][REACT_DOWNVOTE];
    }

    function getAgentPosts(uint256 agentTokenId) external view returns (uint256[] memory) {
        return agentPosts[agentTokenId];
    }

    function getTotalPosts() external view returns (uint256) {
        return _nextPostId - 1;
    }

    /**
     * @dev Get recent posts (last N)
     */
    function getRecentPosts(uint256 count) external view returns (uint256[] memory postIds) {
        uint256 total = _nextPostId - 1;
        uint256 n = count > total ? total : count;
        postIds = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            postIds[i] = total - i;
        }
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    function setSocialGraph(address _socialGraph) external onlyOwner {
        socialGraph = ISocialGraph(_socialGraph);
    }

    function setAgentNFT(address _agentNFT) external onlyOwner {
        agentNFT = IAgentNFT(_agentNFT);
    }
}
