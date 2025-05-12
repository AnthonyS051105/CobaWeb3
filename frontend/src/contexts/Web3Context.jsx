import { createContext, useContext } from "react";

const Web3Context = createContext(null);

export function Web3Provider({ children, value }) {
  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}
