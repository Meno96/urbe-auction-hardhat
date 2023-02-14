// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error UrbEVehicleNft_NotDeployer();

contract UrbEVehicleNft is ERC721URIStorage, Ownable {
    // NFT Variables
    uint256 private s_tokenCounter;
    string[] internal s_vehicleURIs;

    event NftMinted(uint256 indexed tokenId);

    mapping(string => uint) public s_jsonValues;

    constructor(string memory vehiclesURIs) ERC721("UrbE Vehicles NFT", "URBE") {
        s_vehicleURIs.push(vehiclesURIs);
        s_tokenCounter = 0;
    }

    // Main Functions
    function updateArrayUri(string memory _newUri) public onlyOwner {
        s_vehicleURIs.push(_newUri);
    }

    function mintNft(uint256 index) public {
        uint256 newItemId = s_tokenCounter;
        s_tokenCounter = s_tokenCounter + 1;
        _safeMint(msg.sender, newItemId);
        _setTokenURI(newItemId, s_vehicleURIs[index]);
        emit NftMinted(newItemId);
    }

    // Getter Functions
    function getvehicleURI(uint256 index) public view returns (string memory) {
        return s_vehicleURIs[index];
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }
}
