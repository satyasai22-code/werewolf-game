import { useGameStore } from '../../store';

export default function DayPhase() {
  const { gameState, playerId, skipStatus, send } = useGameStore();

  if (!gameState) return null;

  const aliveCount = gameState.players.filter((p) => p.is_alive).length;
  const isReady = skipStatus?.players_ready?.includes(playerId || '') || false;
  const skipCount = skipStatus?.skip_count || 0;
  const requiredCount = skipStatus?.required || aliveCount;

  const handleSkipToggle = () => {
    send('skip_discussion');
  };

  const getDeathMessage = (cause: string) => {
    switch (cause) {
      case 'werewolf':
        return 'was killed by werewolves';
      case 'poison':
        return 'was poisoned';
      case 'avenger':
        return 'was avenged';
      default:
        return 'died mysteriously';
    }
  };

  const getDeathEmoji = (cause: string) => {
    switch (cause) {
      case 'werewolf':
        return '🐺';
      case 'poison':
        return '🧪';
      case 'avenger':
        return '⚔️';
      default:
        return '💀';
    }
  };

  return (
    <div className="card p-4 lg:p-6">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">☀️</span>
          <h2 className="text-lg font-bold text-yellow-400">Day Discussion</h2>
        </div>
        <p className="text-gray-400 text-sm mt-1">
          Discuss and identify the werewolves!
        </p>
      </div>

      {/* Last night deaths announcement - compact */}
      {gameState.last_night_deaths && gameState.last_night_deaths.length > 0 && (
        <div className="mb-4 bg-red-900/30 border border-red-700 rounded-lg p-3">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {gameState.last_night_deaths.map((death, index) => (
              <span
                key={index}
                className={`flex items-center gap-1 ${
                  death.cause === 'avenger' ? 'text-purple-400' : 'text-red-300'
                }`}
              >
                <span>{getDeathEmoji(death.cause)}</span>
                <span className="font-bold">{death.player_name}</span>
                <span className="text-sm">{getDeathMessage(death.cause)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {gameState.last_night_deaths && gameState.last_night_deaths.length === 0 && (
        <div className="mb-4 bg-green-900/30 border border-green-700 rounded-lg p-3 text-center text-sm">
          <span className="text-green-400">🌅 Peaceful night - no one died!</span>
        </div>
      )}

      {/* Skip to voting + player count - inline */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
        {gameState.is_alive && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSkipToggle}
              className={`btn btn-sm ${isReady ? 'bg-green-600 hover:bg-green-700' : 'btn-primary'}`}
            >
              {isReady ? '✓ Ready' : 'Skip to Vote'}
            </button>
            <span className="text-sm text-gray-400">
              {skipCount}/{requiredCount}
            </span>
          </div>
        )}
        <span className="text-sm text-gray-400">
          <span className="font-bold text-white">{aliveCount}</span> alive
        </span>
      </div>

      {/* Discussion tips - collapsed/compact */}
      <details className="bg-werewolf-dark/50 rounded-lg">
        <summary className="px-4 py-2 cursor-pointer text-gray-300 font-medium text-sm hover:text-white">
          💡 Discussion Tips
        </summary>
        <ul className="px-4 pb-3 text-gray-400 text-xs space-y-1">
          <li>• Watch for nervous or defensive behavior</li>
          <li>• Look for story inconsistencies</li>
          <li>• Consider who benefits from events</li>
        </ul>
      </details>

      {/* Status for dead players */}
      {!gameState.is_alive && (
        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <p className="text-gray-400">
            💀 You are dead. You can watch but cannot participate.
          </p>
        </div>
      )}
    </div>
  );
}
