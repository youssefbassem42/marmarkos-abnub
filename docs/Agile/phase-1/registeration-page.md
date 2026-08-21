# ROLE

You are a **Senior Frontend Engineer + UI/UX Engineer + Arabic RTL Specialist**.

You are implementing the **Youth Service — إجتماع الشباب بأبنوب** registration experience.

The project already contains a **design guide Markdown file** created specifically for this project.

Your first responsibility is to **read and strictly follow that design guide**.

Do not invent a new visual identity.

Do not redesign the brand.

Do not replace the established colors, fonts, icon style, spacing principles, or visual language with your own preferences.

---

# 1. FIRST: INSPECT THE PROJECT

Before writing or modifying code:

1. Inspect the existing project structure.
2. Find and read the existing **design guide `.md` file**.
3. Identify the current frontend framework and styling setup.
4. Identify existing reusable components.
5. Identify existing routing/layout structure.
6. Identify whether authentication/API integration already exists.
7. Reuse existing components and conventions wherever possible.
8. Do NOT unnecessarily rewrite existing code.

If the design guide contains a newer or more specific rule than this prompt, **the design guide takes priority**.

---

# 2. PRIMARY TASK

Implement the complete **Arabic Registration Page** shown by the provided reference design.

The page is for:

**إجتماع الشباب بأبنوب**

The implementation must be:

* Arabic-first
* RTL
* Responsive
* Clean
* Production-quality
* Accessible
* Componentized
* Maintainable
* Consistent with the existing project
* Strictly aligned with the design guide

The result should visually resemble the provided reference image while following the project's actual design system.

---

# 3. LANGUAGE

The registration page must be **Arabic**.

Use:

```html
dir="rtl"
lang="ar"
```

where appropriate.

All visible UI text should be Arabic.

Do NOT leave English placeholder UI text such as:

* First Name
* Last Name
* Email
* Password
* Create Account

Translate them properly into Arabic.

Use natural Egyptian/Modern Standard Arabic suitable for a church youth service.

---

# 4. ARABIC TYPOGRAPHY

Use the exact fonts specified in the design guide.

## Bible verses

Use:

**Amiri**

Google Fonts:

https://fonts.google.com/specimen/Amiri

Use Amiri for:

* Bible verses
* Scripture quotations
* Scripture references where appropriate
* Spiritual quotation sections

---

## Arabic content

Use:

**Markazi Text**

Google Fonts:

https://fonts.google.com/specimen/Markazi+Text

Use for:

* Body text
* Descriptions
* Supporting content
* Form helper text where appropriate

---

## Modern Arabic headings

Use:

**El Messiri**

Google Fonts:

https://fonts.google.com/specimen/El+Messiri

Use for:

* Main headings
* Section headings
* Registration heading
* Brand messaging
* Important Arabic UI headings

---

# 5. DO NOT MIX FONTS RANDOMLY

Follow this hierarchy:

```text
Bible / Scripture
→ Amiri

Arabic body/content
→ Markazi Text

Modern Arabic headings/UI
→ El Messiri
```

Do not introduce another Arabic font.

Do not allow browser fallback fonts to become the primary visual font.

Load the fonts correctly through the project's preferred font-loading mechanism.

---

# 6. BRAND IDENTITY

The page belongs to:

**إجتماع الشباب بأبنوب**

Preserve the existing identity from the design guide and logo.

Primary colors:

```text
Navy   #253D63
Blue   #2672B0
Mint   #53CB9E
Orange #F96702
Red    #9E150B
White  #FFFFFF
```

Use the colors according to the design guide.

General priority:

```text
White + Navy
        ↓
Blue
        ↓
Mint
        ↓
Orange
        ↓
Red
```

Do NOT make the page rainbow-colored.

Do NOT use gradients as the main visual identity.

Do NOT invent additional brand colors unless required for accessibility or form states.

---

# 7. LOGO

Do NOT recreate or generate the logo.

Do NOT modify the logo.

Use the existing placeholder:

```text
/public/images/logo-placeholder.png
```

If the project already has another placeholder path defined by the design guide, use that instead.

The developer/user will manually replace the placeholder with the real logo.

The logo must be inside a fixed-size container.

Never allow the logo to unexpectedly change the layout.

Use:

```css
object-fit: contain;
```

Never crop or distort it.

---

# 8. PAGE STRUCTURE

Implement the registration experience as a polished two-part composition.

## Desktop

Use approximately:

```text
Left / Brand Panel
+
Right / Registration Form
```

The brand panel should communicate:

**Faith + Friends + Purpose**

The registration panel should be the primary interactive area.

---

# 9. BRAND / LEFT PANEL

Create a visually strong but clean brand panel.

Include:

### Logo

Use the logo placeholder inside its fixed container.

---

### Service identity

Display:

**إجتماع الشباب بأبنوب**

Use **El Messiri**.

Use the mint brand color as an accent.

---

### Main message

Use the Arabic equivalent of:

**إيمان.
صداقات.
هدف.**

Visually emphasize the three concepts.

Recommended:

```text
إيمان.
صداقات.
هدف.
```

Use:

* Navy for the first two
* Mint for the final word

Do not over-style the text.

---

### Supporting message

Use:

> انضم إلى مجتمع من الشباب ينمو معًا في الإيمان والمحبة والخدمة.

Use Markazi Text.

---

# 10. VISUAL BRAND ELEMENTS

The left panel may include subtle visual references to the existing logo:

* Cross
* Church
* Youth silhouettes
* Navy wave
* Mint/blue/orange/red figures

Do not create a completely new illustration system.

If assets are unavailable:

Use clean placeholders or simple CSS shapes.

Do NOT spend time generating complex artwork.

The identity should remain recognizable even without the final images.

---

# 11. BIBLE VERSE

Include the Bible verse from the reference:

> لا يدع أحدًا يحتقرك لأنك شاب، بل كن قدوة للمؤمنين في الكلام، في السلوك، في المحبة، في الإيمان، في الطهارة.

Reference:

**١ تيموثاوس ٤:١٢**

Use:

**Amiri**

The verse should visually feel different from normal UI content.

Use:

* elegant typography
* comfortable line height
* quotation mark
* mint accent

Do not make it look like a normal form description.

---

# 12. REGISTRATION CARD

Create a large white registration card.

The card should have:

* generous padding
* subtle border/shadow
* moderate rounded corners
* clean hierarchy
* excellent readability

Do not make the card excessively rounded.

Do not use glassmorphism.

Do not use heavy shadows.

---

# 13. REGISTRATION HEADER

Heading:

**إنشاء حساب جديد**

Use:

**El Messiri**

Subheading:

> انضم إلينا وكن جزءًا مما يفعله الله!

Use Markazi Text.

Add a simple user/account icon using **Lucide React**.

Use the mint brand color.

---

# 14. FORM FIELDS

Implement the following fields.

## الاسم الأول

Placeholder:

**أدخل اسمك الأول**

---

## اسم العائلة

Placeholder:

**أدخل اسم العائلة**

---

## البريد الإلكتروني

Placeholder:

**أدخل بريدك الإلكتروني**

---

## كلمة المرور

Placeholder:

**أنشئ كلمة مرور**

Include show/hide password functionality.

Use:

* Eye
* EyeOff
* Lock

from Lucide React.

---

## تأكيد كلمة المرور

Placeholder:

**أكد كلمة المرور**

Include show/hide functionality.

---

## تاريخ الميلاد

Placeholder:

**اختر تاريخ ميلادك**

Use a calendar icon.

---

## رقم الهاتف

Label:

**رقم الهاتف (اختياري)**

Placeholder:

**أدخل رقم هاتفك**

Use a phone icon.

---

## أنا

Create a select field.

Example options:

* شاب
* خادم
* قائد
* أخرى

Use a clean accessible select.

---

## كيف سمعت عنا؟

Create a select field.

Options:

* صديق
* اجتماع الكنيسة
* وسائل التواصل الاجتماعي
* فعالية
* أخرى

---

# 15. FORM LAYOUT

Desktop:

Use two-column fields where appropriate.

Example:

```text
الاسم الأول          اسم العائلة

البريد الإلكتروني    [full width]

كلمة المرور          تأكيد كلمة المرور

تاريخ الميلاد        رقم الهاتف

أنا                   كيف سمعت عنا؟
```

The email field should have enough width.

On mobile:

Everything becomes one column.

Do NOT squeeze fields to preserve the desktop layout.

---

# 16. TERMS CHECKBOX

Include:

**أوافق على الشروط والأحكام وسياسة الخصوصية**

The terms and privacy policy should be clickable links.

Use a proper accessible checkbox.

Do not automatically check it.

The registration button must remain disabled until the required agreement is accepted if that matches the existing application logic.

---

# 17. PRIMARY CTA

Button:

**إنشاء حساب**

Use:

```text
background: #253D63
color: #FFFFFF
```

Include a small appropriate Lucide icon.

The button should:

* have a clear hover state
* have a focus state
* have disabled state
* show loading state during submission

Avoid excessive animations.

---

# 18. SOCIAL REGISTRATION

Below the primary registration button:

Create a divider:

**أو**

Then:

**التسجيل باستخدام Google**

and, if supported by the existing application:

**التسجيل باستخدام Facebook**

Use appropriate icons.

Do NOT fake authentication functionality.

If the project already has OAuth endpoints, connect them properly.

If OAuth is not implemented yet, create clean UI placeholders and clearly isolate the integration point.

Do not invent backend endpoints.

---

# 19. LOGIN LINK

At the bottom of the registration card:

> لديك حساب بالفعل؟ **سجل الدخول من هنا**

The login link should use the mint brand color.

If a login route already exists:

Use the existing route.

Do not create duplicate authentication routes.

---

# 20. FORM VALIDATION

Implement clean client-side validation.

Required:

* First name
* Last name
* Email
* Password
* Confirm password
* Date of birth if required by existing requirements
* Terms agreement

Validation should provide Arabic messages.

Examples:

```text
هذا الحقل مطلوب

يرجى إدخال بريد إلكتروني صحيح

كلمة المرور يجب أن تحتوي على ...

كلمتا المرور غير متطابقتين

يجب الموافقة على الشروط والأحكام
```

Do not expose technical errors to users.

---

# 21. ACCESSIBILITY

Use:

* semantic `<form>`
* `<label>`
* accessible inputs
* keyboard navigation
* visible focus states
* proper error messages
* aria attributes when needed
* sufficient contrast

Do not rely only on color for errors.

---

# 22. ICON SYSTEM

Use **Lucide React only** for UI icons.

Examples:

```text
User
Mail
Lock
Eye
EyeOff
Calendar
Phone
ChevronDown
UserPlus
ShieldCheck
Users
Heart
Flame
BookOpen
Quote
```

Keep all icons visually consistent.

Do not mix icon libraries.

---

# 23. BOTTOM BENEFITS SECTION

Add a navy section beneath/around the main registration composition.

Create four concise benefits:

### آمن وموثوق

> نحافظ على سرية بياناتك ولا نشاركها مع أي جهة.

Icon:

ShieldCheck

Color:

Mint

---

### مجتمع الشباب

> تواصل مع شباب يشاركونك الإيمان وينمون معًا.

Icon:

Users

Color:

Blue

---

### النمو في الإيمان

> موارد وفعاليات وتشجيع روحي لنمو علاقتك مع الله.

Icon:

Heart

Color:

Orange

---

### صنع تأثير

> اكتشف فرصًا للخدمة والقيادة والتأثير من أجل الآخرين.

Icon:

Flame

Color:

Red

---

# 24. RESPONSIVE DESIGN

The page must work perfectly on:

* Desktop
* Laptop
* Tablet
* Mobile

Desktop:

Two-column composition.

Tablet:

Adjust proportions naturally.

Mobile:

```text
Logo
↓
Brand message
↓
Bible verse
↓
Registration card
↓
Benefits
```

Do not force a side-by-side layout on small screens.

---

# 25. RTL IMPLEMENTATION

This is extremely important.

Do not implement the page as LTR and merely add:

```css
text-align: right;
```

The layout itself must support RTL.

Use:

```css
direction: rtl;
```

and appropriate logical CSS properties:

```css
margin-inline
padding-inline
inset-inline
border-inline
```

Avoid unnecessary:

```css
margin-left
margin-right
left
right
```

for layout positioning.

Icons that indicate direction should also be considered for RTL.

---

# 26. ANIMATION

Keep animations minimal.

Allowed:

* subtle fade-in
* subtle slide-up
* button hover
* input focus transitions
* very small image hover effect

Do NOT implement:

* 3D
* parallax
* particles
* WebGL
* animated backgrounds
* excessive floating elements
* continuous motion
* complicated Framer Motion sequences

The page should feel:

**calm + welcoming + spiritual + modern**

---

# 27. CLEAN CODE

Follow the existing project's architecture.

Create reusable components such as:

```text
RegistrationPage
BrandPanel
RegistrationCard
RegistrationForm
FormField
PasswordField
SelectField
SocialAuthButtons
BibleVerse
BenefitsSection
```

Do not put the entire page into one huge component.

Use reusable data arrays for repeated fields/cards where appropriate.

Avoid unnecessary abstraction.

---

# 28. DO NOT BREAK EXISTING PROJECT

This is critical.

Before changing anything:

* inspect existing code
* inspect routes
* inspect dependencies
* inspect API services
* inspect authentication logic
* inspect styling system

Do not:

* replace the frontend framework
* replace Tailwind
* rewrite the entire application
* delete existing components
* change unrelated routes
* introduce unnecessary dependencies
* duplicate existing utilities

Only make changes necessary for this feature.

---

# 29. DESIGN GUIDE IS THE SOURCE OF TRUTH

The project contains a Markdown design guide.

You MUST read it before implementation.

Extract from it:

* exact colors
* typography rules
* logo rules
* icon rules
* spacing
* border radius
* animation restrictions
* visual hierarchy
* content rules

If this prompt conflicts with the design guide:

**FOLLOW THE DESIGN GUIDE.**

---

# 30. FINAL VISUAL QUALITY CHECK

After implementation, inspect the result carefully.

Check:

### Identity

* Logo placeholder is correct
* Navy/blue/mint/orange/red are used correctly
* Visual language matches the existing identity

### Typography

* El Messiri → Arabic headings
* Markazi Text → Arabic content
* Amiri → Bible verse
* No random Arabic fonts

### RTL

* Entire page correctly RTL
* Form fields correctly aligned
* Icons positioned correctly
* Responsive layout works correctly

### Form

* All fields are aligned
* Labels are clear
* Validation works
* Password visibility works
* Terms checkbox works
* Loading state works
* Error states work

### Responsive

* Desktop looks balanced
* Tablet works
* Mobile is not cramped
* Registration form remains usable

### Animation

* No heavy animation
* No distracting effects
* Only subtle transitions

---

# 31. IMPORTANT IMPLEMENTATION PRINCIPLE

Do not blindly copy the screenshot if doing so creates bad code.

Use the screenshot as the **visual reference**.

Use the Markdown design guide as the **design-system authority**.

Use the existing project architecture as the **technical authority**.

The final result should be:

**Visually faithful + technically clean + RTL-native + accessible + maintainable.**

---

# 32. BEFORE YOU FINISH

Do not simply generate the page and stop.

Run the project.

Verify that:

* it compiles
* there are no TypeScript errors
* there are no console errors
* routes work
* form interactions work
* responsive layout works
* fonts load correctly
* placeholder logo loads correctly
* no broken images exist

If the project has linting/tests, run them.

Fix any issues you introduce.

---

# FINAL COMMAND

**Read the design guide first. Inspect the existing codebase second. Then implement the Arabic RTL registration page according to the reference design and all rules above.**

Do not redesign the identity.

Do not invent new colors.

Do not replace the specified fonts.

Do not use heavy animations.

Do not create a fake backend.

Do not break existing functionality.

Produce clean, production-ready code that looks like it genuinely belongs to the **إجتماع الشباب بأبنوب** platform.
