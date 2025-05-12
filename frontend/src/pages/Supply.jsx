import { useState, useEffect } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { 
  getAllAssets, 
  getUserWalletBalances, 
  supplyAsset,
  withdrawAsset,
  approveToken,
  getTokenAllowance
} from "../services/contractService";
import { ethers } from "ethers";

function Supply() {
  const { account, provider, connected } = useWeb3();
  
  const [assets, setAssets] = useState([]);
  const [walletBalances, setWalletBalances] = useState({});
  const [userSuppliedAssets, setUserSuppliedAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [amount, setAmount] = useState("");
  const [approving, setApproving] = useState(false);
  const [supplying, setSupplying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchSupplyData() {
      try {
        setLoading(true);
        const assetsData = await getAllAssets();
        setAssets(assetsData);
        
        if (connected && account) {
          const balances = await getUserWalletBalances(account);
          setWalletBalances(balances);
          
          // Filter only assets that the user has supplied
          const suppliedAssets = assetsData.filter(asset => {
            const balance = parseFloat(asset.userSupplied || 0);
            return balance > 0;
          });
          
          setUserSuppliedAssets(suppliedAssets);
        }
      } catch (error) {
        console.error("Error fetching supply data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSupplyData();
  }, [account, connected, provider]);

  const handleOpenSupplyModal = (asset) => {
    setSelectedAsset(asset);
    setAmount("");
    setError("");
    setActiveModal("supply");
  };

  const handleOpenWithdrawModal = (asset) => {
    setSelectedAsset(asset);
    setAmount("");
    setError("");
    setActiveModal("withdraw");
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedAsset(null);
    setAmount("");
    setError("");
    setTxHash("");
  };

  const handleMaxAmount = () => {
    if (activeModal === "supply" && selectedAsset) {
      setAmount(walletBalances[selectedAsset.symbol]?.toString() || "0");
    } else if (activeModal === "withdraw" && selectedAsset) {
      setAmount(selectedAsset.userSupplied?.toString() || "0");
    }
  };

  const validateAmount = () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return false;
    }
    
    if (activeModal === "supply") {
      const maxAmount = walletBalances[selectedAsset.symbol] || 0;
      if (parseFloat(amount) > parseFloat(maxAmount)) {
        setError(`Amount exceeds your wallet balance (${maxAmount} ${selectedAsset.symbol})`);
        return false;
      }
    } else if (activeModal === "withdraw") {
      const maxAmount = selectedAsset.userSupplied || 0;
      if (parseFloat(amount) > parseFloat(maxAmount)) {
        setError(`Amount exceeds your supplied balance (${maxAmount} ${selectedAsset.symbol})`);
        return false;
      }
    }
    
    return true;
  };

  const handleSupplyAsset = async () => {
    if (!validateAmount()) return;
    
    try {
      setError("");
      
      // Check if token is approved for the amount
      const allowance = await getTokenAllowance(
        provider,
        account,
        selectedAsset.address
      );
      
      const amountInWei = ethers.utils.parseUnits(amount, selectedAsset.decimals);
      
      // If allowance is less than the amount, we need to approve first
      if (allowance.lt(amountInWei)) {
        setApproving(true);
        
        const approveTx = await approveToken(
          provider,
          selectedAsset.address,
          amountInWei
        );
        
        await approveTx.wait();
        setApproving(false);
      }
      
      // Now supply the asset
      setSupplying(true);
      const tx = await supplyAsset(
        provider,
        selectedAsset.address,
        amount,
        selectedAsset.decimals
      );
      
      setTxHash(tx.hash);
      await tx.wait();
      
      // Refresh data
      const assetsData = await getAllAssets();
      setAssets(assetsData);
      
      if (connected && account) {
        const balances = await getUserWalletBalances(account);
        setWalletBalances(balances);
        
        const suppliedAssets = assetsData.filter(asset => {
          const balance = parseFloat(asset.userSupplied || 0);
          return balance > 0;
        });
        
        setUserSuppliedAssets(suppliedAssets);
      }
      
      setSupplying(false);
    } catch (error) {
      console.error("Error supplying asset:", error);
      setError(error.message || "Failed to supply asset");
      setApproving(false);
      setSupplying(false);
    }
  };

  const handleWithdrawAsset = async () => {
    if (!validateAmount()) return;
    
    try {
      setError("");
      setWithdrawing(true);
      
      const tx = await withdrawAsset(
        provider,
        selectedAsset.address,
        amount,
        selectedAsset.decimals
      );
      
      setTxHash(tx.hash);
      await tx.wait();
      
      // Refresh data
      const assetsData = await getAllAssets();
      setAssets(assetsData);
      
      if (connected && account) {
        const balances = await getUserWalletBalances(account);
        setWalletBalances(balances);
        
        const suppliedAssets = assetsData.filter(asset => {
          const balance = parseFloat(asset.userSupplied || 0);
          return balance > 0;
        });
        
        setUserSuppliedAssets(suppliedAssets);
      }
      
      setWithdrawing(false);
    } catch (error) {
      console.error("Error withdrawing asset:", error);
      setError(error.message || "Failed to withdraw asset");
      setWithdrawing(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="heading">Supply Market</h1>
        <p className="text-gray-600 mt-2">
          Supply your assets to earn interest and use as collateral
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {!connected ? (
            <div className="card mb-8 bg-gradient-to-r from-primary-100 to-secondary-100 border-l-4 border-primary-600">
              <h2 className="font-bold text-lg mb-2">Connect Your Wallet</h2>
              <p className="mb-4">
                Connect your wallet to view available assets and manage your supply positions.
              </p>
            </div>
          ) : (
            <>
              {userSuppliedAssets.length > 0 && (
                <div className="mb-8">
                  <h2 className="font-bold text-lg mb-4">Your Supplied Assets</h2>
                  <div className="grid md:grid-cols-1 gap-6">
                    <div className="card">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Asset
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Supplied
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Value
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                APY
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>