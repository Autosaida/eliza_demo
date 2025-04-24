import type { Plugin } from "@elizaos/core";
import { tokenAnalyzeAction } from "./actions/analyzeToken";
import { tokenDataProvider } from "./providers/tokenDataProvider";

export const tokenAnalyzerPlugin: Plugin = {
    name: "token-analyzer",
    description: "Token Analyzer Plugin for Eliza",
    actions: [tokenAnalyzeAction],
    evaluators:[],
    providers:[tokenDataProvider],
};

export default tokenAnalyzerPlugin;
