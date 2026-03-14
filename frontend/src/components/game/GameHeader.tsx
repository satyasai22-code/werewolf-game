import { useGameStore } from '../../store';

interface GameHeaderProps {
  onLeave: () => void;
}

export default function GameHeader({ onLeave }: GameHeaderProps) {
  const { gameState, timerRemaining } = useGameStore();

  if (!gameState) return null;

  const getPhaseDisplay = () => {
    switch (gameState.phase) {
      case 'night':
        return { text: '🌙 Night Phase', color: 'text-blue-400' };
      case 'day_discussion':
        return { text: '☀️ Day - Discussion', color: 'text-yellow-400' };
      case 'day_voting':
        return { text: '⚖️ Day - Voting', color: 'text-orange-400' };
      case 'game_over':
        return { text: '🏁 Game Over', color: 'text-gray-400' };
      default:
        return { text: gameState.phase, color: 'text-gray-400' };
    }
  };

  const phase = getPhaseDisplay();

  return (
    <header className="bg-werewolf-darker border-b border-gray-700 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Leave button */}
        <button onClick={onLeave} className="btn btn-secondary text-sm">
          ← Leave
        </button>

        {/* Phase info */}
        <div className="text-center">
          <div className={`text-lg font-bold ${phase.color}`}>
            {phase.text}
          </div>
          <div className="text-sm text-gray-400">
            Round {gameState.round}
          </div>
        </div>

        {/* Timer & Role info */}
        <div className="flex items-center gap-4">
          {timerRemaining !== null && (
            <div className={`text-2xl font-mono font-bold ${
              timerRemaining <= 10 ? 'text-red-500 animate-pulse' : 'text-white'
            }`}>
              {Math.floor(timerRemaining / 60)}:{(timerRemaining % 60).toString().padStart(2, '0')}
            </div>
          )}
          
          {gameState.role && (
            <div className="text-right">
              <div className="text-xs text-gray-400">Your Role</div>
              <div className={`font-bold ${
                gameState.role.team === 'werewolf' ? 'text-red-400' : 'text-green-400'
              }`}>
                {gameState.role.name || gameState.role.role_type}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
