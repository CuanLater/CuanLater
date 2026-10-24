// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice tNVDA: demo stand-in for a tokenized Nvidia share. 18 decimals.
contract MockStock is ERC20("Test Nvidia", "tNVDA"), Ownable(msg.sender) {
    mapping(address => bool) public minter;

    function setMinter(address who, bool ok) external onlyOwner {
        minter[who] = ok;
    }

    function mint(address to, uint256 amount) external {
        require(minter[msg.sender], "not minter");
        _mint(to, amount);
    }
}
