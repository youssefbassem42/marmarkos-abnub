from enum import StrEnum


class CommentStatus(StrEnum):
    VISIBLE = "VISIBLE"
    HIDDEN = "HIDDEN"
    # Legacy database value; the application no longer writes this state.
    DELETED = "DELETED"
    FLAGGED = "FLAGGED"
