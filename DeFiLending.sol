// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DeFiLending
 * @dev Platform untuk meminjam dan meminjamkan aset crypto dengan oracle untuk data harga
 */
contract DeFiLending is Ownable, ReentrancyGuard {
    // Struktur data untuk informasi mengenai asset yang tersedia
    struct Asset {
        address tokenAddress;        // Alamat token ERC20
        address priceFeedAddress;    // Alamat Chainlink price feed
        uint256 collateralFactor;    // Persentase nilai (basis point, mis. 7500 = 75%)
        uint256 borrowFactor;        // Persentase nilai yang bisa dipinjam (basis point)
        uint256 liquidationThreshold; // Threshold untuk likuidasi (basis point)
        uint256 totalSupplied;       // Total jumlah token yang disupply
        uint256 totalBorrowed;       // Total jumlah token yang dipinjam
        uint256 supplyInterestRate;  // Suku bunga untuk supplier (basis point per tahun)
        uint256 borrowInterestRate;  // Suku bunga untuk peminjam (basis point per tahun)
        bool isActive;               // Status keaktifan asset
    }

    // Struktur data untuk informasi posisi pengguna
    struct UserPosition {
        uint256 supplied;            // Jumlah token yang disupply
        uint256 borrowed;            // Jumlah token yang dipinjam
        uint256 lastUpdateTimestamp; // Timestamp terakhir update bunga
    }

    // Mapping dari asset symbol ke info asset
    mapping(string => Asset) public assets;
    // List asset symbols yang terdaftar
    string[] public assetSymbols;
    // Mapping dari user address ke asset symbol ke posisi user
    mapping(address => mapping(string => UserPosition)) public userPositions;

    // Events
    event AssetAdded(string symbol, address tokenAddress, address priceFeedAddress);
    event AssetUpdated(string symbol, uint256 collateralFactor, uint256 borrowFactor, uint256 liquidationThreshold);
    event Supplied(address indexed user, string symbol, uint256 amount);
    event Withdrawn(address indexed user, string symbol, uint256 amount);
    event Borrowed(address indexed user, string symbol, uint256 amount);
    event Repaid(address indexed user, string symbol, uint256 amount);
    event Liquidated(address indexed liquidator, address indexed borrower, string symbol, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Tambahkan asset baru ke platform
     */
    function addAsset(
        string memory symbol,
        address tokenAddress,
        address priceFeedAddress,
        uint256 collateralFactor,
        uint256 borrowFactor,
        uint256 liquidationThreshold,
        uint256 supplyInterestRate,
        uint256 borrowInterestRate
    ) external onlyOwner {
        require(assets[symbol].tokenAddress == address(0), "Asset already exists");
        require(collateralFactor <= 9000, "Collateral factor too high");
        require(borrowFactor <= collateralFactor, "Borrow factor too high");
        require(liquidationThreshold > collateralFactor, "Invalid liquidation threshold");

        assets[symbol] = Asset({
            tokenAddress: tokenAddress,
            priceFeedAddress: priceFeedAddress,
            collateralFactor: collateralFactor,
            borrowFactor: borrowFactor,
            liquidationThreshold: liquidationThreshold,
            totalSupplied: 0,
            totalBorrowed: 0,
            supplyInterestRate: supplyInterestRate,
            borrowInterestRate: borrowInterestRate,
            isActive: true
        });

        assetSymbols.push(symbol);

        emit AssetAdded(symbol, tokenAddress, priceFeedAddress);
    }

    /**
     * @dev Update parameter asset
     */
    function updateAsset(
        string memory symbol,
        uint256 collateralFactor,
        uint256 borrowFactor,
        uint256 liquidationThreshold,
        uint256 supplyInterestRate,
        uint256 borrowInterestRate,
        bool isActive
    ) external onlyOwner {
        require(assets[symbol].tokenAddress != address(0), "Asset does not exist");
        require(collateralFactor <= 9000, "Collateral factor too high");
        require(borrowFactor <= collateralFactor, "Borrow factor too high");
        require(liquidationThreshold > collateralFactor, "Invalid liquidation threshold");

        Asset storage asset = assets[symbol];
        asset.collateralFactor = collateralFactor;
        asset.borrowFactor = borrowFactor;
        asset.liquidationThreshold = liquidationThreshold;
        asset.supplyInterestRate = supplyInterestRate;
        asset.borrowInterestRate = borrowInterestRate;
        asset.isActive = isActive;

        emit AssetUpdated(symbol, collateralFactor, borrowFactor, liquidationThreshold);
    }

    /**
     * @dev Mendapatkan harga asset dari Chainlink oracle
     */
    function getAssetPrice(string memory symbol) public view returns (uint256) {
        Asset storage asset = assets[symbol];
        require(asset.tokenAddress != address(0), "Asset does not exist");
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(asset.priceFeedAddress);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        
        return uint256(price) * 10**10; // Adjust to 18 decimals
    }

    /**
     * @dev Menyediakan token ke platform sebagai likuiditas
     */
    function supply(string memory symbol, uint256 amount) external nonReentrant {
        Asset storage asset = assets[symbol];
        require(asset.isActive, "Asset not active");
        require(amount > 0, "Amount must be greater than 0");

        // Update interest first
        _updateInterest(symbol, msg.sender);

        // Transfer token dari user ke kontrak
        IERC20 token = IERC20(asset.tokenAddress);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Update user position dan total supply
        userPositions[msg.sender][symbol].supplied += amount;
        asset.totalSupplied += amount;

        emit Supplied(msg.sender, symbol, amount);
    }

    /**
     * @dev Menarik token yang telah disediakan
     */
    function withdraw(string memory symbol, uint256 amount) external nonReentrant {
        Asset storage asset = assets[symbol];
        UserPosition storage position = userPositions[msg.sender][symbol];
        
        require(asset.isActive, "Asset not active");
        require(amount > 0, "Amount must be greater than 0");
        require(position.supplied >= amount, "Insufficient balance");

        // Update interest first
        _updateInterest(symbol, msg.sender);

        // Check if withdrawal would violate health factor
        uint256 newSupplied = position.supplied - amount;
        require(_checkHealthFactor(symbol, msg.sender, newSupplied, position.borrowed), "Health factor too low");

        // Update user position dan total supply
        position.supplied = newSupplied;
        asset.totalSupplied -= amount;

        // Transfer token ke user
        IERC20 token = IERC20(asset.tokenAddress);
        require(token.transfer(msg.sender, amount), "Transfer failed");

        emit Withdrawn(msg.sender, symbol, amount);
    }

    /**
     * @dev Meminjam token dari platform
     */
    function borrow(string memory symbol, uint256 amount) external nonReentrant {
        Asset storage asset = assets[symbol];
        
        require(asset.isActive, "Asset not active");
        require(amount > 0, "Amount must be greater than 0");
        require(asset.totalSupplied - asset.totalBorrowed >= amount, "Insufficient liquidity");

        // Update interest first
        _updateInterest(symbol, msg.sender);

        // Check health factor
        UserPosition storage position = userPositions[msg.sender][symbol];
        require(_checkHealthFactor(symbol, msg.sender, position.supplied, position.borrowed + amount), "Health factor too low");

        // Update user position dan total borrowed
        position.borrowed += amount;
        asset.totalBorrowed += amount;

        // Transfer token ke user
        IERC20 token = IERC20(asset.tokenAddress);
        require(token.transfer(msg.sender, amount), "Transfer failed");

        emit Borrowed(msg.sender, symbol, amount);
    }

    /**
     * @dev Membayar kembali pinjaman
     */
    function repay(string memory symbol, uint256 amount) external nonReentrant {
        Asset storage asset = assets[symbol];
        UserPosition storage position = userPositions[msg.sender][symbol];
        
        require(asset.isActive, "Asset not active");
        require(amount > 0, "Amount must be greater than 0");
        require(position.borrowed > 0, "No outstanding loan");

        // Update interest first
        _updateInterest(symbol, msg.sender);

        // Calculate actual repay amount
        uint256 repayAmount = amount > position.borrowed ? position.borrowed : amount;

        // Transfer token dari user ke kontrak
        IERC20 token = IERC20(asset.tokenAddress);
        require(token.transferFrom(msg.sender, address(this), repayAmount), "Transfer failed");

        // Update user position dan total borrowed
        position.borrowed -= repayAmount;
        asset.totalBorrowed -= repayAmount;

        emit Repaid(msg.sender, symbol, repayAmount);
    }

    /**
     * @dev Likuidasi posisi yang tidak sehat
     */
    function liquidate(address borrower, string memory symbol, uint256 amount) external nonReentrant {
        Asset storage asset = assets[symbol];
        UserPosition storage position = userPositions[borrower][symbol];
        
        require(asset.isActive, "Asset not active");
        require(amount > 0, "Amount must be greater than 0");
        require(position.borrowed > 0, "No outstanding loan");

        // Update interest first
        _updateInterest(symbol, borrower);

        // Check if position is liquidatable
        require(!_isHealthy(symbol, borrower), "Position is healthy");

        // Calculate actual liquidation amount
        uint256 liquidationAmount = amount > position.borrowed ? position.borrowed : amount;
        
        // Calculate collateral to seize (with liquidation bonus)
        uint256 assetPrice = getAssetPrice(symbol);
        uint256 collateralToSeize = (liquidationAmount * assetPrice * 11000) / (assetPrice * 10000); // 10% bonus
        
        require(collateralToSeize <= position.supplied, "Insufficient collateral");

        // Transfer repayment from liquidator
        IERC20 token = IERC20(asset.tokenAddress);
        require(token.transferFrom(msg.sender, address(this), liquidationAmount), "Transfer failed");

        // Update borrower position
        position.borrowed -= liquidationAmount;
        position.supplied -= collateralToSeize;
        asset.totalBorrowed -= liquidationAmount;
        asset.totalSupplied -= collateralToSeize;

        // Transfer seized collateral to liquidator
        require(token.transfer(msg.sender, collateralToSeize), "Collateral transfer failed");

        emit Liquidated(msg.sender, borrower, symbol, liquidationAmount);
    }

    /**
     * @dev Calculate and update interest
     */
    function _updateInterest(string memory symbol, address user) internal {
        Asset storage asset = assets[symbol];
        UserPosition storage position = userPositions[user][symbol];
        
        if (position.lastUpdateTimestamp == 0) {
            position.lastUpdateTimestamp = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - position.lastUpdateTimestamp;
        if (timeElapsed == 0) return;

        // Calculate supply interest (simple interest for simplicity)
        if (position.supplied > 0) {
            uint256 supplyInterest = (position.supplied * asset.supplyInterestRate * timeElapsed) / (10000 * 365 days);
            position.supplied += supplyInterest;
            asset.totalSupplied += supplyInterest;
        }

        // Calculate borrow interest
        if (position.borrowed > 0) {
            uint256 borrowInterest = (position.borrowed * asset.borrowInterestRate * timeElapsed) / (10000 * 365 days);
            position.borrowed += borrowInterest;
            asset.totalBorrowed += borrowInterest;
        }

        position.lastUpdateTimestamp = block.timestamp;
    }

    /**
     * @dev Check if position remains healthy after action
     */
    function _checkHealthFactor(
        string memory symbol,
        address user,
        uint256 supplied,
        uint256 borrowed
    ) internal view returns (bool) {
        if (borrowed == 0) return true;
        
        Asset storage asset = assets[symbol];
        uint256 assetPrice = getAssetPrice(symbol);
        
        uint256 collateralValue = (supplied * assetPrice * asset.collateralFactor) / 10000;
        uint256 borrowValue = borrowed * assetPrice;
        
        return collateralValue >= borrowValue;
    }

    /**
     * @dev Check if position is healthy (not liquidatable)
     */
    function _isHealthy(string memory symbol, address user) internal view returns (bool) {
        UserPosition storage position = userPositions[user][symbol];
        if (position.borrowed == 0) return true;
        
        Asset storage asset = assets[symbol];
        uint256 assetPrice = getAssetPrice(symbol);
        
        uint256 collateralValue = (position.supplied * assetPrice * asset.liquidationThreshold) / 10000;
        uint256 borrowValue = position.borrowed * assetPrice;
        
        return collateralValue >= borrowValue;
    }

    /**
     * @dev Get user's health factor
     */
    function getUserHealthFactor(string memory symbol, address user) external view returns (uint256) {
        UserPosition storage position = userPositions[user][symbol];
        if (position.borrowed == 0) return type(uint256).max; // Max value if no debt
        
        Asset storage asset = assets[symbol];
        uint256 assetPrice = getAssetPrice(symbol);
        
        uint256 collateralValue = (position.supplied * assetPrice * asset.collateralFactor) / 10000;
        uint256 borrowValue = position.borrowed * assetPrice;
        
        return (collateralValue * 10000) / borrowValue; // Multiply by 10000 for precision
    }

    /**
     * @dev Get all registered assets
     */
    function getAllAssets() external view returns (string[] memory) {
        return assetSymbols;
    }

    /**
     * @dev Get asset details
     */
    function getAssetDetails(string memory symbol) external view returns (
        address tokenAddress,
        address priceFeedAddress,
        uint256 collateralFactor,
        uint256 borrowFactor,
        uint256 liquidationThreshold,
        uint256 totalSupplied,
        uint256 totalBorrowed,
        uint256 supplyInterestRate,
        uint256 borrowInterestRate,
        bool isActive
    ) {
        Asset storage asset = assets[symbol];
        return (
            asset.tokenAddress,
            asset.priceFeedAddress,
            asset.collateralFactor,
            asset.borrowFactor,
            asset.liquidationThreshold,
            asset.totalSupplied,
            asset.totalBorrowed,
            asset.supplyInterestRate,
            asset.borrowInterestRate,
            asset.isActive
        );
    }
}