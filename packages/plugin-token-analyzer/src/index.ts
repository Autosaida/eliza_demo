import type { Plugin } from "@elizaos/core";

// Import defined actions
import { tokenAnalyzeAction } from "./actions/analyzeToken";           // Handles standalone token analysis
import { simulationStartAction } from "./actions/simulationStart";     // Starts a new trading simulation
import { simulationEndAction } from "./actions/simulationEnd";         // Ends the simulation and reports PnL
import { simulationTradeAction } from "./actions/simulationTrade";     // Executes simulated trades based on token input

// Import token data provider
import { tokenDataProvider } from "./providers/tokenDataProvider";     // Fetches real-time token data via DexScreener API

// Define the plugin object to register actions and providers with the Eliza framework
export const tokenAnalyzerPlugin: Plugin = {
    name: "token-analyzer",  // Unique plugin name
    description: "Token Analyzer Plugin for Eliza",  // Brief description

    // Register available actions for simulation and token analysis
    actions: [
        tokenAnalyzeAction,
        simulationStartAction,
        simulationEndAction,
        simulationTradeAction
    ],

    evaluators: [],  // No custom evaluators included for now

    // Register external data providers
    providers: [tokenDataProvider],
};

// Default export for plugin usage
export default tokenAnalyzerPlugin;
