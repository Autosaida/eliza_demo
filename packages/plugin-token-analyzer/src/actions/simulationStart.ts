// simulationStartAction.ts

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import type { SimulationState } from "../types";
import { dexScreenerEthPairFetcher } from "../dexScreenerEthPairFetcher";

/**
 * Action that starts the trading simulation mode.
 * It initializes the user’s portfolio with 10 ETH (in WETH form),
 * and stores it in the runtime cache for use by other simulation actions.
 */
export class SimulationStartAction implements Action {
  // Unique action identifier
  name = "START_SIMULATION";

  // Alternative triggers for this action
  similes = ["START_SIMULATION", "SIMULATION_MODE", "BEGIN_SIMULATION", "INIT_SIMULATION"];

  // Short description of the action
  description = "Initializes simulation mode with a base portfolio";

  // Disable automatic system message when this action starts
  suppressInitialMessage = true;

  /**
   * Determines whether the user input should trigger this action
   */
  async validate(_runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    message.unique = true;

    const content = typeof message.content === 'string' ? message.content : message.content?.text;
    if (!content) return false;

    // Match keywords related to starting a simulation
    return /\b(simulation( mode)?|start (sim|simulation)|begin (test|simulation)|enter simulation|simulate now)\b/i.test(content);
  }

  /**
   * Initializes simulation state in cache and responds to user
   */
  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options = {},
    callback?: HandlerCallback
  ): Promise<boolean> {
    message.unique = true;
    console.log("SimulationStartAction handler called.");

    try {
      // Check if simulation is already active
      let simulationState = await runtime.cacheManager.get("simulationState");
      if (simulationState) {
        console.log("Simulation state found in cache");

        const alreadyRunningMsg =
          "Simulation mode is already active. You can input Ethereum token addresses to analyze and simulate trading, or type 'end simulation' to stop.";

        // Respond with notice that simulation is already running
        if (callback) {
          await callback({ text: alreadyRunningMsg, action: this.name });
        }

        if (state) {
          state.responseData = {
            text: alreadyRunningMsg,
            action: this.name
          };
        }

        return true;
      }

      // Fetch the current ETH/USDT price to set initial buyPrice
      const ethPriceUsd = parseFloat((await dexScreenerEthPairFetcher.getEthUsdtPair()).priceUsd);

      // Create initial simulation state with 10 ETH (WETH)
      const initialSimState: SimulationState = {
        isSimulationMode: true,
        portfolio: {
          "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
            symbol: "WETH",
            amount: 10,
            buyPrice: ethPriceUsd
          }
        },
        actions: []
      };

      // Store the simulation state in cache
      await runtime.cacheManager.set("simulationState", initialSimState);

      const response = `Simulation mode activated. You now have 10 ETH. 
Please ONLY provide token addresses on Ethereum.
I will analyze each and make corresponding trade decisions.
You must type 'end simulation' to finish the simulation.`;

      // Send response to client
      if (state) {
        state.responseData = {
          text: response,
          action: this.name
        };
      }

      if (callback) {
        await callback({
          text: response,
          action: this.name
        });
      }

      return true;
    } catch (err) {
      console.error("SimulationStartAction handler error:", err);

      // Handle error gracefully with user feedback
      if (callback) {
        await callback({
          text: "An error occurred while starting the simulation.",
          action: this.name
        });
      }

      return false;
    }
  }

  /**
   * Example conversations for testing and documentation
   */
  examples = [
    [
      {
        user: "{{user}}",
        content: {
          text: "Start simulation mode"
        }
      },
      {
        user: "{{system}}",
        content: {
          text: `Simulation mode activated. You now have 10 ETH. 
          Please ONLY provide token addresses on Ethereum.
          I will analyze each and make corresponding trade decisions.
          You must type 'end simulation' to finish the simulation.`
        }
      }
    ],
    [
      {
        user: "{{user}}",
        content: {
          text: "Start simulation"
        }
      },
      {
        user: "{{system}}",
        content: {
          text: `Simulation mode is already active. You can input Ethereum token addresses to analyze and simulate trading, or type 'end simulation' to stop.`
        }
      }
    ]
  ];
}

// Export instance of the action
export const simulationStartAction = new SimulationStartAction();
