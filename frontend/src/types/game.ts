// Game types matching the backend models

export type RoleType = 
  | 'werewolf' 
  | 'villager' 
  | 'seer' 
  | 'doctor' 
  | 'witch' 
  | 'avenger';

export type Team = 'village' | 'werewolf' | 'none';

export type GamePhase = 
  | 'lobby'
  | 'starting'
  | 'night'
  | 'night_resolution'
  | 'day_announcement'
  | 'day_discussion'
  | 'day_voting'
  | 'vote_resolution'
  | 'game_over';

export interface Role {
  role_type: RoleType | 'unknown';
  team: Team | 'unknown';
  name?: string;
  description?: string;
}

export interface Player {
  id: string;
  name: string;
  is_admin: boolean;
  is_ready: boolean;
  is_alive: boolean;
  is_connected: boolean;
  role?: Role | null;
  death_cause?: 'werewolf' | 'poison' | 'voted_out' | 'avenger' | null;
}

export interface RoleInfo {
  name: string;
  team: Team;
  description: string;
  has_night_action: boolean;
}

export interface NightPrompt {
  role: RoleType;
  has_action: boolean;
  prompt: string;
  action_type: string;
  has_elixir?: boolean;
  has_poison?: boolean;
  restriction?: string | null;
}

export interface VoteInfo {
  voter_id: string;
  target_id: string | null;
}

export interface GameState {
  player_id: string;
  name: string;
  is_alive: boolean;
  role: Role | null;
  role_info: Record<string, unknown>;
  phase: GamePhase;
  round: number;
  players: Player[];
  night_prompt: NightPrompt | null;
  valid_targets?: string[];
  can_vote: boolean;
  vote_counts?: Record<string, number>;
  my_vote?: VoteInfo;
  last_night_deaths?: Array<{
    player_id: string;
    player_name: string;
    cause: 'werewolf' | 'poison' | 'voted_out' | 'avenger';
  }>;
}

export interface GameSettings {
  reveal_role_on_death: boolean;
  show_vote_counts: boolean;
}

export interface LobbyState {
  id: string;
  room_code: string;
  phase: GamePhase;
  players: Player[];
  role_config: Record<RoleType, number>;
  settings: GameSettings;
  player_count: number;
  required_players: number;
  all_ready: boolean;
  config_valid?: boolean;
  config_message?: string;
}

export interface DeathInfo {
  player_id: string;
  player_name: string;
  cause: 'werewolf' | 'poison' | 'voted_out' | 'avenger';
}

export interface GameOverData {
  winner: Team;
  message: string;
  players: Array<Player & { role: Role }>;
  death_log: DeathInfo[];
}

// WebSocket message types
export type MessageType =
  | 'join_room'
  | 'leave_room'
  | 'toggle_ready'
  | 'update_role_config'
  | 'start_game'
  | 'night_action'
  | 'cast_vote'
  | 'chat_message'
  | 'room_state'
  | 'game_state'
  | 'player_joined'
  | 'player_left'
  | 'player_ready'
  | 'game_started'
  | 'phase_changed'
  | 'night_result'
  | 'vote_update'
  | 'vote_result'
  | 'game_over'
  | 'error'
  | 'timer_update';

export interface WebSocketMessage<T = unknown> {
  type: MessageType;
  data: T;
}

export interface ChatMessage {
  sender_id: string;
  sender_name: string;
  message: string;
  is_werewolf_chat?: boolean;
  is_dead?: boolean;
}
