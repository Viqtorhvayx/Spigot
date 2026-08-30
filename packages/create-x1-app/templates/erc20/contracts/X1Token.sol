// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract X1Token is ERC20 {
    constructor(uint256 initialSupply) ERC20("X1 Sample Token", "X1S") {
        _mint(msg.sender, initialSupply);
    }
}
