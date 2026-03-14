import { useState } from 'react';
import type { RoleType, RoleInfo } from '../types';
import { API_BASE } from '../config';

interface RoleConfigProps {
  roles: Record<RoleType, RoleInfo>;
  roleConfig: Record<RoleType, number>;
  isAdmin: boolean;
  onUpdate: (config: Record<string, number>) => void;
}

const ROLE_ORDER: RoleType[] = [
  'werewolf',
  'seer',
  'doctor',
  'witch',
  'avenger',
  'villager',
];

const ROLE_ICONS: Record<RoleType, string> = {
  werewolf: '🐺',
  villager: '👤',
  seer: '🔮',
  doctor: '💉',
  witch: '🧪',
  avenger: '⚔️',
};

const PLAYER_PRESETS = [4, 5, 6, 7, 8, 9, 10, 12, 15];

export default function RoleConfig({ 
  roles, 
  roleConfig, 
  isAdmin, 
  onUpdate 
}: RoleConfigProps) {
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState<number | null>(null);

  const handleChange = (roleType: RoleType, delta: number) => {
    if (!isAdmin) return;
    
    const current = roleConfig[roleType] || 0;
    const newValue = Math.max(0, current + delta);
    
    const newConfig = {
      ...Object.fromEntries(
        Object.entries(roleConfig).map(([k, v]) => [k, v])
      ),
      [roleType]: newValue,
    };
    
    // Remove roles with 0 count
    Object.keys(newConfig).forEach((key) => {
      if (newConfig[key] === 0) {
        delete newConfig[key];
      }
    });
    
    onUpdate(newConfig);
  };

  const handleRandomize = async (playerCount: number) => {
    if (!isAdmin) return;
    
    setIsRandomizing(true);
    setSelectedPlayerCount(playerCount);
    
    try {
      const response = await fetch(`${API_BASE}/roles/random/${playerCount}`);
      if (response.ok) {
        const data = await response.json();
        onUpdate(data.role_counts);
      }
    } catch (error) {
      console.error('Failed to randomize roles:', error);
    } finally {
      setIsRandomizing(false);
      // Keep selection visible briefly for feedback
      setTimeout(() => setSelectedPlayerCount(null), 500);
    }
  };

  const totalPlayers = Object.values(roleConfig).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Randomize Section */}
      {isAdmin && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-600/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎲</span>
            <h3 className="font-bold text-purple-300">Quick Random Setup</h3>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            Click a player count to generate a random balanced configuration:
          </p>
          <div className="flex flex-wrap gap-2">
            {PLAYER_PRESETS.map((count) => (
              <button
                key={count}
                onClick={() => handleRandomize(count)}
                disabled={isRandomizing}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  selectedPlayerCount === count
                    ? 'bg-purple-600 text-white scale-105'
                    : 'bg-gray-700 hover:bg-purple-700 text-gray-200 hover:text-white'
                } ${isRandomizing ? 'opacity-50 cursor-wait' : ''}`}
              >
                {count} 👥
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ✨ Guarantees werewolves + random mix of special roles
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROLE_ORDER.map((roleType) => {
          const role = roles[roleType];
          const count = roleConfig[roleType] || 0;
          const isWerewolf = roleType === 'werewolf';

          return (
            <div
              key={roleType}
              className={`role-card ${
                isWerewolf ? 'role-card-werewolf' : 'role-card-village'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{ROLE_ICONS[roleType]}</span>
                  <div>
                    <h3 className="font-bold text-white">
                      {role?.name || roleType}
                    </h3>
                    <span className={`text-xs ${
                      isWerewolf ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {isWerewolf ? 'Werewolf Team' : 'Village Team'}
                    </span>
                  </div>
                </div>

                {/* Counter */}
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={() => handleChange(roleType, -1)}
                      disabled={count === 0}
                      className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                  )}
                  <span className="w-8 text-center text-xl font-bold">
                    {count}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => handleChange(roleType, 1)}
                      className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-400">
                {role?.description || 'Loading...'}
              </p>

              {role?.has_night_action && (
                <div className="mt-2 text-xs text-blue-400">
                  ✨ Has night action
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total count */}
      <div className="mt-6 p-4 bg-werewolf-dark rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Total Players Required:</span>
          <span className="text-2xl font-bold text-white">{totalPlayers}</span>
        </div>
        {!isAdmin && (
          <p className="mt-2 text-sm text-gray-500">
            Only the admin can modify the role configuration.
          </p>
        )}
      </div>
    </div>
  );
}
