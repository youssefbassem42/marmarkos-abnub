"""Case builders for the branded mail component.

Every outgoing email is one function call away: each builder returns a
``BrandEmailContent`` whose data drives the shared layout — so adding a
new case (event announcement, welcome note...) never touches markup.
All copy is bilingual: Arabic first (RTL), English second.
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
        subject=f"Confirm your email — {_BRAND_EN} | تأكيد بريدك الإلكتروني",
        preheader="One click and your account is active / نقرة واحدة ويصبح حسابك مفعّلًا",
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
            EmailSection(
                heading="Confirm your email",
                paragraphs=(
                    "Welcome to the Marmarkos Abnub youth community!"
                    " Please confirm this address to activate your account.",
                    f"This link is valid for {expire_hours} hours and can be used only once.",
                ),
            ),
        ),
        cta_label="تأكيد البريد الإلكتروني — VERIFY EMAIL",
        cta_url=verify_url,
        note="لم تطلب هذا البريد؟ تجاهله بأمان — لن يتم تفعيل أي حساب. "
        "Didn't request this? You can safely ignore it; no account will be activated.",
    )


def password_reset_email(
    *,
    first_name: str | None,
    reset_url: str,
    expire_minutes: int,
) -> BrandEmailContent:
    name = _esc(_display_name(first_name) or "")
    return BrandEmailContent(
        subject="Reset your password — Marmarkos Abnub | إعادة تعيين كلمة المرور",
        preheader="A link to choose a new password / رابط لاختيار كلمة مرور جديدة",
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
            EmailSection(
                heading="Reset your password",
                paragraphs=(
                    "We received a request to reset the password for your account."
                    " Click the button below to choose a new one.",
                    f"The link is valid for {expire_minutes} minutes and expires after a single use.",
                ),
            ),
        ),
        cta_label="إعادة تعيين كلمة المرور — RESET PASSWORD",
        cta_url=reset_url,
        note="إذا لم تطلب تغيير كلمة المرور فتجاهل هذه الرسالة؛ حسابك آمن. "
        "If you didn't request a reset, ignore this email — your account is safe.",
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
        subject=f"{title_en} — {_BRAND_EN}",
        preheader=message_en,
        sections=(
            EmailSection(heading=_esc(title_ar), paragraphs=(_esc(message_ar),), rtl=True),
            EmailSection(heading=_esc(title_en), paragraphs=(_esc(message_en),)),
        ),
        cta_label=cta_label,
        cta_url=cta_url,
    )


def welcome_email(*, first_name: str | None, sign_in_url: str) -> BrandEmailContent:
    name = _esc(_display_name(first_name) or "")
    return BrandEmailContent(
        subject="Your account is active — Marmarkos Abnub | تم تفعيل حسابك",
        preheader="Welcome to the community / أهلًا بك في المجتمع",
        sections=(
            EmailSection(
                heading=f"تم تفعيل حسابك يا {name}!" if name else "تم تفعيل حسابك!",
                paragraphs=("أهلًا بك في مجتمع شباب أبنوب. يمكنك الآن تسجيل الدخول والمشاركة معنا.",),
                rtl=True,
            ),
            EmailSection(
                heading="Your account is now active",
                paragraphs=(
                    "Welcome aboard! You can sign in now and be part of what God is doing.",
                ),
            ),
        ),
        cta_label="تسجيل الدخول — SIGN IN",
        cta_url=sign_in_url,
    )
