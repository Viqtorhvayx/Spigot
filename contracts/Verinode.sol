// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice On-chain liveness attestation for X1 EcoChain node operators.
/// Operators register once, then submit periodic heartbeats. Uptime becomes
/// a verifiable on-chain record instead of a self-reported claim.
contract Verinode {
    struct Node {
        string label;
        uint256 registeredAt;
        uint256 lastHeartbeat;
        uint256 heartbeatCount;
    }

    uint256 public constant MIN_INTERVAL = 30 minutes;
    uint256 public constant ACTIVE_WINDOW = 2 hours;

    mapping(address => Node) public nodes;
    address[] public operators;

    event NodeRegistered(address indexed operator, string label, uint256 timestamp);
    event HeartbeatSubmitted(address indexed operator, uint256 timestamp, uint256 heartbeatCount);

    function registerNode(string calldata label) external {
        require(nodes[msg.sender].registeredAt == 0, "Already registered");
        nodes[msg.sender] = Node({
            label: label,
            registeredAt: block.timestamp,
            lastHeartbeat: 0,
            heartbeatCount: 0
        });
        operators.push(msg.sender);
        emit NodeRegistered(msg.sender, label, block.timestamp);
    }

    function heartbeat() external {
        Node storage n = nodes[msg.sender];
        require(n.registeredAt != 0, "Not registered");
        require(block.timestamp >= n.lastHeartbeat + MIN_INTERVAL, "Heartbeat too soon");
        n.lastHeartbeat = block.timestamp;
        n.heartbeatCount += 1;
        emit HeartbeatSubmitted(msg.sender, block.timestamp, n.heartbeatCount);
    }

    function isActive(address operator) external view returns (bool) {
        Node storage n = nodes[operator];
        if (n.lastHeartbeat == 0) return false;
        return block.timestamp <= n.lastHeartbeat + ACTIVE_WINDOW;
    }

    function operatorCount() external view returns (uint256) {
        return operators.length;
    }

    function getOperators() external view returns (address[] memory) {
        return operators;
    }
}
