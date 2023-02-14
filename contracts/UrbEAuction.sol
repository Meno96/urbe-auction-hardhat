// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error AlreadyListed(address nftAddress, uint256 tokenId);
error NotListed(address nftAddress, uint256 tokenId);
error BidNotHighEnough(address nftAddress, uint256 tokenId, uint256 price);
error NotOwner();
error NotApproved();
error AuctionAlreadyEnded(address nftAddress, uint256 tokenId);
error AuctionNotYetEnded();
error NoProceeds();
error OnlyNotOwner();

contract UrbEAuction is ReentrancyGuard, Ownable {
    struct Listing {
        uint256 price;
        uint256 endTime;
    }

    address public s_highestBidder;
    address private immutable i_deployer;

    mapping(address => mapping(uint256 => Listing)) private s_listings;
    mapping(address => uint256) private s_proceeds;

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCanceled(address indexed nftAddress, uint256 indexed tokenId);

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event HighestBidIncreased(address indexed bidder, uint256 indexed price);
    event AuctionEnded(
        address indexed winner,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    modifier notListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price > 0) {
            revert AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price <= 0) {
            revert NotListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (spender != owner) {
            revert NotOwner();
        }
        _;
    }

    modifier onlyNotOwner() {
        if (msg.sender == i_deployer) {
            revert OnlyNotOwner();
        }
        _;
    }

    constructor() {
        i_deployer = msg.sender;
    }

    ////////////////////
    // Main Functions //
    ////////////////////
    /*
     * @notice Method for listing NFT
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     * @param price sale price for each item
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price,
        uint256 biddingTime
    ) external onlyOwner notListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, msg.sender) {
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NotApproved();
        }
        setTime(price, nftAddress, tokenId, biddingTime);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function setTime(
        uint256 price,
        address nftAddress,
        uint256 tokenId,
        uint256 biddingTime
    ) internal {
        uint256 endTime = block.timestamp + biddingTime;
        s_listings[nftAddress][tokenId] = Listing(price, endTime);
    }

    function cancelListing(
        address nftAddress,
        uint256 tokenId
    ) external onlyOwner isListed(nftAddress, tokenId) {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        delete (s_listings[nftAddress][tokenId]);
        if (listedItem.price != 0) {
            s_proceeds[s_highestBidder] += listedItem.price;
        }
        emit ItemCanceled(nftAddress, tokenId);
    }

    function placeBid(
        address nftAddress,
        uint256 tokenId
    ) external payable isListed(nftAddress, tokenId) onlyNotOwner nonReentrant {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (block.timestamp > listedItem.endTime) {
            revert AuctionAlreadyEnded(nftAddress, tokenId);
        }

        if (msg.value < listedItem.price) {
            revert BidNotHighEnough(nftAddress, tokenId, listedItem.price);
        }

        if (listedItem.price != 0) {
            s_proceeds[s_highestBidder] += listedItem.price;
        }

        s_highestBidder = msg.sender;

        listedItem.price = msg.value;

        emit HighestBidIncreased(msg.sender, msg.value);
    }

    function auctionEnd(
        address nftAddress,
        uint256 tokenId
    ) external payable isListed(nftAddress, tokenId) nonReentrant {
        Listing memory listedItem = s_listings[nftAddress][tokenId];

        if (block.timestamp < listedItem.endTime) {
            revert AuctionNotYetEnded();
        }

        s_proceeds[i_deployer] += listedItem.price;
        delete (s_listings[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(i_deployer, s_highestBidder, tokenId);

        emit AuctionEnded(s_highestBidder, nftAddress, tokenId, listedItem.price);
    }

    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        require(success, "Transfer Failed");
    }
}
