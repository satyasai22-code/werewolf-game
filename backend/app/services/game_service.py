"""
Game service for managing game instances and room state.
"""
from typing import Dict, Optional
import logging

from app.models import Game, Room, Player, RoleConfiguration, RoleType

logger = logging.getLogger(__name__)


class GameService:
    """
    Service layer for game and room management.
    Handles creating rooms, joining games, and maintaining game state.
    """
    
    def __init__(self):
        # room_code -> Room
        self.rooms: Dict[str, Room] = {}
        # player_id -> room_code (for quick lookup)
        self.player_rooms: Dict[str, str] = {}
    
    def create_room(self, creator_name: str) -> tuple[Room, Player]:
        """
        Create a new game room.
        
        Args:
            creator_name: Name of the player creating the room
            
        Returns:
            Tuple of (Room, Player) for the created room and admin player
        """
        # Generate unique room code
        room_code = Room.generate_code()
        while room_code in self.rooms:
            room_code = Room.generate_code()
        
        # Create game with default configuration
        game = Game(room_code=room_code)
        
        # Add creator as admin
        creator = game.add_player(creator_name, is_admin=True)
        
        # Create room
        room = Room(code=room_code, game=game)
        self.rooms[room_code] = room
        self.player_rooms[creator.id] = room_code
        
        logger.info(f"Room {room_code} created by {creator_name}")
        
        return room, creator
    
    def join_room(self, room_code: str, player_name: str) -> Optional[tuple[Room, Player]]:
        """
        Join an existing room.
        
        Args:
            room_code: The room code to join
            player_name: Name of the joining player
            
        Returns:
            Tuple of (Room, Player) or None if room doesn't exist
        """
        room = self.rooms.get(room_code.upper())
        if not room:
            return None
        
        # Check if game already started
        from app.models import GamePhase
        if room.game.state_machine.current_phase != GamePhase.LOBBY:
            return None
        
        # Add player
        player = room.game.add_player(player_name)
        self.player_rooms[player.id] = room_code
        
        logger.info(f"Player {player_name} joined room {room_code}")
        
        return room, player
    
    def leave_room(self, player_id: str) -> Optional[str]:
        """
        Remove a player from their room.
        
        Args:
            player_id: ID of the player leaving
            
        Returns:
            Room code they left, or None
        """
        room_code = self.player_rooms.pop(player_id, None)
        if not room_code:
            return None
        
        room = self.rooms.get(room_code)
        if room:
            player = room.game.remove_player(player_id)
            if player:
                logger.info(f"Player {player.name} left room {room_code}")
            
            # Clean up empty rooms
            if not room.game.players:
                del self.rooms[room_code]
                logger.info(f"Room {room_code} deleted (empty)")
        
        return room_code
    
    def get_room(self, room_code: str) -> Optional[Room]:
        """Get a room by code."""
        return self.rooms.get(room_code.upper())
    
    def get_game(self, room_code: str) -> Optional[Game]:
        """Get a game by room code."""
        room = self.get_room(room_code)
        return room.game if room else None
    
    def get_player_room(self, player_id: str) -> Optional[str]:
        """Get the room code for a player."""
        return self.player_rooms.get(player_id)
    
    def reconnect_player(self, room_code: str, player_id: str) -> Optional[Player]:
        """
        Handle a player reconnecting to their game.
        
        Args:
            room_code: The room code
            player_id: The player's ID
            
        Returns:
            The player if found and reconnected, None otherwise
        """
        room = self.get_room(room_code)
        if not room:
            return None
        
        player = room.game.players.get(player_id)
        if player:
            player.is_connected = True
            self.player_rooms[player_id] = room_code
            logger.info(f"Player {player.name} reconnected to room {room_code}")
        
        return player
    
    def disconnect_player(self, player_id: str) -> None:
        """
        Mark a player as disconnected (but don't remove from game).
        """
        room_code = self.player_rooms.get(player_id)
        if not room_code:
            return
        
        room = self.get_room(room_code)
        if room:
            player = room.game.players.get(player_id)
            if player:
                player.is_connected = False
                logger.info(f"Player {player.name} disconnected from room {room_code}")
    
    def set_role_configuration(
        self, 
        room_code: str, 
        role_counts: Dict[str, int]
    ) -> tuple[bool, str]:
        """
        Set the role configuration for a game.
        
        Args:
            room_code: The room code
            role_counts: Dict mapping role type strings to counts
            
        Returns:
            Tuple of (success, message)
        """
        game = self.get_game(room_code)
        if not game:
            return False, "Room not found"
        
        # Convert string keys to RoleType
        config_dict = {}
        for role_str, count in role_counts.items():
            try:
                role_type = RoleType(role_str)
                config_dict[role_type] = int(count)
            except ValueError:
                return False, f"Invalid role type: {role_str}"
        
        game.role_config.role_counts = config_dict
        return game.role_config.validate_configuration()
    
    def get_available_roles(self) -> Dict[str, Dict]:
        """Get information about all available roles."""
        from app.models import ROLE_REGISTRY
        
        roles = {}
        for role_type, role_class in ROLE_REGISTRY.items():
            # Create a temporary instance to get info
            temp_role = role_class("temp")
            roles[role_type.value] = {
                "name": temp_role.name,
                "team": temp_role.team.value,
                "description": temp_role.description,
                "has_night_action": temp_role.has_night_action
            }
        
        return roles
    
    def generate_random_roles(self, player_count: int) -> Dict[str, int]:
        """
        Generate a truly random role configuration.
        
        Rules:
        - Werewolves: Always at least 1, never majority
        - Special roles favor lower numbers (1-2) but can occasionally be higher
        - No hard caps, just probability-weighted
        """
        import random
        
        if player_count < 4:
            player_count = 4
        if player_count > 15:
            player_count = 15
        
        role_counts: Dict[str, int] = {}
        remaining = player_count
        
        # Calculate werewolf count (must be minority)
        min_wolves = 1
        max_wolves = max(1, (player_count - 1) // 3)
        wolf_count = random.randint(min_wolves, max_wolves)
        role_counts["werewolf"] = wolf_count
        remaining -= wolf_count
        
        # All village roles (including villager as a "role")
        village_roles = ["seer", "doctor", "witch", "avenger", "villager"]
        random.shuffle(village_roles)
        
        # Randomly distribute remaining slots across all village roles
        for role in village_roles:
            if remaining <= 0:
                break
            
            # Custom probability distribution for special roles:
            # 0: 40%, 1: 30%, 2: 20%, 3+: 10% (spread across remaining)
            if role != "villager":
                base_weights = [40, 30, 20]  # 0, 1, 2
                
                # Spread remaining 10% across higher numbers
                higher_count = max(0, remaining - 2)
                if higher_count > 0:
                    # Split 10% among all numbers >= 3
                    per_higher = 10.0 / higher_count
                    weights = base_weights + [per_higher] * higher_count
                else:
                    weights = base_weights
                
                # Trim to available slots
                weights = weights[:remaining + 1]
            else:
                # For villagers, favor higher numbers (they fill remaining slots)
                weights = [1] * (remaining + 1)
                weights.reverse()  # Higher numbers get more weight
            
            count = random.choices(range(len(weights)), weights=weights)[0]
            
            if count > 0:
                role_counts[role] = count
                remaining -= count
        
        # If anything remains, add as villagers
        if remaining > 0:
            role_counts["villager"] = role_counts.get("villager", 0) + remaining
        
        return role_counts


# Global service instance
game_service = GameService()
