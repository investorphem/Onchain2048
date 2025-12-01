
# 🧱 Onchain2048 – Web3 Puzzle Game Built on Base Chain

Onchain2048 is a fully on-chain version of the classic **2048 puzzle game**, powered by blockchain technology. The game turns every move, score, and leaderboard achievement into verifiable on-chain actions. It’s not just a game — it’s a crypto-native experience that demonstrates blockchain gaming, decentralized logic, and smart contract interaction.

This project lives entirely on the **Base Chain**, giving it fast transactions, cheap gas fees, and secure infrastructure powered by Ethereum layer-2 technology.

## ✨ Key Features

- 🎮 Classic 2048 gameplay but **stored and executed on-chain**
- 🔗 All moves and game states are verified on the blockchain
- ⚡ Built on **Base Chain** for scalable and low-cost transactions
- 👤 Player identity tied to wallet addresses instead of usernames
- 🏆 Leaderboard sorted by wallet (and score!) directly on-chain
- 🧩 Smart contract handles logic, randomness & win conditions
- 🌐 Fully Web3: ownership + transparency + immutability

## 🚀 Why Onchain?

Traditional 2048 is centralized and mutable. Onchain2048:

- Uses smart contracts for gameplay logic  
- Proves that web3 gaming can exist **trustlessly**
- Makes scores verifiable forever on-chain  
- Demonstrates decentralized mechanics in gaming

The blockchain acts as the game server.

## 🛠 Tech Stack

| Component | Technology |
|----------|------------|
| Chain | **Base** |
| Language | Solidity |
| Build Tooling | Hardhat or Foundry |
| Frontend | React / Next.js or simple Web3 UI |
| Wallet | MetaMask / Coinbase Wallet |
| State & Storage | Smart Contract on Base |

## 💡 How it Works

- Start the game by sending a transaction
- Smart contract spawns tiles and updates state
- Every swipe triggers an on-chain execution
- The chain records your board + score
- Leaderboard is read from the contract

No centralized backend. No server. Everything lives on blockchain.

## 🧬 Web3 Concepts Used

This project includes real crypto primitives:

- accounts & wallets  
- decentralized storage of game state  
- blockchain transaction signing  
- gas optimization  
- smart contract execution  
- verifiable randomness  
- on-chain leaderboard  

## 🧱 Why Base Chain?

Base is chosen for:

- ⚡ Fast & cheap gas
- 🪙 EVM compatibility
- 🔐 Ethereum-grade security
- 🧩 Great for on-chain gaming + GameFi
- 🔵 Supported by major Web3 ecosystems

## 📦 Deployment

Deploy the smart contract to Base mainnet or testnet.

Example:

```sh
npx hardhat run scripts/deploy.js --network base
```

Connect your frontend using RPC or wallet provider.

## 🗺 Roadmap

- NFT achievement badges
- Token rewards / GameFi economy
- Multiplayer settings
- Staking for leaderboard challenges
- Onchain randomness expansion

## 🧾 License

MIT — free to build on, fork, or remix.

## 🤝 Contribute

Pull requests, issues, and improvements are always welcome.
