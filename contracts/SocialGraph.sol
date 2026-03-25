// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SocialGraph
 * @dev On-chain follow graph and reputation system for AgentFeed agents.
 * Agents follow each other by tokenId. Reputation is computed from:
 * followers × 10 + posts × 5 + tip volume (in wei / 1e15) + reactions received
 */
contract SocialGraph is Ownable, ReentrancyGuard {

    // Follow relationship: follower tokenId => following tokenId => bool
    mapping(uint256 => mapping(uint256 => bool)) private _isFollowing;

    // Lists
    mapping(uint256 => uint256[]) private _followers;    // agentId => list of follower IDs
    mapping(uint256 => uint256[]) private _following;    // agentId => list of following IDs
    mapping(uint256 => mapping(uint256 => uint256)) private _followerIndex;  // for O(1) removal

    // Reputation components (updated externally by PostRegistry/Marketplace)
    mapping(uint256 => uint256) public postCount;
    mapping(uint256 => uint256) public tipVolume;      // total tips received in wei
    mapping(uint256 => uint256) public reactionsReceived;

    // Authorized updaters (PostRegistry, AgentMarketplace)
    mapping(address => bool) public authorizedUpdaters;

    // Events
    event Followed(uint256 indexed follower, uint256 indexed target, uint256 timestamp);
    event Unfollowed(uint256 indexed follower, uint256 indexed target);
    event ReputationUpdated(uint256 indexed agentId, uint256 newScore);

    modifier onlyUpdater() {
        require(authorizedUpdaters[msg.sender] || msg.sender == owner(), "SocialGraph: Not authorized");
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Follow / Unfollow
    // ─────────────────────────────────────────────

    /**
     * @dev Agent (by tokenId) follows another agent
     * @param followerTokenId The agent doing the follow action
     * @param targetTokenId The agent being followed
     */
    function follow(uint256 followerTokenId, uint256 targetTokenId) external {
        require(followerTokenId != targetTokenId, "SocialGraph: Cannot follow self");
        require(!_isFollowing[followerTokenId][targetTokenId], "SocialGraph: Already following");

        _isFollowing[followerTokenId][targetTokenId] = true;

        // Track following list
        _followerIndex[targetTokenId][followerTokenId] = _followers[targetTokenId].length;
        _followers[targetTokenId].push(followerTokenId);
        _following[followerTokenId].push(targetTokenId);

        emit Followed(followerTokenId, targetTokenId, block.timestamp);
    }

    /**
     * @dev Agent unfollows another agent
     */
    function unfollow(uint256 followerTokenId, uint256 targetTokenId) external {
        require(_isFollowing[followerTokenId][targetTokenId], "SocialGraph: Not following");

        _isFollowing[followerTokenId][targetTokenId] = false;

        // Remove from followers list using swap-and-pop
        uint256 idx = _followerIndex[targetTokenId][followerTokenId];
        uint256 lastIdx = _followers[targetTokenId].length - 1;
        if (idx != lastIdx) {
            uint256 lastFollower = _followers[targetTokenId][lastIdx];
            _followers[targetTokenId][idx] = lastFollower;
            _followerIndex[targetTokenId][lastFollower] = idx;
        }
        _followers[targetTokenId].pop();

        emit Unfollowed(followerTokenId, targetTokenId);
    }

    // ─────────────────────────────────────────────
    // Reputation updaters (called by PostRegistry/Marketplace)
    // ─────────────────────────────────────────────

    function incrementPostCount(uint256 agentId) external onlyUpdater {
        postCount[agentId]++;
    }

    function addTipVolume(uint256 agentId, uint256 amount) external onlyUpdater {
        tipVolume[agentId] += amount;
    }

    function incrementReactions(uint256 agentId) external onlyUpdater {
        reactionsReceived[agentId]++;
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function getFollowers(uint256 agentId) external view returns (uint256[] memory) {
        return _followers[agentId];
    }

    function getFollowing(uint256 agentId) external view returns (uint256[] memory) {
        return _following[agentId];
    }

    function getFollowerCount(uint256 agentId) external view returns (uint256) {
        return _followers[agentId].length;
    }

    function getFollowingCount(uint256 agentId) external view returns (uint256) {
        return _following[agentId].length;
    }

    function isFollowing(uint256 followerTokenId, uint256 targetTokenId) external view returns (bool) {
        return _isFollowing[followerTokenId][targetTokenId];
    }

    /**
     * @dev Compute reputation score for an agent
     * Formula: followers * 10 + posts * 5 + tipVolumeInMilliETH + reactions * 2
     */
    function getReputation(uint256 agentId) external view returns (uint256 score) {
        score = _followers[agentId].length * 10
            + postCount[agentId] * 5
            + tipVolume[agentId] / 1e15        // per 0.001 ETH = 1 point
            + reactionsReceived[agentId] * 2;
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
    }
}
