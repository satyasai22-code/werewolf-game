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

const ROLE_SYMBOLS: Record<RoleType, string> = {
  werewolf: '🌙',  // Night action
  villager: '',
  seer: '👁️',      // Reveals
  doctor: '🛡️',    // Protects
  witch: '⚗️',     // Potions
  avenger: '💀',   // Revenge
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
  const [hoveredRole, setHoveredRole] = useState<RoleType | null>(null);

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
      setTimeout(() => setSelectedPlayerCount(null), 500);
    }
  };

  const totalPlayers = Object.values(roleConfig).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Randomize Section - Compact */}
      {isAdmin && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-600/50">
          <div className="flex items-center gap-2 mb-2">
            <span>🎲</span>
            <span className="font-bold text-purple-300 text-sm">Quick Setup</span>
            <span className="text-xs text-gray-500">— click player count:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PLAYER_PRESETS.map((count) => (
              <button
                key={count}
                onClick={() => handleRandomize(count)}
                disabled={isRandomizing}
                className={`px-3 py-1 rounded text-sm font-bold transition-all ${
                  selectedPlayerCount === count
                    ? 'bg-purple-600 text-white scale-105'
                    : 'bg-gray-700 hover:bg-purple-700 text-gray-200'
                } ${isRandomizing ? 'opacity-50' : ''}`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Role Grid - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {ROLE_ORDER.map((roleType) => {
          const role = roles[roleType];
          const count = roleConfig[roleType] || 0;
          const isWerewolf = roleType === 'werewolf';
          const isHovered = hoveredRole === roleType;

          return (
            <div
              key={roleType}
              className={`relative p-2 rounded-lg border-2 cursor-pointer transition-all ${
                isWerewolf 
                  ? 'border-red-600/50 bg-red-900/20 hover:border-red-500' 
                  : 'border-green-600/50 bg-green-900/20 hover:border-green-500'
              } ${count > 0 ? 'ring-1 ring-white/20' : ''}`}
              onMouseEnter={() => setHoveredRole(roleType)}
              onMouseLeave={() => setHoveredRole(null)}
              onClick={() => !isAdmin && setHoveredRole(isHovered ? null : roleType)}
            >
              {/* Main Content */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl">{ROLE_ICONS[roleType]}</span>
                  <span className="font-bold text-sm text-white truncate">
                    {role?.name || roleType}
                  </span>
                </div>
                {ROLE_SYMBOLS[roleType] && (
                  <span className="text-xs opacity-60" title={role?.description}>
                    {ROLE_SYMBOLS[roleType]}
                  </span>
                )}
              </div>
              
              {/* Counter Row */}
              <div className="flex items-center justify-center gap-1 mt-2">
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleChange(roleType, -1); }}
                    disabled={count === 0}
                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-sm"
                  >
                    −
                  </button>
                )}
                <span className={`w-6 text-center text-lg font-bold ${count > 0 ? 'text-white' : 'text-gray-500'}`}>
                  {count}
                </span>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleChange(roleType, 1); }}
                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                  >
                    +
                  </button>
                )}
              </div>

              {/* Hover Tooltip Description */}
              {isHovered && role?.description && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 p-2 bg-gray-900 border border-gray-600 rounded-lg shadow-xl text-xs text-gray-300">
                  {role.description}
                  {role.has_night_action && (
                    <div className="mt-1 text-blue-400">✨ Has night action</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total - Compact */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-400">Total Players:</span>
        <span className="text-lg font-bold text-white">{totalPlayers}</span>
      </div>
    </div>
  );
}
