import { useGameStore } from '../../store';

export default function DayPhase() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const aliveCount = gameState.players.filter((p) => p.is_alive).length;

  return (
    <div className="card p-8">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">☀️</div>
        <h2 className="text-xl font-bold text-yellow-400">Day Discussion</h2>
        <p className="text-gray-400 mt-2">
          Discuss with other players and try to identify the werewolves!
        </p>
      </div>

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
