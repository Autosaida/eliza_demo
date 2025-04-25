## Token Analyzer Plugin for ElizaOS

### Overview

This project develops a plugin, **[plugin-token-analyzer](./packages/plugin-token-analyzer)**, for the ElizaOS framework.  

It provides two major functionalities:

- **Token Analysis**: Analyze token metrics and offer investment advice.
- **Simulation Mode**: Simulate trading of Ethereum tokens based on agent decisions.

### Setup

1. **Clone the project**  
   ```bash
   git clone git@github.com:Autosaida/eliza_demo.git
   ```

2. **Install dependencies and build**  
   Follow the setup instructions for [ElizaOS](https://github.com/elizaOS/eliza).  
   Typically:
   ```bash
   pnpm install
   pnpm build
   ```

3. **Local Testing**  
   Launch the agent:
   ```bash
   pnpm start --characters="characters/trader.character.json"
   ```
   In another terminal, start the client:
   ```bash
   pnpm start:client
   ```
   Then visit [http://localhost:5173](http://localhost:5173) to interact.

4. **Online Demo**  
   You can also try the live service deployed [here](http://147.182.200.211/).

### Usage

#### Token Analyzer

The plugin analyzes token data based on **DexScreener**'s API. Users can input a **token address** or **symbol** to inquire about the token’s latest market status and receive investment advice.


**Example Input:**
```
Analyze BTC for me.
```

**Example Output:**
```json
{
  "overview": "...",
  "recommendation": "BUY",
  "confidence": 85,
  "reasoning": "...",
  "risks": ["..."],
  "opportunities": ["..."]
}
```

#### Simulation Mode

The plugin also implements a **simulation trading mode** for Ethereum tokens.

- In simulation mode, users start with an initial balance of 10 ETH.
- Users can input an Ethereum token address, and the agent will:
  - Analyze the token based on real-time data (DexScreener).
  - Consider current portfolio holdings.
  - Automatically decide to **BUY**, **SELL**, or **HOLD** the target token.

The portfolio will update dynamically based on these actions.

At the end of the simulation, users can view a final **profit/loss summary**.

**Typical Flow:**
1. Input:  
   ```
   start simulation
   ```
2. Then input any **Ethereum token address** to trigger trading actions.
3. End the simulation:
   ```
   end simulation
   ```

You can refer to the full [Conversation Sample](./packages/plugin-token-analyzer/conversation_sample.md) for detailed input/output examples.

### Notes

- This project is a **demo** mainly intended for **learning purposes**.  
- The analysis and investment recommendations are **simplified** and **for reference only**.
- Sometimes the agent may not strictly follow the expected output format due to LLM unpredictability.  
  - You can try clearing conversation memory.
  - Rephrasing your input.
  - Or waiting and retrying.
