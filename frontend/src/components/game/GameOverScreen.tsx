import { useGameStore } from '../../store';
import { useNavigate } from 'react-router-dom';

export default function GameOverScreen() {
  const { gameState, gameOverData, clearGame } = useGameStore();
  const navigate = useNavigate();

  if (!gameState) return null;

  const handlePlayAgain = () => {
    clearGame();
    navigate('/');
  };

  const isTie = gameOverData?.winner === 'none';
  const isWerewolfWin = gameOverData?.winner === 'werewolf';
  
  const winnerEmoji = isTie ? '⚔️' : isWerewolfWin ? '🐺' : '🏘️';
  const winnerText = isTie ? "It's a Tie!" : isWerewolfWin ? 'Werewolves Win!' : 'Villagers Win!';
  const winnerColor = isTie ? 'text-yellow-500' : isWerewolfWin ? 'text-red-500' : 'text-green-500';

  return (
    <div className="card p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">{winnerEmoji}</div>
        <h2 className={`text-4xl font-bold mb-4 ${winnerColor}`}>
          {winnerText}
        </h2>
        
        {/* Winner announcement */}
        <div className="bg-werewolf-dark rounded-xl p-6 mb-8">
          <p className="text-xl text-gray-300">
            {gameOverData?.message || 'The game has ended!'}
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
                    ? player.role?.team === 'werewolf'
                      ? 'border-red-600 bg-red-900/20'
                      : 'border-green-600 bg-green-900/20'
                    : 'border-gray-600 bg-gray-800/50'
                }`}
              >
                <div className={`text-lg font-bold ${
                  player.is_alive ? 'text-white' : 'text-gray-500'
                }`}>
                  {player.name}
                </div>
                {player.role && (
                  <div className={`text-sm mt-1 font-semibold ${
                    player.role.team === 'werewolf' ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {player.role.name || player.role.role_type}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {player.is_alive ? '✓ Survived' : 
                   player.death_cause === 'avenger' ? '⚔️ Avenged' :
                   player.death_cause === 'werewolf' ? '🐺 Killed' :
                   player.death_cause === 'poison' ? '🧪 Poisoned' :
                   player.death_cause === 'voted_out' ? '🗳️ Voted Out' :
                   '💀 Dead'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Play again button */}
        <button onClick={handlePlayAgain} className="btn btn-primary text-lg px-8">
          Play Again
        </button>
      </div>
    </div>
  );
}
