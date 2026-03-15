import { useEffect, useState } from 'react';
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
  const [showMobileChat, setShowMobileChat] = useState(false);
  
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

  // Redirect to lobby if game not started (only if no gameState exists)
  useEffect(() => {
    if (!gameState && lobbyState?.phase === 'lobby') {
      navigate(`/lobby/${roomCode}`);
    }
  }, [gameState, lobbyState?.phase, roomCode, navigate]);

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
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <GameHeader onLeave={handleLeave} />

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Game Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          <div className="max-w-4xl mx-auto">
            {/* Player Board */}
            <PlayerBoard />

            {/* Phase Content */}
            <div className="mt-4">
              {renderPhaseContent()}
            </div>
          </div>
        </div>

        {/* Chat Panel - Desktop */}
        <div className="w-80 border-l border-gray-700 hidden lg:flex lg:flex-col">
          <ChatPanel />
        </div>

        {/* Mobile Chat Button */}
        <button
          onClick={() => setShowMobileChat(true)}
          className="lg:hidden fixed bottom-4 right-4 w-14 h-14 bg-werewolf-accent rounded-full flex items-center justify-center shadow-lg z-40"
        >
          <span className="text-2xl">💬</span>
        </button>

        {/* Mobile Chat Overlay */}
        {showMobileChat && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-werewolf-darker">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold">Chat</h2>
              <button
                onClick={() => setShowMobileChat(false)}
                className="text-2xl text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
