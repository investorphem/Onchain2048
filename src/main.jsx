import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { sdk } from '@farcaster/miniapp-sdk';
import { createConfig, WagmiConfig, useAccount, useSwitchChain, useContractWrite, useWaitForTransaction } from 'wagmi';
import { base } from 'wagmi/chains';
import { createPublicClient, http } from 'viem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ethers } from 'ethers';

// Contract details
const CONTRACT_ADDRESS = '0x2B204747b90e49791674B7b89F464476C9670eD7';
const ABI = [
  "function startOrResetGame()",
  "function move(uint256 direction)",
  "function getMyBoard() view returns (uint128[16])",
  "function getMyScore() view returns (uint256)",
  "function getMyGameOver() view returns (bool)",
  "function getHighScore(address player) view returns (uint256)",
  "function getPlayersCount() view returns (uint256)",
  "function players(uint256 index) view returns (address)",
  "event MoveMade(address indexed player, uint256 direction, uint256 newScore)",
  "event NewTileAdded(address indexed player, uint256 position, uint256 value)",
  "event HighScoreUpdated(address indexed player, uint256 newHighScore)"
];

// For single-player contract (uncomment if 0x2B204747... is single-player):
/*
const ABI = [
  "function resetGame()",
  "function move(uint256 direction)",
  "function getBoard() view returns (uint256[16])",
  "function score() view returns (uint256)",
  "function gameOver() view returns (bool)",
  "event MoveMade(uint256 direction, uint256 newScore)",
  "event NewTileAdded(uint256 position, uint256 value)"
];
*/

// Wagmi Config
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const config = createConfig({
  chains: [base],
  client: ({ chain }) => publicClient,
});

const queryClient = new QueryClient();

function App() {
  const [board, setBoard] = useState(new Array(16).fill(0));
  const [prevBoard, setPrevBoard] = useState(new Array(16).fill(0));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [error, setError] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [contract, setContract] = useState(null);
  const { address } = useAccount();
  const { switchChain } = useSwitchChain();

  // Persistent provider and signer
  const [provider, setProvider] = useState(null);
  useEffect(() => {
    async function initProvider() {
      try {
        const ethProvider = await sdk.wallet.getEthereumProvider({ chainId: base.id });
        const web3Provider = new ethers.BrowserProvider(ethProvider);
        await web3Provider.send('wallet_switchEthereumChain', [{ chainId: '0x2105' }]);
        const signer = await web3Provider.getSigner();
        setProvider(web3Provider);
        setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, signer));
      } catch (err) {
        setError('Wallet connection failed: ' + err.message);
      }
    }
    if (!provider) initProvider(); // Connect once
  }, []);

  // Initialize
  useEffect(() => {
    sdk.actions.ready();
    if (address && contract) updateGameState();
    updateLeaderboard();
  }, [address, contract]);

  // Game state
  const updateGameState = async () => {
    if (!contract || !address) return;
    try {
      const boardData = await contract.getMyBoard();
      setPrevBoard(board);
      setBoard(boardData.map(b => Number(b)));
      const currentScore = Number(await contract.getMyScore());
      setScore(currentScore);
      setGameOver(await contract.getMyGameOver());
      const currentHigh = Number(await contract.getHighScore(address));
      setHighScore(currentHigh);
      if (currentScore > currentHigh) {
        sdk.notifications.schedule({
          title: "New High Score in 2048!",
          body: `You achieved ${currentScore}! Keep going!`,
          timestamp: Date.now() + 60 * 1000
        });
      }
    } catch (err) {
      setError('Failed to fetch game state: ' + err.message);
    }
  };

  // Leaderboard
  const updateLeaderboard = async () => {
    if (!contract) return;
    try {
      const count = Number(await contract.getPlayersCount());
      const entries = [];
      for (let i = 0; i < count && i < 50; i++) {
        const player = await contract.players(i);
        const hs = Number(await contract.getHighScore(player));
        if (hs > 0) entries.push({ player, score: hs });
      }
      entries.sort((a, b) => b.score - a.score);
      setLeaderboard(entries.slice(0, 10));
    } catch (err) {
      console.error('Leaderboard fetch failed:', err);
      if (address && highScore > 0) setLeaderboard([{ player: address, score: highScore }]);
    }
  };

  // Contract writes
  const { write: moveWrite, data: moveData, error: moveError, isLoading: moveLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'move',
  });

  const { write: resetWrite } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'startOrResetGame',
    // For single-player: functionName: 'resetGame'
  });

  useWaitForTransaction({
    hash: moveData?.hash,
    onSuccess: async () => {
      await updateGameState();
      await updateLeaderboard();
      sdk.haptics.impactOccurred('light');
      sdk.actions.composeCast({ text: `Moved in On-Chain 2048! Score: ${score} 🎮 https://onchain2048.vercel.app/` });
    },
    onError: (err) => setError('Transaction failed: ' + err.message),
  });

  const makeMove = (direction) => {
    if (gameOver || !address || !contract || moveLoading) {
      setError('Cannot move: Game over or wallet not connected');
      return;
    }
    try {
      moveWrite({ args: [direction], gasLimit: 150000n });
    } catch (err) {
      setError('Move failed: ' + err.message);
    }
  };

  const resetGame = async () => {
    try {
      resetWrite({ gasLimit: 100000n });
      await updateGameState();
      await updateLeaderboard();
    } catch (err) {
      setError('Reset failed: ' + err.message);
    }
  };

  const handleKey = (e) => {
    if (moveLoading) return;
    let dir;
    if (e.key === 'ArrowUp') dir = 0;
    else if (e.key === 'ArrowDown') dir = 1;
    else if (e.key === 'ArrowLeft') dir = 2;
    else if (e.key === 'ArrowRight') dir = 3;
    else return;
    makeMove(dir);
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [board, moveLoading]);

  const tileClasses = (i, val) => {
    let classes = `tile tile-${val}`;
    if (val > 0 && prevBoard[i] === 0) classes += ' appear';
    else if (val > prevBoard[i] && prevBoard[i] !== 0) classes += ' merge';
    return classes;
  };

  const tileStyle = (i) => ({
    transform: `translate(${(i % 4) * 105}px, ${Math.floor(i / 4) * 105}px)`,
  });

  return (
    <div>
      <h1>On-Chain 2048 on Base</h1>
      <p>Score: {score} | High Score: {highScore} | Wallet: {address ? `${address.slice(0,6)}...` : 'Connecting...'}</p>
      {error && <p className="error">{error}</p>}
      {gameOver && <p>Game Over! Final Score: {score}</p>}
      <div id="game">
        {board.map((val, i) => (
          <div key={i} className={tileClasses(i, val)} style={tileStyle(i)}>
            {val > 0 ? val : ''}
          </div>
        ))}
      </div>
      <button onClick={resetGame} disabled={moveLoading}>Start/Reset Game</button>
      <p>Use arrow keys. Each move = on-chain tx on Base!</p>
      <div id="leaderboard">
        <h2>Leaderboard (Top 10)</h2>
        <ul>
          {leaderboard.map((entry, idx) => (
            <li key={idx}>{idx + 1}. {entry.player.slice(0,6)}...: {entry.score}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <WagmiConfig config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiConfig>
);
