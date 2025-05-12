import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ethers } from "ethers";

// Components
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Dashboard from "./pages/Dashboard";
import Supply from "./pages/Supply";
import Borrow from "./pages/Borrow";
import Market from "./pages/Market";
import NotFound from "./pages/NotFound";

// Contexts
import { Web3Provider } from "./contexts/Web3Context";

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [connected, setConnected] = useState(false);
  const [chainId, setChainId] = useState(null);

  useEffect(() => {
    const checkIfWalletIsConnected = async () => {
      try {
        if (window.ethereum) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(provider);

          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setConnected(true);

            const network = await provider.getNetwork();
            setChainId(network.chainId);
          }
        } else {
          console.log("Please install MetaMask!");
        }
      } catch (error) {
        console.error("Error connecting to MetaMask:", error);
      }
    };

    checkIfWalletIsConnected();
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setConnected(true);
        } else {
          setAccount(null);
          setConnected(false);
        }
      });

      window.ethereum.on("chainChanged", (chainId) => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
        window.ethereum.removeAllListeners("chainChanged");
      }
    };
  }, []);

  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        setConnected(true);

        const network = await provider.getNetwork();
        setChainId(network.chainId);
      } else {
        alert("Please install MetaMask!");
      }
    } catch (error) {
      console.error("Error connecting to wallet:", error);
    }
  };

  return (
    <Web3Provider
      value={{ account, provider, connected, chainId, connectWallet }}
    >
      <Router>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/supply" element={<Supply />} />
              <Route path="/borrow" element={<Borrow />} />
              <Route path="/market" element={<Market />} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;
