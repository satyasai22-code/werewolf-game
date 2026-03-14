import { useState } from 'react';
import { useGameStore } from '../../store';

export default function VotingPhase() {
  const { gameState, playerId, send } = useGameStore();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  if (!gameState) return null;

  const alivePlayers = gameState.players.filter(
    (p) => p.is_alive && p.id !== playerId
  );
  const voteCounts = gameState.vote_counts || {};

  const handleVote = (targetId: string | null) => {
    if (hasVoted || !gameState.is_alive) return;

    send('cast_vote', { target_id: targetId });
    setSelectedTarget(targetId);
    setHasVoted(true);
  };

  // Dead players just watch
  if (!gameState.is_alive) {
    return (
      <div className="card p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⚖️</div>
          <h2 className="text-xl font-bold text-orange-400">Voting Phase</h2>
          <p className="text-gray-400 mt-2">
            💀 You are dead and cannot vote.
          </p>
        </div>

        <VoteDisplay voteCounts={voteCounts} players={gameState.players} />
      </div>
    );
  }

  return (
    <div className="card p-8">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">⚖️</div>
        <h2 className="text-xl font-bold text-orange-400">Voting Phase</h2>
        <p className="text-gray-400 mt-2">
          {hasVoted 
            ? 'Your vote has been cast. Waiting for others...'
            : 'Vote for who you think is a werewolf!'
          }
        </p>
      </div>

      {!hasVoted && (
        <>
          {/* Vote targets */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {alivePlayers.map((player) => {
              const voteCount = voteCounts[player.id] || 0;
              
              return (
                <button
                  key={player.id}
                  onClick={() => setSelectedTarget(player.id)}
                  className={`p-4 rounded-lg border-2 transition-all relative ${
                    selectedTarget === player.id
                      ? 'border-orange-500 bg-orange-900/20'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-sm font-medium">{player.name}</div>
                  
                  {/* Live vote count */}
                  {voteCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                      {voteCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handleVote(selectedTarget)}
              disabled={!selectedTarget}
              className={`btn ${selectedTarget ? 'btn-primary' : 'btn-disabled'}`}
            >
              Vote to Eliminate
            </button>
            
            <button
              onClick={() => handleVote(null)}
              className="btn btn-secondary"
            >
              Abstain
            </button>
          </div>
        </>
      )}

      {hasVoted && (
        <VoteDisplay 
          voteCounts={voteCounts} 
          players={gameState.players}
          myVote={selectedTarget}
        />
      )}
    </div>
  );
}

// Vote display component
function VoteDisplay({ 
  voteCounts, 
  players,
  myVote 
}: { 
  voteCounts: Record<string, number>; 
  players: { id: string; name: string; is_alive: boolean }[];
  myVote?: string | null;
}) {
  const sortedPlayers = [...players]
    .filter((p) => p.is_alive)
    .sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide">
        Current Votes
      </h3>
      
      {sortedPlayers.map((player) => {
        const votes = voteCounts[player.id] || 0;
        const isMyVote = player.id === myVote;
        
        return (
          <div
            key={player.id}
            className={`flex items-center justify-between p-3 rounded-lg ${
              isMyVote ? 'bg-orange-900/30 border border-orange-600' : 'bg-werewolf-dark'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{player.name}</span>
              {isMyVote && <span className="text-xs text-orange-400">(Your vote)</span>}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {Array(votes).fill(0).map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-full bg-red-500" />
                ))}
              </div>
              <span className="text-lg font-bold text-white">{votes}</span>
            </div>
          </div>
        );
      })}
      
      {sortedPlayers.length === 0 && (
        <div className="text-gray-500 text-center py-4">
          No votes yet
        </div>
      )}
    </div>
  );
}
