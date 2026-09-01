"""Pure grading math (BR-28, D-17) — DB-free and unit-testable."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class GradedAnswerRow:
    """One graded answer: what to persist on ``quiz_answers`` at submit."""

    answer_id: UUID | None
    question_id: UUID
    selected_option_id: UUID | None
    is_correct: bool
    points_awarded: int


@dataclass(frozen=True, slots=True)
class GradingResult:
    """Immutable outcome of grading one attempt."""

    rows: list[GradedAnswerRow]
    score: int
    total_points: int
    correct_count: int
    incorrect_count: int
    percentage: float
    score_out_of_10: float

    @property
    def points_awarded(self) -> int:
        return self.score


def _normalise(score: int, total_points: int) -> tuple[float, float]:
    if total_points <= 0:
        return 0.0, 0.0
    percentage = round(score / total_points * 100, 1)
    out_of_10 = round(score / total_points * 10, 1)
    return percentage, out_of_10


def grade(
    questions: list[dict[str, object]],
    correct_option_ids: dict[UUID, UUID],
    answers: dict[UUID, UUID | None],
    answer_ids: dict[UUID, UUID] | None = None,
    total_points_override: int | None = None,
) -> GradingResult:
    """Grade stored selections against the correct options.

    ``questions`` items: {id, points}. Unanswered questions score 0 and
    count as incorrect (BR-28). ``total_points`` is the snapshot taken
    at start so later quiz edits never rewrite history (BR-22).
    """
    rows: list[GradedAnswerRow] = []
    score = 0
    correct_count = 0
    total = int(total_points_override or 0)

    for question in sorted(questions, key=lambda q: str(q.get("position", ""))):
        question_id = UUID(str(question["id"]))
        points = int(str(question.get("points", 0)))
        total += points if total_points_override is None else 0
        selected = answers.get(question_id)
        correct_id = correct_option_ids.get(question_id)
        is_correct = selected is not None and correct_id is not None and selected == correct_id
        awarded = points if is_correct else 0
        score += awarded
        if is_correct:
            correct_count += 1
        rows.append(
            GradedAnswerRow(
                answer_id=(answer_ids or {}).get(question_id),
                question_id=question_id,
                selected_option_id=selected,
                is_correct=is_correct,
                points_awarded=awarded,
            )
        )
    incorrect_count = len(rows) - correct_count
    percentage, out_of_10 = _normalise(score, total)
    return GradingResult(
        rows=rows,
        score=score,
        total_points=total,
        correct_count=correct_count,
        incorrect_count=incorrect_count,
        percentage=percentage,
        score_out_of_10=out_of_10,
    )
