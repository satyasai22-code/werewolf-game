"""
Game State Machine (FSM) for managing game phases and transitions.
"""
from enum import Enum
from typing import Callable, Dict, List, Optional, Any
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)


class GamePhase(str, Enum):
    """All possible game phases."""
    LOBBY = "lobby"
    STARTING = "starting"
    NIGHT = "night"
    NIGHT_RESOLUTION = "night_resolution"
    DAY_ANNOUNCEMENT = "day_announcement"
    DAY_DISCUSSION = "day_discussion"
    DAY_VOTING = "day_voting"
    VOTE_RESOLUTION = "vote_resolution"
    GAME_OVER = "game_over"


class PhaseTransition(BaseModel):
    """Represents a valid phase transition."""
    from_phase: GamePhase
    to_phase: GamePhase
    condition: Optional[str] = None  # Name of condition function
    

# Define valid state transitions
VALID_TRANSITIONS: List[PhaseTransition] = [
    PhaseTransition(from_phase=GamePhase.LOBBY, to_phase=GamePhase.STARTING),
    PhaseTransition(from_phase=GamePhase.STARTING, to_phase=GamePhase.NIGHT),
    PhaseTransition(from_phase=GamePhase.NIGHT, to_phase=GamePhase.NIGHT_RESOLUTION),
    PhaseTransition(from_phase=GamePhase.NIGHT_RESOLUTION, to_phase=GamePhase.DAY_ANNOUNCEMENT),
    PhaseTransition(from_phase=GamePhase.DAY_ANNOUNCEMENT, to_phase=GamePhase.DAY_DISCUSSION),
    PhaseTransition(from_phase=GamePhase.DAY_DISCUSSION, to_phase=GamePhase.DAY_VOTING),
    PhaseTransition(from_phase=GamePhase.DAY_VOTING, to_phase=GamePhase.VOTE_RESOLUTION),
    PhaseTransition(from_phase=GamePhase.VOTE_RESOLUTION, to_phase=GamePhase.NIGHT),
    PhaseTransition(from_phase=GamePhase.VOTE_RESOLUTION, to_phase=GamePhase.GAME_OVER),
    PhaseTransition(from_phase=GamePhase.NIGHT_RESOLUTION, to_phase=GamePhase.GAME_OVER),
    # Allow restart from game over
    PhaseTransition(from_phase=GamePhase.GAME_OVER, to_phase=GamePhase.LOBBY),
]


class GameStateMachine:
    """
    Finite State Machine for managing game phase transitions.
    Ensures game flows through valid states and triggers callbacks.
    """
    
    def __init__(self, initial_phase: GamePhase = GamePhase.LOBBY):
        self.current_phase = initial_phase
        self.phase_history: List[GamePhase] = [initial_phase]
        self.round_number = 0
        
        # Callbacks for phase events
        self._on_enter_callbacks: Dict[GamePhase, List[Callable]] = {phase: [] for phase in GamePhase}
        self._on_exit_callbacks: Dict[GamePhase, List[Callable]] = {phase: [] for phase in GamePhase}
        self._transition_callbacks: List[Callable] = []
        
        # Build transition map for quick lookup
        self._transition_map: Dict[GamePhase, List[GamePhase]] = {}
        for transition in VALID_TRANSITIONS:
            if transition.from_phase not in self._transition_map:
                self._transition_map[transition.from_phase] = []
            self._transition_map[transition.from_phase].append(transition.to_phase)
    
    def can_transition_to(self, target_phase: GamePhase) -> bool:
        """Check if transition to target phase is valid from current phase."""
        valid_targets = self._transition_map.get(self.current_phase, [])
        return target_phase in valid_targets
    
    def transition_to(self, target_phase: GamePhase, context: Optional[Dict[str, Any]] = None) -> bool:
        """
        Attempt to transition to a new phase.
        
        Args:
            target_phase: The phase to transition to
            context: Optional context data for callbacks
            
        Returns:
            True if transition successful, False otherwise
        """
        if not self.can_transition_to(target_phase):
            logger.warning(
                f"Invalid transition: {self.current_phase} -> {target_phase}"
            )
            return False
        
        context = context or {}
        old_phase = self.current_phase
        
        # Execute exit callbacks for current phase
        for callback in self._on_exit_callbacks[old_phase]:
            try:
                callback(old_phase, target_phase, context)
            except Exception as e:
                logger.error(f"Error in exit callback: {e}")
        
        # Update phase
        self.current_phase = target_phase
        self.phase_history.append(target_phase)
        
        # Track round number
        if target_phase == GamePhase.NIGHT:
            self.round_number += 1
        
        # Execute enter callbacks for new phase
        for callback in self._on_enter_callbacks[target_phase]:
            try:
                callback(old_phase, target_phase, context)
            except Exception as e:
                logger.error(f"Error in enter callback: {e}")
        
        # Execute general transition callbacks
        for callback in self._transition_callbacks:
            try:
                callback(old_phase, target_phase, context)
            except Exception as e:
                logger.error(f"Error in transition callback: {e}")
        
        logger.info(f"Phase transition: {old_phase} -> {target_phase}")
        return True
    
    def on_enter(self, phase: GamePhase, callback: Callable) -> None:
        """Register a callback for when entering a specific phase."""
        self._on_enter_callbacks[phase].append(callback)
    
    def on_exit(self, phase: GamePhase, callback: Callable) -> None:
        """Register a callback for when exiting a specific phase."""
        self._on_exit_callbacks[phase].append(callback)
    
    def on_transition(self, callback: Callable) -> None:
        """Register a callback for any phase transition."""
        self._transition_callbacks.append(callback)
    
    def get_valid_transitions(self) -> List[GamePhase]:
        """Get list of valid phases to transition to from current phase."""
        return self._transition_map.get(self.current_phase, [])
    
    def reset(self) -> None:
        """Reset the state machine to initial state."""
        self.current_phase = GamePhase.LOBBY
        self.phase_history = [GamePhase.LOBBY]
        self.round_number = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize state machine state."""
        return {
            "current_phase": self.current_phase.value,
            "round_number": self.round_number,
            "valid_transitions": [p.value for p in self.get_valid_transitions()],
            "phase_history_length": len(self.phase_history)
        }


class PhaseTimer:
    """
    Timer for game phases with configurable durations.
    """
    
    DEFAULT_DURATIONS = {
        GamePhase.STARTING: 5,  # 5 seconds countdown
        GamePhase.NIGHT: 30,  # 30 seconds for night actions
        GamePhase.DAY_ANNOUNCEMENT: 10,  # 10 seconds to show deaths
        GamePhase.DAY_DISCUSSION: 120,  # 2 minutes discussion
        GamePhase.DAY_VOTING: 30,  # 30 seconds to vote
        GamePhase.VOTE_RESOLUTION: 5,  # 5 seconds to show results
    }
    
    def __init__(self, durations: Optional[Dict[GamePhase, int]] = None):
        self.durations = {**self.DEFAULT_DURATIONS, **(durations or {})}
        self.current_timer: Optional[float] = None
        self.is_running = False
    
    def get_duration(self, phase: GamePhase) -> Optional[int]:
        """Get the duration for a phase in seconds."""
        return self.durations.get(phase)
    
    def start_timer(self, phase: GamePhase) -> Optional[int]:
        """Start timer for a phase. Returns duration or None if no timer."""
        duration = self.get_duration(phase)
        if duration:
            self.is_running = True
            return duration
        return None
    
    def stop_timer(self) -> None:
        """Stop the current timer."""
        self.is_running = False
        self.current_timer = None
