"""Case builders for the branded mail component.

Every outgoing email is one function call away: each builder returns a
``BrandEmailContent`` whose data drives the shared layout — so adding a
new case (event announcement, welcome note...) never touches markup.
The platform renders Arabic only; function signatures retain ``_en``
parameters for API/DB contract compliance.
"""

import html

from app.modules.notifications.infrastructure.email.templates import (
    BrandEmailContent,
    EmailSection,
)

_BRAND_EN = "Marmarkos Abnub"


def _esc(value: str) -> str:
    return html.escape(value, quote=False)


def _display_name(first_name: str | None, last_name: str | None = None) -> str | None:
    name = " ".join(part for part in (first_name, last_name) if part)
    return name or None


def verification_email(
    *,
    first_name: str | None,
    verify_url: str,
    expire_hours: int,
) -> BrandEmailContent:
    name = _esc(_display_name(first_name) or "")
    return BrandEmailContent(
        subject=f"تأكيد بريدك الإلكتروني — {_BRAND_EN}",
        preheader="نقرة واحدة ويصبح حسابك مفعّلًا",
        sections=(
            EmailSection(
                heading=f"أهلاً {name} 👋" if name else "أهلاً بك 👋",
                paragraphs=(
                    "شكرًا لانضمامك إلى اجتماع الشباب بأبنوب! بقي خطوة واحدة فقط:"
                    " أكّد أن هذا البريد الإلكتروني يخصّك لتفعيل حسابك.",
                    f"هذا الرابط صالح لمدة {expire_hours} ساعة، ويمكن استخدامه مرة واحدة فقط.",
                ),
                rtl=True,
            ),
        ),
        cta_label="تأكيد البريد الإلكتروني",
        cta_url=verify_url,
        note="لم تطلب هذا البريد؟ تجاهله بأمان — لن يتم تفعيل أي حساب.",
    )


def password_reset_email(
    *,
    first_name: str | None,
    reset_url: str,
    expire_minutes: int,
) -> BrandEmailContent:
    name = _esc(_display_name(first_name) or "")
    return BrandEmailContent(
        subject=f"إعادة تعيين كلمة المرور — {_BRAND_EN}",
        preheader="رابط لاختيار كلمة مرور جديدة",
        sections=(
            EmailSection(
                heading=f"مرحبًا {name}" if name else "مرحبًا",
                paragraphs=(
                    "وصلنا طلب لإعادة تعيين كلمة المرور الخاصة بحسابك."
                    " اضغط على الزر أدناه لاختيار كلمة مرور جديدة.",
                    f"هذا الرابط صالح لمدة {expire_minutes} دقيقة فقط،"
                    " وينتهي صلاحيته تلقائيًا بعد الاستخدام.",
                ),
                rtl=True,
            ),
        ),
        cta_label="إعادة تعيين كلمة المرور",
        cta_url=reset_url,
        note="إذا لم تطلب تغيير كلمة المرور فتجاهل هذه الرسالة؛ حسابك آمن.",
    )


def notification_email(
    *,
    title_ar: str,
    title_en: str,
    message_ar: str,
    message_en: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
) -> BrandEmailContent:
    """Generic announcement case (new event, blog post, ...) reusing the same layout."""
    return BrandEmailContent(
        subject=f"{title_ar} — {_BRAND_EN}",
        preheader=message_ar,
        sections=(
            EmailSection(heading=_esc(title_ar), paragraphs=(_esc(message_ar),), rtl=True),
        ),
        cta_label=cta_label,
        cta_url=cta_url,
    )


def new_post_email(
    *,
    title_ar: str,
    title_en: str,
    message_ar: str,
    message_en: str,
    cta_url: str | None = None,
) -> BrandEmailContent:
    """Blog post case: the generic announcement with a read CTA."""
    return notification_email(
        title_ar=title_ar,
        title_en=title_en,
        message_ar=message_ar,
        message_en=message_en,
        cta_label="اقرأ المزيد",
        cta_url=cta_url,
    )


def welcome_email(*, first_name: str | None, sign_in_url: str) -> BrandEmailContent:
    name = _esc(_display_name(first_name) or "")
    return BrandEmailContent(
        subject=f"تم تفعيل حسابك — {_BRAND_EN}",
        preheader="أهلًا بك في المجتمع",
        sections=(
            EmailSection(
                heading=f"تم تفعيل حسابك يا {name}!" if name else "تم تفعيل حسابك!",
                paragraphs=(
                    "أهلًا بك في مجتمع شباب أبنوب. يمكنك الآن تسجيل الدخول والمشاركة معنا.",
                ),
                rtl=True,
            ),
        ),
        cta_label="تسجيل الدخول",
        cta_url=sign_in_url,
    )


def verse_published_email(
    *,
    verse_reference: str,
    title: str,
    published_at: str,
    verse_url: str,
) -> BrandEmailContent:
    """Phase 5 (US-028): creator notification after automatic publication.

    Follows ``phase-5.md`` §46: tells the creator their scheduled verse
    went live.
    """
    reference = _esc(verse_reference)
    heading_title = _esc(title)
    return BrandEmailContent(
        subject=f"تم نشر آية الكتاب المقدس المجدولة — {_BRAND_EN}",
        preheader="تم النشر التلقائي",
        sections=(
            EmailSection(
                heading="تم نشر آيتك المجدولة",
                paragraphs=(
                    "مرحبًا،",
                    f"تم نشر آية الكتاب المقدس المجدولة تلقائيًا اليوم: {heading_title}"
                    f" ({reference}).",
                    f"تاريخ النشر: {published_at}",
                    "يمكنك فتح المنصة لمشاهدة المنشور.",
                ),
                rtl=True,
            ),
        ),
        cta_label="افتح الآية",
        cta_url=verse_url,
        note="— خدمة الشباب بأبنوب",
    )
