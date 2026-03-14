import { useGameStore } from '../../store';
import { useNavigate } from 'react-router-dom';

export default function GameOverScreen() {
  const { gameState, clearGame } = useGameStore();
  const navigate = useNavigate();

  if (!gameState) return null;

  // This will be populated when game_over message is received
  // For now, show a basic screen based on gameState
  const handlePlayAgain = () => {
    clearGame();
    navigate('/');
  };

  return (
    <div className="card p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">🏁</div>
        <h2 className="text-3xl font-bold text-werewolf-gold mb-4">
          Game Over
        </h2>
        
        {/* Winner announcement - this would be populated from game_over event */}
        <div className="bg-werewolf-dark rounded-xl p-8 mb-8">
          <p className="text-xl text-gray-300 mb-4">
            The game has ended!
          </p>
          <p className="text-gray-400">
            Check the player board above to see everyone's roles.
          </p>
        </div>

        {/* All players with roles revealed */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-300 mb-4">Final Standings</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {gameState.players.map((player) => (
              <div
                key={player.id}
                className={`p-4 rounded-lg border ${
                  player.is_alive
                    ? 'border-green-600 bg-green-900/20'
                    : 'border-gray-600 bg-gray-800/50'
                }`}
              >
                <div className={`text-lg font-bold ${
                  player.is_alive ? 'text-white' : 'text-gray-500'
                }`}>
                  {player.name}
                </div>
                {player.role && (
                  <div className={`text-sm mt-1 ${
                    player.role.team === 'werewolf' ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {player.role.name || player.role.role_type}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {player.is_alive ? '✓ Survived' : '💀 Dead'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Play again button */}
        <button onClick={handlePlayAgain} className="btn btn-primary text-lg">
          Play Again
        </button>
      </div>
    </div>
  );
}
