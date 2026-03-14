import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, LobbyState, ChatMessage, WebSocketMessage } from '../types';

interface GameStore {
  // Connection state
  playerId: string | null;
  playerName: string | null;
  roomCode: string | null;
  isAdmin: boolean;
  isConnected: boolean;
  
  // Game state
  lobbyState: LobbyState | null;
  gameState: GameState | null;
  
  // UI state
  chatMessages: ChatMessage[];
  timerRemaining: number | null;
  error: string | null;
  
  // Actions
  setPlayerInfo: (playerId: string, playerName: string, roomCode: string, isAdmin: boolean) => void;
  setConnected: (connected: boolean) => void;
  setLobbyState: (state: LobbyState) => void;
  setGameState: (state: GameState) => void;
  addChatMessage: (message: ChatMessage) => void;
  setTimer: (remaining: number | null) => void;
  setError: (error: string | null) => void;
  clearGame: () => void;
  
  // WebSocket
  ws: WebSocket | null;
  connect: (roomCode: string, playerId: string) => void;
  disconnect: () => void;
  send: (type: string, data?: unknown) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Initial state
      playerId: null,
      playerName: null,
      roomCode: null,
      isAdmin: false,
      isConnected: false,
      lobbyState: null,
      gameState: null,
      chatMessages: [],
      timerRemaining: null,
      error: null,
      ws: null,

      setPlayerInfo: (playerId, playerName, roomCode, isAdmin) => {
        set({ playerId, playerName, roomCode, isAdmin });
      },

      setConnected: (connected) => {
        set({ isConnected: connected });
      },

      setLobbyState: (state) => {
        set({ lobbyState: state });
      },

      setGameState: (state) => {
        set({ gameState: state });
      },

      addChatMessage: (message) => {
        set((state) => ({
          chatMessages: [...state.chatMessages.slice(-100), message],
        }));
      },

      setTimer: (remaining) => {
        set({ timerRemaining: remaining });
      },

      setError: (error) => {
        set({ error });
        if (error) {
          setTimeout(() => set({ error: null }), 5000);
        }
      },

      clearGame: () => {
        const { ws } = get();
        if (ws) {
          ws.close();
        }
        set({
          playerId: null,
          playerName: null,
          roomCode: null,
          isAdmin: false,
          isConnected: false,
          lobbyState: null,
          gameState: null,
          chatMessages: [],
          timerRemaining: null,
          error: null,
          ws: null,
        });
      },

      connect: (roomCode, playerId) => {
        const { ws: existingWs } = get();
        if (existingWs) {
          existingWs.close();
        }

        // Use environment variable for API URL, fallback to localhost:8000 for dev
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
        const apiHost = apiBase.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${apiHost}/ws/${roomCode}/${playerId}`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connected');
          set({ isConnected: true, ws });
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          set({ isConnected: false, ws: null });
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          set({ error: 'Connection error' });
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            handleMessage(message, get, set);
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };
      },

      disconnect: () => {
        const { ws } = get();
        if (ws) {
          ws.close();
        }
        set({ ws: null, isConnected: false });
      },

      send: (type, data = {}) => {
        const { ws, isConnected } = get();
        if (ws && isConnected) {
          ws.send(JSON.stringify({ type, data }));
        }
      },
    }),
    {
      name: 'werewolf-storage',
      partialize: (state) => ({
        playerId: state.playerId,
        playerName: state.playerName,
        roomCode: state.roomCode,
        isAdmin: state.isAdmin,
      }),
    }
  )
);

// Message handler
function handleMessage(
  message: WebSocketMessage,
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void
) {
  const { type, data } = message;

  switch (type) {
    case 'room_state':
      set({ lobbyState: data as LobbyState });
      break;

    case 'game_state':
      // Clear lobbyState when game starts to prevent navigation conflicts
      set({ gameState: data as GameState, lobbyState: null });
      break;

    case 'player_joined':
    case 'player_left':
    case 'player_ready': {
      // These update the lobby state - we'll receive a full update
      // but we can also handle them individually for snappier UI
      const { lobbyState } = get();
      if (lobbyState && 'all_ready' in (data as Record<string, unknown>)) {
        set({
          lobbyState: {
            ...lobbyState,
            all_ready: (data as { all_ready: boolean }).all_ready,
          },
        });
      }
      break;
    }

    case 'game_started':
      // Clear chat and prepare for game
      set({ chatMessages: [] });
      break;

    case 'phase_changed':
      // Phase change notifications are handled by game_state updates
      break;

    case 'night_result':
      // Night action result - shown to specific players
      console.log('Night result:', data);
      break;

    case 'vote_update':
      // Update vote counts in game state
      const { gameState: currentState } = get();
      if (currentState) {
        set({
          gameState: {
            ...currentState,
            vote_counts: (data as { vote_counts: Record<string, number> }).vote_counts,
          },
        });
      }
      break;

    case 'vote_result':
    case 'game_over':
      // These are handled by full game state updates
      break;

    case 'chat_message':
      get().addChatMessage(data as ChatMessage);
      break;

    case 'timer_update':
      set({ timerRemaining: (data as { remaining: number }).remaining });
      break;

    case 'error':
      set({ error: (data as { message: string }).message });
      break;

    default:
      console.log('Unknown message type:', type, data);
  }
}

// Helper hooks
export const usePlayer = () => {
  const { playerId, playerName, isAdmin } = useGameStore();
  return { playerId, playerName, isAdmin };
};

export const useRoom = () => {
  const { roomCode, isConnected, lobbyState, gameState } = useGameStore();
  return { roomCode, isConnected, lobbyState, gameState };
};

export const useLobby = () => {
  return useGameStore((state) => state.lobbyState);
};

export const useGameState = () => {
  return useGameStore((state) => state.gameState);
};
