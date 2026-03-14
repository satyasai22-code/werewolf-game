"""
Core game models including Player, Game, Room, and NightState.
"""
from typing import Dict, List, Optional, Any, Set
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
import random

from app.models.roles import (
    BaseRole, RoleType, Team, ActionResult, 
    create_role, ROLE_REGISTRY
)
from app.models.state_machine import GameStateMachine, GamePhase, PhaseTimer


class NightState(BaseModel):
    """Tracks all actions and targets during a night phase."""
    werewolf_target: Optional[str] = None
    doctor_target: Optional[str] = None
    witch_saved: bool = False
    witch_poison_target: Optional[str] = None
    seer_target: Optional[str] = None
    avenger_target: Optional[str] = None
    
    # Track which players have submitted their actions
    actions_submitted: Set[str] = Field(default_factory=set)
    
    def reset(self) -> None:
        """Reset night state for a new night."""
        self.werewolf_target = None
        self.doctor_target = None
        self.witch_saved = False
        self.witch_poison_target = None
        self.seer_target = None
        self.avenger_target = None
        self.actions_submitted = set()
    
    def all_actions_submitted(self, required_players: List[str]) -> bool:
        """Check if all required players have submitted their actions."""
        return all(p in self.actions_submitted for p in required_players)


class Vote(BaseModel):
    """A single vote cast during day phase."""
    voter_id: str
    target_id: Optional[str] = None  # None = abstain
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class VotingState(BaseModel):
    """Tracks voting during day phase."""
    votes: Dict[str, Vote] = Field(default_factory=dict)
    
    def cast_vote(self, voter_id: str, target_id: Optional[str]) -> None:
        """Cast or change a vote."""
        self.votes[voter_id] = Vote(voter_id=voter_id, target_id=target_id)
    
    def get_vote_counts(self) -> Dict[str, int]:
        """Get vote counts for each target."""
        counts: Dict[str, int] = {}
        for vote in self.votes.values():
            if vote.target_id:
                counts[vote.target_id] = counts.get(vote.target_id, 0) + 1
        return counts
    
    def get_elimination_target(self, alive_count: int) -> Optional[str]:
        """
        Determine who gets eliminated based on strict majority.
        Returns None if no one has strict majority (tie or not enough votes).
        """
        counts = self.get_vote_counts()
        if not counts:
            return None
        
        majority_threshold = alive_count // 2 + 1
        
        # Find max votes
        max_votes = max(counts.values())
        
        # Check for strict majority
        if max_votes < majority_threshold:
            return None
        
        # Check for tie at max
        max_targets = [t for t, c in counts.items() if c == max_votes]
        if len(max_targets) > 1:
            return None
        
        return max_targets[0]
    
    def reset(self) -> None:
        """Reset voting state for new vote."""
        self.votes = {}


class Player(BaseModel):
    """Represents a player in the game."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    is_admin: bool = False
    is_ready: bool = False
    is_alive: bool = True
    is_connected: bool = True
    role: Optional[BaseRole] = None
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        arbitrary_types_allowed = True
    
    def assign_role(self, role_type: RoleType) -> None:
        """Assign a role to this player."""
        self.role = create_role(role_type, self.id)
    
    def kill(self, game: "Game", killer_id: Optional[str] = None) -> Optional[ActionResult]:
        """Kill this player and trigger death effects."""
        self.is_alive = False
        if self.role:
            return self.role.on_death(game, killer_id)
        return None
    
    def get_game_view(self, game: "Game") -> Dict[str, Any]:
        """Get the game state from this player's perspective (blind state)."""
        view = {
            "player_id": self.id,
            "name": self.name,
            "is_alive": self.is_alive,
            "role": self.role.to_dict(reveal=True) if self.role else None,
            "role_info": self.role.get_visible_info(game) if self.role else {},
            "phase": game.state_machine.current_phase.value,
            "round": game.state_machine.round_number,
            "players": [],
            "night_prompt": None,
            "can_vote": False,
        }
        
        # Add visible player info (hide roles for most players)
        for player in game.players.values():
            player_info = {
                "id": player.id,
                "name": player.name,
                "is_alive": player.is_alive,
                "is_connected": player.is_connected,
                "role": None  # Default hidden
            }
            
            # Reveal roles in certain conditions
            if player.id == self.id:
                player_info["role"] = player.role.to_dict(reveal=True) if player.role else None
            elif self.role and self.role.role_type == RoleType.WEREWOLF:
                # Werewolves can see other werewolves
                if player.role and player.role.role_type == RoleType.WEREWOLF:
                    player_info["role"] = player.role.to_dict(reveal=True)
            elif not player.is_alive and game.state_machine.current_phase != GamePhase.NIGHT:
                # Dead players' roles are revealed during day (if setting enabled)
                if game.settings.reveal_role_on_death:
                    player_info["role"] = player.role.to_dict(reveal=True) if player.role else None
            
            view["players"].append(player_info)
        
        # Add night action prompt if applicable
        if game.state_machine.current_phase == GamePhase.NIGHT and self.is_alive:
            if self.role:
                view["night_prompt"] = self.role.get_night_action_prompt()
                view["valid_targets"] = self.role.get_valid_targets(game)
        
        # Add voting info during day voting
        if game.state_machine.current_phase == GamePhase.DAY_VOTING and self.is_alive:
            view["can_vote"] = True
            # Only show vote counts if setting enabled
            if game.settings.show_vote_counts:
                view["vote_counts"] = game.voting_state.get_vote_counts()
            view["my_vote"] = game.voting_state.votes.get(self.id)
        
        return view
    
    def to_dict(self, include_role: bool = False) -> Dict[str, Any]:
        """Serialize player data."""
        data = {
            "id": self.id,
            "name": self.name,
            "is_admin": self.is_admin,
            "is_ready": self.is_ready,
            "is_alive": self.is_alive,
            "is_connected": self.is_connected,
        }
        if include_role and self.role:
            data["role"] = self.role.to_dict(reveal=True)
        return data


class RoleConfiguration(BaseModel):
    """Configuration for roles in a game."""
    role_counts: Dict[RoleType, int] = Field(default_factory=dict)
    
    def get_total_players(self) -> int:
        """Get total number of players needed."""
        return sum(self.role_counts.values())
    
    def validate_configuration(self) -> tuple[bool, str]:
        """Validate the role configuration."""
        total = self.get_total_players()
        
        if total < 4:
            return False, "Minimum 4 players required"
        
        werewolf_count = self.role_counts.get(RoleType.WEREWOLF, 0)
        if werewolf_count < 1:
            return False, "At least 1 werewolf required"
        
        # Werewolves should be minority
        if werewolf_count >= total / 2:
            return False, "Werewolves cannot be majority"
        
        return True, "Valid configuration"
    
    def generate_role_list(self) -> List[RoleType]:
        """Generate a shuffled list of roles based on configuration."""
        roles = []
        for role_type, count in self.role_counts.items():
            roles.extend([role_type] * count)
        random.shuffle(roles)
        return roles


class GameSettings(BaseModel):
    """Game settings configurable by admin."""
    reveal_role_on_death: bool = True  # Show dead player's role
    show_vote_counts: bool = True      # Show vote counts during voting
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "reveal_role_on_death": self.reveal_role_on_death,
            "show_vote_counts": self.show_vote_counts,
        }


class Game(BaseModel):
    """Main game model containing all game state."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_code: str
    players: Dict[str, Player] = Field(default_factory=dict)
    state_machine: GameStateMachine = Field(default_factory=GameStateMachine)
    phase_timer: PhaseTimer = Field(default_factory=PhaseTimer)
    role_config: RoleConfiguration = Field(default_factory=RoleConfiguration)
    settings: GameSettings = Field(default_factory=GameSettings)
    night_state: NightState = Field(default_factory=NightState)
    voting_state: VotingState = Field(default_factory=VotingState)
    
    # Discussion skip tracking
    discussion_skip_requests: Set[str] = Field(default_factory=set)
    
    # Game results
    winner: Optional[Team] = None
    death_log: List[Dict[str, Any]] = Field(default_factory=list)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        arbitrary_types_allowed = True
    
    def add_player(self, name: str, is_admin: bool = False) -> Player:
        """Add a new player to the game."""
        player = Player(name=name, is_admin=is_admin)
        self.players[player.id] = player
        return player
    
    def remove_player(self, player_id: str) -> Optional[Player]:
        """Remove a player and handle admin transfer."""
        player = self.players.pop(player_id, None)
        
        if player and player.is_admin and self.players:
            # Transfer admin to next player
            next_admin = min(self.players.values(), key=lambda p: p.joined_at)
            next_admin.is_admin = True
        
        return player
    
    def get_admin(self) -> Optional[Player]:
        """Get the current admin player."""
        for player in self.players.values():
            if player.is_admin:
                return player
        return None
    
    def all_players_ready(self) -> bool:
        """Check if all players are ready."""
        return all(p.is_ready for p in self.players.values())
    
    def get_alive_players(self) -> List[Player]:
        """Get list of alive players."""
        return [p for p in self.players.values() if p.is_alive]
    
    def get_werewolf_ids(self) -> List[str]:
        """Get IDs of all werewolf players."""
        return [
            p.id for p in self.players.values() 
            if p.role and p.role.role_type == RoleType.WEREWOLF
        ]
    
    def get_alive_werewolves(self) -> List[Player]:
        """Get alive werewolf players."""
        return [
            p for p in self.players.values() 
            if p.is_alive and p.role and p.role.role_type == RoleType.WEREWOLF
        ]
    
    def get_alive_villagers(self) -> List[Player]:
        """Get alive village team players."""
        return [
            p for p in self.players.values()
            if p.is_alive and p.role and p.role.team == Team.VILLAGE
        ]
    
    def assign_roles(self) -> bool:
        """Assign roles to all players based on configuration."""
        roles = self.role_config.generate_role_list()
        players = list(self.players.values())
        
        if len(roles) != len(players):
            return False
        
        for player, role_type in zip(players, roles):
            player.assign_role(role_type)
        
        return True
    
    def start_game(self) -> bool:
        """Start the game if conditions are met."""
        if not self.all_players_ready():
            return False
        
        valid, _ = self.role_config.validate_configuration()
        if not valid:
            return False
        
        if len(self.players) != self.role_config.get_total_players():
            return False
        
        if not self.assign_roles():
            return False
        
        return self.state_machine.transition_to(GamePhase.STARTING)
    
    def check_win_condition(self) -> Optional[Team]:
        """Check if any team has won."""
        alive_wolves = len(self.get_alive_werewolves())
        alive_villagers = len(self.get_alive_villagers())
        
        # Village wins if all werewolves dead
        if alive_wolves == 0:
            return Team.VILLAGE
        
        # Werewolves win if they equal or outnumber villagers
        if alive_wolves >= alive_villagers:
            return Team.WEREWOLF
        
        return None
    
    def get_players_with_night_actions(self) -> List[str]:
        """Get IDs of alive players who have night actions."""
        players_with_actions = []
        for player in self.get_alive_players():
            if player.role and player.role.has_night_action:
                # Special handling for Avenger - only has action once
                if player.role.role_type == RoleType.AVENGER:
                    if not player.role.target_locked:
                        players_with_actions.append(player.id)
                else:
                    players_with_actions.append(player.id)
        return players_with_actions
    
    def process_night_actions(self) -> List[Dict[str, Any]]:
        """
        Process all night actions and return results.
        Actions are processed in priority order.
        """
        results = []
        deaths = []
        
        # Determine final werewolf target
        werewolf_kill = self.night_state.werewolf_target
        
        # Check if Doctor saved the target
        if werewolf_kill and self.night_state.doctor_target == werewolf_kill:
            werewolf_kill = None
            results.append({
                "type": "save",
                "message": "The Doctor saved someone tonight!"
            })
        
        # Check if Witch saved
        if werewolf_kill and self.night_state.witch_saved:
            werewolf_kill = None
            results.append({
                "type": "save",
                "message": "Someone was saved by mysterious magic..."
            })
        
        # Process werewolf kill
        if werewolf_kill:
            victim = self.players.get(werewolf_kill)
            if victim and victim.is_alive:
                death_result = victim.kill(self, killer_id="werewolves")
                deaths.append({
                    "player_id": werewolf_kill,
                    "player_name": victim.name,
                    "cause": "werewolf"
                })
                if death_result:
                    # Handle Avenger revenge
                    if death_result.data.get("revenge_victim"):
                        revenge_victim = self.players.get(death_result.data["revenge_victim"])
                        if revenge_victim:
                            deaths.append({
                                "player_id": revenge_victim.id,
                                "player_name": revenge_victim.name,
                                "cause": "avenger"
                            })
        
        # Process Witch poison
        if self.night_state.witch_poison_target:
            victim = self.players.get(self.night_state.witch_poison_target)
            if victim and victim.is_alive:
                death_result = victim.kill(self, killer_id="witch")
                deaths.append({
                    "player_id": victim.id,
                    "player_name": victim.name,
                    "cause": "poison"
                })
                if death_result and death_result.data.get("revenge_victim"):
                    revenge_victim = self.players.get(death_result.data["revenge_victim"])
                    if revenge_victim:
                        deaths.append({
                            "player_id": revenge_victim.id,
                            "player_name": revenge_victim.name,
                            "cause": "avenger"
                        })
        
        # Log deaths
        self.death_log.extend(deaths)
        
        return deaths
    
    def process_vote_elimination(self) -> Optional[Dict[str, Any]]:
        """Process the vote and eliminate player if applicable."""
        alive_count = len(self.get_alive_players())
        target_id = self.voting_state.get_elimination_target(alive_count)
        
        if target_id:
            victim = self.players.get(target_id)
            if victim:
                death_result = victim.kill(self, killer_id="village")
                death_info = {
                    "player_id": victim.id,
                    "player_name": victim.name,
                    "cause": "voted_out",
                    "vote_counts": self.voting_state.get_vote_counts()
                }
                self.death_log.append(death_info)
                
                # Handle Avenger revenge on vote death
                if death_result and death_result.data.get("revenge_victim"):
                    revenge_victim = self.players.get(death_result.data["revenge_victim"])
                    if revenge_victim:
                        self.death_log.append({
                            "player_id": revenge_victim.id,
                            "player_name": revenge_victim.name,
                            "cause": "avenger"
                        })
                        death_info["revenge_victim"] = revenge_victim.name
                
                return death_info
        
        return None
    
    def to_lobby_dict(self) -> Dict[str, Any]:
        """Serialize game state for lobby view."""
        return {
            "id": self.id,
            "room_code": self.room_code,
            "phase": self.state_machine.current_phase.value,
            "players": [p.to_dict() for p in self.players.values()],
            "role_config": {
                k.value: v for k, v in self.role_config.role_counts.items()
            },
            "settings": self.settings.to_dict(),
            "player_count": len(self.players),
            "required_players": self.role_config.get_total_players(),
            "all_ready": self.all_players_ready(),
        }
    
    def to_game_dict(self) -> Dict[str, Any]:
        """Serialize full game state (admin/debug view)."""
        return {
            "id": self.id,
            "room_code": self.room_code,
            "state": self.state_machine.to_dict(),
            "players": [p.to_dict(include_role=True) for p in self.players.values()],
            "winner": self.winner.value if self.winner else None,
            "death_log": self.death_log,
        }


class Room(BaseModel):
    """
    Room management for lobby functionality.
    Maps room codes to games.
    """
    code: str
    game: Game
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    @staticmethod
    def generate_code(length: int = 6) -> str:
        """Generate a unique room code."""
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # Avoid ambiguous chars
        return "".join(random.choices(chars, k=length))
    
    class Config:
        arbitrary_types_allowed = True
