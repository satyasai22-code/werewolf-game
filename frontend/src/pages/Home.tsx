import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store';
import { API_BASE } from '../config';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  
  const navigate = useNavigate();
  const setPlayerInfo = useGameStore((state) => state.setPlayerInfo);

  const createRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setError(null);
    setIsJoining(true);

    try {
      const response = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: playerName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create room');
      }

      const data = await response.json();
      setPlayerInfo(data.player_id, data.player_name, data.room_code, data.is_admin);
      navigate(`/lobby/${data.room_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    } finally {
      setIsJoining(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setError(null);
    setIsJoining(true);

    try {
      const response = await fetch(`${API_BASE}/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName.trim(),
          room_code: roomCode.trim().toUpperCase(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to join room');
      }

      const data = await response.json();
      setPlayerInfo(data.player_id, data.player_name, data.room_code, data.is_admin);
      navigate(`/lobby/${data.room_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="font-title text-5xl font-bold text-werewolf-accent mb-2">
            Werewolf
          </h1>
          <p className="text-gray-400">
            A game of deception and deduction
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Name Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Your Name
          </label>
          <input
            type="text"
            className="input"
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
          />
        </div>

        {/* Create/Join Buttons */}
        {!showJoinForm ? (
          <div className="space-y-4">
            <button
              onClick={createRoom}
              disabled={isJoining}
              className="btn btn-primary w-full text-lg"
            >
              {isJoining ? 'Creating...' : 'Create New Game'}
            </button>
            
            <button
              onClick={() => setShowJoinForm(true)}
              className="btn btn-secondary w-full"
            >
              Join Existing Game
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Room Code
              </label>
              <input
                type="text"
                className="input text-center text-2xl tracking-widest uppercase"
                placeholder="XXXXXX"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>
            
            <button
              onClick={joinRoom}
              disabled={isJoining}
              className="btn btn-primary w-full"
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </button>
            
            <button
              onClick={() => setShowJoinForm(false)}
              className="btn btn-secondary w-full"
            >
              Back
            </button>
          </div>
        )}

        {/* Game Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>4-15 players • Night & Day phases</p>
          <p className="mt-1">Find the werewolves before it's too late!</p>
        </div>
      </div>
    </div>
  );
}
