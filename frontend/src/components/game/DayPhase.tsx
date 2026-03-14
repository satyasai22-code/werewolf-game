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
    <div className="card p-8">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">☀️</div>
        <h2 className="text-xl font-bold text-yellow-400">Day Discussion</h2>
        <p className="text-gray-400 mt-2">
          Discuss with other players and try to identify the werewolves!
        </p>
      </div>

      {/* Last night deaths announcement */}
      {gameState.last_night_deaths && gameState.last_night_deaths.length > 0 && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg p-4">
          <h3 className="font-bold text-red-400 mb-3 text-center">☠️ Last Night's Events</h3>
          <div className="space-y-2">
            {gameState.last_night_deaths.map((death, index) => (
              <div
                key={index}
                className={`flex items-center justify-center gap-2 text-lg ${
                  death.cause === 'avenger' ? 'text-purple-400' : 'text-red-300'
                }`}
              >
                <span>{getDeathEmoji(death.cause)}</span>
                <span className="font-bold">{death.player_name}</span>
                <span>{getDeathMessage(death.cause)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {gameState.last_night_deaths && gameState.last_night_deaths.length === 0 && (
        <div className="mb-6 bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
          <span className="text-green-400">🌅 It was a peaceful night. No one died!</span>
        </div>
      )}

      {/* Skip to voting button */}
      {gameState.is_alive && (
        <div className="mb-6 text-center">
          <button
            onClick={handleSkipToggle}
            className={`btn ${isReady ? 'bg-green-600 hover:bg-green-700' : 'btn-primary'}`}
          >
            {isReady ? '✓ Ready to Vote' : 'Skip to Voting'}
          </button>
          <div className="text-sm text-gray-400 mt-2">
            {skipCount}/{requiredCount} players ready to vote
          </div>
          {skipCount > 0 && skipCount < requiredCount && (
            <div className="text-xs text-gray-500 mt-1">
              Waiting for {requiredCount - skipCount} more player(s)...
            </div>
          )}
        </div>
      )}

      {/* Discussion tips */}
      <div className="bg-werewolf-dark/50 rounded-lg p-6">
        <h3 className="font-bold text-gray-300 mb-3">💡 Discussion Tips</h3>
        <ul className="space-y-2 text-gray-400 text-sm">
          <li>• Pay attention to who seems nervous or overly defensive</li>
          <li>• Look for inconsistencies in people's stories</li>
          <li>• Consider who might benefit from last night's events</li>
          <li>• Share information carefully - you might be talking to a werewolf!</li>
        </ul>
      </div>

      {/* Player count */}
      <div className="mt-6 text-center text-gray-400">
        <span className="font-bold text-white">{aliveCount}</span> players remain alive
      </div>

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
