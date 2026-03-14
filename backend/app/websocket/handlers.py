"""
WebSocket message handlers for game events.
"""
from typing import Dict, Any, Optional
from fastapi import WebSocket
import logging
import asyncio

from app.models import (
    Game, Player, GamePhase, RoleType, Team
)
from app.websocket.connection_manager import manager
from app.services.game_service import GameService

logger = logging.getLogger(__name__)


class MessageType:
    """WebSocket message types."""
    # Client -> Server
    JOIN_ROOM = "join_room"
    LEAVE_ROOM = "leave_room"
    TOGGLE_READY = "toggle_ready"
    UPDATE_ROLE_CONFIG = "update_role_config"
    START_GAME = "start_game"
    NIGHT_ACTION = "night_action"
    CAST_VOTE = "cast_vote"
    CHAT_MESSAGE = "chat_message"
    
    # Server -> Client
    ROOM_STATE = "room_state"
    GAME_STATE = "game_state"
    PLAYER_JOINED = "player_joined"
    PLAYER_LEFT = "player_left"
    PLAYER_READY = "player_ready"
    GAME_STARTED = "game_started"
    PHASE_CHANGED = "phase_changed"
    NIGHT_RESULT = "night_result"
    VOTE_UPDATE = "vote_update"
    VOTE_RESULT = "vote_result"
    GAME_OVER = "game_over"
    ERROR = "error"
    TIMER_UPDATE = "timer_update"


class GameMessageHandler:
    """
    Handles incoming WebSocket messages and coordinates game actions.
    """
    
    def __init__(self, game_service: GameService):
        self.game_service = game_service
        self._phase_timers: Dict[str, asyncio.Task] = {}
    
    async def handle_message(
        self, 
        websocket: WebSocket,
        room_code: str,
        player_id: str,
        message: Dict[str, Any]
    ) -> None:
        """Route incoming message to appropriate handler."""
        msg_type = message.get("type")
        data = message.get("data", {})
        
        handlers = {
            MessageType.TOGGLE_READY: self._handle_toggle_ready,
            MessageType.UPDATE_ROLE_CONFIG: self._handle_update_role_config,
            MessageType.START_GAME: self._handle_start_game,
            MessageType.NIGHT_ACTION: self._handle_night_action,
            MessageType.CAST_VOTE: self._handle_cast_vote,
            MessageType.CHAT_MESSAGE: self._handle_chat_message,
        }
        
        handler = handlers.get(msg_type)
        if handler:
            try:
                await handler(room_code, player_id, data)
            except Exception as e:
                logger.error(f"Error handling {msg_type}: {e}")
                await self._send_error(player_id, str(e))
        else:
            await self._send_error(player_id, f"Unknown message type: {msg_type}")
    
    async def _handle_toggle_ready(
        self, 
        room_code: str, 
        player_id: str, 
        data: Dict
    ) -> None:
        """Handle player toggling ready status."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        player = game.players.get(player_id)
        if player:
            player.is_ready = not player.is_ready
            
            # Broadcast updated room state
            await manager.broadcast_to_room(
                {
                    "type": MessageType.PLAYER_READY,
                    "data": {
                        "player_id": player_id,
                        "is_ready": player.is_ready,
                        "all_ready": game.all_players_ready()
                    }
                },
                room_code
            )
    
    async def _handle_update_role_config(
        self, 
        room_code: str, 
        player_id: str, 
        data: Dict
    ) -> None:
        """Handle admin updating role configuration."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        player = game.players.get(player_id)
        if not player or not player.is_admin:
            await self._send_error(player_id, "Only admin can update role configuration")
            return
        
        # Update role configuration
        role_counts = {}
        for role_str, count in data.get("role_counts", {}).items():
            try:
                role_type = RoleType(role_str)
                role_counts[role_type] = int(count)
            except ValueError:
                continue
        
        game.role_config.role_counts = role_counts
        
        # Validate configuration
        valid, message = game.role_config.validate_configuration()
        
        # Broadcast updated room state
        await manager.broadcast_to_room(
            {
                "type": MessageType.ROOM_STATE,
                "data": {
                    **game.to_lobby_dict(),
                    "config_valid": valid,
                    "config_message": message
                }
            },
            room_code
        )
    
    async def _handle_start_game(
        self, 
        room_code: str, 
        player_id: str, 
        data: Dict
    ) -> None:
        """Handle admin starting the game."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        player = game.players.get(player_id)
        if not player or not player.is_admin:
            await self._send_error(player_id, "Only admin can start the game")
            return
        
        if not game.all_players_ready():
            await self._send_error(player_id, "All players must be ready")
            return
        
        if len(game.players) != game.role_config.get_total_players():
            await self._send_error(
                player_id, 
                f"Need {game.role_config.get_total_players()} players, have {len(game.players)}"
            )
            return
        
        # Start the game
        if game.start_game():
            await manager.broadcast_to_room(
                {
                    "type": MessageType.GAME_STARTED,
                    "data": {"message": "Game is starting!"}
                },
                room_code
            )
            
            # Start the game loop
            await self._transition_to_night(room_code)
    
    async def _transition_to_night(self, room_code: str) -> None:
        """Transition to night phase."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        # Reset night state
        game.night_state.reset()
        
        # Reset per-night role state
        for player in game.players.values():
            if player.role:
                player.role.reset_nightly()
        
        # Transition to night
        game.state_machine.transition_to(GamePhase.NIGHT)
        
        # Send personalized game state to each player
        await manager.broadcast_game_state(room_code, game)
        
        # Start night timer
        await self._start_phase_timer(room_code, GamePhase.NIGHT)
    
    async def _handle_night_action(
        self, 
        room_code: str, 
        player_id: str, 
        data: Dict
    ) -> None:
        """Handle a player's night action."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        if game.state_machine.current_phase != GamePhase.NIGHT:
            await self._send_error(player_id, "Not night phase")
            return
        
        player = game.players.get(player_id)
        if not player or not player.is_alive:
            await self._send_error(player_id, "Cannot perform action")
            return
        
        target_id = data.get("target_id")
        action_type = data.get("action_type", "primary")
        
        # Execute the role's action
        if player.role:
            result = player.role.perform_action(game, target_id, action_type)
            
            # Send result to appropriate players
            await manager.send_to_players(
                {
                    "type": MessageType.NIGHT_RESULT,
                    "data": {
                        "success": result.success,
                        "message": result.message,
                        "data": result.data
                    }
                },
                result.visible_to
            )
            
            if result.success:
                # Mark action as submitted
                game.night_state.actions_submitted.add(player_id)
                
                # Check if all night actions are in
                required = game.get_players_with_night_actions()
                if game.night_state.all_actions_submitted(required):
                    await self._resolve_night(room_code)
    
    async def _resolve_night(self, room_code: str) -> None:
        """Resolve night actions and transition to day."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        # Cancel night timer
        await self._cancel_phase_timer(room_code)
        
        # Transition to resolution phase
        game.state_machine.transition_to(GamePhase.NIGHT_RESOLUTION)
        
        # Process all night actions
        deaths = game.process_night_actions()
        
        # Check win condition
        winner = game.check_win_condition()
        if winner:
            game.winner = winner
            game.state_machine.transition_to(GamePhase.GAME_OVER)
            await self._broadcast_game_over(room_code, winner)
            return
        
        # Transition to day announcement
        game.state_machine.transition_to(GamePhase.DAY_ANNOUNCEMENT)
        
        # Broadcast deaths
        await manager.broadcast_to_room(
            {
                "type": MessageType.PHASE_CHANGED,
                "data": {
                    "phase": GamePhase.DAY_ANNOUNCEMENT.value,
                    "deaths": deaths,
                    "message": self._generate_death_announcement(deaths)
                }
            },
            room_code
        )
        
        # After announcement, transition to discussion
        await asyncio.sleep(game.phase_timer.get_duration(GamePhase.DAY_ANNOUNCEMENT) or 5)
        await self._transition_to_discussion(room_code)
    
    async def _transition_to_discussion(self, room_code: str) -> None:
        """Transition to day discussion phase."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        game.state_machine.transition_to(GamePhase.DAY_DISCUSSION)
        game.voting_state.reset()
        
        await manager.broadcast_game_state(room_code, game)
        await self._start_phase_timer(room_code, GamePhase.DAY_DISCUSSION)
    
    async def _transition_to_voting(self, room_code: str) -> None:
        """Transition to day voting phase."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        game.state_machine.transition_to(GamePhase.DAY_VOTING)
        
        await manager.broadcast_to_room(
            {
                "type": MessageType.PHASE_CHANGED,
                "data": {
                    "phase": GamePhase.DAY_VOTING.value,
                    "message": "Time to vote! Choose who to eliminate."
                }
            },
            room_code
        )
        
        await manager.broadcast_game_state(room_code, game)
        await self._start_phase_timer(room_code, GamePhase.DAY_VOTING)
    
    async def _handle_cast_vote(
        self, 
        room_code: str, 
        player_id: str, 
        data: Dict
    ) -> None:
        """Handle a player casting their vote."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        if game.state_machine.current_phase != GamePhase.DAY_VOTING:
            await self._send_error(player_id, "Not voting phase")
            return
        
        player = game.players.get(player_id)
        if not player or not player.is_alive:
            await self._send_error(player_id, "Cannot vote")
            return
        
        target_id = data.get("target_id")  # None = abstain
        
        # Validate target
        if target_id:
            target = game.players.get(target_id)
            if not target or not target.is_alive:
                await self._send_error(player_id, "Invalid vote target")
                return
        
        # Cast vote
        game.voting_state.cast_vote(player_id, target_id)
        
        # Broadcast vote update
        await manager.broadcast_to_room(
            {
                "type": MessageType.VOTE_UPDATE,
                "data": {
                    "voter_id": player_id,
                    "vote_counts": game.voting_state.get_vote_counts(),
                    "votes_cast": len(game.voting_state.votes),
                    "votes_needed": len(game.get_alive_players())
                }
            },
            room_code
        )
        
        # Check if all alive players have voted
        if len(game.voting_state.votes) >= len(game.get_alive_players()):
            await self._resolve_vote(room_code)
    
    async def _resolve_vote(self, room_code: str) -> None:
        """Resolve the vote and potentially eliminate a player."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        await self._cancel_phase_timer(room_code)
        
        game.state_machine.transition_to(GamePhase.VOTE_RESOLUTION)
        
        # Process elimination
        elimination = game.process_vote_elimination()
        
        if elimination:
            await manager.broadcast_to_room(
                {
                    "type": MessageType.VOTE_RESULT,
                    "data": {
                        "eliminated": True,
                        "player_id": elimination["player_id"],
                        "player_name": elimination["player_name"],
                        "vote_counts": elimination["vote_counts"],
                        "message": f"{elimination['player_name']} has been eliminated by the village!"
                    }
                },
                room_code
            )
        else:
            await manager.broadcast_to_room(
                {
                    "type": MessageType.VOTE_RESULT,
                    "data": {
                        "eliminated": False,
                        "message": "No one was eliminated (tie or no majority)."
                    }
                },
                room_code
            )
        
        # Check win condition
        winner = game.check_win_condition()
        if winner:
            game.winner = winner
            game.state_machine.transition_to(GamePhase.GAME_OVER)
            await self._broadcast_game_over(room_code, winner)
            return
        
        # Transition back to night
        await asyncio.sleep(game.phase_timer.get_duration(GamePhase.VOTE_RESOLUTION) or 5)
        await self._transition_to_night(room_code)
    
    async def _broadcast_game_over(self, room_code: str, winner: Team) -> None:
        """Broadcast game over message with full reveal."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        # Reveal all roles
        players_revealed = []
        for player in game.players.values():
            players_revealed.append({
                "id": player.id,
                "name": player.name,
                "role": player.role.to_dict(reveal=True) if player.role else None,
                "is_alive": player.is_alive
            })
        
        await manager.broadcast_to_room(
            {
                "type": MessageType.GAME_OVER,
                "data": {
                    "winner": winner.value,
                    "message": f"The {winner.value} team wins!",
                    "players": players_revealed,
                    "death_log": game.death_log
                }
            },
            room_code
        )
    
    async def _handle_chat_message(
        self, 
        room_code: str, 
        player_id: str, 
        data: Dict
    ) -> None:
        """Handle chat messages during day phase."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        player = game.players.get(player_id)
        if not player:
            return
        
        message = data.get("message", "").strip()
        if not message:
            return
        
        # Determine who can see the message
        phase = game.state_machine.current_phase
        
        if phase == GamePhase.NIGHT:
            # Only werewolves can chat at night (among themselves)
            if player.role and player.role.role_type == RoleType.WEREWOLF:
                recipients = game.get_werewolf_ids()
                await manager.send_to_players(
                    {
                        "type": MessageType.CHAT_MESSAGE,
                        "data": {
                            "sender_id": player_id,
                            "sender_name": player.name,
                            "message": message,
                            "is_werewolf_chat": True
                        }
                    },
                    recipients
                )
        else:
            # Day phase - everyone can chat
            # Dead players can only see, not send (handled by UI)
            if player.is_alive or phase == GamePhase.GAME_OVER:
                await manager.broadcast_to_room(
                    {
                        "type": MessageType.CHAT_MESSAGE,
                        "data": {
                            "sender_id": player_id,
                            "sender_name": player.name,
                            "message": message,
                            "is_dead": not player.is_alive
                        }
                    },
                    room_code
                )
    
    async def _start_phase_timer(self, room_code: str, phase: GamePhase) -> None:
        """Start a timer for the current phase."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        duration = game.phase_timer.start_timer(phase)
        if not duration:
            return
        
        # Cancel existing timer
        await self._cancel_phase_timer(room_code)
        
        async def timer_task():
            remaining = duration
            while remaining > 0:
                await manager.broadcast_to_room(
                    {
                        "type": MessageType.TIMER_UPDATE,
                        "data": {"remaining": remaining, "phase": phase.value}
                    },
                    room_code
                )
                await asyncio.sleep(1)
                remaining -= 1
            
            # Timer expired - auto-transition
            await self._handle_timer_expired(room_code, phase)
        
        self._phase_timers[room_code] = asyncio.create_task(timer_task())
    
    async def _cancel_phase_timer(self, room_code: str) -> None:
        """Cancel the current phase timer."""
        task = self._phase_timers.pop(room_code, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    
    async def _handle_timer_expired(self, room_code: str, phase: GamePhase) -> None:
        """Handle phase timer expiration."""
        game = self.game_service.get_game(room_code)
        if not game:
            return
        
        if phase == GamePhase.NIGHT:
            # Auto-resolve night with whatever actions were submitted
            await self._resolve_night(room_code)
        elif phase == GamePhase.DAY_DISCUSSION:
            await self._transition_to_voting(room_code)
        elif phase == GamePhase.DAY_VOTING:
            await self._resolve_vote(room_code)
    
    def _generate_death_announcement(self, deaths: list) -> str:
        """Generate narrative text for night deaths."""
        if not deaths:
            return "The village wakes to find everyone alive. A peaceful night!"
        
        if len(deaths) == 1:
            return f"The village wakes to find {deaths[0]['player_name']} dead!"
        
        names = ", ".join(d["player_name"] for d in deaths)
        return f"A terrible night! {names} were found dead!"
    
    async def _send_error(self, player_id: str, message: str) -> None:
        """Send an error message to a player."""
        await manager.send_personal_message(
            {
                "type": MessageType.ERROR,
                "data": {"message": message}
            },
            player_id
        )


# Global handler instance (initialized with game service)
handler: Optional[GameMessageHandler] = None


def init_handler(game_service: GameService) -> GameMessageHandler:
    """Initialize the global message handler."""
    global handler
    handler = GameMessageHandler(game_service)
    return handler
