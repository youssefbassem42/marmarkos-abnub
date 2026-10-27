"""The read model of the quiz module, as the other modules see it (ARCH-001).

The member feed of the bible module shows the state of the quiz of a
verse: is there a quiz, is it published, has the member started it, has
the member finished it. Until now the bible module read the quiz tables
directly - it imported the ORM models of the quiz module, and the quiz
module imported the bible module: a cycle that made both modules
impossible to test on their own.

The contract below is the whole of what the bible module needs. The
implementation lives in the quiz module (it owns the data), and the
other modules reach it through the Unit of Work - the one place that
knows every module.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from app.shared.contracts.quiz import AttemptStatus, QuizStatus


@dataclass(frozen=True, slots=True)
class QuizState:
    """The quiz of a verse: which one it is and in which state."""

    quiz_id: uuid.UUID
    status: QuizStatus


@dataclass(frozen=True, slots=True)
class AttemptState:
    """The attempt of a member for a quiz."""

    quiz_id: uuid.UUID
    status: AttemptStatus


class QuizReadModel(Protocol):
    """What the other modules may ask about quizzes."""

    async def quiz_states_by_verse(
        self, verse_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, QuizState]:
        """The quiz of every requested verse (the ones without a quiz are absent)."""
        ...

    async def viewer_attempts_by_quiz(
        self, viewer_id: uuid.UUID, verse_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, AttemptState]:
        """The attempt of the member for the quizzes of the requested verses.

        The result is keyed by the **quiz** id: that is the key the
        caller already holds (it comes from the quiz state above).
        """
        ...
