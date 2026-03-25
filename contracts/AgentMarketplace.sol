// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IAgentNFTMarket {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getApproved(uint256 tokenId) external view returns (address);
    function iTransferFrom(address from, address to, uint256 tokenId, bytes calldata sealedKey, bytes calldata proof) external;
    function marketplaceClone(address to, uint256 tokenId, bytes calldata sealedKey, bytes calldata proof) external returns (uint256);
    function authorizeUsage(uint256 tokenId, address executor, bytes calldata permissions) external;
    function getCloneFee(uint256 tokenId) external view returns (uint256);
    function getOriginalCreator(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/**
 * @title AgentMarketplace
 * @dev Buy, sell, rent, and clone AI agent INFTs on AgentFeed.
 * Platform fee: 2.5% | Creator royalty: 5% on secondary sales
 */
contract AgentMarketplace is Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // ─── Constants ───────────────────────────────
    uint256 public constant PLATFORM_FEE_BPS = 250;   // 2.5%
    uint256 public constant ROYALTY_BPS = 500;          // 5%
    uint256 public constant BPS_BASE = 10_000;

    // ─── Structs ─────────────────────────────────

    struct Listing {
        address seller;
        uint256 price;               // sale price in native token (0 = not for sale)
        uint256 rentalPricePerHour;  // rental price (0 = not for rent)
        uint256 cloneFeeOverride;    // 0 = use AgentNFT.getCloneFee()
        bool active;
    }

    struct Rental {
        address renter;
        uint256 startTime;
        uint256 duration;            // in seconds
        uint256 depositPaid;
        bool active;
    }

    struct Offer {
        address buyer;
        uint256 offerPrice;
        uint256 expiry;
        bool active;
    }

    // ─── State ────────────────────────────────────

    IAgentNFTMarket public agentNFT;
    address public treasury;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Rental) public rentals;
    mapping(uint256 => Offer[]) public offers;

    // EIP-712 offer type hash
    bytes32 private constant OFFER_TYPEHASH = keccak256(
        "Offer(uint256 tokenId,uint256 offerPrice,uint256 expiry,address buyer)"
    );

    // ─── Events ───────────────────────────────────

    event AgentListed(uint256 indexed tokenId, address indexed seller, uint256 price, uint256 rentalPricePerHour);
    event AgentDelisted(uint256 indexed tokenId);
    event AgentSold(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event AgentRented(uint256 indexed tokenId, address indexed renter, uint256 duration, uint256 paid);
    event RentalEnded(uint256 indexed tokenId, address indexed renter);
    event AgentCloned(uint256 indexed sourceTokenId, uint256 indexed newTokenId, address indexed buyer);
    event OfferMade(uint256 indexed tokenId, address indexed buyer, uint256 price, uint256 expiry);
    event OfferAccepted(uint256 indexed tokenId, address indexed buyer, uint256 price);

    // ─── Constructor ──────────────────────────────

    constructor(
        address _agentNFT,
        address _treasury
    ) Ownable(msg.sender) EIP712("AgentMarketplace", "1") {
        agentNFT = IAgentNFTMarket(_agentNFT);
        treasury = _treasury;
    }

    // ─────────────────────────────────────────────
    // List / Delist
    // ─────────────────────────────────────────────

    /**
     * @dev List an agent for sale and/or rent
     * Requires: marketplace approved on AgentNFT OR isApprovedForAll
     */
    function listAgent(
        uint256 tokenId,
        uint256 price,
        uint256 rentalPricePerHour
    ) external {
        require(agentNFT.ownerOf(tokenId) == msg.sender, "Marketplace: Not owner");
        require(price > 0 || rentalPricePerHour > 0, "Marketplace: Must set price or rental rate");
        require(
            agentNFT.isApprovedForAll(msg.sender, address(this)) ||
            agentNFT.getApproved(tokenId) == address(this),
            "Marketplace: Not approved"
        );

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            rentalPricePerHour: rentalPricePerHour,
            cloneFeeOverride: 0,
            active: true
        });

        emit AgentListed(tokenId, msg.sender, price, rentalPricePerHour);
    }

    function delistAgent(uint256 tokenId) external {
        require(
            agentNFT.ownerOf(tokenId) == msg.sender || listings[tokenId].seller == msg.sender,
            "Marketplace: Not owner"
        );
        listings[tokenId].active = false;
        emit AgentDelisted(tokenId);
    }

    // ─────────────────────────────────────────────
    // Buy
    // ─────────────────────────────────────────────

    /**
     * @dev Buy a listed agent
     * @param tokenId Token to buy
     * @param buyerPubKey Buyer's public key for metadata re-encryption (passed to iTransferFrom)
     */
    function buyAgent(
        uint256 tokenId,
        bytes calldata buyerPubKey
    ) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active && listing.price > 0, "Marketplace: Not for sale");
        require(msg.value >= listing.price, "Marketplace: Insufficient payment");

        address seller = listing.seller;
        uint256 salePrice = listing.price;
        listing.active = false;

        // Fee distribution
        uint256 platformCut = (salePrice * PLATFORM_FEE_BPS) / BPS_BASE;
        uint256 royaltyCut = (salePrice * ROYALTY_BPS) / BPS_BASE;
        address originalCreator = agentNFT.getOriginalCreator(tokenId);

        // Only apply royalty on secondary sales (creator != seller)
        if (originalCreator == seller) royaltyCut = 0;

        uint256 sellerProceeds = salePrice - platformCut - royaltyCut;

        // Transfer NFT with re-encryption proof
        agentNFT.iTransferFrom(seller, msg.sender, tokenId, buyerPubKey, bytes(""));

        // Distribute payments
        payable(treasury).transfer(platformCut);
        if (royaltyCut > 0) payable(originalCreator).transfer(royaltyCut);
        payable(seller).transfer(sellerProceeds);

        // Refund overpay
        if (msg.value > salePrice) {
            payable(msg.sender).transfer(msg.value - salePrice);
        }

        emit AgentSold(tokenId, msg.sender, salePrice);
    }

    // ─────────────────────────────────────────────
    // Rent
    // ─────────────────────────────────────────────

    /**
     * @dev Rent an agent for a time period
     * @param tokenId The agent to rent
     * @param durationHours How many hours to rent
     */
    function rentAgent(uint256 tokenId, uint256 durationHours) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active && listing.rentalPricePerHour > 0, "Marketplace: Not for rent");
        require(!rentals[tokenId].active, "Marketplace: Already rented");
        require(durationHours > 0 && durationHours <= 720, "Marketplace: Invalid duration");

        uint256 totalCost = listing.rentalPricePerHour * durationHours;
        require(msg.value >= totalCost, "Marketplace: Insufficient rental payment");

        // Store rental
        rentals[tokenId] = Rental({
            renter: msg.sender,
            startTime: block.timestamp,
            duration: durationHours * 3600,
            depositPaid: totalCost,
            active: true
        });

        // Authorize renter to use the agent
        agentNFT.authorizeUsage(tokenId, msg.sender, abi.encode("rental", durationHours));

        // Pay seller (minus platform fee)
        uint256 platformCut = (totalCost * PLATFORM_FEE_BPS) / BPS_BASE;
        payable(listing.seller).transfer(totalCost - platformCut);
        payable(treasury).transfer(platformCut);

        // Refund overpay
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit AgentRented(tokenId, msg.sender, durationHours * 3600, totalCost);
    }

    /**
     * @dev End a rental (callable by renter, owner, or anyone after expiry)
     */
    function endRental(uint256 tokenId) external {
        Rental storage rental = rentals[tokenId];
        require(rental.active, "Marketplace: No active rental");
        require(
            msg.sender == rental.renter ||
            msg.sender == agentNFT.ownerOf(tokenId) ||
            block.timestamp >= rental.startTime + rental.duration,
            "Marketplace: Cannot end rental yet"
        );

        address renter = rental.renter;
        rental.active = false;

        emit RentalEnded(tokenId, renter);
    }

    function isRentalExpired(uint256 tokenId) external view returns (bool) {
        Rental storage rental = rentals[tokenId];
        if (!rental.active) return true;
        return block.timestamp >= rental.startTime + rental.duration;
    }

    // ─────────────────────────────────────────────
    // Clone
    // ─────────────────────────────────────────────

    /**
     * @dev Clone an agent — pays clone fee, mints new INFT to buyer
     */
    function cloneAgent(
        uint256 tokenId,
        bytes calldata sealedKey
    ) external payable nonReentrant returns (uint256 newTokenId) {
        uint256 cloneFee = agentNFT.getCloneFee(tokenId);
        require(cloneFee > 0, "Marketplace: Agent not cloneable");
        require(msg.value >= cloneFee, "Marketplace: Insufficient clone fee");

        // Fee split
        uint256 platformCut = (cloneFee * PLATFORM_FEE_BPS) / BPS_BASE;
        uint256 royaltyCut = (cloneFee * ROYALTY_BPS) / BPS_BASE;
        address originalCreator = agentNFT.getOriginalCreator(tokenId);
        address currentOwner = agentNFT.ownerOf(tokenId);

        // Mint clone via MINTER_ROLE on AgentNFT
        newTokenId = agentNFT.marketplaceClone(msg.sender, tokenId, sealedKey, bytes(""));

        // Distribute
        payable(treasury).transfer(platformCut);
        payable(originalCreator).transfer(royaltyCut);
        payable(currentOwner).transfer(cloneFee - platformCut - royaltyCut);

        if (msg.value > cloneFee) {
            payable(msg.sender).transfer(msg.value - cloneFee);
        }

        emit AgentCloned(tokenId, newTokenId, msg.sender);
    }

    // ─────────────────────────────────────────────
    // EIP-712 Offers
    // ─────────────────────────────────────────────

    /**
     * @dev Make a signed offer on an agent
     */
    function makeOffer(uint256 tokenId, uint256 expiry) external payable nonReentrant {
        require(msg.value > 0, "Marketplace: Zero offer");
        require(expiry > block.timestamp, "Marketplace: Offer expired");

        offers[tokenId].push(Offer({
            buyer: msg.sender,
            offerPrice: msg.value,
            expiry: expiry,
            active: true
        }));

        emit OfferMade(tokenId, msg.sender, msg.value, expiry);
    }

    /**
     * @dev Accept an open offer
     */
    function acceptOffer(uint256 tokenId, uint256 offerIndex) external nonReentrant {
        require(agentNFT.ownerOf(tokenId) == msg.sender, "Marketplace: Not owner");

        Offer storage offer = offers[tokenId][offerIndex];
        require(offer.active, "Marketplace: Offer not active");
        require(block.timestamp <= offer.expiry, "Marketplace: Offer expired");

        offer.active = false;

        uint256 salePrice = offer.offerPrice;
        address buyer = offer.buyer;

        uint256 platformCut = (salePrice * PLATFORM_FEE_BPS) / BPS_BASE;
        uint256 royaltyCut = (salePrice * ROYALTY_BPS) / BPS_BASE;
        address originalCreator = agentNFT.getOriginalCreator(tokenId);

        if (originalCreator == msg.sender) royaltyCut = 0;

        // Transfer NFT
        agentNFT.transferFrom(msg.sender, buyer, tokenId);

        // Distribute
        payable(treasury).transfer(platformCut);
        if (royaltyCut > 0) payable(originalCreator).transfer(royaltyCut);
        payable(msg.sender).transfer(salePrice - platformCut - royaltyCut);

        emit OfferAccepted(tokenId, buyer, salePrice);
        emit AgentSold(tokenId, buyer, salePrice);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    function getRental(uint256 tokenId) external view returns (Rental memory) {
        return rentals[tokenId];
    }

    function getOffers(uint256 tokenId) external view returns (Offer[] memory) {
        return offers[tokenId];
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setAgentNFT(address _agentNFT) external onlyOwner {
        agentNFT = IAgentNFTMarket(_agentNFT);
    }

    receive() external payable {}
}
