import { useGameStore } from '../../store';
import type { Player } from '../../types';

export default function PlayerBoard() {
  const { gameState, playerId } = useGameStore();

  if (!gameState) return null;

  const getPlayerCardClass = (player: Player) => {
    const isCurrentPlayer = player.id === playerId;
    const baseClasses = 'p-3 rounded-lg border-2 transition-all';
    
    if (!player.is_alive) {
      return `${baseClasses} border-gray-700 bg-gray-800/50 opacity-50`;
    }
    
    if (isCurrentPlayer) {
      return `${baseClasses} border-werewolf-accent bg-werewolf-accent/10`;
    }
    
    return `${baseClasses} border-gray-600 bg-werewolf-dark/50 hover:border-gray-500`;
  };

  const getRoleDisplay = (player: Player) => {
    // Show role for self
    if (player.id === playerId && gameState.role) {
      return (
        <span className={`text-xs px-2 py-0.5 rounded ${
          gameState.role.team === 'werewolf' 
            ? 'bg-red-900/50 text-red-300' 
            : 'bg-green-900/50 text-green-300'
        }`}>
          {gameState.role.name || gameState.role.role_type}
        </span>
      );
    }

    // Show role for dead players (except during night)
    if (!player.is_alive && player.role && gameState.phase !== 'night') {
      return (
        <span className={`text-xs px-2 py-0.5 rounded ${
          player.role.team === 'werewolf' 
            ? 'bg-red-900/50 text-red-300' 
            : 'bg-green-900/50 text-green-300'
        }`}>
          {player.role.name || player.role.role_type}
        </span>
      );
    }

    // Show werewolf indicator if current player is werewolf
    if (
      gameState.role?.role_type === 'werewolf' && 
      player.role?.role_type === 'werewolf' &&
      player.id !== playerId
    ) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-300">
          🐺 Pack
        </span>
      );
    }

    return null;
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold mb-4 text-gray-300">Players</h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {gameState.players.map((player) => (
          <div
            key={player.id}
            className={getPlayerCardClass(player)}
          >
            {/* Avatar */}
            <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold mb-2 ${
              player.is_alive ? 'bg-gray-600' : 'bg-gray-800'
            }`}>
              {!player.is_alive ? '💀' : player.name.charAt(0).toUpperCase()}
            </div>
            
            {/* Name */}
            <div className="text-center">
              <div className={`font-medium text-sm truncate ${
                player.is_alive ? 'text-white' : 'text-gray-500'
              }`}>
                {player.name}
                {player.id === playerId && (
                  <span className="text-xs text-gray-400 ml-1">(You)</span>
                )}
              </div>
              
              {/* Role badge */}
              <div className="mt-1 min-h-[20px]">
                {getRoleDisplay(player)}
              </div>
              
              {/* Status */}
              {!player.is_alive && (
                <div className={`text-xs mt-1 ${
                  player.death_cause === 'avenger' ? 'text-purple-400' : 'text-gray-500'
                }`}>
                  {player.death_cause === 'avenger' ? '⚔️ Avenged' : 
                   player.death_cause === 'werewolf' ? '🐺 Killed' :
                   player.death_cause === 'poison' ? '🧪 Poisoned' :
                   player.death_cause === 'voted_out' ? '🗳️ Voted Out' :
                   '💀 Dead'}
                </div>
              )}
              {!player.is_connected && player.is_alive && (
                <div className="text-xs text-yellow-500 mt-1">Offline</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
