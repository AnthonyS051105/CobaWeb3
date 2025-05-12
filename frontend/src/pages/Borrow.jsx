import { useState, useEffect } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import {
  getAllAssets,
  getUserWalletBalances,
  borrowAsset,
  repayBorrowAsset,
  approveToken,
  getTokenAllowance,
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

          assetsData.forEach((asset) => {
            if (asset.userSupplied && asset.userSupplied > 0) {
              totalBorrowLimit +=
                asset.userSupplied * asset.priceUSD * asset.collateralFactor;
            }

            if (asset.userBorrowed && asset.userBorrowed > 0) {
              totalBorrowValue += asset.userBorrowed * asset.priceUSD;
            }
          });

          setBorrowLimit(totalBorrowLimit);
          setBorrowLimitUsed(totalBorrowValue);
          setUserBorrowedAssets(
            assetsData.filter((asset) => asset.userBorrowed > 0)
          );
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching borrow data:", err);
        setError("Failed to fetch borrow data");
        setLoading(false);
      }
    }

    fetchBorrowData();
  }, [connected, account]);

  const handleOpenBorrowModal = (asset) => {
    setSelectedAsset(asset);
    setActiveModal("borrow");
    setAmount("");
    setError("");
  };

  const handleOpenRepayModal = (asset) => {
    setSelectedAsset(asset);
    setActiveModal("repay");
    setAmount("");
    setError("");
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
  };

  const handleApprove = async () => {
    if (!selectedAsset || !amount) return;

    try {
      setApproving(true);
      setError("");

      const parsedAmount = ethers.utils.parseUnits(
        amount,
        selectedAsset.decimals
      );
      const tx = await approveToken(selectedAsset.address, parsedAmount);

      await tx.wait();
      setTxHash(tx.hash);
    } catch (err) {
      console.error("Approval error:", err);
      setError(err.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handleBorrow = async () => {
    if (!selectedAsset || !amount) return;

    try {
      setBorrowing(true);
      setError("");

      const parsedAmount = ethers.utils.parseUnits(
        amount,
        selectedAsset.decimals
      );
      const tx = await borrowAsset(selectedAsset.address, parsedAmount);

      await tx.wait();
      setTxHash(tx.hash);

      // Refresh data after borrowing
      await fetchBorrowData();
      setActiveModal(null);
    } catch (err) {
      console.error("Borrow error:", err);
      setError(err.message || "Borrowing failed");
    } finally {
      setBorrowing(false);
    }
  };

  const handleRepay = async () => {
    if (!selectedAsset || !amount) return;

    try {
      setRepaying(true);
      setError("");

      const parsedAmount = ethers.utils.parseUnits(
        amount,
        selectedAsset.decimals
      );
      const tx = await repayBorrowAsset(selectedAsset.address, parsedAmount);

      await tx.wait();
      setTxHash(tx.hash);

      // Refresh data after repaying
      await fetchBorrowData();
      setActiveModal(null);
    } catch (err) {
      console.error("Repay error:", err);
      setError(err.message || "Repayment failed");
    } finally {
      setRepaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Borrow Assets</h1>

        {/* Borrow Limit Section */}
        <div className="mb-6">
          <div className="bg-blue-100 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-700">
                Borrow Limit
              </span>
              <span className="text-xl font-bold text-blue-600">
                ${borrowLimit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-lg font-semibold text-gray-700">
                Borrow Limit Used
              </span>
              <span className="text-xl font-bold text-red-600">
                ${borrowLimitUsed.toFixed(2)} (
                {((borrowLimitUsed / borrowLimit) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Available Assets to Borrow */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <div
              key={asset.address}
              className="bg-gray-50 rounded-lg shadow-md p-4 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center mb-4">
                <img
                  src={`/icons/${asset.symbol.toLowerCase()}.svg`}
                  alt={`${asset.name} icon`}
                  className="w-10 h-10 mr-4"
                />
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {asset.name}
                  </h2>
                  <p className="text-gray-500">{asset.symbol}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Available to Borrow: {asset.availableToBorrow.toFixed(4)}{" "}
                  {asset.symbol}
                </p>
                <p className="text-sm text-gray-600">
                  Price: ${asset.priceUSD.toFixed(2)}
                </p>
                <button
                  onClick={() => handleOpenBorrowModal(asset)}
                  className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors"
                >
                  Borrow
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Borrowed Assets Section */}
        {userBorrowedAssets.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Your Borrowed Assets
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userBorrowedAssets.map((asset) => (
                <div
                  key={asset.address}
                  className="bg-gray-50 rounded-lg shadow-md p-4 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center mb-4">
                    <img
                      src={`/icons/${asset.symbol.toLowerCase()}.svg`}
                      alt={`${asset.name} icon`}
                      className="w-10 h-10 mr-4"
                    />
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">
                        {asset.name}
                      </h2>
                      <p className="text-gray-500">{asset.symbol}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Borrowed: {asset.userBorrowed.toFixed(4)} {asset.symbol}
                    </p>
                    <p className="text-sm text-gray-600">
                      Value: ${(asset.userBorrowed * asset.priceUSD).toFixed(2)}
                    </p>
                    <button
                      onClick={() => handleOpenRepayModal(asset)}
                      className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors"
                    >
                      Repay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Borrow Modal */}
        {activeModal === "borrow" && selectedAsset && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Borrow {selectedAsset.name}
              </h2>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Amount to Borrow
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="mb-4 text-red-500 text-sm">{error}</div>
              )}
              <div className="flex space-x-4">
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {approving ? "Approving..." : "Approve"}
                </button>
                <button
                  onClick={handleBorrow}
                  disabled={borrowing}
                  className="flex-1 bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {borrowing ? "Borrowing..." : "Borrow"}
                </button>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-full mt-4 bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Repay Modal */}
        {activeModal === "repay" && selectedAsset && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Repay {selectedAsset.name}
              </h2>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Amount to Repay
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Borrowed: {selectedAsset.userBorrowed.toFixed(4)}{" "}
                  {selectedAsset.symbol}
                </p>
              </div>
              {error && (
                <div className="mb-4 text-red-500 text-sm">{error}</div>
              )}
              <button
                onClick={handleRepay}
                disabled={repaying}
                className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {repaying ? "Repaying..." : "Repay"}
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="w-full mt-4 bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Borrow;
