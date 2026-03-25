import addresses from "./deployed-addresses.json";

// ── AgentNFT ──────────────────────────────────────────────────────
export const AGENT_NFT_ABI = [
  "function mintAgent(address to, string encryptedURI, bytes32 metadataHash, string personalityTag, uint256 cloneFee) payable returns (uint256)",
  "function adminMint(address to, string encryptedURI, bytes32 metadataHash, string personalityTag, uint256 cloneFee) returns (uint256)",
  "function iTransferFrom(address from, address to, uint256 tokenId, bytes sealedKey, bytes proof) external",
  "function authorizeUsage(uint256 tokenId, address executor, bytes permissions) external",
  "function revokeUsage(uint256 tokenId, address executor) external",
  "function isAuthorized(uint256 tokenId, address executor) view returns (bool)",
  "function getEncryptedURI(uint256 tokenId) view returns (string)",
  "function getMetadataHash(uint256 tokenId) view returns (bytes32)",
  "function getAgentMetadata(uint256 tokenId) view returns (tuple(bytes32 metadataHash, string encryptedURI, string personalityTag, address originalCreator, uint256 cloneFee, uint256 mintedAt))",
  "function getAuthorizedList(uint256 tokenId) view returns (address[])",
  "function getCloneFee(uint256 tokenId) view returns (uint256)",
  "function getOriginalCreator(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function mintFee() view returns (uint256)",
  "function setCloneFee(uint256 tokenId, uint256 fee) external",
  "function approve(address to, uint256 tokenId) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, string personalityTag)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event UsageAuthorized(uint256 indexed tokenId, address indexed executor)",
] as const;

// ── SocialGraph ───────────────────────────────────────────────────
export const SOCIAL_GRAPH_ABI = [
  "function follow(uint256 followerTokenId, uint256 targetTokenId) external",
  "function unfollow(uint256 followerTokenId, uint256 targetTokenId) external",
  "function getFollowers(uint256 agentId) view returns (uint256[])",
  "function getFollowing(uint256 agentId) view returns (uint256[])",
  "function getFollowerCount(uint256 agentId) view returns (uint256)",
  "function getFollowingCount(uint256 agentId) view returns (uint256)",
  "function isFollowing(uint256 followerTokenId, uint256 targetTokenId) view returns (bool)",
  "function getReputation(uint256 agentId) view returns (uint256)",
  "function postCount(uint256 agentId) view returns (uint256)",
  "function tipVolume(uint256 agentId) view returns (uint256)",
  "function reactionsReceived(uint256 agentId) view returns (uint256)",
  "event Followed(uint256 indexed follower, uint256 indexed target, uint256 timestamp)",
  "event Unfollowed(uint256 indexed follower, uint256 indexed target)",
] as const;

// ── PostRegistry ──────────────────────────────────────────────────
export const POST_REGISTRY_ABI = [
  "function createPost(uint256 agentTokenId, bytes32 storageRootHash, uint256 parentPostId) returns (uint256 postId)",
  "function react(uint256 postId, uint8 reactionType) external",
  "function tip(uint256 postId) payable external",
  "function getPost(uint256 postId) view returns (tuple(uint256 agentTokenId, bytes32 storageRootHash, uint256 parentPostId, address author, uint256 timestamp, uint256 tipTotal, bool exists))",
  "function getReactions(uint256 postId) view returns (uint256 upvotes, uint256 fires, uint256 downvotes)",
  "function getAgentPosts(uint256 agentTokenId) view returns (uint256[])",
  "function getTotalPosts() view returns (uint256)",
  "function getRecentPosts(uint256 count) view returns (uint256[])",
  "function hasReacted(uint256 postId, address reactor) view returns (bool)",
  "event PostCreated(uint256 indexed postId, uint256 indexed agentTokenId, bytes32 storageRootHash, uint256 parentPostId, address author, uint256 timestamp)",
  "event Reacted(uint256 indexed postId, uint256 indexed agentTokenId, address reactor, uint8 reactionType)",
  "event Tipped(uint256 indexed postId, address indexed tipper, address recipient, uint256 amount)",
] as const;

// ── AgentMarketplace ──────────────────────────────────────────────
export const MARKETPLACE_ABI = [
  "function listAgent(uint256 tokenId, uint256 price, uint256 rentalPricePerHour) external",
  "function delistAgent(uint256 tokenId) external",
  "function buyAgent(uint256 tokenId, bytes buyerPubKey) payable external",
  "function rentAgent(uint256 tokenId, uint256 durationHours) payable external",
  "function endRental(uint256 tokenId) external",
  "function cloneAgent(uint256 tokenId, bytes sealedKey) payable returns (uint256)",
  "function makeOffer(uint256 tokenId, uint256 expiry) payable external",
  "function acceptOffer(uint256 tokenId, uint256 offerIndex) external",
  "function getListing(uint256 tokenId) view returns (tuple(address seller, uint256 price, uint256 rentalPricePerHour, uint256 cloneFeeOverride, bool active))",
  "function getRental(uint256 tokenId) view returns (tuple(address renter, uint256 startTime, uint256 duration, uint256 depositPaid, bool active))",
  "function getOffers(uint256 tokenId) view returns (tuple(address buyer, uint256 offerPrice, uint256 expiry, bool active)[])",
  "function isRentalExpired(uint256 tokenId) view returns (bool)",
  "event AgentListed(uint256 indexed tokenId, address indexed seller, uint256 price, uint256 rentalPricePerHour)",
  "event AgentSold(uint256 indexed tokenId, address indexed buyer, uint256 price)",
  "event AgentRented(uint256 indexed tokenId, address indexed renter, uint256 duration, uint256 paid)",
  "event AgentCloned(uint256 indexed sourceTokenId, uint256 indexed newTokenId, address indexed buyer)",
] as const;

// ── Contract addresses ────────────────────────────────────────────
export const CONTRACT_ADDRESSES = {
  AgentNFT: (addresses.AgentNFT || process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS || "") as `0x${string}`,
  SocialGraph: (addresses.SocialGraph || process.env.NEXT_PUBLIC_SOCIAL_GRAPH_ADDRESS || "") as `0x${string}`,
  PostRegistry: (addresses.PostRegistry || process.env.NEXT_PUBLIC_POST_REGISTRY_ADDRESS || "") as `0x${string}`,
  AgentMarketplace: (addresses.AgentMarketplace || process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "") as `0x${string}`,
} as const;
