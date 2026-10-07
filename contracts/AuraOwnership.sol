// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract AuraOwnership is ERC721, ERC721URIStorage, ERC2981, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;

    constructor(address admin, string memory baseTokenURI_, address royaltyReceiver, uint96 royaltyBps)
        ERC721("AURA Ownership", "AURA")
    {
        require(admin != address(0), "admin=0");
        require(royaltyReceiver != address(0), "royalty=0");
        require(royaltyBps <= 1000, "royalty>10%");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _setDefaultRoyalty(royaltyReceiver, royaltyBps);
        _baseTokenURI = baseTokenURI_;
    }

    function mint(address to, string calldata tokenUri) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256 tokenId) {
        require(to != address(0), "to=0");
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function setBaseTokenURI(string calldata value) external onlyRole(DEFAULT_ADMIN_ROLE) { _baseTokenURI = value; }

    function setDefaultRoyalty(address receiver, uint96 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(receiver != address(0), "receiver=0");
        require(bps <= 1000, "royalty>10%");
        _setDefaultRoyalty(receiver, bps);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, ERC2981, AccessControl) returns (bool)
    { return super.supportsInterface(interfaceId); }

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    { return super.tokenURI(tokenId); }

    function _baseURI() internal view override returns (string memory) { return _baseTokenURI; }

    function _update(address to, uint256 tokenId, address auth)
        internal override whenNotPaused returns (address)
    { return super._update(to, tokenId, auth); }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721) { super._increaseBalance(account, value); }
}
