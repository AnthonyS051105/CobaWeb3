import { ethers } from "ethers";
import axios from "axios";

const API_URL = "/api";
const CONTRACT_ADDRESS = "0xYourDeployedContractAddress"; // Should be replaced with your actual contract address
const ABI = []; // Import your ABI here or fetch it dynamically

export async function getContractWithSigner(provider) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  return contract;
}

export async function getReadOnlyContract(provider) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  return contract;
}

// API calls to the backend
export async function getAllAssets() {
  try {
    const response = await axios.get(`${API_URL}/assets`);
    return response.data;
  } catch (error) {
    console.error("Error fetching assets:", error);
    throw error;
  }
}

export async function getUserPositions(address) {
  try {
    const response = await axios.get(`${API_URL}/user/${address}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user positions:", error);
    throw error;
  }
}

export async function getPriceHistory(symbol) {
  try {
    const response = await axios.get(`${API_URL}/price-history/${symbol}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching price history:", error);
    throw error;
  }
}

export async function getAPYData() {
  try {
    const response = await axios.get(`${API_URL}/apy`);
    return response.data;
  } catch (error) {
    console.error("Error fetching APY data:", error);
    throw error;
  }
}

// Contract interactions
export async function supplyAsset(provider, symbol, amount) {
  try {
    const contract = await getContractWithSigner(provider);
    const parsedAmount = ethers.utils.parseEther(amount.toString());

    // First, need to approve the contract to spend tokens
    const asset = await getAssetDetails(provider, symbol);
    const erc20 = new ethers.Contract(
      asset.tokenAddress,
      [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
      ],
      provider.getSigner()
    );

    // Check if we need to approve
    const allowance = await erc20.allowance(
      await provider.getSigner().getAddress(),
      CONTRACT_ADDRESS
    );
    if (allowance.lt(parsedAmount)) {
      const approveTx = await erc20.approve(
        CONTRACT_ADDRESS,
        ethers.constants.MaxUint256
      );
      await approveTx.wait();
    }

    // Supply the asset
    const tx = await contract.supply(symbol, parsedAmount);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error supplying asset:", error);
    throw error;
  }
}

export async function withdrawAsset(provider, symbol, amount) {
  try {
    const contract = await getContractWithSigner(provider);
    const parsedAmount = ethers.utils.parseEther(amount.toString());
    const tx = await contract.withdraw(symbol, parsedAmount);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error withdrawing asset:", error);
    throw error;
  }
}

export async function borrowAsset(provider, symbol, amount) {
  try {
    const contract = await getContractWithSigner(provider);
    const parsedAmount = ethers.utils.parseEther(amount.toString());
    const tx = await contract.borrow(symbol, parsedAmount);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error borrowing asset:", error);
    throw error;
  }
}

export async function repayAsset(provider, symbol, amount) {
  try {
    const contract = await getContractWithSigner(provider);
    const parsedAmount = ethers.utils.parseEther(amount.toString());

    // Need to approve the contract to spend tokens first
    const asset = await getAssetDetails(provider, symbol);
    const erc20 = new ethers.Contract(
      asset.tokenAddress,
      [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
      ],
      provider.getSigner()
    );

    // Check if we need to approve
    const allowance = await erc20.allowance(
      await provider.getSigner().getAddress(),
      CONTRACT_ADDRESS
    );
    if (allowance.lt(parsedAmount)) {
      const approveTx = await erc20.approve(
        CONTRACT_ADDRESS,
        ethers.constants.MaxUint256
      );
      await approveTx.wait();
    }

    // Repay the asset
    const tx = await contract.repay(symbol, parsedAmount);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error repaying asset:", error);
    throw error;
  }
}

export async function getAssetDetails(provider, symbol) {
  try {
    const contract = await getReadOnlyContract(provider);
    const details = await contract.getAssetDetails(symbol);
    return {
      tokenAddress: details[0],
      priceFeedAddress: details[1],
      collateralFactor: details[2].toString(),
      borrowFactor: details[3].toString(),
      liquidationThreshold: details[4].toString(),
      totalSupplied: ethers.utils.formatEther(details[5]),
      totalBorrowed: ethers.utils.formatEther(details[6]),
      supplyInterestRate: details[7].toString(),
      borrowInterestRate: details[8].toString(),
      isActive: details[9],
    };
  } catch (error) {
    console.error("Error getting asset details:", error);
    throw error;
  }
}

export async function getUserHealthFactor(provider, address, symbol) {
  try {
    const contract = await getReadOnlyContract(provider);
    const healthFactor = await contract.getUserHealthFactor(symbol, address);
    return ethers.utils.formatEther(healthFactor);
  } catch (error) {
    console.error("Error getting health factor:", error);
    throw error;
  }
}
