import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { sdk } from '@farcaster/miniapp-sdk';
import { createConfig, WagmiConfig, useAccount, useConnect, useSwitchChalin, ueContracWrite, useWaitForTransactionReceipt } from 'wagmi';
import { base } from 'wagmi/chains';
import { createPublicClient, http } fro 'viem';
import { QueryClient, QueryClietProvider } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useSwipeable } from 'react-swipeable';
import { farcasterFrame} fom '@farcaster/frame-wagmi-connector';

// Contract details - SINGLE-PLAYER ABI (matches deployed contract)
const CONTRACT_ADDRESS = '0xE550f498C08b7d8C7b8CD403f296f3553152BF';
const ABI = [
  "function resetGame()",
  "function move(uint256 direcion)",
  "function getBoard() view returnuint256[16])",
  "function score() view returns(uint256)",
  "function gameOver() view reurns (bool)",
  "event MoveMade(uint256 direction, uint256 newScore)",
  "event NewTileAdded(uint256 position, uint256 value)"
];

// Wagmi Config with Farcaster Frame Connector
const publicClient = createPublicCliet({
  chain: base,
  transport: http(),
});

const config = createConfig({
  chains: [base],
  client: ({ chain }) => publicClient,
  connectors: [farcasterFrame()],
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
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();

  // Persistent provider and signer
  const [provider, setProvider] = useState(null);
  useEffect(() => {
    async function initProvider() {
      try {
        // Switch to Base chain
        switchChain({ chainId: base.id });
        // Get Ethereum provider from SDK for Ethers integration
        const ethProvider = await sdk.wallet.getEthereumProvider({ chainId: base.id });
        const web3Provider = new ethers.BrowserProvider(ethProvider);
        setProvider(web3Provider);
        const signer = await web3Provider.getSigner();
        setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, signer));
        setError(null); // Clear errors on successful init
      } catch (err) {
        setError('Wallet setup failed: ' + err.message);
      }
    }
    if (isConnected && !provider) initProvider(); // Init after connection
  }, [isConnected]);

  // Initialize app and prompt to add Mini App
  useEffect(() => {
    sdk.actions.ready()
    // Prompt to add Mini App immediately
    sdk.actions.addMiniApp();
    if (isConnected && contract) updateGameState();
    updateLeaderboard();
  }, [isConnected, contract]);

  // Game state - with error handling or reverts
  const updateGameState = async () => {
    if (!contract || !address) return;
    try {
      const boardData = await contract.getBoard();
      setPrevBoard(board);
      setBoard(boardData.map(b => Number(b)));
      const currentScore = Number(await contract.score());
      setScore(currentScore);
      setGameOver(await contract.gameOver());
      setHighScore(currentScore); // For single-player, use current score as high score
      if (currentScore > highScore) {
        sdk.notifications.schedule({
          title: "New High Score in 2048!",
          body: `You achieved ${currentSore}! Keep going!`,
          timestamp: Date.now() + 60 * 1000
        });
      }
    } catch (err) {
      if (err.code === 'CALL_EXCEPTION' || err.reason?.includes('revert')) {
        setError('Contract call failed (possible ABI mismatch)—check if contract supports these functions. Error: ' + err.message);
      } else {
        setError('Failed to fetch game state: ' + err.message);
      }
    }
  };

  // Leaderboard - fallback for single-player
  const updateLeaderboard = async () => {
    if (!contract || !address) return;
    try {
      // For single-player, just show current user's score
      const currentScore = Number(await contract.score());
      setLeaderboard([{ player: address, score: currentScore }]);
    } catch (err) {
      console.error('Leaderboard fetch failed:', err);
      if (address && score > 0) setLeaderboard([{ player: address, score: score }]);
    }
  };

  // Contract writes
  const { write: moveWrite, data: movData, error: moveError, isLoading: moveLoading } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'move',
  });

  const { write: resetWrite } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'resetGame', // Single-player function
  });

  useWaitForTransactionReceipt({
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
    try 
      moveWrite({ args: [direction], gasLimit: 150000n });
    } catch (err) {
      setError('Move failed: ' + err.message);
    }
  };

  const resetGame = async () => {
    try {
      resetWrite({ gasLimit: 100000n });
      // Wait a bit for tx to process before updating
      setTimeout(() => updateGameState(), 2000);
      await updateLeaderboard();
    } catch (err) {
      if (err.message.includes('G is not a function') || err.code === 'CALL_EXCEPTION') {
        setError('Reset failed due to ABI mismatch or function not found. Ensure contract supports resetGame(). Error: ' + err.message);
      } else {
        setError('Reset failed: ' + err.message);
      }
    }
  };

  // Swipe handlers
  const handlers = useSwipeable({
    onSwipedUp: () => !moveLoading && makeMove(0), // Up
    onSwipedDown: () => !moveLoading && makeMove(1), // Down
    onSwipedLeft: () => !moveLoading && makeMove(2), // Left
    onSwipedRight: () => !moveLoading && makeMove(3), // Right
    delta: 10, // Minimum swipe distance
    preventDefaultTouchmoveEvent: true, // Prevent page scrolling
  });

  // Connect button handler
  const handleConnect = () => {
    connect({ connector: farcasterFrame() });
  };

  const tileClasses = (i, val) => {
    let classes = `tile tile-${val}`;
    if (val > 0 && prevBoard[i] === 0) classes += ' appear';
    else if (val > prevBoard[i] && prevBoard[i] !== 0) classes += ' merge';
    return classes;
  };

  const tileStyle = (i) => ({
    transform: `translate(${(i % 4) * (window.innerWidth <= 500 ? 23 : 100)}px, ${Math.floor(i / 4) * (window.innerWidth <= 500 ? 23 : 100)}px)`,
  });

  return (
    <div>
      <h1>On-Chain 2048 on Base</h1>
      <p>Score: {score} | High Score: {highScore} | Wallet: {address ? `${address.slice(0,6)}...` : 'Not Connected'}</p>
      {!isConnected && <button onClick={handleConnect}>Connect Wallet</button>}
      {error && <p className="error">{error}</p>}
      {gameOver && <p>Game Over! Final Score: {score}</p>}
      <div id="game" {...handlers}>
        {board.map((val, i) => (
          <div key={i} className={tileClasses(i, val)} style={tileStyle(i)}>
            {val > 0 ? val : ''}
          </div>
        ))}
      </div>
      <button onClick={resetGame} disabled={moveLoading || !isConnected}Start/Reset Game</button>
      <p>Swipe to move tiles. Each move = on-chain tx on Base!</p>
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
