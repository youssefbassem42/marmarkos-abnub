"""The quiz status - now a shared contract (ARCH-001).

The definition lives in ``app/shared/contracts/quiz.py`` because the
bible module speaks it too. This module keeps the old import path
working; the object is the same one.
"""

from app.shared.contracts.quiz import QuizStatus

__all__ = ["QuizStatus"]
