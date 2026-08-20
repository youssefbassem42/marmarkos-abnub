from enum import StrEnum


class CommentStatus(StrEnum):
    VISIBLE = "VISIBLE"
    HIDDEN = "HIDDEN"
    DELETED = "DELETED"
    FLAGGED = "FLAGGED"
