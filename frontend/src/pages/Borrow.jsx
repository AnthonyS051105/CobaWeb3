import { useState, useEffect } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { 
  getAllAssets, 
  getUserWalletBalances,
  borrowAsset,
  repayBorrowAsset,
  approveToken,
  getTokenAllowance
} from "../services/contractService";
import { ethers } from "ethers";

function Borrow() {
  const { account, provider, connected } = useWeb3();
  
  const [assets, setAssets] = useState([]);
  const [walletBalances, setWalletBalances] = useState({});
  const [userBorrowedAssets, setUserBorrowedAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [amount, setAmount] = useState("");
  const [borrowLimit, setBorrowLimit] = useState(0);
  const [borrowLimitUsed, setBorrowLimitUsed] = useState(0);
  const [approving, setApproving] = useState(false);
  const [borrowing, setBorrowing] = useState(false);
  const [repaying, setRepaying] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBorrowData() {
      try {
        setLoading(true);
        const assetsData = await getAllAssets();
        setAssets(assetsData);
        
        if (connected && account) {
          const balances = await getUserWalletBalances(account);
          setWalletBalances(balances);
          
          // Calculate borrow limit based on supplied collateral
          let totalBorrowLimit = 0;
          let totalBorrowValue = 0;
          
          assetsData.forEach(asset => {
            if (asset.userSupplied && asset.userSupplied > 0) {
              totalBorrowLimit += asset.userSupplied * asset.priceUSD * asset.collateralFactor;
            }
            
            if (asset.userBorrowed && asset.userBorrowed > 0) {
              totalBorrowValue += asset.userBorrowed * asset.