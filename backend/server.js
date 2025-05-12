// server.js
const express = require("express");
const cors = require("cors");
const ethers = require("ethers");
const dotenv = require("dotenv");
const contractABI = require("./contractABI.json");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Konfigurasi provider dan kontrak
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new ethers.Contract(contractAddress, contractABI, provider);

// API Routes
app.get("/api/assets", async (req, res) => {
  try {
    const assetSymbols = await contract.getAllAssets();
    const assetsDetails = await Promise.all(
      assetSymbols.map(async (symbol) => {
        const details = await contract.getAssetDetails(symbol);
        const price = await contract.getAssetPrice(symbol);

        return {
          symbol,
          tokenAddress: details.tokenAddress,
          priceFeedAddress: details.priceFeedAddress,
          collateralFactor: details.collateralFactor.toString(),
          borrowFactor: details.borrowFactor.toString(),
          liquidationThreshold: details.liquidationThreshold.toString(),
          totalSupplied: ethers.utils.formatEther(details.totalSupplied),
          totalBorrowed: ethers.utils.formatEther(details.totalBorrowed),
          supplyInterestRate: details.supplyInterestRate.toString(),
          borrowInterestRate: details.borrowInterestRate.toString(),
          isActive: details.isActive,
          price: ethers.utils.formatEther(price),
        };
      })
    );

    res.json(assetsDetails);
  } catch (error) {
    console.error("Error fetching assets:", error);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

app.get("/api/user/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const assetSymbols = await contract.getAllAssets();

    const userPositions = await Promise.all(
      assetSymbols.map(async (symbol) => {
        const position = await contract.userPositions(address, symbol);
        const healthFactor = await contract.getUserHealthFactor(
          symbol,
          address
        );

        return {
          symbol,
          supplied: ethers.utils.formatEther(position.supplied),
          borrowed: ethers.utils.formatEther(position.borrowed),
          lastUpdateTimestamp: position.lastUpdateTimestamp.toString(),
          healthFactor: healthFactor.toString(),
        };
      })
    );

    res.json(userPositions);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// API untuk mendapatkan data historis harga dari Oracle
app.get("/api/price-history/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const asset = await contract.getAssetDetails(symbol);
    const priceFeedAddress = asset.priceFeedAddress;

    // Mock data untuk simulasi history (dalam produksi Anda bisa menggunakan database atau API lain)
    const now = Math.floor(Date.now() / 1000);
    const history = [];

    for (let i = 0; i < 30; i++) {
      const timestamp = now - i * 86400; // 1 day intervals
      const randomFactor = 0.95 + Math.random() * 0.1; // +/- 5%
      const basePrice = parseFloat(
        ethers.utils.formatEther(await contract.getAssetPrice(symbol))
      );
      const price = basePrice * randomFactor;

      history.push({
        timestamp,
        price: price.toFixed(2),
      });
    }

    res.json(history.reverse());
  } catch (error) {
    console.error("Error fetching price history:", error);
    res.status(500).json({ error: "Failed to fetch price history" });
  }
});

// API untuk mendapatkan estimasi APY
app.get("/api/apy", async (req, res) => {
  try {
    const assetSymbols = await contract.getAllAssets();
    const apyData = await Promise.all(
      assetSymbols.map(async (symbol) => {
        const details = await contract.getAssetDetails(symbol);

        // Convert basispoints (e.g. 500 = 5%) to APY percentage
        const supplyAPY = parseFloat(details.supplyInterestRate) / 100;
        const borrowAPY = parseFloat(details.borrowInterestRate) / 100;

        // Utilization rate affects actual APY
        let utilizationRate = 0;
        if (parseFloat(details.totalSupplied) > 0) {
          utilizationRate =
            parseFloat(details.totalBorrowed) /
            parseFloat(details.totalSupplied);
        }

        return {
          symbol,
          supplyAPY: supplyAPY.toFixed(2),
          borrowAPY: borrowAPY.toFixed(2),
          utilizationRate: (utilizationRate * 100).toFixed(2),
        };
      })
    );

    res.json(apyData);
  } catch (error) {
    console.error("Error calculating APY:", error);
    res.status(500).json({ error: "Failed to calculate APY" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
