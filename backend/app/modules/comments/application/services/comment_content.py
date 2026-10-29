"""Sanitisation and word counting for comment HTML (BR-78/BR-79).

The browser sends HTML, but the backend never trusts it.  This service is
the single boundary where the editor's HTML becomes the small, safe
vocabulary that the platform stores.

The policy belongs to the comments module rather than the shared kernel:
its tags and its colour palette are a product rule of the blog comments,
not a generic HTML contract that another module currently shares.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import cast

import bleach  # type: ignore[import-untyped]

ALLOWED_TAGS = frozenset(
    {
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "ul",
        "ol",
        "li",
        "blockquote",
        "span",
        "a",
    }
)
"""The only HTML elements a comment may contain (D-7/BR-78)."""

ALLOWED_PALETTE_COLORS = frozenset(
    {
        "#253d63",  # brand navy
        "#2672b0",  # brand blue
        "#53cb9e",  # brand mint
        "#f96702",  # brand orange
        "#9e150b",  # brand red
        "#6ea8dd",  # dark-mode brand blue
        "#e04a3a",  # dark-mode brand red
    }
)
"""The concrete colours of the design-system palette."""

_ALLOWED_CSS_VARIABLES = frozenset(
    {
        "var(--brand-navy)",
        "var(--brand-blue)",
        "var(--brand-mint)",
        "var(--brand-orange)",
        "var(--brand-red)",
    }
)

_SAFE_STYLE = re.compile(
    r"^color\s*:\s*(#[0-9a-f]{6}|var\(--brand-(?:navy|blue|mint|orange|red)\))\s*;?$",
    re.IGNORECASE,
)
_DANGEROUS_ELEMENT = re.compile(
    r"<(script|style)\b[^>]*>.*?(?:</\1\s*>|$)",
    re.IGNORECASE | re.DOTALL,
)
_BLOCK_TAGS = frozenset({"p", "br", "ul", "ol", "li", "blockquote"})

DELETED_COMMENT_CONTENT = "تم حذف التعليق"
"""The only text a deleted comment exposes (BR-80)."""


def _safe_href(value: str) -> bool:
    """Accept absolute HTTP(S) links and same-platform relative paths."""
    candidate = value.strip()
    lowered = candidate.lower()
    return (
        lowered.startswith("http://")
        or lowered.startswith("https://")
        or (candidate.startswith("/") and not candidate.startswith("//"))
    )


def _safe_span_style(value: str) -> bool:
    """Accept one colour declaration, and only from the product palette."""
    match = _SAFE_STYLE.fullmatch(value.strip())
    if match is None:
        return False
    colour = match.group(1).lower()
    return colour in ALLOWED_PALETTE_COLORS or colour in _ALLOWED_CSS_VARIABLES


def _allowed_attribute(tag: str, name: str, value: str) -> str | bool:
    """Bleach's attribute filter for the deliberately tiny comment policy."""
    if tag == "a" and name == "href":
        return value if _safe_href(value) else False
    if tag == "span" and name == "style":
        return value if _safe_span_style(value) else False
    return False


def sanitize_comment_html(value: str) -> str:
    """Return comment HTML containing only the tags and attributes of BR-78.

    Script and style elements lose their contents as well as their tags.
    Every other unknown element is stripped while its harmless text is
    retained.  Event-handler attributes, unsafe URLs and colours outside
    the palette never reach the database.
    """
    without_dangerous_elements = _DANGEROUS_ELEMENT.sub("", value)
    return cast(
        str,
        bleach.clean(
            without_dangerous_elements,
            tags=ALLOWED_TAGS,
            attributes=_allowed_attribute,
            protocols={"http", "https"},
            css_sanitizer=_PaletteCssSanitizer(),
            strip=True,
            strip_comments=True,
        ),
    )


class _PaletteCssSanitizer:
    """Keep the one colour declaration accepted by the attribute filter.

    Bleach deliberately empties every ``style`` attribute unless it is
    given a CSS sanitizer.  The attribute filter above has already proved
    that the value is exactly one palette colour, so this sanitizer may
    return that value unchanged without opening a path to arbitrary CSS.
    """

    @staticmethod
    def sanitize_css(value: str) -> str:
        return value


class _TextExtractor(HTMLParser):
    """Collect visible text and keep block boundaries as word boundaries."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def count_comment_words(html: str) -> int:
    """Count the words of visible comment text (BR-79).

    Tags are not words, block elements separate their words, and a
    whitespace-delimited emoji counts as one word.  The count is made on
    the sanitised HTML, so hidden script text cannot affect the limit.
    """
    parser = _TextExtractor()
    parser.feed(html)
    parser.close()
    return len(" ".join(parser.parts).split())
