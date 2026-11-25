from enum import StrEnum


class PostStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class PostStatusFilter(StrEnum):
    """The states the blog list may be filtered by.

    A scheduled post is still a draft in the database (BR-63).  The
    filter keeps that implementation detail out of the public contract:
    ``DRAFT`` means an unscheduled draft and ``SCHEDULED`` means a draft
    that carries a publication date.
    """

    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"
