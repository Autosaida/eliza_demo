import type { DexScreenerPair } from "./types";

/**
 * Fetches token pair data from DexScreener focused on ETH pairs.
 */
export class DexScreenerEthPairFetcher {
  
  /**
   * Retrieves the ETH-based trading pair for a given token address.
   * It searches among the token's trading pairs and selects the one
   * where the quote token is WETH on Ethereum or EthereumPOW.
   *
   * @param tokenAddress - The address of the token to query
   * @returns DexScreenerPair - The matched ETH pair
   * @throws Error if no valid pair is found or fetch fails
   */
  async getEthPair(tokenAddress: string): Promise<DexScreenerPair> {
    try {
      const endpoint = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch token pairs: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.pairs || data.pairs.length === 0) {
        throw new Error("No trading pairs found for the given token");
      }

      // Look for a pair where the quote token is WETH on Ethereum/EthereumPOW
      const matchedPair = data.pairs.find(
        (pair: DexScreenerPair) =>
          (pair.chainId === "ethereum" || pair.chainId === "ethereumpow") &&
          pair.quoteToken?.address.toLowerCase() ===
            "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" // WETH
      );

      if (!matchedPair) {
        throw new Error("No ETH pair found on the Ethereum chain for this token");
      }

      return matchedPair;
    } catch (error) {
      console.error("Error fetching ETH pair:", error);
      throw new Error("Failed to fetch ETH pair");
    }
  }

  /**
   * Returns the ETH/USDC pair data on Ethereum for price reference.
   * This is useful for calculating ETH price in USD.
   *
   * @returns DexScreenerPair - The ETH-USDT pair data
   * @throws Error if the pair cannot be fetched or is invalid
   */
  async getEthUsdtPair(): Promise<DexScreenerPair> {
    try {
      const endpoint = `https://api.dexscreener.com/latest/dex/pairs/ethereum/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640`; // Uniswap V3 ETH/USDC
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch token pairs: ${response.statusText}`);
      }

      const data = await response.json();

      return data.pair;
    } catch (error) {
      console.error("Error fetching ETH pair:", error);
      throw new Error("Failed to fetch ETH pair");
    }
  }
}

export const dexScreenerEthPairFetcher = new DexScreenerEthPairFetcher();
