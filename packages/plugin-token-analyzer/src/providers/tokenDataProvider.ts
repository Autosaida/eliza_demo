import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";

interface DexScreenerPair {
  baseToken: {
    name: string;
    symbol: string;
    address: string;
    decimals?: number;
  };
  priceUsd: string;

  liquidity?: {
    usd: string;
    base?: number;
    quote?: number;
  };

  volume?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };

  txns?: {
    m5?: {
      buys: number;
      sells: number;
    };
    h1?: {
      buys: number;
      sells: number;
    };
    h6?: {
      buys: number;
      sells: number;
    };
    h24?: {
      buys: number;
      sells: number;
    };
  };

  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };

  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

export class TokenDataProvider implements Provider {
  async get(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<string> {
    try {
      const content = typeof message.content === "string"
        ? message.content
        : message.content?.text;
      if (!content) {
          throw new Error("No message content provided");
      }

      // Extract token from content
      const tokenIdentifier = this.extractToken(content);
      console.log("Token Identifier:", tokenIdentifier);
      if (!tokenIdentifier) {
          throw new Error("Could not identify token in message");
      }

      // Make API request
      const isAddress =
          /^0x[a-fA-F0-9]{40}$/.test(tokenIdentifier) ||
          /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(tokenIdentifier); // validates for ethAddress and solAddress
      const endpoint = isAddress
          ? `https://api.dexscreener.com/latest/dex/tokens/${tokenIdentifier}`
          : `https://api.dexscreener.com/latest/dex/search?q=${tokenIdentifier}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.pairs || data.pairs.length === 0) {
          throw new Error(`No pricing data found for ${tokenIdentifier}`);
      }

      // Get best pair by liquidity
      const bestPair = this.getBestPair(data.pairs, tokenIdentifier, isAddress);
      console.log("Best Pair Data:", bestPair);
      const result = this.formatPairData(bestPair);
      console.log("Formatted Price Data:", result);
      return result;
    } catch (error) {
      console.error("Error in tokenDataProvider:", error);
      return "Failed to fetch token data. Please try again later.";
    }
  }

  private extractToken(content: string): string | null {
        // Try different patterns in order of specificity
        const patterns = [
            /0x[a-fA-F0-9]{40}/, // ETH address
            /[$#]([a-zA-Z0-9]+)/, // $TOKEN or #TOKEN
            /\b(?:analyze|analysis|evaluate|evaluation|insight|overview|recommend|suggest|opinion|advice|buy|invest|sell)\s+(?:of|for|about)?\s*([a-zA-Z0-9]+)\b/i,
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                // Use captured group if it exists, otherwise use full match
                const token = match[1] || match[0];
                // Clean up the token identifier
                return token.replace(/[$#]/g, "").toLowerCase().trim();
            }
        }

        return null;
    }

  /**
   * Selects the best trading pair with the highest liquidity 
   * where the base token matches the given token identifier.
   *
   * @param pairs - Array of trading pairs from DexScreener API
   * @param tokenIdentifier - Token symbol or address to match against baseToken
   * @param isAddress - Whether the tokenIdentifier is an address (true) or symbol (false)
   * @returns The best matching pair with the highest USD liquidity, or null if none found
   */
  private getBestPair(
    pairs: DexScreenerPair[],
    tokenIdentifier: string,
    isAddress: boolean
  ): DexScreenerPair | null {
    const normalizedIdentifier = tokenIdentifier.toLowerCase();

    // Filter pairs based on whether baseToken matches by address or symbol/
    const filtered = pairs.filter(pair => {
      if (!pair.baseToken) return false;
      return isAddress
        ? pair.baseToken.address?.toLowerCase() === normalizedIdentifier
        : (pair.baseToken.symbol?.toLowerCase() === normalizedIdentifier || pair.baseToken.name?.toLowerCase() === normalizedIdentifier);
    });

    if (filtered.length === 0) return null;

    // From matching pairs, select the one with the highest liquidity
    return filtered.reduce((best, current) => {
      const bestLiquidity = parseFloat(best.liquidity?.usd || "0");
      const currentLiquidity = parseFloat(current.liquidity?.usd || "0");
      return currentLiquidity > bestLiquidity ? current : best;
    }, filtered[0]);
  }

  private formatPairData(pair: DexScreenerPair): string {
    const {
      baseToken,
      priceUsd,
      liquidity,
      volume,
      txns,
      priceChange,
      fdv,
      marketCap,
      pairCreatedAt,
    } = pair;
  
    const name = baseToken.name || baseToken.symbol;
    const symbol = baseToken.symbol;
    const price = parseFloat(priceUsd).toFixed(6);
  
    const priceChanges = {
      m5: priceChange?.m5 ?? 0,
      h1: priceChange?.h1 ?? 0,
      h6: priceChange?.h6 ?? 0,
      h24: priceChange?.h24 ?? 0,
    };
  
    const volumes = {
      m5: volume?.m5 ?? 0,
      h1: volume?.h1 ?? 0,
      h6: volume?.h6 ?? 0,
      h24: volume?.h24 ?? 0,
    };
  
    const txnCounts = {
      m5: txns?.m5 ?? { buys: 0, sells: 0 },
      h1: txns?.h1 ?? { buys: 0, sells: 0 },
      h6: txns?.h6 ?? { buys: 0, sells: 0 },
      h24: txns?.h24 ?? { buys: 0, sells: 0 },
    };
  
    const liquidityUsd = liquidity?.usd ?? 0;
    const liquidityBase = liquidity?.base ?? 0;
    const liquidityQuote = liquidity?.quote ?? 0;
  
    const fdvText = fdv ? `$${fdv.toLocaleString()}` : "not available";
    const marketCapText = marketCap ? `$${marketCap.toLocaleString()}` : "not available";
    const createdAt = pairCreatedAt ? new Date(pairCreatedAt).toLocaleDateString() : "an unknown date";
  
    return `
  The token ${name} (${symbol}) is currently priced at $${price}. 
  This price and the following trading data are based on the trading pair with the highest liquidity.
  
  In terms of price change, it has moved:
  - +${priceChanges.m5.toFixed(2)}% in the last 5 minutes,
  - +${priceChanges.h1.toFixed(2)}% in the last 1 hour,
  - +${priceChanges.h6.toFixed(2)}% in the last 6 hours,
  - +${priceChanges.h24.toFixed(2)}% in the last 24 hours.
  
  Trading volumes were:
  - $${volumes.m5.toLocaleString(undefined, { maximumFractionDigits: 2 })} in the last 5 minutes,
  - $${volumes.h1.toLocaleString(undefined, { maximumFractionDigits: 2 })} in the last 1 hour,
  - $${volumes.h6.toLocaleString(undefined, { maximumFractionDigits: 2 })} in the last 6 hours,
  - $${volumes.h24.toLocaleString(undefined, { maximumFractionDigits: 2 })} in the last 24 hours.
  
  Transaction counts:
  - 5 minutes: ${txnCounts.m5.buys} buys / ${txnCounts.m5.sells} sells,
  - 1 hour: ${txnCounts.h1.buys} buys / ${txnCounts.h1.sells} sells,
  - 6 hours: ${txnCounts.h6.buys} buys / ${txnCounts.h6.sells} sells,
  - 24 hours: ${txnCounts.h24.buys} buys / ${txnCounts.h24.sells} sells.
  
  Current liquidity stands at $${liquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}, 
  with ${liquidityBase.toLocaleString()} base tokens and ${liquidityQuote.toLocaleString()} quote tokens in the pool.
  
  The fully diluted valuation (FDV) is ${fdvText}, and the market capitalization is ${marketCapText}. 
  This trading pair was created on ${createdAt}.
  `.trim();
  }
  
};

export const tokenDataProvider = new TokenDataProvider();