import type { Action, IAgentRuntime, Memory, State, HandlerCallback, ActionExample } from "@elizaos/core";
import type { SimulationState } from "../types";
import { generateText, ModelClass, parseJSONObjectFromText } from "@elizaos/core";
import { dexScreenerEthPairFetcher } from "../dexScreenerEthPairFetcher";

/**
 * This action handles a single token trade in simulation mode.
 * It fetches live market data for a given token, asks the model to make a trading decision,
 * updates the simulated portfolio, and logs the action.
 */
export class SimulationTradeAction implements Action {
  name = "SIMULATE_TOKEN_TRADE";
  similes = ["SIMULATE_TRADE", "TRADING_SIMULATION"];
  description = "Handles individual token trades during simulation";
  suppressInitialMessage = true;

  /**
   * This action triggers only if:
   * - The simulation is active (exists in cache)
   * - The message content is a valid Ethereum token address
   */
  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    message.unique = true;
    const content = typeof message.content === 'string' ? message.content : message.content?.text;
    console.log(content, "Is message unique?", message.unique);

    const isAddr = /^0x[a-fA-F0-9]{40}$/.test(content);
    const simulationState = (await runtime.cacheManager.get("simulationState")) as SimulationState;

    return (simulationState ? true : false) && isAddr;
  }

  /**
   * Main handler logic:
   * 1. Fetch token data from DEX Screener
   * 2. Generate trading decision (BUY/SELL/HOLD) using LLM
   * 3. Apply the decision to the simulated portfolio
   * 4. Save updated state and respond to user
   */
  async handler(runtime: IAgentRuntime, message: Memory, state?: State, _options = {}, callback?: HandlerCallback): Promise<boolean> {
    message.unique = true;
    console.log("handler Is message unique?", message.unique);

    try {
      console.log("SimulationTradeAction handler called.");
      const tokenAddress = message.content.text.trim().toLowerCase();

      // Step 1: Fetch pair data for the provided token address
      const pair = await dexScreenerEthPairFetcher.getEthPair(tokenAddress);
      console.log("Pair Data:", pair);

      // Step 2: Load current simulation state and portfolio
      const simulationState = (await runtime.cacheManager.get("simulationState")) as SimulationState;
      const portfolio = simulationState.portfolio;

      // Step 3: Construct prompt to let LLM make a decision
      const prompt = `Your target is to maximize profit in ETH terms before simulation ends.
Analyze the following Token Pair Data along with the current Portfolio.
Now your goal is to determine the most **profitable trading action**. Do not go all-in on a single token.

Token Pair Data:
${JSON.stringify(pair, null, 2)}

Portfolio:
${JSON.stringify(portfolio, null, 2)}

You must return **ONLY** the final decision as a **JSON object** in the following format:
{
  "address": "${tokenAddress}",
  "symbol": "${pair.baseToken.symbol}",
  "priceUsd": ${pair.priceUsd},
  "action": "BUY" | "SELL" | "HOLD",
  "amount": number,
  "reasoning": string
}`;

      console.log("portfolio", `${JSON.stringify(portfolio, null, 2)}`);

      // Step 4: Use LLM to generate a trading decision
      const content = await generateText({
        runtime,
        context: prompt,
        modelClass: ModelClass.LARGE,
      });

      // Step 5: Parse JSON output from LLM
      const decision = parseJSONObjectFromText(content);
      console.log("Decision:", decision);

      const decisionAmount = parseFloat(decision.amount);
      const decisionPrice = parseFloat(decision.priceUsd);

      if (!decision || !["BUY", "SELL", "HOLD"].includes(decision.action)) {
        throw new Error("Model did not return a valid trading decision.");
      }

      // Step 6: Apply the decision to the simulated portfolio
      const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const ethHolding = portfolio[wethAddress];

      if (decision.action === "BUY") {
        const ethUsed = decisionAmount * parseFloat(pair.priceNative);
        if (ethUsed > ethHolding.amount) {
          throw new Error("Not enough ETH to execute trade.");
        }

        // Deduct ETH from WETH balance
        ethHolding.amount -= ethUsed;

        // Update or create token holding
        const existing = portfolio[tokenAddress];
        if (existing) {
          const totalValue = existing.amount * existing.buyPrice + decisionAmount * decisionPrice;
          const newAmount = existing.amount + decisionAmount;
          existing.amount = newAmount;
          existing.buyPrice = parseFloat((totalValue / newAmount).toFixed(2));
        } else {
          portfolio[tokenAddress] = {
            symbol: decision.symbol,
            amount: decisionAmount,
            buyPrice: decisionPrice,
          };
        }

        portfolio[wethAddress] = ethHolding;
        console.log("Portfolio after BUY:", portfolio);

      } else if (decision.action === "SELL") {
        const existing = portfolio[tokenAddress];
        if (!existing || existing.amount < decisionAmount) {
          throw new Error("Not enough tokens to sell.");
        }

        // Subtract token amount, remove from portfolio if depleted
        existing.amount -= decisionAmount;
        if (existing.amount === 0) delete portfolio[tokenAddress];

        // Add ETH from sale
        const ethGain = decisionAmount * parseFloat(pair.priceNative);
        ethHolding.amount += ethGain;
        portfolio[wethAddress] = ethHolding;

        console.log("Portfolio after SELL:", portfolio);
      }

      // Step 7: Log the action
      simulationState.actions.push({
        token: decision.address,
        action: decision.action,
        amount: decisionAmount,
        price: decisionPrice,
      });

      // Step 8: Save updated state
      await runtime.cacheManager.set("simulationState", simulationState);

      // Step 9: Return the result
      if (callback) {
        await callback({
          text: content,
          action: this.name
        });
      }

      if (state) {
        state.responseData = {
          text: content,
          action: this.name
        };
      }

      return true;

    } catch (error) {
      console.error("Error in SimulationTradeAction handler:", error);
      if (callback) {
        await callback({
          text: "An error occurred while processing the trade.",
          action: this.name
        });
      }
      return false;
    }
  }

  /**
   * Example prompts and responses for testing or documentation.
   */
  examples = [
    [
      {
        user: "{{user}}",
        content: { text: "0x6b175474e89094c44da98b954eedeac495271d0f" } // DAI
      },
      {
        user: "{{system}}",
        content: {
          text: `{
  "address": "0x6b175474e89094c44da98b954eedeac495271d0f",
  "symbol": "DAI",
  "priceUsd": 1.00,
  "action": "BUY",
  "amount": 200,
  "reasoning": "DAI is stable and can be used to hedge ETH volatility. You have sufficient ETH to diversify."
}`
        }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "0xdac17f958d2ee523a2206206994597c13d831ec7" } // USDT
      },
      {
        user: "{{system}}",
        content: {
          text: `{
  "address": "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "symbol": "USDT",
  "priceUsd": 1.00,
  "action": "HOLD",
  "amount": 0,
  "reasoning": "You already hold a sufficient stablecoin balance, and market conditions do not justify buying or selling."
}`
        }
      }
    ],
    [
      {
        user: "{{user}}",
        content: { text: "0x514910771af9ca656af840dff83e8264ecf986ca" } // LINK
      },
      {
        user: "{{system}}",
        content: {
          text: `{
  "address": "0x514910771af9ca656af840dff83e8264ecf986ca",
  "symbol": "LINK",
  "priceUsd": 9.50,
  "action": "SELL",
  "amount": 50,
  "reasoning": "LINK price has surged over 20% in the last 24 hours. Selling now can lock in profits from your earlier purchase."
}`
        }
      }
    ]
  ];      
}

// Export singleton instance
export const simulationTradeAction = new SimulationTradeAction();
