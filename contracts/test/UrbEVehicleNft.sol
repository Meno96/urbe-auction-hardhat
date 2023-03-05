// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// Import the ERC721URIStorage contract from the OpenZeppelin library
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

// Create the UrbEVehicleNft contract, which inherits from ERC721URIStorage
contract UrbEVehicleNft is ERC721URIStorage {
    // Struct representing the data associated with an NFT
    struct NFT {
        string uri;
        string name;
    }

    // Private state variables
    uint256 private s_tokenCounter; // Tracks the total number of tokens minted
    uint256 private s_nftCount; // Tracks the number of NFTs defined

    // Mapping between an NFT index and its associated data
    mapping(uint256 => NFT) public s_nfts;

    // Event emitted when an NFT is minted
    event NftMinted(uint256 indexed tokenId);

    constructor() ERC721("UrbE Vehicles NFT", "URBE") {
        s_tokenCounter = 0;
        s_nftCount = 0;
    }

    ////////////////////
    // Main Functions //
    ////////////////////
    /**
     * @notice Method for updating the mapping of NFT
     * @param _uri URI for NFT
     * @param _name Name for NFT
     */
    function updateMappingNft(string memory _uri, string memory _name) public {
        s_nfts[s_nftCount] = NFT(_uri, _name);
        s_nftCount = s_nftCount + 1;
    }

    /**
     * @notice Method for minting an NFT
     * @param index Index of NFT to mint
     */
    function mintNft(uint256 index) public {
        uint256 newItemId = s_tokenCounter;
        s_tokenCounter = s_tokenCounter + 1;
        _safeMint(msg.sender, newItemId);
        _setTokenURI(newItemId, s_nfts[index].uri);
        emit NftMinted(newItemId);
    }

    //////////////////////
    // Getter Functions //
    //////////////////////

    /**
     * @notice Method for getting information about all NFTs in the mapping
     * @return result Array of NFT structs containing URI and name for each NFT in the mapping
     */
    function getNftInfos() public view returns (NFT[] memory) {
        NFT[] memory result = new NFT[](s_nftCount);
        for (uint256 i = 0; i < s_nftCount; i++) {
            result[i] = s_nfts[i];
        }
        return result;
    }

    /**
     * @notice Method for getting the current token counter value
     * @return s_tokenCounter Current value of the token counter
     */
    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }
}
