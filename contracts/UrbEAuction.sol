// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// Defines custom errors that can be thrown by the contract
error AlreadyListed(address nftAddress, uint256 tokenId);
error NotListed(address nftAddress, uint256 tokenId);
error BidNotHighEnough(address nftAddress, uint256 tokenId, uint256 price);
error AuctionAlreadyEnded(address nftAddress, uint256 tokenId);
error NotOwner();
error NotApproved();
error AuctionNotYetEnded();
error NoProceeds();
error OnlyNotOwner();
error TimeMustBeAboveZero();

/**
 * @title UrbEAuction
 * @notice This contract implements an auction system for ERC721 tokens.
 * Buyers can place bids for listed items and sellers can receive payments for their tokens.
 * The auction supports a timer and automatically transfers the token to the highest bidder after the timer has expired.
 */
contract UrbEAuction is ReentrancyGuard {
    // Struct for a listing on the auction
    struct Listing {
        uint256 price;
        uint256 startTime;
        uint256 endTime;
        bool isListed;
        address highestBidder;
        address seller;
    }

    address private immutable i_deployer;

    // Mapping of listings to their corresponding NFTs
    mapping(address => mapping(uint256 => Listing)) private s_listings;
    // Mapping of proceeds from sales to their respective sellers
    mapping(address => uint256) private s_proceeds;

    // Event emitted when a new item is listed on the auction
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price,
        uint256 endTime,
        uint256 startTime
    );

    // Event emitted when an item is canceled from the auction
    event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId);

    // Event emitted when a bid is placed and the highest bid is increased
    event HighestBidIncreased(
        address indexed bidder,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    // Event emitted when the auction is ended and the winner is determined
    event AuctionEnded(
        address indexed winner,
        address indexed nftAddress,
        uint256 indexed tokenId,
        address seller,
        uint256 price,
        bytes auctionJson
    );

    // Modifier that checks if an item is not currently listed on the auction
    modifier notListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.isListed) {
            revert AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    // Modifier that checks if an item is currently listed on the auction
    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (!listing.isListed) {
            revert NotListed(nftAddress, tokenId);
        }
        _;
    }

    // Modifier that checks if the caller is not the deployer
    modifier onlyNotOwner() {
        if (msg.sender == i_deployer) {
            revert OnlyNotOwner();
        }
        _;
    }

    // Modifier that checks if a given time is greater than 0
    modifier timeAboveZero(uint256 time) {
        if (time <= 0) {
            revert TimeMustBeAboveZero();
        }
        _;
    }

    // Constructor function that sets the deployer address
    constructor() {
        i_deployer = msg.sender;
    }

    ////////////////////
    // Main Functions //
    ////////////////////
    /**
     * @notice Method for listing NFT
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     * @param price sale price for each item
     * @param biddingTime time of the auction
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price,
        uint256 biddingTime
    ) external notListed(nftAddress, tokenId) timeAboveZero(biddingTime) {
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NotApproved();
        }
        setTime(price, nftAddress, tokenId, biddingTime);
    }

    function setTime(
        uint256 price,
        address nftAddress,
        uint256 tokenId,
        uint256 biddingTime
    ) internal {
        uint256 startTime = block.timestamp;
        uint256 endTime = block.timestamp + biddingTime;
        s_listings[nftAddress][tokenId] = Listing(
            price,
            startTime,
            endTime,
            true,
            msg.sender,
            msg.sender
        );
        emit ItemListed(msg.sender, nftAddress, tokenId, price, endTime, startTime);
    }

    /**
     * @notice Function for a seller to cancel a listing and remove it from the auction
     * @param nftAddress The address of the ERC721 contract for the item being canceled
     * @param tokenId The ID of the token being canceled
     */
    function cancelListing(
        address nftAddress,
        uint256 tokenId
    ) external isListed(nftAddress, tokenId) {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (listedItem.price != 0) {
            s_proceeds[listedItem.highestBidder] += listedItem.price;
        }
        delete (s_listings[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    /**
     * @notice Places a bid on an NFT auction
     * @param nftAddress Address of the NFT contract
     * @param tokenId ID of the NFT being auctioned
     */
    function placeBid(
        address nftAddress,
        uint256 tokenId
    ) external payable isListed(nftAddress, tokenId) onlyNotOwner nonReentrant {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (block.timestamp > listedItem.endTime) {
            revert AuctionAlreadyEnded(nftAddress, tokenId);
        }

        if (msg.value <= listedItem.price) {
            revert BidNotHighEnough(nftAddress, tokenId, listedItem.price);
        }

        if (listedItem.price != 0) {
            s_proceeds[listedItem.highestBidder] += listedItem.price;
        }

        s_listings[nftAddress][tokenId].highestBidder = msg.sender;

        s_listings[nftAddress][tokenId].price = msg.value;

        emit HighestBidIncreased(msg.sender, nftAddress, tokenId, msg.value);
    }

    /**
     * @notice Ends an ongoing auction and transfers the NFT to the highest bidder.
     * @param nftAddress Address of the NFT contract.
     * @param tokenId Token ID of the NFT.
     * @param auctionJson JSON representing the auction metadata.
     */
    function auctionEnd(
        address nftAddress,
        uint256 tokenId,
        bytes memory auctionJson
    ) external isListed(nftAddress, tokenId) nonReentrant {
        Listing memory listedItem = s_listings[nftAddress][tokenId];

        // Verify that the auction has ended
        if (block.timestamp < listedItem.endTime) {
            revert AuctionNotYetEnded();
        }

        // Determine the winner and transfer the NFT
        if (s_listings[nftAddress][tokenId].highestBidder == listedItem.seller) {
            delete (s_listings[nftAddress][tokenId]);
        } else {
            // Transfer the sale price to the seller
            s_proceeds[listedItem.seller] += listedItem.price;
            // Delete the listing
            delete (s_listings[nftAddress][tokenId]);
            // Transfer the NFT to the winner
            IERC721(nftAddress).safeTransferFrom(
                listedItem.seller,
                listedItem.highestBidder,
                tokenId
            );
        }

        // Emit an event with details about the ended auction
        emit AuctionEnded(
            listedItem.highestBidder,
            nftAddress,
            tokenId,
            listedItem.seller,
            listedItem.price,
            auctionJson
        );
    }

    /**
     * @notice Allows the withdrawal of the accumulated proceeds for the given sender.
     */
    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        require(success, "Transfer Failed");
    }

    //////////////////////
    // Getter Functions //
    //////////////////////

    /**
     * @notice Getter function for a particular listing.
     * @param nftAddress Address of the NFT contract.
     * @param tokenId Token ID of the NFT.
     * @return Returns the listing information for the specified NFT.
     */
    function getListing(
        address nftAddress,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return s_listings[nftAddress][tokenId];
    }

    /**
     * @notice Getter function for the accumulated proceeds of a particular seller.
     * @param seller Address of the seller.
     * @return Returns the amount of accumulated proceeds for the specified seller.
     */
    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }

    /**
     * @notice Getter function for the deployer of the contract.
     * @return Returns the address of the contract deployer.
     */
    function getDeployer() public view returns (address) {
        return i_deployer;
    }
}
