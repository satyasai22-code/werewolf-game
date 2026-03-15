import { useState } from 'react';
import { useGameStore } from '../../store';

export default function NightPhase() {
  const { gameState, nightResult, send } = useGameStore();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [actionSubmitted, setActionSubmitted] = useState(false);

  if (!gameState || !gameState.night_prompt) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">🌙</div>
        <h2 className="text-xl font-bold text-blue-400 mb-2">Night has fallen...</h2>
        <p className="text-gray-400">Close your eyes and wait for dawn.</p>
      </div>
    );
  }

  const { night_prompt, valid_targets = [], role } = gameState;

  // Villager - no action
  if (!night_prompt.has_action) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">🌙</div>
        <h2 className="text-xl font-bold text-blue-400 mb-2">Night Phase</h2>
        <p className="text-gray-400">{night_prompt.prompt}</p>
        <div className="mt-4 text-sm text-gray-500">
          You have no special powers. Wait for the night to pass...
        </div>
      </div>
    );
  }

  // Get alive players for targeting
  const targetPlayers = gameState.players.filter(
    (p) => valid_targets.includes(p.id) && p.is_alive
  );

  const handleSubmitAction = () => {
    if (actionSubmitted) return;

    // Handle different role actions
    if (night_prompt.action_type === 'witch_choice') {
      // Witch has special handling - see WitchAction component
      return;
    }

    if (selectedTarget || night_prompt.action_type === 'none') {
      send('night_action', {
        target_id: selectedTarget,
        action_type: 'primary',
      });
      setActionSubmitted(true);
    }
  };

  const getRoleIcon = () => {
    switch (night_prompt.role) {
      case 'werewolf': return '🐺';
      case 'seer': return '🔮';
      case 'doctor': return '💉';
      case 'witch': return '🧪';
      case 'avenger': return '⚔️';
      default: return '👤';
    }
  };

  // Witch special UI
  if (night_prompt.action_type === 'witch_choice') {
    return <WitchAction />;
  }

  return (
    <div className="card p-4 lg:p-6">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">{getRoleIcon()}</span>
          <h2 className="text-lg font-bold text-blue-400">
            {role?.name || night_prompt.role}
          </h2>
        </div>
        <p className="text-gray-400 text-sm mt-1">{night_prompt.prompt}</p>
      </div>

      {actionSubmitted ? (
        <div className="text-center">
          <div className="text-2xl mb-2 text-green-400">✓</div>
          {nightResult ? (
            <div className="space-y-2">
              <p className={nightResult.success ? 'text-green-400' : 'text-red-400'}>
                {nightResult.message}
              </p>
              {nightResult.data?.revealed_role && (
                <div className="mt-3 p-3 bg-purple-900/30 rounded-lg border border-purple-500 inline-block">
                  <div className="text-purple-300 text-xs mb-1">Role Revealed:</div>
                  <div className="text-xl font-bold capitalize">
                    {nightResult.data.revealed_role === 'werewolf' ? '🐺' : '👤'} {nightResult.data.revealed_role}
                  </div>
                </div>
              )}
              <p className="text-gray-500 text-sm mt-2">Waiting for others...</p>
            </div>
          ) : (
            <p className="text-green-400">Action submitted! Waiting for others...</p>
          )}
        </div>
      ) : (
        <>
          {/* Target selection - more compact */}
          {targetPlayers.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {targetPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedTarget(player.id)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedTarget === player.id
                      ? 'border-werewolf-accent bg-werewolf-accent/20'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <span className="mr-2">{player.name.charAt(0).toUpperCase()}</span>
                  <span className="text-sm font-medium">{player.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Restriction note */}
          {night_prompt.restriction && (
            <div className="text-sm text-yellow-400 text-center mb-3">
              ⚠️ {night_prompt.restriction}
            </div>
          )}

          {/* Submit button */}
          <div className="text-center">
            <button
              onClick={handleSubmitAction}
              disabled={!selectedTarget && targetPlayers.length > 0}
              className={`btn ${
                selectedTarget || targetPlayers.length === 0
                  ? 'btn-primary'
                  : 'btn-disabled'
              }`}
            >
              {getActionButtonText(night_prompt.action_type)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function getActionButtonText(actionType: string): string {
  switch (actionType) {
    case 'kill': return 'Confirm Kill';
    case 'reveal': return 'Reveal Role';
    case 'heal': return 'Protect Player';
    case 'revenge': return 'Confirm Target';
    default: return 'Confirm';
  }
}

// Witch special component
function WitchAction() {
  const { gameState, send } = useGameStore();
  const [selectedAction, setSelectedAction] = useState<'save' | 'poison' | 'skip' | null>(null);
  const [poisonTarget, setPoisonTarget] = useState<string | null>(null);
  const [actionSubmitted, setActionSubmitted] = useState(false);

  if (!gameState?.night_prompt) return null;

  const { night_prompt } = gameState;
  const hasElixir = night_prompt.has_elixir;
  const hasPoison = night_prompt.has_poison;

  const targetPlayers = gameState.players.filter(
    (p) => p.is_alive && p.id !== gameState.player_id
  );

  const handleSubmit = () => {
    if (actionSubmitted) return;

    if (selectedAction === 'save') {
      send('night_action', { action_type: 'save' });
    } else if (selectedAction === 'poison' && poisonTarget) {
      send('night_action', { target_id: poisonTarget, action_type: 'poison' });
    } else if (selectedAction === 'skip') {
      send('night_action', { action_type: 'skip' });
    }
    setActionSubmitted(true);
  };

  if (actionSubmitted) {
    return (
      <div className="card p-6 text-center">
        <div className="text-2xl text-green-400 mb-2">✓</div>
        <p>Action submitted! Waiting for others...</p>
      </div>
    );
  }

  return (
    <div className="card p-4 lg:p-6">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">🧪</span>
          <h2 className="text-lg font-bold text-purple-400">Witch</h2>
        </div>
        <p className="text-gray-400 text-sm">Choose your action wisely...</p>
      </div>

      {/* Potion options - horizontal on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {/* Elixir option */}
        <button
          onClick={() => { setSelectedAction('save'); setPoisonTarget(null); }}
          disabled={!hasElixir}
          className={`p-3 rounded-lg border-2 text-center transition-all ${
            !hasElixir
              ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
              : selectedAction === 'save'
              ? 'border-green-500 bg-green-900/30'
              : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <div className="text-3xl mb-1">💚</div>
          <div className={`font-bold text-sm ${hasElixir ? 'text-green-400' : 'text-gray-500'}`}>
            Elixir
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {hasElixir ? 'Save the victim' : 'Already used'}
          </div>
        </button>

        {/* Poison option */}
        <button
          onClick={() => setSelectedAction('poison')}
          disabled={!hasPoison}
          className={`p-3 rounded-lg border-2 text-center transition-all ${
            !hasPoison
              ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
              : selectedAction === 'poison'
              ? 'border-purple-500 bg-purple-900/30'
              : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <div className="text-3xl mb-1">☠️</div>
          <div className={`font-bold text-sm ${hasPoison ? 'text-purple-400' : 'text-gray-500'}`}>
            Poison
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {hasPoison ? 'Kill someone' : 'Already used'}
          </div>
        </button>

        {/* Skip option */}
        <button
          onClick={() => { setSelectedAction('skip'); setPoisonTarget(null); }}
          className={`p-3 rounded-lg border-2 text-center transition-all ${
            selectedAction === 'skip'
              ? 'border-gray-500 bg-gray-700'
              : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <div className="text-3xl mb-1">💤</div>
          <div className="font-bold text-sm">Skip</div>
          <div className="text-xs text-gray-400 mt-1">Save potions</div>
        </button>
      </div>

      {/* Poison target selection */}
      {selectedAction === 'poison' && hasPoison && (
        <div className="mb-4 p-3 bg-werewolf-dark rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Select target:</div>
          <div className="flex flex-wrap gap-2">
            {targetPlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => setPoisonTarget(player.id)}
                className={`px-3 py-1.5 rounded text-sm ${
                  poisonTarget === player.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="text-center">
        <button
          onClick={handleSubmit}
          disabled={!selectedAction || (selectedAction === 'poison' && !poisonTarget)}
          className={`btn ${
            selectedAction && (selectedAction !== 'poison' || poisonTarget)
              ? 'btn-primary'
              : 'btn-disabled'
          }`}
        >
          Confirm Choice
        </button>
      </div>
    </div>
  );
}
