import type { Player } from '../types';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string;
}

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className="space-y-2">
      {players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center justify-between p-3 rounded-lg border ${
            player.id === currentPlayerId
              ? 'border-werewolf-accent bg-werewolf-accent/10'
              : 'border-gray-700 bg-werewolf-dark/50'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Avatar placeholder */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
              player.is_connected ? 'bg-gray-600' : 'bg-gray-800'
            }`}>
              {player.name.charAt(0).toUpperCase()}
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${
                  player.is_connected ? 'text-white' : 'text-gray-500'
                }`}>
                  {player.name}
                </span>
                {player.is_admin && (
                  <span className="text-xs bg-werewolf-gold/20 text-werewolf-gold px-2 py-0.5 rounded">
                    Admin
                  </span>
                )}
                {player.id === currentPlayerId && (
                  <span className="text-xs text-gray-400">(You)</span>
                )}
              </div>
              {!player.is_connected && (
                <span className="text-xs text-gray-500">Disconnected</span>
              )}
            </div>
          </div>

          {/* Ready status */}
          <div className={`w-3 h-3 rounded-full ${
            player.is_ready ? 'bg-green-500' : 'bg-gray-600'
          }`} title={player.is_ready ? 'Ready' : 'Not Ready'} />
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
