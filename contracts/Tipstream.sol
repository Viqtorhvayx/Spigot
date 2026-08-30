// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Tipstream
/// @notice Social creator tipping for X1 EcoChain. Fans follow creators, tip
/// them with a message, and creators can reply publicly — a two-way loop,
/// not just a payment log. Every tip splits automatically: a fixed platform
/// fee to the protocol treasury, the rest credited to the creator as a
/// withdrawable balance — pulled, never pushed, so one broken recipient can
/// never block anyone else's tip.
contract Tipstream {
    struct Creator {
        string name;
        string bio;
        uint256 registeredAt;
        uint256 totalReceived; // lifetime net amount attributed to this creator
        uint256 tipCount;
        uint256 followerCount;
        uint256 goalTarget; // 0 = no goal set
        string goalDescription;
    }

    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_BIO_LENGTH = 280;
    uint256 public constant MAX_MESSAGE_LENGTH = 280;
    uint256 public constant MAX_GOAL_DESC_LENGTH = 140;

    address public immutable feeRecipient;

    mapping(address => Creator) public creators;
    address[] public creatorList;
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice Any address — creator or fan — can set a display name, shown
    /// in feeds and leaderboards instead of a raw address.
    mapping(address => string) public displayNames;

    mapping(address => mapping(address => bool)) public isFollowing; // fan => creator => following?

    mapping(uint256 => address) public tipRecipient; // tipId => creator, for reply authorization
    mapping(uint256 => string) public tipReplies; // tipId => creator's public reply
    uint256 public totalTips;

    bool private locked;

    event CreatorRegistered(address indexed creator, string name, uint256 timestamp);
    event ProfileUpdated(address indexed creator, string name, uint256 timestamp);
    event DisplayNameSet(address indexed account, string name);
    event GoalSet(address indexed creator, uint256 target, string description);
    event Followed(address indexed fan, address indexed creator);
    event Unfollowed(address indexed fan, address indexed creator);
    event TipSent(uint256 indexed tipId, address indexed from, address indexed to, uint256 payout, uint256 fee, string message, uint256 timestamp);
    event TipReplied(uint256 indexed tipId, address indexed creator, string reply, uint256 timestamp);
    event Withdrawn(address indexed account, uint256 amount);

    error NameRequired();
    error NameTooLong();
    error BioTooLong();
    error MessageTooLong();
    error GoalDescriptionTooLong();
    error ReplyTooLong();
    error AlreadyRegistered();
    error NotRegistered();
    error CreatorNotRegistered();
    error TipMustBePositive();
    error NothingToWithdraw();
    error TransferFailed();
    error InvalidFeeRecipient();
    error ReentrancyBlocked();
    error CannotFollowSelf();
    error AlreadyFollowing();
    error NotFollowing();
    error NotTipRecipient();

    modifier nonReentrant() {
        if (locked) revert ReentrancyBlocked();
        locked = true;
        _;
        locked = false;
    }

    constructor(address _feeRecipient) {
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        feeRecipient = _feeRecipient;
    }

    /// @notice One-time page creation. Use `updateProfile` afterward to change it.
    function registerCreator(string calldata name, string calldata bio) external {
        _validateProfile(name, bio);
        if (creators[msg.sender].registeredAt != 0) revert AlreadyRegistered();

        creators[msg.sender] = Creator({
            name: name,
            bio: bio,
            registeredAt: block.timestamp,
            totalReceived: 0,
            tipCount: 0,
            followerCount: 0,
            goalTarget: 0,
            goalDescription: ""
        });
        creatorList.push(msg.sender);
        emit CreatorRegistered(msg.sender, name, block.timestamp);
    }

    /// @notice Update an existing page's name/bio. Stats and history are untouched.
    function updateProfile(string calldata name, string calldata bio) external {
        _validateProfile(name, bio);
        Creator storage c = creators[msg.sender];
        if (c.registeredAt == 0) revert NotRegistered();

        c.name = name;
        c.bio = bio;
        emit ProfileUpdated(msg.sender, name, block.timestamp);
    }

    /// @notice Set a display name for any address — fans included, not just
    /// creators — so feeds and leaderboards can show a name instead of 0x…
    function setDisplayName(string calldata name) external {
        if (bytes(name).length > MAX_NAME_LENGTH) revert NameTooLong();
        displayNames[msg.sender] = name;
        emit DisplayNameSet(msg.sender, name);
    }

    /// @notice Set (or clear, with target 0) a funding goal shown as a
    /// progress bar against totalReceived.
    function setGoal(uint256 target, string calldata description) external {
        Creator storage c = creators[msg.sender];
        if (c.registeredAt == 0) revert NotRegistered();
        if (bytes(description).length > MAX_GOAL_DESC_LENGTH) revert GoalDescriptionTooLong();

        c.goalTarget = target;
        c.goalDescription = description;
        emit GoalSet(msg.sender, target, description);
    }

    function follow(address creator) external {
        if (creator == msg.sender) revert CannotFollowSelf();
        if (creators[creator].registeredAt == 0) revert CreatorNotRegistered();
        if (isFollowing[msg.sender][creator]) revert AlreadyFollowing();

        isFollowing[msg.sender][creator] = true;
        creators[creator].followerCount += 1;
        emit Followed(msg.sender, creator);
    }

    function unfollow(address creator) external {
        if (!isFollowing[msg.sender][creator]) revert NotFollowing();

        isFollowing[msg.sender][creator] = false;
        creators[creator].followerCount -= 1;
        emit Unfollowed(msg.sender, creator);
    }

    /// @notice Send a tip. Splits msg.value between the creator and the
    /// platform fee recipient as pending withdrawals — call `withdraw()`
    /// to actually move the funds. Returns the tip's id, usable by the
    /// creator to reply via `replyToTip`.
    function tip(address creator, string calldata message) external payable returns (uint256) {
        if (msg.value == 0) revert TipMustBePositive();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong();
        if (creators[creator].registeredAt == 0) revert CreatorNotRegistered();

        uint256 fee = (msg.value * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = msg.value - fee;

        Creator storage c = creators[creator];
        c.totalReceived += payout;
        c.tipCount += 1;

        pendingWithdrawals[creator] += payout;
        pendingWithdrawals[feeRecipient] += fee;

        uint256 tipId = totalTips;
        tipRecipient[tipId] = creator;
        totalTips += 1;

        emit TipSent(tipId, msg.sender, creator, payout, fee, message, block.timestamp);
        return tipId;
    }

    /// @notice The creator who received a tip can post one public reply to it.
    function replyToTip(uint256 tipId, string calldata reply) external {
        if (tipRecipient[tipId] != msg.sender) revert NotTipRecipient();
        if (bytes(reply).length > MAX_MESSAGE_LENGTH) revert ReplyTooLong();

        tipReplies[tipId] = reply;
        emit TipReplied(tipId, msg.sender, reply, block.timestamp);
    }

    /// @notice Pull your full pending balance. Works identically for
    /// creators and the platform fee recipient.
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    function getCreators() external view returns (address[] memory) {
        return creatorList;
    }

    function creatorCount() external view returns (uint256) {
        return creatorList.length;
    }

    function _validateProfile(string calldata name, string calldata bio) private pure {
        if (bytes(name).length == 0) revert NameRequired();
        if (bytes(name).length > MAX_NAME_LENGTH) revert NameTooLong();
        if (bytes(bio).length > MAX_BIO_LENGTH) revert BioTooLong();
    }
}
