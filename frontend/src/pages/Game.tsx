import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store';
import NightPhase from '../components/game/NightPhase';
import DayPhase from '../components/game/DayPhase';
import VotingPhase from '../components/game/VotingPhase';
import GameOverScreen from '../components/game/GameOverScreen';
import PlayerBoard from '../components/game/PlayerBoard';
import GameHeader from '../components/game/GameHeader';
import ChatPanel from '../components/game/ChatPanel';

export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  
  const {
    playerId,
    isConnected,
    gameState,
    lobbyState,
    connect,
    clearGame,
  } = useGameStore();

  // Connect/reconnect to WebSocket
  useEffect(() => {
    if (roomCode && playerId && !isConnected) {
      connect(roomCode, playerId);
    }
  }, [roomCode, playerId, isConnected, connect]);

  // Redirect to lobby if game not started
  useEffect(() => {
    if (lobbyState?.phase === 'lobby') {
      navigate(`/lobby/${roomCode}`);
    }
  }, [lobbyState?.phase, roomCode, navigate]);

  // Handle leave
  const handleLeave = () => {
    clearGame();
    navigate('/');
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading game...</div>
      </div>
    );
  }

  const renderPhaseContent = () => {
    switch (gameState.phase) {
      case 'night':
        return <NightPhase />;
      case 'day_discussion':
        return <DayPhase />;
      case 'day_voting':
        return <VotingPhase />;
      case 'game_over':
        return <GameOverScreen />;
      default:
        return (
          <div className="text-center text-gray-400 py-8">
            {gameState.phase === 'starting' && 'Game is starting...'}
            {gameState.phase === 'night_resolution' && 'Resolving night actions...'}
            {gameState.phase === 'day_announcement' && 'Announcing night events...'}
            {gameState.phase === 'vote_resolution' && 'Counting votes...'}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <GameHeader onLeave={handleLeave} />

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Game Area */}
        <div className="flex-1 p-4">
          <div className="max-w-4xl mx-auto">
            {/* Player Board */}
            <PlayerBoard />

            {/* Phase Content */}
            <div className="mt-6">
              {renderPhaseContent()}
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="w-80 border-l border-gray-700 hidden lg:block">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
