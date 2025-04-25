import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import type { DexScreenerPair } from "../types";

/**
 * Provider that fetches token data from the DexScreener API.
 * It analyzes tokens based on symbol or address, and returns
 * a formatted report summarizing trading metrics.
 */
export class TokenDataProvider implements Provider {

  /**
   * Main method invoked when the provider is triggered.
   * It parses the token from the message, queries DexScreener,
   * and formats relevant data into a natural-language summary.
   */
  async get(runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> {
    try {
      console.trace("TokenDataProvider.get() was called");

      const content = typeof message.content === "string"
        ? message.content
        : message.content?.text;
      if (!content) throw new Error("No message content provided");

      // Extract token address or symbol from user message
      const tokenIdentifier = this.extractToken(content);
      console.log("Token Identifier:", tokenIdentifier);
      if (!tokenIdentifier) throw new Error("Could not identify token in message");

      // Decide query method based on whether token is an address
      const isAddress =
        /^0x[a-fA-F0-9]{40}$/.test(tokenIdentifier) ||
        /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(tokenIdentifier); // ETH or Solana address

      const endpoint = isAddress
        ? `https://api.dexscreener.com/latest/dex/tokens/${tokenIdentifier}`
        : `https://api.dexscreener.com/latest/dex/search?q=${tokenIdentifier}`;

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);

      const data = await response.json();
      if (!data.pairs || data.pairs.length === 0) {
        throw new Error(`No pricing data found for ${tokenIdentifier}`);
      }

      // Select the best trading pair by liquidity
      const bestPair = this.getBestPair(data.pairs, tokenIdentifier, isAddress);
      console.log("Best Pair Data:", bestPair);

      return this.formatPairData(bestPair);
    } catch (error) {
      console.error("Error in tokenDataProvider:", error);
      return "Failed to fetch token data. Please try again later.";
    }
  }

  /**
   * Attempts to extract a token address or symbol from user input.
   * Supports formats like: 0xAddress, $TOKEN, or plain "analyze XYZ".
   */
  private extractToken(content: string): string | null {
    const patterns = [
      /0x[a-fA-F0-9]{40}/,                                  // Ethereum address
      /[$#]([a-zA-Z0-9]+)/,                                  // $TOKEN or #TOKEN
      /\b(?:analyze|analysis|evaluation|recommend|buy|sell)\s+(?:of|for|about)?\s*([a-zA-Z0-9]+)\b/i, // heuristic fallback
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const token = match[1] || match[0];
        return token.replace(/[$#]/g, "").toLowerCase().trim();
      }
    }

    return null;
  }

  /**
   * Finds the best pair by highest liquidity where the base token matches the given token.
   */
  private getBestPair(pairs: DexScreenerPair[], tokenIdentifier: string, isAddress: boolean): DexScreenerPair | null {
    const normalizedIdentifier = tokenIdentifier.toLowerCase();

    const filtered = pairs.filter(pair => {
      if (!pair.baseToken) return false;
      return isAddress
        ? pair.baseToken.address?.toLowerCase() === normalizedIdentifier
        : (
            pair.baseToken.symbol?.toLowerCase() === normalizedIdentifier ||
            pair.baseToken.name?.toLowerCase() === normalizedIdentifier
          );
    });

    if (filtered.length === 0) return null;

    return filtered.reduce((best, current) => {
      const bestLiquidity = parseFloat(best.liquidity?.usd || "0");
      const currentLiquidity = parseFloat(current.liquidity?.usd || "0");
      return currentLiquidity > bestLiquidity ? current : best;
    }, filtered[0]);
  }

  /**
   * Converts a DexScreenerPair object into a human-readable string summary.
   */
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
This is based on the trading pair with the highest liquidity.

Price change:
- +${priceChanges.m5.toFixed(2)}% in the last 5 minutes
- +${priceChanges.h1.toFixed(2)}% in the last 1 hour
- +${priceChanges.h6.toFixed(2)}% in the last 6 hours
- +${priceChanges.h24.toFixed(2)}% in the last 24 hours

Trading volumes:
- $${volumes.m5.toLocaleString()} in the last 5 minutes
- $${volumes.h1.toLocaleString()} in the last 1 hour
- $${volumes.h6.toLocaleString()} in the last 6 hours
- $${volumes.h24.toLocaleString()} in the last 24 hours

Transactions:
- 5m: ${txnCounts.m5.buys} buys / ${txnCounts.m5.sells} sells
- 1h: ${txnCounts.h1.buys} buys / ${txnCounts.h1.sells} sells
- 6h: ${txnCounts.h6.buys} buys / ${txnCounts.h6.sells} sells
- 24h: ${txnCounts.h24.buys} buys / ${txnCounts.h24.sells} sells

Liquidity: $${Number(liquidityUsd).toLocaleString()}
FDV: ${fdvText}
Market Cap: ${marketCapText}
Pair created on: ${createdAt}
`.trim();
  }
}

export const tokenDataProvider = new TokenDataProvider();
