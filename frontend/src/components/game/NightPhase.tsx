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
    <div className="card p-8">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{getRoleIcon()}</div>
        <h2 className="text-xl font-bold text-blue-400">
          {role?.name || night_prompt.role}
        </h2>
        <p className="text-gray-400 mt-2">{night_prompt.prompt}</p>
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
                <div className="mt-4 p-4 bg-purple-900/30 rounded-lg border border-purple-500">
                  <div className="text-purple-300 text-sm mb-1">Role Revealed:</div>
                  <div className="text-2xl font-bold capitalize">
                    {nightResult.data.revealed_role === 'werewolf' ? '🐺' : '👤'} {nightResult.data.revealed_role}
                  </div>
                </div>
              )}
              <p className="text-gray-500 text-sm mt-4">Waiting for others...</p>
            </div>
          ) : (
            <p className="text-green-400">Action submitted! Waiting for others...</p>
          )}
        </div>
      ) : (
        <>
          {/* Target selection */}
          {targetPlayers.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {targetPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedTarget(player.id)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedTarget === player.id
                      ? 'border-werewolf-accent bg-werewolf-accent/20'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-sm font-medium">{player.name}</div>
                </button>
              ))}
            </div>
          )}

          {/* Restriction note */}
          {night_prompt.restriction && (
            <div className="text-sm text-yellow-400 text-center mb-4">
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
    case 'revenge': return 'Set Revenge Target';
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

  const { night_prompt, role_info } = gameState;
  const hasElixir = night_prompt.has_elixir;
  const hasPoison = night_prompt.has_poison;
  const attackVictim = (role_info as { attack_victim?: { id: string; name: string } })?.attack_victim;

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
      <div className="card p-8 text-center">
        <div className="text-2xl text-green-400 mb-2">✓</div>
        <p>Action submitted! Waiting for others...</p>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🧪</div>
        <h2 className="text-xl font-bold text-purple-400">Witch</h2>
        <p className="text-gray-400 mt-2">Choose your action wisely...</p>
      </div>

      {/* Attack notification */}
      {attackVictim && hasElixir && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-6 text-center">
          <p className="text-red-300">
            🐺 The werewolves are attacking <strong>{attackVictim.name}</strong> tonight!
          </p>
        </div>
      )}

      {/* Potion options */}
      <div className="space-y-4 mb-6">
        {/* Elixir option */}
        {hasElixir && attackVictim && (
          <button
            onClick={() => { setSelectedAction('save'); setPoisonTarget(null); }}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              selectedAction === 'save'
                ? 'border-green-500 bg-green-900/30'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">💚</span>
              <div>
                <div className="font-bold text-green-400">Use Elixir of Life</div>
                <div className="text-sm text-gray-400">Save {attackVictim.name} from death</div>
              </div>
            </div>
          </button>
        )}

        {!hasElixir && (
          <div className="p-4 rounded-lg border border-gray-700 text-gray-500">
            💚 Elixir already used
          </div>
        )}

        {/* Poison option */}
        {hasPoison && (
          <div>
            <button
              onClick={() => setSelectedAction('poison')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedAction === 'poison'
                  ? 'border-purple-500 bg-purple-900/30'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">☠️</span>
                <div>
                  <div className="font-bold text-purple-400">Use Poison</div>
                  <div className="text-sm text-gray-400">Kill someone of your choice</div>
                </div>
              </div>
            </button>

            {/* Poison target selection */}
            {selectedAction === 'poison' && (
              <div className="mt-3 grid grid-cols-3 gap-2 p-3 bg-werewolf-dark rounded-lg">
                {targetPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setPoisonTarget(player.id)}
                    className={`p-2 rounded text-sm ${
                      poisonTarget === player.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!hasPoison && (
          <div className="p-4 rounded-lg border border-gray-700 text-gray-500">
            ☠️ Poison already used
          </div>
        )}

        {/* Skip option */}
        <button
          onClick={() => { setSelectedAction('skip'); setPoisonTarget(null); }}
          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
            selectedAction === 'skip'
              ? 'border-gray-500 bg-gray-800'
              : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💤</span>
            <div>
              <div className="font-bold">Do Nothing</div>
              <div className="text-sm text-gray-400">Save your potions for later</div>
            </div>
          </div>
        </button>
      </div>

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
