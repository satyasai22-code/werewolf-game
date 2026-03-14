import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store';
import type { RoleType, RoleInfo } from '../types';
import RoleConfig from '../components/RoleConfig';
import PlayerList from '../components/PlayerList';
import { API_BASE } from '../config';

export default function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  
  const {
    playerId,
    playerName,
    isAdmin,
    isConnected,
    lobbyState,
    error,
    connect,
    send,
    clearGame,
  } = useGameStore();

  const [roles, setRoles] = useState<Record<RoleType, RoleInfo>>({} as Record<RoleType, RoleInfo>);
  const [copied, setCopied] = useState(false);

  // Fetch available roles
  useEffect(() => {
    fetch(`${API_BASE}/roles`)
      .then((res) => res.json())
      .then(setRoles)
      .catch(console.error);
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    if (roomCode && playerId && !isConnected) {
      connect(roomCode, playerId);
    }
  }, [roomCode, playerId, isConnected, connect]);

  // Redirect if game starts
  useEffect(() => {
    if (lobbyState?.phase && lobbyState.phase !== 'lobby') {
      navigate(`/game/${roomCode}`);
    }
  }, [lobbyState?.phase, roomCode, navigate]);

  // Handle leave
  const handleLeave = () => {
    clearGame();
    navigate('/');
  };

  // Copy room code
  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Toggle ready
  const toggleReady = () => {
    send('toggle_ready');
  };

  // Start game
  const startGame = () => {
    send('start_game');
  };

  // Update role config
  const updateRoleConfig = (roleCounts: Record<string, number>) => {
    send('update_role_config', { role_counts: roleCounts });
  };

  if (!lobbyState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Connecting...</div>
      </div>
    );
  }

  const currentPlayer = lobbyState.players.find((p) => p.id === playerId);
  const isReady = currentPlayer?.is_ready ?? false;
  const canStart = isAdmin && lobbyState.all_ready && 
    lobbyState.player_count === lobbyState.required_players &&
    lobbyState.config_valid !== false;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleLeave}
            className="btn btn-secondary"
          >
            ← Leave
          </button>
          
          <div className="text-center">
            <h1 className="font-title text-3xl font-bold text-werewolf-accent">
              Game Lobby
            </h1>
            <div 
              className="flex items-center gap-2 mt-2 cursor-pointer hover:opacity-80"
              onClick={copyRoomCode}
            >
              <span className="text-gray-400">Room Code:</span>
              <span className="text-2xl font-mono font-bold tracking-widest text-white">
                {roomCode}
              </span>
              <span className="text-sm text-gray-500">
                {copied ? '✓ Copied!' : '(click to copy)'}
              </span>
            </div>
          </div>
          
          <div className="w-24" /> {/* Spacer for centering */}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Config validation message */}
        {lobbyState.config_message && lobbyState.config_valid === false && (
          <div className="bg-yellow-900/50 border border-yellow-600 text-yellow-200 px-4 py-3 rounded-lg mb-6">
            {lobbyState.config_message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Players Panel */}
          <div className="lg:col-span-1">
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-4">
                Players ({lobbyState.player_count}/{lobbyState.required_players})
              </h2>
              <PlayerList 
                players={lobbyState.players} 
                currentPlayerId={playerId || ''} 
              />
            </div>
          </div>

          {/* Role Configuration */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-4">Role Configuration</h2>
              <RoleConfig
                roles={roles}
                roleConfig={lobbyState.role_config}
                isAdmin={isAdmin}
                onUpdate={updateRoleConfig}
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-werewolf-darker border-t border-gray-700 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="text-gray-400">
              {!lobbyState.all_ready && (
                <span>Waiting for all players to be ready...</span>
              )}
              {lobbyState.all_ready && lobbyState.player_count !== lobbyState.required_players && (
                <span>
                  Need {lobbyState.required_players - lobbyState.player_count} more player(s)
                </span>
              )}
              {lobbyState.all_ready && lobbyState.player_count === lobbyState.required_players && (
                <span className="text-green-400">Ready to start!</span>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={toggleReady}
                className={`btn ${isReady ? 'btn-success' : 'btn-secondary'}`}
              >
                {isReady ? '✓ Ready' : 'Ready Up'}
              </button>

              {isAdmin && (
                <button
                  onClick={startGame}
                  disabled={!canStart}
                  className={`btn ${canStart ? 'btn-primary animate-glow' : 'btn-disabled'}`}
                >
                  Start Game
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Spacer for fixed bottom bar */}
        <div className="h-24" />
      </div>
    </div>
  );
}
