import { useState, useEffect } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import {
  getAllAssets,
  getUserWalletBalances,
  supplyAsset,
  withdrawAsset,
  approveToken,
  getTokenAllowance,
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
          const suppliedAssets = assetsData.filter((asset) => {
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
        setError(
          `Amount exceeds your wallet balance (${maxAmount} ${selectedAsset.symbol})`
        );
        return false;
      }
    } else if (activeModal === "withdraw") {
      const maxAmount = selectedAsset.userSupplied || 0;
      if (parseFloat(amount) > parseFloat(maxAmount)) {
        setError(
          `Amount exceeds your supplied balance (${maxAmount} ${selectedAsset.symbol})`
        );
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

      const amountInWei = ethers.utils.parseUnits(
        amount,
        selectedAsset.decimals
      );

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

        const suppliedAssets = assetsData.filter((asset) => {
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

        const suppliedAssets = assetsData.filter((asset) => {
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
                Connect your wallet to view available assets and manage your
                supply positions.
              </p>
            </div>
          ) : (
            <>
              {userSuppliedAssets.length > 0 && (
                <div className="mb-8">
                  <h2 className="font-bold text-lg mb-4">
                    Your Supplied Assets
                  </h2>
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
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {userSuppliedAssets.map((asset) => (
                              <tr key={asset.symbol}>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      <img
                                        className="h-10 w-10 rounded-full"
                                        src={
                                          asset.logoURI ||
                                          `/assets/tokens/${asset.symbol.toLowerCase()}.svg`
                                        }
                                        alt={asset.name}
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src =
                                            "/assets/tokens/default.svg";
                                        }}
                                      />
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">
                                        {asset.symbol}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {asset.name}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {parseFloat(asset.userSupplied).toFixed(4)}{" "}
                                    {asset.symbol}
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {formatCurrency(
                                      asset.userSupplied * asset.priceUSD
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {(asset.supplyAPY * 100).toFixed(2)}%
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() =>
                                      handleOpenWithdrawModal(asset)
                                    }
                                    className="text-primary-600 hover:text-primary-900 mr-2"
                                  >
                                    Withdraw
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-8">
                <h2 className="font-bold text-lg mb-4">All Assets</h2>
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
                              Wallet Balance
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              APY
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Supplied
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {assets.map((asset) => (
                            <tr key={asset.symbol}>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <img
                                      className="h-10 w-10 rounded-full"
                                      src={
                                        asset.logoURI ||
                                        `/assets/tokens/${asset.symbol.toLowerCase()}.svg`
                                      }
                                      alt={asset.name}
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src =
                                          "/assets/tokens/default.svg";
                                      }}
                                    />
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {asset.symbol}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {asset.name}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {parseFloat(
                                    walletBalances[asset.symbol] || 0
                                  ).toFixed(4)}{" "}
                                  {asset.symbol}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatCurrency(
                                    (walletBalances[asset.symbol] || 0) *
                                      asset.priceUSD
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-green-600 font-medium">
                                  {(asset.supplyAPY * 100).toFixed(2)}%
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {parseFloat(asset.totalSupplied).toFixed(2)}{" "}
                                  {asset.symbol}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatCurrency(
                                    asset.totalSupplied * asset.priceUSD
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleOpenSupplyModal(asset)}
                                  className="text-primary-600 hover:text-primary-900 mr-2"
                                  disabled={
                                    !walletBalances[asset.symbol] ||
                                    parseFloat(walletBalances[asset.symbol]) <=
                                      0
                                  }
                                >
                                  Supply
                                </button>
                                {parseFloat(asset.userSupplied || 0) > 0 && (
                                  <button
                                    onClick={() =>
                                      handleOpenWithdrawModal(asset)
                                    }
                                    className="text-secondary-600 hover:text-secondary-900"
                                  >
                                    Withdraw
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Supply Modal */}
      {activeModal === "supply" && selectedAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Supply {selectedAsset.symbol}
                    </h3>
                    <div className="mt-2 mb-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-500">
                          Balance:{" "}
                          {parseFloat(
                            walletBalances[selectedAsset.symbol] || 0
                          ).toFixed(4)}{" "}
                          {selectedAsset.symbol}
                        </span>
                        <button
                          onClick={handleMaxAmount}
                          className="text-sm text-primary-600"
                        >
                          MAX
                        </button>
                      </div>
                      <div className="flex border rounded-lg p-2 focus-within:border-primary-500">
                        <input
                          type="text"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="flex-grow outline-none"
                          placeholder="0.0"
                        />
                        <span className="ml-2 text-gray-500">
                          {selectedAsset.symbol}
                        </span>
                      </div>
                    </div>

                    {txHash && (
                      <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
                        Transaction submitted:
                        <a
                          href={`https://etherscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-primary-600 underline"
                        >
                          View on Etherscan
                        </a>
                      </div>
                    )}

                    {error && (
                      <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        {error}
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-500">
                          Supply APY
                        </span>
                        <span className="text-sm text-green-600 font-medium">
                          {(selectedAsset.supplyAPY * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">
                          Collateral
                        </span>
                        <span className="text-sm text-gray-900">
                          {selectedAsset.collateralFactor * 100}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSupplyAsset}
                  disabled={approving || supplying}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {approving
                    ? "Approving..."
                    : supplying
                    ? "Supplying..."
                    : "Supply"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {activeModal === "withdraw" && selectedAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Withdraw {selectedAsset.symbol}
                    </h3>
                    <div className="mt-2 mb-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-500">
                          Supplied:{" "}
                          {parseFloat(selectedAsset.userSupplied || 0).toFixed(
                            4
                          )}{" "}
                          {selectedAsset.symbol}
                        </span>
                        <button
                          onClick={handleMaxAmount}
                          className="text-sm text-primary-600"
                        >
                          MAX
                        </button>
                      </div>
                      <div className="flex border rounded-lg p-2 focus-within:border-primary-500">
                        <input
                          type="text"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="flex-grow outline-none"
                          placeholder="0.0"
                        />
                        <span className="ml-2 text-gray-500">
                          {selectedAsset.symbol}
                        </span>
                      </div>
                    </div>

                    {txHash && (
                      <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
                        Transaction submitted:
                        <a
                          href={`https://etherscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-primary-600 underline"
                        >
                          View on Etherscan
                        </a>
                      </div>
                    )}

                    {error && (
                      <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
                        {error}
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-500">
                          Supply APY
                        </span>
                        <span className="text-sm text-green-600 font-medium">
                          {(selectedAsset.supplyAPY * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Value</span>
                        <span className="text-sm text-gray-900">
                          {formatCurrency(
                            selectedAsset.userSupplied * selectedAsset.priceUSD
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleWithdrawAsset}
                  disabled={withdrawing}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-secondary-600 text-base font-medium text-white hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {withdrawing ? "Withdrawing..." : "Withdraw"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Supply;
