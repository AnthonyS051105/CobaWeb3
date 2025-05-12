import { useState, useEffect } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { 
  getAllAssets, 
  getUserPositions, 
  getAPYData,
  getUserHealthFactor 
} from "../services/contractService";
import { ethers } from "ethers";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

function Dashboard() {
  const { account, provider, connected } = useWeb3();
  
  const [assets, setAssets] = useState([]);
  const [userPositions, setUserPositions] = useState(null);
  const [apyData, setApyData] = useState([]);
  const [healthFactor, setHealthFactor] = useState("0");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const assetsData = await getAllAssets();
        setAssets(assetsData);
        
        const apyInfo = await getAPYData();
        setApyData(apyInfo);
        
        if (connected && account) {
          const positions = await getUserPositions(account);
          setUserPositions(positions);
          
          // If user has positions, get their health factor
          if (positions && positions.suppliedAssets?.length > 0) {
            const factor = await getUserHealthFactor(provider, account, positions.suppliedAssets[0].symbol);
            setHealthFactor(factor);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [account, connected, provider]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const totalSupplied = userPositions?.suppliedAssets?.reduce(
    (acc, asset) => acc + parseFloat(asset.amountUSD), 0
  ) || 0;
  
  const totalBorrowed = userPositions?.borrowedAssets?.reduce(
    (acc, asset) => acc + parseFloat(asset.amountUSD), 0
  ) || 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="heading">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Overview of your positions and market statistics
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {connected ? (
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="card">
                <h2 className="font-bold text-lg mb-2">Supply Balance</h2>
                <p className="text-2xl font-bold text-primary-600">
                  {formatCurrency(totalSupplied)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Total value of supplied assets
                </p>
              </div>
              
              <div className="card">
                <h2 className="font-bold text-lg mb-2">Borrow Balance</h2>
                <p className="text-2xl font-bold text-secondary-600">
                  {formatCurrency(totalBorrowed)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Total value of borrowed assets
                </p>
              </div>
              
              <div className="card">
                <h2 className="font-bold text-lg mb-2">Health Factor</h2>
                <p className={`text-2xl font-bold ${
                  parseFloat(healthFactor) < 1.2 
                    ? "text-red-600" 
                    : parseFloat(healthFactor) < 1.5 
                    ? "text-yellow-600" 
                    : "text-green-600"
                }`}>
                  {parseFloat(healthFactor).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {parseFloat(healthFactor) < 1.2 
                    ? "At risk of liquidation" 
                    : parseFloat(healthFactor) < 1.5 
                    ? "Caution advised" 
                    : "Safe position"}
                </p>
              </div>
            </div>
          ) : (
            <div className="card mb-8 bg-gradient-to-r from-primary-100 to-secondary-100 border-l-4 border-primary-600">
              <h2 className="font-bold text-lg mb-2">Connect Your Wallet</h2>
              <p className="mb-4">
                Connect your wallet to view your personal dashboard and manage your assets.
              </p>
            </div>
          )}

          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "overview"
                      ? "border-primary-600 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                  onClick={() => setActiveTab("overview")}
                >
                  Market Overview
                </button>
                {connected && (
                  <button
                    className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "your-assets"
                        ? "border-primary-600 text-primary-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                    onClick={() => setActiveTab("your-assets")}
                  >
                    Your Assets
                  </button>
                )}
                <button
                  className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "apy-trends"
                      ? "border-primary-600 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                  onClick={() => setActiveTab("apy-trends")}
                >
                  APY Trends
                </button>
              </nav>
            </div>
          </div>

          {activeTab === "overview" && (
            <div className="grid md:grid-cols-1 gap-6">
              <div className="card">
                <h2 className="font-bold text-lg mb-4">Available Assets</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Asset
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Supplied
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Borrowed
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Supply APY
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Borrow APY
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {assets.map((asset) => (
                        <tr key={asset.symbol} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <img 
                                src={`/assets/${asset.symbol.toLowerCase()}.svg`} 
                                alt={asset.name}
                                className="w-6 h-6 mr-2"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = "/assets/default-token.svg";
                                }}
                              />
                              <div>
                                <div className="font-medium text-gray-900">{asset.symbol}</div>
                                <div className="text-sm text-gray-500">{asset.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatCurrency(asset.totalSupplied)}</div>
                            <div className="text-xs text-gray-500">{parseFloat(asset.totalSuppliedTokens).toFixed(2)} {asset.symbol}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatCurrency(asset.totalBorrowed)}</div>
                            <div className="text-xs text-gray-500">{parseFloat(asset.totalBorrowedTokens).toFixed(2)} {asset.symbol}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-green-600">
                              {(parseFloat(asset.supplyAPY) * 100).toFixed(2)}%
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-secondary-600">
                              {(parseFloat(asset.borrowAPY) * 100).toFixed(2)}%
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "your-assets" && connected && (
            <div className="grid md:grid-cols-1 gap-6">
              {userPositions?.suppliedAssets?.length > 0 ? (
                <div className="card">
                  <h2 className="font-bold text-lg mb-4">Your Supplied Assets</h2>
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
                            APY Earned
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Collateral
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userPositions.suppliedAssets.map((asset) => (
                          <tr key={asset.symbol} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <img 
                                  src={`/assets/${asset.symbol.toLowerCase()}.svg`} 
                                  alt={asset.name}
                                  className="w-6 h-6 mr-2"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "/assets/default-token.svg";
                                  }}
                                />
                                <div>
                                  <div className="font-medium text-gray-900">{asset.symbol}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{parseFloat(asset.amount).toFixed(4)} {asset.symbol}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatCurrency(asset.amountUSD)}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-green-600">
                                {(parseFloat(asset.apy) * 100).toFixed(2)}%
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className={`text-sm ${asset.isCollateral ? "text-green-600" : "text-gray-500"}`}>
                                {asset.isCollateral ? "Yes" : "No"}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="card bg-gray-50 text-center py-12">
                  <p className="text-gray-500">You haven't supplied any assets yet.</p>
                  <button
                    onClick={() => window.location.href = "/supply"}
                    className="btn btn-primary mt-4"
                  >
                    Supply Assets
                  </button>
                </div>
              )}

              {userPositions?.borrowedAssets?.length > 0 ? (
                <div className="card">
                  <h2 className="font-bold text-lg mb-4">Your Borrowed Assets</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Asset
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Borrowed
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Value
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            APY Paid
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userPositions.borrowedAssets.map((asset) => (
                          <tr key={asset.symbol} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <img 
                                  src={`/assets/${asset.symbol.toLowerCase()}.svg`} 
                                  alt={asset.name}
                                  className="w-6 h-6 mr-2"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "/assets/default-token.svg";
                                  }}
                                />
                                <div>
                                  <div className="font-medium text-gray-900">{asset.symbol}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{parseFloat(asset.amount).toFixed(4)} {asset.symbol}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatCurrency(asset.amountUSD)}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-secondary-600">
                                {(parseFloat(asset.apy) * 100).toFixed(2)}%
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="card bg-gray-50 text-center py-12">
                  <p className="text-gray-500">You haven't borrowed any assets yet.</p>
                  <button
                    onClick={() => window.location.href = "/borrow"}
                    className="btn btn-primary mt-4"
                  >
                    Borrow Assets
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "apy-trends" && (
            <div className="card">
              <h2 className="font-bold text-lg mb-4">APY History</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={apyData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => {
                        const d = new Date(date);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis
                      tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
                    />
                    <Tooltip 
                      formatter={(value) => [`${(value * 100).toFixed(2)}%`]}
                      labelFormatter={(label) => {
                        const d = new Date(label);
                        return d.toLocaleDateString();
                      }}
                    />
                    <Legend />
                    {apyData.length > 0 && 
                      Object.keys(apyData[0])
                        .filter(key => key !== 'date')
                        .map((asset, index) => (
                          <Line
                            key={asset}
                            type="monotone"
                            dataKey={asset}
                            name={`${asset.split('_')[0]} ${asset.includes('supply') ? 'Supply' : 'Borrow'}`}
                            stroke={asset.includes('supply') ? '#16a34a' : '#7c3aed'}
                            activeDot={{ r: 8 }}
                          />
                        ))