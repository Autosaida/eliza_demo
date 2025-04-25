import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { generateText, ModelClass } from "@elizaos/core";
import { TokenDataProvider } from "../providers/tokenDataProvider";

/**
 * Action that analyzes a cryptocurrency token based on on-chain metrics
 * and generates a trading recommendation.
 */
export class TokenAnalyzeAction implements Action {
    // Unique action name
    name = "ANALYZE_TOKEN";

    // Alternative names / aliases for action matching
    similes = [
        "ANALYZE_TOKEN",
        "TOKEN_ANALYSIS",
        "EVALUATE_TOKEN",
        "REVIEW_TOKEN",
        "CHECK_TOKEN_METRICS",
        "TOKEN_HEALTH_CHECK",
        "TOKEN_SCORE",
        "TOKEN_OVERVIEW",
        "TOKEN_PRICE",
    ];

    // Short description of the action
    description = "Analyzes a token for price, volume, liquidity, and other on-chain metrics to provide a comprehensive token overview and trading recommendation.";

    // Suppress default initial message output
    suppressInitialMessage = true;

    /**
     * Validate whether this action should be triggered
     */
    async validate(_runtime: IAgentRuntime, message: Memory): Promise<boolean> {
        message.unique = true;

        const content = typeof message.content === 'string'
            ? message.content
            : message.content?.text;

        if (!content) return false;

        // Check for relevant keywords suggesting an analysis or recommendation
        const hasAnalyzeKeyword = /\b(analyze|analysis|evaluate|evaluation|insight|overview|recommend|suggest|opinion|advice|should\s+(i\s+)?(buy|invest|sell)|what\s+do\s+you\s+think)\b/i.test(content);

        // Check for token identifiers (addresses or symbols)
        const hasToken = (
            /0x[a-fA-F0-9]{40}/.test(content) ||
            /[$#]?[a-zA-Z0-9]+/i.test(content)
        );

        return hasAnalyzeKeyword && hasToken;
    }

    /**
     * Handler function that fetches token data, generates an analysis,
     * and returns a structured trading recommendation
     */
    async handler(
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options: { [key: string]: unknown } = {},
        callback?: HandlerCallback
    ): Promise<boolean> {
        message.unique = true;

        console.log("TokenAnalyzeAction handler called.");
        try {
            // Find the token data provider
            const provider = runtime.providers.find(p => p instanceof TokenDataProvider);
            if (!provider) {
                throw new Error("Token Data provider not found");
            }

            console.log("Fetching price data...");
            // Fetch detailed token data
            const tokenData = await provider.get(runtime, message, state);
            console.log("Received price data:", tokenData);

            if (tokenData.includes("Error")) {
                throw new Error(tokenData);
            }

            // Construct prompt for text generation model
            const prompt = `First, analyze the following token data and provide a comprehensive **overview** of the token's current state. 
                Consider aspects such as price, liquidity, volume, recent trends, and any indicators of risk or strength.
                Then, based on your analysis, **provide a trading recommendation** on whether to BUY or SELL this token.

                Token Data:
                ${JSON.stringify(tokenData, null, 2)}
                
                You must return **ONLY** the recommendation as a **JSON object** in the following structure:
                {
                "overview": string,
                "recommendation": "BUY" | "SELL | HOLD",
                "confidence": number (0-100),
                "reasoning": string,
                "risks": string[],
                "opportunities": string[]
                }`;

            // Use the large model to generate the analysis
            const content = await generateText({
                runtime,
                context: prompt,
                modelClass: ModelClass.LARGE,
            });

            if (!content) {
                throw new Error("No analysis generated");
            }
            
            // Send the result back via callback if provided
            if (callback) {
                await callback({
                    text: content,
                    action: this.name
                });
            }

            // Also store the result in the state (optional, for future use)
            if (state) {
                state.responseData = {
                    text: content,
                    action: this.name
                };
            }

            return true;

        } catch (error) {
            console.error("Error in price action handler:", error);

            // Fallback response if an error occurs
            if (callback) {
                await callback({
                    text: `Sorry, I couldn't fetch the token price: ${error.message}`,
                    action: this.name
                });
            }

            return false;
        }
    }

    /**
     * Example conversations for training or testing
     */
    examples = [
        [
            {
                user: "{{user}}",
                content: {
                    text: "analyze eth for me"
                }
            },
            {
                user: "{{system}}",
                content: {
                    text: `{
        "overview": "Ethereum (ETH) is currently priced at $2,345.67. It shows high 24h volume ($9.87B) and strong liquidity ($1.23B). The price increased by +5.43% in the last 24 hours, indicating healthy market momentum.",
        "recommendation": "BUY",
        "confidence": 85,
        "reasoning": "ETH is showing strong liquidity and volume with positive price movement.",
        "risks": ["Potential short-term correction", "Market volatility"],
        "opportunities": ["Institutional interest", "Strong ecosystem adoption"]
                    }`
                }
            }
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Give me the analysis for btc."
                }
            },
            {
                user: "{{system}}",
                content: {
                    text: `{
        "overview": "Bitcoin (BTC) is trading at $42,567.89 with strong 24h volume ($25.87B) and excellent liquidity ($15.23B). Price is up 2.15% in the last 24 hours, indicating bullish sentiment.",
        "recommendation": "BUY",
        "confidence": 78,
        "reasoning": "BTC's performance indicates market confidence and stability.",
        "risks": ["Macro-economic factors", "High investor expectations"],
        "opportunities": ["Digital gold narrative", "Long-term growth"]
                    }`
                }
            }
        ],
    ];
}

// Export the action instance
export const tokenAnalyzeAction = new TokenAnalyzeAction();
