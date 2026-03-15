import type { Player } from '../types';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string;
}

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className="space-y-1.5">
      {players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center justify-between p-2 rounded-lg border ${
            player.id === currentPlayerId
              ? 'border-werewolf-accent bg-werewolf-accent/10'
              : 'border-gray-700 bg-werewolf-dark/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
              player.is_connected ? 'bg-gray-600' : 'bg-gray-800'
            }`}>
              {player.name.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-medium ${
                player.is_connected ? 'text-white' : 'text-gray-500'
              }`}>
                {player.name}
              </span>
              {player.is_admin && (
                <span className="text-[10px] bg-werewolf-gold/20 text-werewolf-gold px-1.5 py-0.5 rounded">
                  👑
                </span>
              )}
              {player.id === currentPlayerId && (
                <span className="text-[10px] text-gray-400">•</span>
              )}
              {!player.is_connected && (
                <span className="text-[10px] text-red-400">⚠</span>
              )}
            </div>
          </div>

          {/* Ready status */}
          <div className={`w-2.5 h-2.5 rounded-full ${
            player.is_ready ? 'bg-green-500' : 'bg-gray-600'
          }`} />
        </div>
      ))}

      {players.length === 0 && (
        <div className="text-gray-500 text-center py-4">
          No players yet
        </div>
      )}
    </div>
  );
}
