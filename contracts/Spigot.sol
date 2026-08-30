// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Spigot
/// @notice Pay-per-call settlement rails for APIs, AI agents, and machine
/// services on X1 EcoChain — an X1-native implementation of the same
/// pattern as x402 (HTTP 402 Payment Required): a caller pays per request,
/// a provider gets paid instantly. Two payment modes are supported:
/// `payAndCall` for occasional callers who just send value with the call,
/// and `callService` against a prepaid credit balance for high-frequency
/// agent callers who don't want a full transaction's gas overhead on
/// every single request.
contract Spigot {
    struct Service {
        address provider;
        string name;
        string description;
        uint256 pricePerCall;
        uint256 maxCallsPerDay; // 0 = unlimited
        uint256 registeredAt;
        uint256 totalCalls;
        uint256 totalRevenue; // net, after fee
        bool active;
    }

    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_DESC_LENGTH = 280;

    address public immutable feeRecipient;

    uint256 public totalServices;
    mapping(uint256 => Service) public services;

    mapping(address => uint256) public consumerBalance; // prepaid credit
    mapping(address => uint256) public pendingWithdrawals; // provider/fee earnings
    mapping(address => string) public displayNames;

    // serviceId => day epoch => consumer => calls made that day
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public callsInEpoch;

    uint256 public totalCallsSettled;

    bool private locked;

    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, string name, uint256 pricePerCall);
    event ServiceUpdated(uint256 indexed serviceId, string name, uint256 pricePerCall, bool active);
    event DisplayNameSet(address indexed account, string name);
    event CreditDeposited(address indexed consumer, uint256 amount);
    event CreditWithdrawn(address indexed consumer, uint256 amount);
    event CallSettled(uint256 indexed receiptId, uint256 indexed serviceId, address indexed consumer, uint256 payout, uint256 fee, uint256 timestamp);
    event Withdrawn(address indexed account, uint256 amount);

    error NameRequired();
    error NameTooLong();
    error DescriptionTooLong();
    error InvalidPrice();
    error ServiceNotFound();
    error NotServiceProvider();
    error ServiceInactive();
    error InsufficientCredit();
    error IncorrectPayment();
    error DailyLimitReached();
    error NothingToWithdraw();
    error TransferFailed();
    error InvalidFeeRecipient();
    error ReentrancyBlocked();
    error NothingToDeposit();

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

    function setDisplayName(string calldata name) external {
        if (bytes(name).length > MAX_NAME_LENGTH) revert NameTooLong();
        displayNames[msg.sender] = name;
        emit DisplayNameSet(msg.sender, name);
    }

    /// @notice Register a paid service. Returns its id (0, 1, 2, ... —
    /// sequential, so the frontend can enumerate 0..totalServices-1).
    function registerService(
        string calldata name,
        string calldata description,
        uint256 pricePerCall,
        uint256 maxCallsPerDay
    ) external returns (uint256 serviceId) {
        _validateService(name, description, pricePerCall);

        serviceId = totalServices;
        services[serviceId] = Service({
            provider: msg.sender,
            name: name,
            description: description,
            pricePerCall: pricePerCall,
            maxCallsPerDay: maxCallsPerDay,
            registeredAt: block.timestamp,
            totalCalls: 0,
            totalRevenue: 0,
            active: true
        });
        totalServices += 1;

        emit ServiceRegistered(serviceId, msg.sender, name, pricePerCall);
    }

    function updateService(
        uint256 serviceId,
        string calldata name,
        string calldata description,
        uint256 pricePerCall,
        uint256 maxCallsPerDay,
        bool active
    ) external {
        Service storage s = services[serviceId];
        if (s.provider == address(0)) revert ServiceNotFound();
        if (s.provider != msg.sender) revert NotServiceProvider();
        _validateService(name, description, pricePerCall);

        s.name = name;
        s.description = description;
        s.pricePerCall = pricePerCall;
        s.maxCallsPerDay = maxCallsPerDay;
        s.active = active;

        emit ServiceUpdated(serviceId, name, pricePerCall, active);
    }

    function depositCredit() external payable {
        if (msg.value == 0) revert NothingToDeposit();
        consumerBalance[msg.sender] += msg.value;
        emit CreditDeposited(msg.sender, msg.value);
    }

    function withdrawCredit(uint256 amount) external nonReentrant {
        if (amount == 0 || amount > consumerBalance[msg.sender]) revert InsufficientCredit();
        consumerBalance[msg.sender] -= amount;
        emit CreditWithdrawn(msg.sender, amount);
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    /// @notice Pay for one call from your prepaid credit balance — no
    /// transaction value needed, just gas. Built for high-frequency,
    /// automated agent callers.
    function callService(uint256 serviceId) external returns (uint256 receiptId) {
        Service storage s = _checkAndMeter(serviceId);
        if (consumerBalance[msg.sender] < s.pricePerCall) revert InsufficientCredit();

        consumerBalance[msg.sender] -= s.pricePerCall;
        receiptId = _settle(serviceId, s, msg.sender);
    }

    /// @notice Pay for one call directly with msg.value — no prepay step,
    /// for occasional or one-off callers.
    function payAndCall(uint256 serviceId) external payable returns (uint256 receiptId) {
        Service storage s = _checkAndMeter(serviceId);
        if (msg.value != s.pricePerCall) revert IncorrectPayment();

        receiptId = _settle(serviceId, s, msg.sender);
    }

    /// @notice Pull your full pending balance. Works identically for
    /// providers and the platform fee recipient.
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    function _validateService(string calldata name, string calldata description, uint256 pricePerCall) private pure {
        if (bytes(name).length == 0) revert NameRequired();
        if (bytes(name).length > MAX_NAME_LENGTH) revert NameTooLong();
        if (bytes(description).length > MAX_DESC_LENGTH) revert DescriptionTooLong();
        if (pricePerCall == 0) revert InvalidPrice();
    }

    function _checkAndMeter(uint256 serviceId) private returns (Service storage s) {
        s = services[serviceId];
        if (s.provider == address(0)) revert ServiceNotFound();
        if (!s.active) revert ServiceInactive();

        if (s.maxCallsPerDay > 0) {
            uint256 epoch = block.timestamp / 1 days;
            uint256 used = callsInEpoch[serviceId][epoch][msg.sender];
            if (used >= s.maxCallsPerDay) revert DailyLimitReached();
            callsInEpoch[serviceId][epoch][msg.sender] = used + 1;
        }
    }

    function _settle(uint256 serviceId, Service storage s, address consumer) private returns (uint256 receiptId) {
        uint256 fee = (s.pricePerCall * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = s.pricePerCall - fee;

        s.totalCalls += 1;
        s.totalRevenue += payout;

        pendingWithdrawals[s.provider] += payout;
        pendingWithdrawals[feeRecipient] += fee;

        receiptId = totalCallsSettled;
        totalCallsSettled += 1;

        emit CallSettled(receiptId, serviceId, consumer, payout, fee, block.timestamp);
    }
}
