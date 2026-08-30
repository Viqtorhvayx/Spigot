// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Greeter {
    string private greeting;
    address public owner;

    event GreetingChanged(string newGreeting, address changedBy);

    constructor(string memory _greeting) {
        greeting = _greeting;
        owner = msg.sender;
    }

    function greet() external view returns (string memory) {
        return greeting;
    }

    function setGreeting(string calldata _greeting) external {
        greeting = _greeting;
        emit GreetingChanged(_greeting, msg.sender);
    }
}
