import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store';
import type { RoleType, RoleInfo } from '../types';
import RoleConfig from '../components/RoleConfig';
import PlayerList from '../components/PlayerList';
import { API_BASE } from '../config';

// Compact setting toggle component
function SettingToggle({ 
  label, 
  enabled, 
  onChange, 
  disabled 
}: { 
  label: string; 
  enabled: boolean; 
  onChange: () => void; 
  disabled: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
        enabled 
          ? 'bg-green-900/30 border-green-600/50' 
          : 'bg-gray-800/50 border-gray-600/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-500 cursor-pointer'}`}
    >
      <span className="text-xs text-gray-300">{label}</span>
      <div className={`w-8 h-4 rounded-full transition-colors ${enabled ? 'bg-green-600' : 'bg-gray-600'}`}>
        <div className={`w-3 h-3 bg-white rounded-full transform transition-transform mt-0.5 ${
          enabled ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'
        }`} style={{ marginLeft: enabled ? '17px' : '2px' }} />
      </div>
    </button>
  );
}

export default function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  
  const {
    playerId,
    isAdmin,
    isConnected,
    lobbyState,
    gameState,
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

  // Redirect if game starts (check both lobbyState.phase and if gameState exists)
  useEffect(() => {
    if (gameState || (lobbyState?.phase && lobbyState.phase !== 'lobby')) {
      navigate(`/game/${roomCode}`);
    }
  }, [lobbyState?.phase, gameState, roomCode, navigate]);

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
    <div className="min-h-screen p-3">
      <div className="max-w-6xl mx-auto">
        {/* Header - Compact */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={handleLeave} className="btn btn-secondary text-sm px-3 py-2">
            ← Leave
          </button>
          
          <div 
            className="text-center cursor-pointer hover:opacity-80"
            onClick={copyRoomCode}
          >
            <span className="text-gray-400 text-sm">Room: </span>
            <span className="text-xl font-mono font-bold tracking-widest text-white">
              {roomCode}
            </span>
            <span className="text-xs text-gray-500 ml-2">
              {copied ? '✓' : '📋'}
            </span>
          </div>
          
          <div className="w-20" />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 text-red-200 px-3 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Config validation message */}
        {lobbyState.config_message && lobbyState.config_valid === false && (
          <div className="bg-yellow-900/50 border border-yellow-600 text-yellow-200 px-3 py-2 rounded-lg mb-4 text-sm">
            {lobbyState.config_message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Players Panel - Compact */}
          <div className="lg:col-span-1">
            <div className="card p-4">
              <h2 className="text-sm font-bold mb-3 text-gray-400 uppercase tracking-wide">
                Players {lobbyState.player_count}/{lobbyState.required_players}
              </h2>
              <PlayerList 
                players={lobbyState.players} 
                currentPlayerId={playerId || ''} 
              />
            </div>
          </div>

          {/* Role Configuration + Settings */}
          <div className="lg:col-span-3">
            {/* Role Config - hide completely when blind mode */}
            {!lobbyState.settings?.hide_role_config && (
              <div className="card p-4">
                <h2 className="text-sm font-bold mb-3 text-gray-400 uppercase tracking-wide">Roles</h2>
                <RoleConfig
                  roles={roles}
                  roleConfig={lobbyState.role_config}
                  isAdmin={isAdmin}
                  onUpdate={updateRoleConfig}
                />
              </div>
            )}

            {/* Blind mode message */}
            {lobbyState.settings?.hide_role_config && (
              <div className="card p-4">
                <div className="text-center py-6">
                  <div className="text-4xl mb-2">🎭</div>
                  <h3 className="text-lg font-bold text-purple-400">Blind Mode</h3>
                  <p className="text-gray-400 text-sm mt-2">
                    Roles will be randomly assigned when the game starts.
                    <br />No one knows the role composition!
                  </p>
                  {isAdmin && (
                    <p className="text-xs text-gray-500 mt-3">
                      Players needed: {lobbyState.player_count}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Game Settings - Compact */}
            <div className="card p-4 mt-4">
              <h2 className="text-sm font-bold mb-3 text-gray-400 uppercase tracking-wide">Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {/* Each setting as a compact row */}
                <SettingToggle
                  label="👁️ Reveal roles on death"
                  enabled={lobbyState.settings?.reveal_role_on_death ?? false}
                  onChange={() => send('update_settings', { reveal_role_on_death: !lobbyState.settings?.reveal_role_on_death })}
                  disabled={!isAdmin}
                />
                <SettingToggle
                  label="🗳️ Show vote counts"
                  enabled={lobbyState.settings?.show_vote_counts ?? false}
                  onChange={() => send('update_settings', { show_vote_counts: !lobbyState.settings?.show_vote_counts })}
                  disabled={!isAdmin}
                />
                <SettingToggle
                  label="⚔️ Avenger chains"
                  enabled={lobbyState.settings?.avenger_chain_kill ?? false}
                  onChange={() => send('update_settings', { avenger_chain_kill: !lobbyState.settings?.avenger_chain_kill })}
                  disabled={!isAdmin}
                />
                <SettingToggle
                  label="🧪 Show poison kills"
                  enabled={lobbyState.settings?.reveal_poison_kills ?? false}
                  onChange={() => send('update_settings', { reveal_poison_kills: !lobbyState.settings?.reveal_poison_kills })}
                  disabled={!isAdmin}
                />
                <SettingToggle
                  label="💀 Show avenger kills"
                  enabled={lobbyState.settings?.reveal_avenger_kills ?? false}
                  onChange={() => send('update_settings', { reveal_avenger_kills: !lobbyState.settings?.reveal_avenger_kills })}
                  disabled={!isAdmin}
                />
                <SettingToggle
                  label="🎭 Blind mode (random)"
                  enabled={lobbyState.settings?.hide_role_config ?? false}
                  onChange={() => send('update_settings', { hide_role_config: !lobbyState.settings?.hide_role_config })}
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions - Compact */}
        <div className="fixed bottom-0 left-0 right-0 bg-werewolf-darker border-t border-gray-700 p-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="text-gray-400 text-sm">
              {!lobbyState.all_ready && <span>⏳ Waiting for players...</span>}
              {lobbyState.all_ready && lobbyState.player_count !== lobbyState.required_players && (
                <span>Need {lobbyState.required_players - lobbyState.player_count} more</span>
              )}
              {lobbyState.all_ready && lobbyState.player_count === lobbyState.required_players && (
                <span className="text-green-400">✓ Ready!</span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={toggleReady}
                className={`btn text-sm px-4 py-2 ${isReady ? 'btn-success' : 'btn-secondary'}`}
              >
                {isReady ? '✓ Ready' : 'Ready'}
              </button>

              {isAdmin && (
                <button
                  onClick={startGame}
                  disabled={!canStart}
                  className={`btn text-sm px-4 py-2 ${canStart ? 'btn-primary animate-glow' : 'btn-disabled'}`}
                >
                  Start
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Spacer for fixed bottom bar */}
        <div className="h-16" />
      </div>
    </div>
  );
}
