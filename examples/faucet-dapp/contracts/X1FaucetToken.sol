// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice A self-serve claim faucet: anyone can claim a fixed amount of
/// tokens once per cooldown period, no Discord bot required.
contract X1FaucetToken is ERC20, Ownable {
    uint256 public claimAmount = 50 * 10 ** 18;
    uint256 public cooldown = 1 hours;

    mapping(address => uint256) public lastClaimed;

    event Claimed(address indexed claimant, uint256 amount);

    constructor(uint256 initialSupply) ERC20("X1 Faucet Token", "X1F") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    function claim() external {
        require(block.timestamp >= lastClaimed[msg.sender] + cooldown, "Claim cooldown active");
        lastClaimed[msg.sender] = block.timestamp;
        _mint(msg.sender, claimAmount);
        emit Claimed(msg.sender, claimAmount);
    }

    function timeUntilNextClaim(address account) external view returns (uint256) {
        uint256 nextClaimTime = lastClaimed[account] + cooldown;
        if (block.timestamp >= nextClaimTime) return 0;
        return nextClaimTime - block.timestamp;
    }

    function setClaimAmount(uint256 _amount) external onlyOwner {
        claimAmount = _amount;
    }

    function setCooldown(uint256 _cooldown) external onlyOwner {
        cooldown = _cooldown;
    }
}
