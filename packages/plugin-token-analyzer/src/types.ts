export interface DexScreenerPair {
  chainId: string; // Blockchain network (e.g., "ethereum", "bsc")

  baseToken: {
    name: string;     // Name of the base token (e.g., "Uniswap")
    symbol: string;   // Symbol of the base token (e.g., "UNI")
    address: string;  // Contract address of the base token
    decimals?: number; // Optional: number of decimals
  };

  quoteToken: {
    name: string;     // Name of the quote token (e.g., "ETH")
    symbol: string;   // Symbol of the quote token
    address: string;  // Contract address of the quote token
    decimals?: number;
  };

  priceNative: string; // Price in terms of native token (e.g., ETH)
  priceUsd: string;    // Price in USD

  liquidity?: {
    usd: string;       // Total liquidity in USD
    base?: number;     // Liquidity of base token
    quote?: number;    // Liquidity of quote token
  };

  volume?: {
    m5?: number;       // Trading volume over last 5 minutes
    h1?: number;       // Trading volume over last 1 hour
    h6?: number;       // Trading volume over last 6 hours
    h24?: number;      // Trading volume over last 24 hours
  };

  txns?: {
    m5?: { buys: number; sells: number };   // # of transactions in last 5 min
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };

  priceChange?: {
    m5?: number;       // Price % change in 5 minutes
    h1?: number;
    h6?: number;
    h24?: number;
  };

  fdv?: number;         // Fully diluted valuation
  marketCap?: number;   // Market capitalization
  pairCreatedAt?: number; // Unix timestamp when pair was created
}


export interface SimulationState {
  isSimulationMode: boolean; // Whether simulation mode is currently active

  portfolio: Record<
    string,                         // Token address as key
    {
      symbol: string;              // Token symbol (e.g., "ETH")
      amount: number;              // Amount held
      buyPrice: number;            // Average buy price in USD
    }
  >;

  actions: {
    token: string;                 // Token address
    action: "BUY" | "SELL" | "HOLD"; // Action type
    amount: number;                // Trade amount
    price: number;                 // Executed price at the time
  }[];
}
