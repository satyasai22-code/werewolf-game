"""
WebSocket connection manager for real-time game communication.
"""
from typing import Dict, List, Set, Optional, Any
from fastapi import WebSocket
import json
import logging
import asyncio

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for all game rooms.
    Handles connection lifecycle, broadcasting, and targeted messaging.
    """
    
    def __init__(self):
        # room_code -> {player_id -> WebSocket}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # player_id -> room_code (for quick lookup)
        self.player_rooms: Dict[str, str] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def connect(
        self, 
        websocket: WebSocket, 
        room_code: str, 
        player_id: str
    ) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        
        async with self._lock:
            if room_code not in self.active_connections:
                self.active_connections[room_code] = {}
            
            # Disconnect existing connection for this player if any
            if player_id in self.active_connections[room_code]:
                try:
                    old_ws = self.active_connections[room_code][player_id]
                    await old_ws.close()
                except Exception:
                    pass
            
            self.active_connections[room_code][player_id] = websocket
            self.player_rooms[player_id] = room_code
        
        logger.info(f"Player {player_id} connected to room {room_code}")
    
    async def disconnect(self, player_id: str) -> Optional[str]:
        """
        Disconnect a player and return their room code.
        Returns None if player wasn't connected.
        """
        async with self._lock:
            room_code = self.player_rooms.pop(player_id, None)
            
            if room_code and room_code in self.active_connections:
                self.active_connections[room_code].pop(player_id, None)
                
                # Clean up empty rooms
                if not self.active_connections[room_code]:
                    del self.active_connections[room_code]
                
                logger.info(f"Player {player_id} disconnected from room {room_code}")
                return room_code
        
        return None
    
    async def send_personal_message(
        self, 
        message: Dict[str, Any], 
        player_id: str
    ) -> bool:
        """Send a message to a specific player."""
        room_code = self.player_rooms.get(player_id)
        if not room_code:
            return False
        
        websocket = self.active_connections.get(room_code, {}).get(player_id)
        if not websocket:
            return False
        
        try:
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"Error sending message to {player_id}: {e}")
            return False
    
    async def send_to_players(
        self, 
        message: Dict[str, Any], 
        player_ids: List[str]
    ) -> None:
        """Send a message to specific players."""
        tasks = []
        for player_id in player_ids:
            tasks.append(self.send_personal_message(message, player_id))
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def broadcast_to_room(
        self, 
        message: Dict[str, Any], 
        room_code: str,
        exclude: Optional[Set[str]] = None
    ) -> None:
        """Broadcast a message to all players in a room."""
        exclude = exclude or set()
        connections = self.active_connections.get(room_code, {})
        
        tasks = []
        for player_id, websocket in connections.items():
            if player_id not in exclude:
                tasks.append(self._safe_send(websocket, message))
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def broadcast_game_state(
        self, 
        room_code: str, 
        game: Any  # Game object
    ) -> None:
        """
        Send personalized game state to each player.
        Each player only sees information relevant to their role.
        """
        connections = self.active_connections.get(room_code, {})
        
        tasks = []
        for player_id, websocket in connections.items():
            player = game.players.get(player_id)
            if player:
                # Get personalized view for this player
                player_view = player.get_game_view(game)
                message = {
                    "type": "game_state",
                    "data": player_view
                }
                tasks.append(self._safe_send(websocket, message))
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _safe_send(
        self, 
        websocket: WebSocket, 
        message: Dict[str, Any]
    ) -> bool:
        """Safely send a message, handling connection errors."""
        try:
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"Error broadcasting: {e}")
            return False
    
    def get_room_connections(self, room_code: str) -> List[str]:
        """Get list of connected player IDs in a room."""
        return list(self.active_connections.get(room_code, {}).keys())
    
    def is_player_connected(self, player_id: str) -> bool:
        """Check if a player is currently connected."""
        return player_id in self.player_rooms


# Global connection manager instance
manager = ConnectionManager()
