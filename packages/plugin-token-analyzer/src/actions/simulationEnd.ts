import type { Action, IAgentRuntime, Memory, State, HandlerCallback, ActionExample } from "@elizaos/core";
import type { SimulationState } from "../types";
import { dexScreenerEthPairFetcher } from "../dexScreenerEthPairFetcher";

/**
 * This action ends the token trading simulation.
 * It summarizes profit and loss based on the current portfolio,
 * compares each token's current price to its purchase price,
 * and deletes the simulation state from the runtime cache.
 */
export class SimulationEndAction implements Action {
  name = "END_SIMULATION";
  similes = ["SIMULATION_END", "STOP_SIMULATION", "FINISH", "SIMULATION_STOP", "END_SIMULATION"];
  description = "Ends simulation and reports profit/loss.";
  suppressInitialMessage = true;

  /**
   * Triggers this action if the message contains a phrase indicating the user wants to end the simulation.
   */
  async validate(_runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    message.unique = true;
    const content = typeof message.content === 'string' ? message.content : message.content?.text;
    return /\bsimulation end\b|\end simulation\b|\bend\b|\bstop\b|\bfinish\b/i.test(content);
  }

  /**
   * Calculates PnL from cached portfolio and generates a summary.
   * Clears the cached simulation state.
   */
  async handler(runtime: IAgentRuntime, message: Memory, state?: State, _options = {}, callback?: HandlerCallback): Promise<boolean> {
    message.unique = true;
    try {
      console.log("SimulationEndAction handler called.");

      // Load current simulation state from cache
      let simulationState = (await runtime.cacheManager.get("simulationState")) as SimulationState;
      if (!simulationState) {
        const notInSimMsg = "Simulation is not active. Start one with 'start simulation'.";
        if (callback) {
          await callback({ text: notInSimMsg, action: this.name });
        }
        if (state) {
          state.responseData = { text: notInSimMsg, action: this.name };
        }
        return true;
      }

      console.log("Simulation state found in cache");

      const portfolio = simulationState.portfolio;
      console.log("Portfolio:", portfolio);

      const summary: any[] = [];
      let totalUsdPnL = 0;

      // Get the latest ETH/USD price
      const ethUsdtPair = await dexScreenerEthPairFetcher.getEthUsdtPair();
      const ethPriceUsd = parseFloat(ethUsdtPair.priceUsd);
      console.log("ETH Price in USD:", ethPriceUsd);

      // Handle ETH (WETH) balance if it exists
      const ethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const ethHolding = portfolio[ethAddress];

      if (ethHolding) {
        const ethPnl = (ethPriceUsd - ethHolding.buyPrice) * ethHolding.amount;
        totalUsdPnL += ethPnl;

        summary.push({
          token: ethHolding.symbol,
          currentPrice: ethPriceUsd,
          buyPrice: ethHolding.buyPrice,
          amount: ethHolding.amount,
          pnlUsd: ethPnl.toFixed(4),
        });

        // Remove ETH from portfolio so we don't reprocess it
        delete portfolio[ethAddress];
      }

      // Iterate through all other token holdings and calculate PnL
      for (const tokenAddress in portfolio) {
        const holding = portfolio[tokenAddress];
        try {
          const pair = await dexScreenerEthPairFetcher.getEthPair(tokenAddress);
          const currentPrice = parseFloat(pair.priceUsd);
          const pnl = (currentPrice - holding.buyPrice) * holding.amount;
          totalUsdPnL += pnl;

          summary.push({
            token: holding.symbol,
            currentPrice,
            buyPrice: holding.buyPrice,
            amount: holding.amount,
            pnlUsd: pnl.toFixed(4),
          });
        } catch (err) {
          console.error(`Error fetching data for ${tokenAddress}:`, err);
          summary.push({
            token: holding.symbol,
            address: tokenAddress,
            error: "Failed to fetch data"
          });
        }
      }

      // Convert total USD PnL to ETH using latest ETH price
      const totalEthPnL = (totalUsdPnL / ethPriceUsd);

      const finalReport = `
Simulation complete. Here is your profit/loss summary:

ETH/USD Price: $${ethPriceUsd.toFixed(4)}

Total Net PnL:
- USD: $${totalUsdPnL.toFixed(4)}
- ETH: ${totalEthPnL} ETH

Detailed Holdings:
${JSON.stringify(summary, null, 2)}
      `.trim();

      // Clear simulation state from cache
      await runtime.cacheManager.delete("simulationState");

      // Send response
      if (state) {
        state.responseData = { 
          text: finalReport, 
          action: this.name 
        };
      }

      if (callback) {
        await callback({ 
          text: finalReport, 
          action: this.name 
        });
      }

      return true;
    } catch (err) {
      console.error("SimulationEndAction handler error:", err);
      if (callback) {
        await callback({
          text: "An error occurred while ending the simulation.",
          action: this.name
        });
      }
      return false;
    }
  }

  /**
   * Example user/system interaction for this action
   */
  examples = [
    [
      {
        user: "{{user}}",
        content: { text: "end simulation mode" }
      },
      {
        user: "{{system}}",
        content: {
          text: `Simulation complete. Here is your profit/loss summary:\n\n{
  "totalPnL": {
    "usd": 135.45,
    "eth": "0.0763"
  },
  "holdings": [
    {
      "token": "UNI",
      "currentPrice": 7.23,
      "buyPrice": 6.5,
      "amount": 100,
      "pnlUsd": "73.00"
    },
    {
      "token": "LINK",
      "currentPrice": 9.8,
      "buyPrice": 10.2,
      "amount": 50,
      "pnlUsd": "-20.00"
    }
  ]
}`
        }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "end simulation mode" }
      },
      {
        user: "{{system}}",
        content: {
          text: `Simulation is not active. Start one with 'start simulation'.`
        }
      }
    ]
  ];
}

// Export instance of the action
export const simulationEndAction = new SimulationEndAction();
