// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract UrbEVehicleNft is ERC721URIStorage {
    // NFT Variables
    struct NFT {
        string uri;
        string name;
    }

    uint256 private s_tokenCounter;
    uint256 private s_nftCount;

    mapping(uint256 => NFT) public s_nfts;

    event NftMinted(uint256 indexed tokenId);

    constructor() ERC721("UrbE Vehicles NFT", "URBE") {
        s_tokenCounter = 0;
        s_nftCount = 0;
    }

    // Main Functions
    function updateMappingNft(string memory _uri, string memory _name) public {
        s_nfts[s_nftCount] = NFT(_uri, _name);
        s_nftCount = s_nftCount + 1;
    }

    function mintNft(uint256 index) public {
        uint256 newItemId = s_tokenCounter;
        s_tokenCounter = s_tokenCounter + 1;
        _safeMint(msg.sender, newItemId);
        _setTokenURI(newItemId, s_nfts[index].uri);
        emit NftMinted(newItemId);
    }

    // Getter Functions
    function getNftInfos() public view returns (NFT[] memory) {
        NFT[] memory result = new NFT[](s_nftCount);
        for (uint256 i = 0; i < s_nftCount; i++) {
            result[i] = s_nfts[i];
        }
        return result;
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }
}
