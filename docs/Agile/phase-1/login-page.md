# ROLE

You are a Senior Frontend Engineer, UI/UX Engineer, and Design-System Engineer.

Your task is to implement the provided password-reset UI reference screen into the existing project.

The attached screenshot is the PRIMARY VISUAL REFERENCE.

The existing project's design-guide Markdown file is the PRIMARY BRAND AUTHORITY.

You must combine both:

1. Reference screenshot → visual/layout authority
2. Existing design guide → brand/identity/typography authority
3. Existing codebase → technical/architecture authority

DO NOT invent a new design.

DO NOT redesign the screen.

DO NOT simplify the UI into a generic authentication form.

The final implementation must look like it belongs to the same Youth Service platform.

==================================================
1. FIRST: INSPECT THE PROJECT
==================================================

Before changing anything:

1. Inspect the complete project structure.
2. Find the project's design guide `.md` file.
3. READ the design guide completely.
4. Inspect existing authentication pages/components.
5. Inspect existing:
   - Navbar/layout
   - Button components
   - Input components
   - Typography
   - Color tokens
   - Icons
   - Routing
   - API/authentication services
   - Form validation
6. Identify reusable components.
7. Reuse existing infrastructure wherever possible.

DO NOT rewrite unrelated code.

DO NOT introduce a second design system.

DO NOT duplicate existing components unnecessarily.

==================================================
2. TARGET PAGE
==================================================

Implement:

RESET PASSWORD

This is STEP 3 of the password recovery flow.

The previous flow is:

STEP 1
Forgot Password

↓

STEP 2
Check Your Email

↓

STEP 3
Reset Password

The current page must clearly communicate that the user has reached the final step.

==================================================
3. TECHNOLOGY
==================================================

Use the project's existing technology stack.

If the existing project uses React + TypeScript + Tailwind CSS, continue using it.

Do not replace the framework.

Do not introduce a new UI framework.

Use existing dependencies whenever possible.

Use Lucide React for icons if that is already used by the project.

==================================================
4. REFERENCE SCREEN
==================================================

Reproduce the attached reference screenshot as closely as reasonably possible.

Match:

- Overall composition
- Two-column structure
- Card proportions
- Spacing
- Typography hierarchy
- Button dimensions
- Input dimensions
- Border radius
- Shadows
- Colors
- Illustration placement
- Footer placement
- Progress indicator
- Alignment
- Responsive behavior

The screenshot is NOT a suggestion.

It is the visual target.

Do not replace it with your own interpretation.

==================================================
5. BRAND IDENTITY
==================================================

The page belongs to:

إجتماع الشباب بأبنوب

Youth Service

The existing brand palette is:

Navy:
#253D63

Blue:
#2672B0

Mint:
#53CB9E

Orange:
#F96702

Red:
#9E150B

White:
#FFFFFF

Primary visual hierarchy:

WHITE + NAVY
↓
BLUE
↓
MINT
↓
ORANGE
↓
RED

Navy should remain the dominant brand color.

Mint should be the main positive/action accent.

Orange and red should remain supporting accents.

DO NOT introduce random colors.

DO NOT turn the page into a rainbow design.

==================================================
6. TYPOGRAPHY
==================================================

For the Arabic version use the exact fonts from the design guide.

Arabic headings:

EL MESSIRI

https://fonts.google.com/specimen/El+Messiri

Arabic content:

MARKAZI TEXT

https://fonts.google.com/specimen/Markazi+Text

Bible verses:

AMIRI

https://fonts.google.com/specimen/Amiri

Do not replace these fonts with generic Arabic fonts.

For English, use the existing project's approved English font.

If no English font is defined, use a clean modern font such as Inter.

==================================================
7. LOGO
==================================================

DO NOT recreate the church logo.

DO NOT generate a new logo.

Use the existing logo placeholder:

/public/images/logo-placeholder.png

If the project already has a different placeholder path, use the existing one.

The user will manually replace the placeholder image later.

The logo must always be inside a fixed-size container.

Desktop:

100px × 70px

Mobile:

80px × 60px

Footer:

150px × 100px

Use:

object-fit: contain;

Never crop or distort the logo.

==================================================
8. DESKTOP LAYOUT
==================================================

Create the same visual composition as the reference.

LEFT:

Brand / identity section.

RIGHT:

Reset password card.

The left side should communicate:

FAITH.
FRIENDS.
PURPOSE.

The right side is the interactive password-reset experience.

The composition should feel balanced.

The registration/authentication card should visually dominate the right side without feeling oversized.

==================================================
9. LEFT BRAND PANEL — ENGLISH
==================================================

Display:

YOUTH SERVICE

FAITH.
FRIENDS.
PURPOSE.

Use:

FAITH → Navy

FRIENDS → Navy

PURPOSE → Mint

Supporting copy:

"A place where young hearts encounter God, build real friendships, and discover their God-given purpose."

Include the existing logo placeholder.

Include subtle visual elements inspired by the original logo:

- Cross
- Church
- Youth silhouettes
- Navy wave
- Blue
- Mint
- Orange
- Red

IMPORTANT:

Do not create a completely different illustration.

The visual language should resemble the existing logo.

Keep the decorative elements subtle.

==================================================
10. BIBLE VERSE
==================================================

Include:

"Don't let anyone look down on you because you are young, but set an example for the believers in speech, in life, in love, in faith and in purity."

1 TIMOTHY 4:12

The verse should use:

AMIRI

It should have a distinct spiritual/editorial appearance.

Do not make it look like normal UI body text.

==================================================
11. RIGHT RESET CARD
==================================================

Create a large white card.

Properties:

- White background
- Moderate border radius
- Subtle shadow
- Generous padding
- Clean spacing
- No glassmorphism
- No excessive gradients

At the top:

Lock/security icon.

Use a mint outline/icon.

==================================================
12. RESET HEADER
==================================================

English:

Reset Your Password

Subtitle:

Almost there! Create your new password.

Highlight:

new password

using Mint.

==================================================
13. PROGRESS INDICATOR
==================================================

Display three steps horizontally:

1. Enter Email
2. Check Email
3. Reset Password

Current step:

STEP 3

Steps 1 and 2:

Completed

Step 3:

Active

Use:

- Mint for completed/active
- Light gray for inactive
- Navy/dark text for labels

Connect the steps with thin dotted/dashed lines.

Keep it visually clean.

==================================================
14. NEW PASSWORD FIELD
==================================================

Label:

New Password

Placeholder:

Enter your new password

Include:

Lock icon

Eye / EyeOff toggle

Password visibility must actually work.

==================================================
15. PASSWORD REQUIREMENTS
==================================================

Display password requirements below the field.

Requirements:

✓ At least 8 characters long
✓ Include uppercase and lowercase letters
✓ Include at least one number
✓ Include at least one special character

Requirements should update dynamically as the user types.

Valid:

Mint check icon.

Invalid:

Neutral/error state according to the existing design system.

Do not use aggressive red unless the requirement is explicitly invalid.

==================================================
16. CONFIRM PASSWORD
==================================================

Label:

Confirm New Password

Placeholder:

Confirm your new password

Include:

Lock icon

Eye / EyeOff toggle

Validate matching passwords.

If passwords don't match:

Display an accessible error message.

==================================================
17. PRIMARY CTA
==================================================

Button:

RESET PASSWORD

Use:

background: #253D63

color: white

Full width.

Include a Lock icon.

Button states:

- Normal
- Hover
- Focus
- Disabled
- Loading

Loading state:

Show a small spinner and:

Resetting...

Do not allow multiple submissions.

==================================================
18. BACK TO LOGIN
==================================================

Below the main button:

OR

Then secondary button:

← BACK TO LOGIN

Use:

White background
Navy border
Navy text

Do not make this button visually stronger than the primary CTA.

==================================================
19. AUTHENTICATION LOGIC
==================================================

IMPORTANT:

Do not fake backend functionality.

Inspect the existing authentication implementation.

If the project already has a password-reset API:

Connect this page to the existing API.

Use the token/reset-token already provided by the existing authentication flow.

Do not invent endpoints.

Do not invent request formats.

Do not hardcode fake success responses.

If the backend integration does not exist yet:

Create a clean service boundary/interface so the backend can be connected later.

Keep the UI functional and properly isolated.

==================================================
20. VALIDATION
==================================================

Implement:

- Required password
- Password strength
- Confirm password
- Password match
- Token validity if handled by frontend
- API errors
- Loading state
- Success state

Use clear user-friendly messages.

English examples:

"Please enter a new password."

"Password must contain at least 8 characters."

"Passwords do not match."

"This reset link is invalid or has expired."

"Your password has been reset successfully."

==================================================
21. SUCCESS STATE
==================================================

After successful password reset, provide a clean success state.

Example:

Password Reset Successfully

"Your password has been updated. You can now sign in with your new password."

CTA:

BACK TO LOGIN

Keep the same brand identity.

Do not navigate away before the user understands the result unless the existing authentication flow requires it.

==================================================
22. ERROR STATE
==================================================

If the reset token is invalid/expired:

Display a branded error state.

Example:

Reset Link Expired

"This password reset link is no longer valid. Please request a new password reset link."

CTA:

REQUEST NEW RESET LINK

Secondary:

BACK TO LOGIN

Use the existing brand colors.

==================================================
23. FOOTER / BENEFITS
==================================================

Maintain the visual footer from the reference.

Four benefits:

SAFE & SECURE

Your information is protected and will never be shared.

YOUTH COMMUNITY

Connect with other young believers and leaders.

GROW IN FAITH

Access resources, events, and spiritual encouragement.

MAKE AN IMPACT

Discover opportunities to serve and lead.

Use icons:

ShieldCheck
Users
Heart
Flame

Use brand accents:

Safe & Secure → Mint
Youth Community → Blue
Grow in Faith → Orange
Make an Impact → Red

Footer background:

#253D63

==================================================
24. ARABIC VERSION
==================================================

The SAME page must have a fully native Arabic RTL version.

Do NOT simply translate the English page.

Implement proper RTL layout.

Use:

dir="rtl"

lang="ar"

The entire layout must naturally flow from right to left.

==================================================
25. ARABIC BRAND PANEL
==================================================

Use:

إجتماع الشباب بأبنوب

Main message:

إيمان.
صداقات.
هدف.

Use:

إيمان → Navy

صداقات → Navy

هدف → Mint

Supporting text:

"مكان يلتقي فيه شباب اليوم بالله، ويبنون صداقات حقيقية، ويكتشفون هدفهم في الحياة."

==================================================
26. ARABIC RESET HEADER
==================================================

Heading:

إعادة تعيين كلمة المرور

Subtitle:

أنت على بعد خطوة واحدة! أنشئ كلمة مرور جديدة.

Highlight:

كلمة مرور جديدة

with Mint.

==================================================
27. ARABIC PROGRESS
==================================================

Use:

1. أدخل البريد الإلكتروني
2. تحقق من بريدك
3. إعادة تعيين كلمة المرور

Step 3 is active.

Steps 1 and 2 are completed.

==================================================
28. ARABIC PASSWORD FORM
==================================================

Label:

كلمة المرور الجديدة

Placeholder:

أدخل كلمة المرور الجديدة

Requirements:

✓ يجب أن تكون 8 أحرف على الأقل
✓ تحتوي على أحرف كبيرة وصغيرة
✓ تحتوي على رقم واحد على الأقل
✓ تحتوي على رمز خاص واحد على الأقل

Second field:

تأكيد كلمة المرور الجديدة

Placeholder:

أكد كلمة المرور الجديدة

CTA:

إعادة تعيين كلمة المرور

Secondary:

العودة إلى تسجيل الدخول

Divider:

أو

==================================================
29. ARABIC VALIDATION
==================================================

Use natural Arabic messages.

Examples:

"يرجى إدخال كلمة المرور الجديدة."

"يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل."

"كلمتا المرور غير متطابقتين."

"رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية."

"تم تغيير كلمة المرور بنجاح."

==================================================
30. ARABIC BIBLE VERSE
==================================================

Use:

"لا يدع أحدٌ أحدًا يحتقرك لأنك شاب، بل كن قدوة للمؤمنين في الكلام، في السلوك، في المحبة، في الإيمان، في الطهارة."

1 تيموثاوس 4:12

Use:

Amiri

Do not use Markazi Text for the Bible verse.

==================================================
31. ARABIC FOOTER
==================================================

آمن وموثوق

نحافظ على سرية بياناتك ولا نشاركها مع أي جهة.

مجتمع الشباب

تواصل مع شباب يشاركونك الإيمان وينمون معًا في المحبة والخدمة.

النمو في الإيمان

موارد وفعاليات وتشجيع روحي لنمو علاقتك مع الله.

صنع تأثير

اكتشف فرصًا للخدمة والقيادة والتأثير من أجل الآخرين.

==================================================
32. RTL TECHNICAL RULES
==================================================

Do NOT implement RTL by simply applying:

text-align: right;

The actual layout must be RTL.

Use:

direction: rtl;

Prefer CSS logical properties:

margin-inline
padding-inline
inset-inline
border-inline

Avoid unnecessary:

margin-left
margin-right
left
right

Icons must also be positioned naturally for RTL.

Directional arrows should point in the correct direction.

==================================================
33. RESPONSIVE DESIGN
==================================================

Desktop:

Two-column layout.

Tablet:

Maintain the two-column composition where practical but reduce spacing.

Mobile:

Stack naturally:

Logo
↓
Brand message
↓
Bible verse
↓
Reset card
↓
Benefits
↓
Footer

The form must remain easy to use.

Inputs must not become too narrow.

Progress indicators may become compact or vertically arranged if necessary.

Do not simply scale down the desktop screenshot.

Recompose intelligently.

==================================================
34. ANIMATIONS
==================================================

STRICTLY MINIMAL.

Allowed:

- subtle fade-in
- subtle slide-up
- button hover
- input transitions
- password requirement transitions

Do NOT use:

- 3D
- particles
- WebGL
- parallax
- animated gradients
- floating elements
- excessive Framer Motion
- continuous animation

The website should feel:

CALM
WELCOMING
SPIRITUAL
MODERN

==================================================
35. COMPONENT ARCHITECTURE
==================================================

Create reusable components where appropriate.

Suggested:

ResetPasswordPage
BrandPanel
AuthCard
AuthProgress
PasswordField
PasswordRequirements
ResetPasswordForm
AuthFooter
SuccessState
ErrorState

Do not create unnecessary abstraction.

Keep components readable.

==================================================
36. CODE QUALITY
==================================================

Use:

- TypeScript
- Strong typing
- Reusable components
- Clean naming
- Small focused functions
- No duplicated markup
- No magic values where design tokens already exist
- No unnecessary dependencies

Use existing project conventions.

==================================================
37. DESIGN TOKENS
==================================================

If the project has existing CSS variables/design tokens, reuse them.

Otherwise create centralized tokens for:

--brand-navy: #253D63
--brand-blue: #2672B0
--brand-mint: #53CB9E
--brand-orange: #F96702
--brand-red: #9E150B

Do not scatter raw hex values throughout dozens of components.

==================================================
38. DO NOT BREAK EXISTING FEATURES
==================================================

Do not modify unrelated authentication pages.

Do not break:

- Login
- Registration
- Forgot Password
- Check Email
- Routing
- Existing API calls

Reuse the authentication flow already established.

==================================================
39. FINAL VERIFICATION
==================================================

Before finishing:

1. Run the development server.
2. Verify the page loads.
3. Verify no console errors.
4. Verify no TypeScript errors.
5. Verify fonts load.
6. Verify logo placeholder loads.
7. Verify password visibility.
8. Verify password validation.
9. Verify password confirmation.
10. Verify loading state.
11. Verify API error state.
12. Verify success state.
13. Verify responsive behavior.
14. Verify RTL behavior.
15. Compare the page visually against the attached screenshot.

Fix discrepancies in:

- spacing
- proportions
- typography
- alignment
- colors
- card dimensions
- buttons
- inputs
- progress indicator
- footer

==================================================
40. FINAL RULE
==================================================

DO NOT redesign.

DO NOT invent.

DO NOT over-animate.

DO NOT replace the brand.

DO NOT replace the fonts.

DO NOT replace the colors.

DO NOT generate a new logo.

DO NOT create fake backend behavior.

IMPLEMENT THE PROVIDED DESIGN.

The final result should feel like the official authentication experience of:

"إجتماع الشباب بأبنوب"

and should seamlessly fit with the existing registration, login, forgot-password, and check-email screens.