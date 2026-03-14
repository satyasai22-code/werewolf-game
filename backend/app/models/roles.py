"""
Role System using Strategy Pattern for extensibility.
Each role inherits from BaseRole and implements perform_action().
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from pydantic import BaseModel

if TYPE_CHECKING:
    from app.models.game import Game, Player


class RoleType(str, Enum):
    """Enum for all available roles in the game."""
    WEREWOLF = "werewolf"
    VILLAGER = "villager"
    SEER = "seer"
    DOCTOR = "doctor"
    WITCH = "witch"
    AVENGER = "avenger"


class Team(str, Enum):
    """Team affiliations for win condition checking."""
    VILLAGE = "village"
    WEREWOLF = "werewolf"
    NONE = "none"  # Tie - both teams eliminated


class ActionResult(BaseModel):
    """Result of a role action."""
    success: bool
    message: str
    data: Dict[str, Any] = {}
    visible_to: List[str] = []  # Player IDs who can see this result


class NightAction(BaseModel):
    """Represents a queued night action."""
    player_id: str
    role_type: RoleType
    target_id: Optional[str] = None
    secondary_target_id: Optional[str] = None  # For roles like Witch
    action_type: str = "primary"  # primary, save, poison for Witch
    priority: int = 0  # Lower = executes first


class BaseRole(ABC):
    """
    Abstract base class for all roles using Strategy Pattern.
    New roles should inherit from this class and implement perform_action().
    """
    
    role_type: RoleType
    team: Team
    name: str
    description: str
    priority: int = 50  # Default priority for night action execution
    has_night_action: bool = False
    
    def __init__(self, player_id: str):
        self.player_id = player_id
        self.is_alive = True
        self.action_used = False  # For one-time actions
    
    @abstractmethod
    def perform_action(
        self, 
        game: "Game", 
        target_id: Optional[str] = None,
        action_type: str = "primary"
    ) -> ActionResult:
        """
        Execute the role's action. Must be implemented by each role.
        
        Args:
            game: The current game state
            target_id: ID of the target player (if applicable)
            action_type: Type of action (for roles with multiple actions)
            
        Returns:
            ActionResult with success status and relevant data
        """
        pass
    
    def get_valid_targets(self, game: "Game") -> List[str]:
        """Return list of valid target player IDs for this role's action."""
        return [p.id for p in game.players.values() if p.is_alive and p.id != self.player_id]
    
    def get_night_action_prompt(self) -> Dict[str, Any]:
        """Return UI prompt data for the night action."""
        return {
            "role": self.role_type.value,
            "has_action": self.has_night_action,
            "prompt": "Waiting for night to end...",
            "action_type": "none"
        }
    
    def get_visible_info(self, game: "Game") -> Dict[str, Any]:
        """Return role-specific information visible to this player."""
        return {}
    
    def on_death(self, game: "Game", killer_id: Optional[str] = None) -> Optional[ActionResult]:
        """Hook called when the player dies. Override for death effects."""
        self.is_alive = False
        return None
    
    def reset_nightly(self) -> None:
        """Reset any per-night state. Called at the start of each night."""
        pass
    
    def to_dict(self, reveal: bool = False) -> Dict[str, Any]:
        """Serialize role info. If reveal=False, hide sensitive info."""
        if reveal:
            return {
                "role_type": self.role_type.value,
                "team": self.team.value,
                "name": self.name,
                "description": self.description
            }
        return {"role_type": "unknown", "team": "unknown"}


class Werewolf(BaseRole):
    """Werewolf role - kills one player per night."""
    
    role_type = RoleType.WEREWOLF
    team = Team.WEREWOLF
    name = "Werewolf"
    description = "Hunt with your pack. Kill one villager each night."
    priority = 30  # Werewolves act after Seer but result resolved after Doctor
    has_night_action = True
    
    def perform_action(
        self, 
        game: "Game", 
        target_id: Optional[str] = None,
        action_type: str = "primary"
    ) -> ActionResult:
        if not target_id:
            return ActionResult(success=False, message="Must select a target to kill")
        
        target = game.players.get(target_id)
        if not target or not target.is_alive:
            return ActionResult(success=False, message="Invalid target")
        
        if target.role.role_type == RoleType.WEREWOLF:
            return ActionResult(success=False, message="Cannot kill fellow werewolf")
        
        # Mark target for death (resolved after Doctor action)
        game.night_state.werewolf_target = target_id
        
        return ActionResult(
            success=True,
            message=f"Targeted {target.name} for elimination",
            data={"target_id": target_id},
            visible_to=game.get_werewolf_ids()
        )
    
    def get_valid_targets(self, game: "Game") -> List[str]:
        """Werewolves cannot target other werewolves."""
        return [
            p.id for p in game.players.values() 
            if p.is_alive and p.role.role_type != RoleType.WEREWOLF
        ]
    
    def get_night_action_prompt(self) -> Dict[str, Any]:
        return {
            "role": self.role_type.value,
            "has_action": True,
            "prompt": "Choose a player to eliminate tonight",
            "action_type": "kill"
        }
    
    def get_visible_info(self, game: "Game") -> Dict[str, Any]:
        """Werewolves can see other werewolves."""
        werewolf_ids = game.get_werewolf_ids()
        return {
            "pack_members": [
                {"id": p.id, "name": p.name} 
                for p in game.players.values() 
                if p.id in werewolf_ids
            ]
        }


class Villager(BaseRole):
    """Villager role - no special powers."""
    
    role_type = RoleType.VILLAGER
    team = Team.VILLAGE
    name = "Villager"
    description = "You have no special powers. Use your wits to find the werewolves!"
    priority = 100
    has_night_action = False
    
    def perform_action(
        self, 
        game: "Game", 
        target_id: Optional[str] = None,
        action_type: str = "primary"
    ) -> ActionResult:
        return ActionResult(
            success=True,
            message="You have no night action. Rest peacefully.",
            visible_to=[self.player_id]
        )
    
    def get_night_action_prompt(self) -> Dict[str, Any]:
        return {
            "role": self.role_type.value,
            "has_action": False,
            "prompt": "You have no special powers. Wait for dawn...",
            "action_type": "none"
        }


class Seer(BaseRole):
    """Seer role - reveals one player's role per night."""
    
    role_type = RoleType.SEER
    team = Team.VILLAGE
    name = "Seer"
    description = "Each night, divine the true nature of one player."
    priority = 10  # Seer acts first
    has_night_action = True
    
    def __init__(self, player_id: str):
        super().__init__(player_id)
        self.revealed_players: Dict[str, RoleType] = {}
    
    def perform_action(
        self, 
        game: "Game", 
        target_id: Optional[str] = None,
        action_type: str = "primary"
    ) -> ActionResult:
        if not target_id:
            return ActionResult(success=False, message="Must select a player to reveal")
        
        target = game.players.get(target_id)
        if not target or not target.is_alive:
            return ActionResult(success=False, message="Invalid target")
        
        # Store revelation
        self.revealed_players[target_id] = target.role.role_type
        
        return ActionResult(
            success=True,
            message=f"{target.name} is a {target.role.name}!",
            data={
                "target_id": target_id,
                "target_name": target.name,
                "revealed_role": target.role.role_type.value
            },
            visible_to=[self.player_id]
        )
    
    def get_night_action_prompt(self) -> Dict[str, Any]:
        return {
            "role": self.role_type.value,
            "has_action": True,
            "prompt": "Choose a player to reveal their true identity",
            "action_type": "reveal"
        }
    
    def get_visible_info(self, game: "Game") -> Dict[str, Any]:
        return {"revealed_players": self.revealed_players}


class Doctor(BaseRole):
    """Doctor role - heals one player per night, cannot heal same player twice in a row."""
    
    role_type = RoleType.DOCTOR
    team = Team.VILLAGE
    name = "Doctor"
    description = "Protect one player each night. Cannot protect the same player consecutively."
    priority = 40  # Doctor acts after werewolves select target
    has_night_action = True
    
    def __init__(self, player_id: str):
        super().__init__(player_id)
        self.last_healed: Optional[str] = None
    
    def perform_action(
        self, 
        game: "Game", 
        target_id: Optional[str] = None,
        action_type: str = "primary"
    ) -> ActionResult:
        if not target_id:
            return ActionResult(success=False, message="Must select a player to heal")
        
        target = game.players.get(target_id)
        if not target or not target.is_alive:
            return ActionResult(success=False, message="Invalid target")
        
        if target_id == self.last_healed:
            return ActionResult(
                success=False, 
                message="Cannot heal the same player two nights in a row"
            )
        
        # Mark player as protected
        game.night_state.doctor_target = target_id
        self.last_healed = target_id
        
        return ActionResult(
            success=True,
            message=f"You are protecting {target.name} tonight",
            data={"target_id": target_id},
            visible_to=[self.player_id]
        )
    
    def get_valid_targets(self, game: "Game") -> List[str]:
        """Cannot heal the same player twice in a row."""
        return [
            p.id for p in game.players.values() 
            if p.is_alive and p.id != self.last_healed
        ]
    
    def get_night_action_prompt(self) -> Dict[str, Any]:
        return {
            "role": self.role_type.value,
            "has_action": True,
            "prompt": "Choose a player to protect tonight",
            "action_type": "heal",
            "restriction": f"Cannot heal: {self.last_healed}" if self.last_healed else None
        }


class Witch(BaseRole):
    """Witch role - has one save potion and one kill potion, each usable once per game."""
    
    role_type = RoleType.WITCH
    team = Team.VILLAGE
    name = "Witch"
    description = "You possess one Elixir of Life and one Poison. Each can only be used once."
    priority = 45  # Witch acts after Doctor
    has_night_action = True
    
    def __init__(self, player_id: str):
        super().__init__(player_id)
        self.has_elixir = True
        self.has_poison = True
    
    def perform_action(
        self, 
        game: "Game", 
        target_id: Optional[str] = None,
        action_type: str = "primary"
    ) -> ActionResult:
        if action_type == "save":
            return self._use_elixir(game)
        elif action_type == "poison":
            return self._use_poison(game, target_id)
        elif action_type == "skip":
            return ActionResult(
                success=True,
                message="You chose not to use your potions tonight",
                visible_to=[self.player_id]
            )
        
        return ActionResult(success=False, message="Invalid action type")
    
    def _use_elixir(self, game: "Game") -> ActionResult:
        if not self.has_elixir:
            return ActionResult(success=False, message="You have already used your Elixir")
        
        if not game.night_state.werewolf_target:
            return ActionResult(
                success=False, 
                message="No one is being attacked tonight"
            )
        
        # Save the werewolf target
        game.night_state.witch_saved = True
        self.has_elixir = False
        
        target = game.players.get(game.night_state.werewolf_target)
        target_name = target.name if target else "Unknown"
        
        return ActionResult(
            success=True,
            message=f"You used your Elixir to save {target_name}",
            data={"saved_id": game.night_state.werewolf_target},
            visible_to=[self.player_id]
        )
    
    def _use_poison(self, game: "Game", target_id: Optional[str]) -> ActionResult:
        if not self.has_poison:
            return ActionResult(success=False, message="You have already used your Poison")
        
        if not target_id:
            return ActionResult(success=False, message="Must select a target to poison")
        
        target = game.players.get(target_id)
        if not target or not target.is_alive:
            return ActionResult(success=False, message="Invalid target")
        
        game.night_state.witch_poison_target = target_id
        self.has_poison = False
        
        return ActionResult(
            success=True,
            message=f"You used your Poison on {target.name}",
            data={"poisoned_id": target_id},
            visible_to=[self.player_id]
        )
    
    def get_night_action_prompt(self) -> Dict[str, Any]:
        return {
            "role": self.role_type.value,
            "has_action": True,
            "prompt": "Choose to use your potions",
            "action_type": "witch_choice",
            "has_elixir": self.has_elixir,
            "has_poison": self.has_poison
        }
    
    def get_visible_info(self, game: "Game") -> Dict[str, Any]:
        info = {
            "has_elixir": self.has_elixir,
            "has_poison": self.has_poison
        }
        # Witch can see who is being attacked
        if game.night_state.werewolf_target:
            target = game.players.get(game.night_state.werewolf_target)
            if target:
                info["attack_victim"] = {"id": target.id, "name": target.name}
        return info


class Avenger(BaseRole):
    """Avenger role - upon death, their pre-selected target also dies."""
    
    role_type = RoleType.AVENGER
    team = Team.VILLAGE
    name = "Avenger"
    description = "Choose a target. If you die, they die with you."
    priority = 20
    has_night_action = True
    
    def __init__(self, player_id: str):
        super().__init__(player_id)
        self.revenge_target: Optional[str] = None
        self.target_locked = False
    
    def perform_action(
        self, 
        game: "Game", 
        target_id: Optional[str] = None,
        action_type: str = "primary"
    ) -> ActionResult:
        if self.target_locked:
            return ActionResult(
                success=False, 
                message="Your revenge target is already locked"
            )
        
        if not target_id:
            return ActionResult(success=False, message="Must select a revenge target")
        
        target = game.players.get(target_id)
        if not target or not target.is_alive:
            return ActionResult(success=False, message="Invalid target")
        
        self.revenge_target = target_id
        self.target_locked = True
        
        return ActionResult(
            success=True,
            message=f"If you die, {target.name} will share your fate",
            data={"revenge_target": target_id},
            visible_to=[self.player_id]
        )
    
    def on_death(self, game: "Game", killer_id: Optional[str] = None) -> Optional[ActionResult]:
        """When Avenger dies, their target also dies."""
        super().on_death(game, killer_id)
        
        if self.revenge_target:
            target = game.players.get(self.revenge_target)
            if target and target.is_alive:
                target.kill(game, killer_id=self.player_id, cause="avenger")
                return ActionResult(
                    success=True,
                    message=f"The Avenger's curse strikes {target.name}!",
                    data={"revenge_victim": self.revenge_target}
                )
        return None
    
    def get_night_action_prompt(self) -> Dict[str, Any]:
        if self.target_locked:
            return {
                "role": self.role_type.value,
                "has_action": False,
                "prompt": "Your target is locked. Wait for dawn...",
                "action_type": "none"
            }
        return {
            "role": self.role_type.value,
            "has_action": True,
            "prompt": "Choose your revenge target (can only be set once)",
            "action_type": "revenge"
        }
    
    def get_visible_info(self, game: "Game") -> Dict[str, Any]:
        if self.revenge_target:
            target = game.players.get(self.revenge_target)
            return {
                "revenge_target": {
                    "id": self.revenge_target,
                    "name": target.name if target else "Unknown"
                },
                "target_locked": self.target_locked
            }
        return {"revenge_target": None, "target_locked": False}


# Role Registry for easy instantiation
ROLE_REGISTRY: Dict[RoleType, type] = {
    RoleType.WEREWOLF: Werewolf,
    RoleType.VILLAGER: Villager,
    RoleType.SEER: Seer,
    RoleType.DOCTOR: Doctor,
    RoleType.WITCH: Witch,
    RoleType.AVENGER: Avenger,
}


def create_role(role_type: RoleType, player_id: str) -> BaseRole:
    """Factory function to create a role instance."""
    role_class = ROLE_REGISTRY.get(role_type)
    if not role_class:
        raise ValueError(f"Unknown role type: {role_type}")
    return role_class(player_id)
