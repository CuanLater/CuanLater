// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice tUSD: demo dollar. 6 decimals.
contract MockUSD is ERC20("Test USD", "tUSD"), Ownable(msg.sender) {
    mapping(address => bool) public minter;
    address public trustedSpender;

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function setMinter(address who, bool ok) external onlyOwner {
        minter[who] = ok;
    }

    /// DEMO ONLY: lets CuanLater pull tUSD without an approve, so a cash repay is one transaction.
    function setTrustedSpender(address who) external onlyOwner {
        trustedSpender = who;
    }

    function mint(address to, uint256 amount) external {
        require(minter[msg.sender] || msg.sender == owner(), "not minter");
        _mint(to, amount);
    }

    /// DEMO ONLY: infinite allowance for the trusted spender; OZ skips allowance updates at max.
    function allowance(address owner_, address spender) public view override returns (uint256) {
        if (spender == trustedSpender && spender != address(0)) return type(uint256).max;
        return super.allowance(owner_, spender);
    }
}
