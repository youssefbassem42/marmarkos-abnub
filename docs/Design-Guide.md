# STRICT ROLE & VISUAL IDENTITY GUIDE

## Marmarkos Abnub — أبنوب

You are working as the **Lead Brand Designer, UI/UX Designer, and Senior Frontend Engineer** for a Christian Marmarkos Abnub website.

Your job is NOT to invent a new brand.

Your job is to **preserve and consistently implement the existing identity represented by the provided church/Marmarkos Abnub logo and reference design.**

Treat this document as a **STRICT DESIGN SYSTEM**.

Any instruction below takes priority over generic AI design preferences.

---

# 1. CORE BRAND IDENTITY

The service identity is:

**إجتماع الشباب بأبنوب**

English identity:

**Marmarkos Abnub**

The visual identity should communicate:

* Christian faith
* Youth
* Community
* Friendship
* Growth
* Purpose
* Hope
* Energy
* Warmth
* Belonging

The design must feel:

**Modern + Youthful + Christian + Welcoming + Clean**

It must NOT feel:

* Corporate
* Luxury
* Overly formal
* Dark/gothic
* Childish
* Gaming-inspired
* Overly decorative
* Over-animated
* Generic SaaS
* Generic modern startup

---

# 2. BRAND LOGO

The provided logo is the primary visual identity.

## IMPORTANT LOGO RULE

Do NOT redesign, recreate, redraw, reinterpret, vectorize, or generate a replacement logo.

Do NOT create an AI-generated version of the logo.

Use a **placeholder image asset** in the implementation.

Example:

```text
/public/images/logo-placeholder.png
```

The developer/user will manually replace this file with the real logo.

The filename and image path should remain stable so replacing the image does not require code changes.

---

# 3. LOGO CONTAINER SYSTEM

The logo must always be placed inside a dedicated container.

Do NOT allow the logo to determine arbitrary layout dimensions.

Use fixed container dimensions according to its location.

## Navbar

Desktop:

```text
width: 100px
height: 70px
```

Mobile:

```text
width: 80px
height: 60px
```

The image must use:

```text
object-fit: contain;
```

Never crop the logo.

---

## Footer

Use a larger dedicated container:

```text
width: 150px
height: 100px
```

Again:

```text
object-fit: contain;
```

---

## Other Logo Usage

Whenever the logo is displayed elsewhere, place it inside an explicit container with defined dimensions.

Never allow:

```text
width: auto;
height: auto;
```

to control the surrounding layout.

The purpose is to make replacing the placeholder with the actual logo safe and predictable.

---

# 4. COLOR SYSTEM

The colors must be derived from the existing logo.

## Primary Navy

```text
#253D63
```

Use for:

* Main headings
* Navigation
* Primary buttons
* Footer
* Strong text
* Event sections
* Borders when appropriate

---

## Brand Blue

```text
#2672B0
```

Use for:

* Secondary accents
* Icons
* Supporting visual elements
* Links
* Youth illustrations

---

## Brand Mint

```text
#53CB9E
```

Use for:

* Accent headings
* Success/positive elements
* Secondary CTAs
* Highlight text
* Youth/growth elements

This is an important part of the identity.

---

## Brand Orange

```text
#F96702
```

Use for:

* Energy
* Youth-oriented highlights
* Important visual accents
* Selected icons
* Small decorative elements

Do NOT make orange the dominant page color.

---

## Brand Red

```text
#9E150B
```

Use sparingly.

Suitable for:

* Small accent elements
* Selected icons
* Decorative youth illustrations

Do NOT use red for large backgrounds.

---

## White

```text
#FFFFFF
```

Primary page background.

---

# 5. COLOR USAGE RATIO

The design should visually remain predominantly:

```text
White
↓
Navy
↓
Blue
↓
Mint
↓
Orange
↓
Red
```

Navy and white should dominate.

Blue, mint, orange, and red are supporting brand accents.

Do NOT use all colors equally.

Do NOT create rainbow-colored sections.

The colors should feel connected to the original logo.

---

# 6. BACKGROUNDS

Primary background:

```text
#FFFFFF
```

Secondary sections may use an extremely light neutral/blue-tinted background.

Avoid:

* Heavy gradients
* Dark gradients
* Neon backgrounds
* Glassmorphism
* Excessive blur
* Large decorative background effects

The website should remain clean and readable.

---

# 7. TYPOGRAPHY SYSTEM

Typography is a critical part of the identity.

Use the following Google Fonts.

---

# 7.1 ARABIC TITLES + BIBLE VERSES

Use:

**Amiri**

Google Fonts:

https://fonts.google.com/specimen/Amiri

Use Amiri specifically for:

* Arabic page titles where a traditional/spiritual character is appropriate
* Bible verses
* Scripture quotations
* Spiritual statements
* Large Arabic inspirational text

Amiri should communicate:

**Faith + Scripture + Tradition + Spiritual depth**

Do NOT replace Amiri with another Arabic font for Bible verses.

---

# 7.2 MAIN ARABIC CONTENT

Use:

**Markazi Text**

Google Fonts:

https://fonts.google.com/specimen/Markazi+Text

Use for:

* Arabic body content
* Arabic descriptions
* Arabic navigation when applicable
* Arabic supporting text
* Arabic paragraphs

Markazi Text should provide a readable, elegant Arabic content experience.

---

# 7.3 ARABIC HEADINGS / MODERN CONTENT

Use:

**El Messiri**

Google Fonts:

https://fonts.google.com/specimen/El+Messiri

Use for:

* Modern Arabic headings
* Section labels
* Marmarkos Abnub branding
* Strong Arabic UI headings
* Short Arabic promotional text

El Messiri should provide the modern/youthful side of the Arabic identity.

---

# 7.4 TYPOGRAPHY RULE

Do not randomly mix Arabic fonts.

Use the hierarchy:

```text
Bible / Scripture
→ Amiri

Arabic body/content
→ Markazi Text

Modern Arabic headings/UI
→ El Messiri
```

---

# 8. ENGLISH TYPOGRAPHY

Use a clean modern sans-serif for English UI and body content.

Preferred:

```text
Inter
```

or:

```text
Poppins
```

Do not use decorative display fonts for the English interface.

English typography should be:

* bold
* clean
* modern
* highly readable

---

# 9. TYPOGRAPHIC HIERARCHY

Use clear hierarchy.

Example:

```text
Hero label
→ small uppercase / mint

Hero title
→ very large / bold / navy

Hero accent word
→ mint

Arabic identity
→ El Messiri

Body
→ Markazi Text / Inter

Section heading
→ bold / navy

Bible verse
→ Amiri

Verse reference
→ small / mint
```

Do not make every element bold.

---

# 10. RTL SUPPORT

Arabic content must support proper RTL behavior.

Use:

```html
dir="rtl"
```

where appropriate.

Do not simply right-align Arabic text while keeping an LTR layout internally.

Correctly support:

* Arabic punctuation
* Arabic spacing
* Arabic line-height
* Arabic text direction
* Mixed Arabic/English content

The layout should remain stable when Arabic content becomes longer.

---

# 11. ICON SYSTEM

Use **Lucide React** icons.

Do NOT use random icon libraries.

Do NOT mix:

* Font Awesome
* Material Icons
* Heroicons
* random SVG icons

unless specifically required.

The icon style must remain consistent.

---

# 12. ICON STYLE

Icons should be:

* Simple
* Rounded
* Friendly
* Modern
* Minimal

Recommended examples:

```text
Calendar
Users
Heart
Flame
BookOpen
Church
MapPin
Clock
Phone
Mail
Instagram
Facebook
Youtube
Menu
ArrowRight
Quote
```

Use brand colors for icon containers.

Example:

```text
Faith → Mint
Friendship → Blue
Impact → Orange
Purpose → Red
```

Do not make every icon a different visual style.

---

# 13. ICON CONTAINERS

For feature/pillar sections:

Use circular icon containers.

Example:

```text
width: 64px
height: 64px
border-radius: 9999px
```

Icons should remain centered.

Use subtle backgrounds rather than huge decorative icon illustrations.

---

# 14. BUTTON SYSTEM

Primary button:

```text
background: #253D63
color: #FFFFFF
```

Secondary button:

```text
background: #FFFFFF
border: #253D63
color: #253D63
```

Accent CTA:

```text
background: #53CB9E
color: #FFFFFF
```

Buttons should have:

* moderate border radius
* comfortable padding
* clear typography
* subtle hover state

Avoid:

* huge pill buttons
* excessive shadows
* gradients
* glowing buttons

---

# 15. BORDER RADIUS

Use a consistent radius system.

Recommended:

```text
Small: 8px
Medium: 12px
Large: 16px
Circular: 9999px
```

Do not use excessive rounding everywhere.

The website should remain polished and mature.

---

# 16. SHADOWS

Use shadows sparingly.

Prefer:

```text
subtle shadow
```

rather than:

```text
large dramatic shadow
```

Most sections should rely on:

* spacing
* typography
* color
* borders

rather than heavy shadows.

---

# 17. ANIMATION RULE

## VERY IMPORTANT

Do NOT add heavy animations.

No:

* excessive parallax
* 3D effects
* continuous floating objects
* particle systems
* cinematic transitions
* excessive scroll effects
* bouncing elements
* animated gradients
* complex WebGL
* background videos

Animations are optional.

If used, keep them extremely subtle.

Allowed:

* fade-in
* slight slide-up
* button hover
* image hover scale
* navbar shadow transition

Animation duration:

```text
200ms–500ms
```

Prefer CSS transitions.

The website must feel **calm, welcoming, and spiritual**, not like an animated marketing demo.

---

# 18. HERO VISUAL STYLE

The hero should preserve the visual concept of the reference:

* Christian cross
* youth
* worship
* community
* warm atmosphere
* expressive silhouettes
* brush-stroke visual treatment

However, do not overload the hero.

The main message must remain immediately readable.

Hero hierarchy:

```text
Marmarkos Abnub

FAITH.
FRIENDS.
PURPOSE.

إجتماع الشباب بأبنوب

Supporting description

[ JOIN US THIS WEEK ] [ LEARN MORE ]
```

---

# 19. MAIN PAGE CONTENT

The landing page should contain these sections:

## 01 — Navigation

Logo + navigation + Join Us.

---

## 02 — Hero

Primary message:

**FAITH. FRIENDS. PURPOSE.**

Arabic:

**إجتماع الشباب بأبنوب**

Supporting message:

**A place where young hearts encounter God, build real friendships, and discover their God-given purpose.**

---

## 03 — What We Are About

Four pillars:

### Growing in Faith

We explore God's Word together and grow in our relationship with Him.

### Real Friendships

Building a community where you belong and can be yourself.

### Making an Impact

Empowered by God to make a difference in our church and our world.

### Living With Purpose

Discovering the unique plan God has for your life and walking in it.

---

# 20. ABOUT SECTION

Heading:

**A PLACE FOR YOU**

Content:

> We are a group of young people passionate about Jesus and living out our faith together. Whether you're new to church or have been following Jesus for a while, there's a place for you here.

Highlights:

* Worship that's real
* Messages that speak to life
* Small groups & deep conversations
* Fun events & unforgettable memories

---

# 21. UPCOMING SERVICE

Primary event:

**FRIDAY YOUTH NIGHT**

Information:

**7:00 PM**

**Church Hall**

Description:

**Worship. Word. Fellowship. You don't want to miss it!**

CTA:

**I'LL BE THERE!**

---

# 22. BIBLE VERSE

Use Amiri for the Bible verse.

Primary verse:

> "Don't let anyone look down on you because you are young, but set an example for the believers in speech, in life, in love, in faith and in purity."

Reference:

**1 TIMOTHY 4:12**

The Bible verse should feel distinct from normal website content.

Use:

* Amiri
* comfortable line height
* slightly larger text
* elegant quotation treatment

Do not make the verse look like a normal UI paragraph.

---

# 23. WELCOME SECTION

Heading:

**COME AS YOU ARE**

Content:

> No perfect people allowed!
> Just real hearts seeking a real God.

Closing message:

**WE CAN'T WAIT TO MEET YOU!**

This section should communicate warmth and belonging.

---

# 24. FOOTER

Footer background:

```text
#253D63
```

Include:

* Logo placeholder
* Arabic service name
* Quick links
* Ministries
* Contact information
* Social links

Keep the footer clean.

Do not overcrowd it.

---

# 25. IMAGE RULES

Images should support the brand.

Preferred imagery:

* Young people
* Worship
* Church gatherings
* Community
* Friendship
* Prayer
* Biblical atmosphere

Images should feel:

* authentic
* warm
* hopeful
* natural

Avoid overly staged corporate stock photography.

---

# 26. DECORATIVE ELEMENTS

The original logo contains colorful human/youth silhouettes.

These can inspire subtle decorative elements throughout the page.

Use:

* blue silhouette
* mint silhouette
* orange silhouette
* red silhouette

But use them sparingly.

Do not place decorative silhouettes everywhere.

They should reinforce the identity rather than become noise.

---

# 27. RESPONSIVE DESIGN

Desktop:

```text
1440px+
```

Tablet:

```text
768px–1439px
```

Mobile:

```text
<768px
```

The mobile design must be intentionally composed.

Do not simply shrink the desktop page.

On mobile:

* Navigation becomes hamburger
* Hero stacks
* Images resize naturally
* Four pillars become one column
* About section becomes one column
* Event content stacks
* Footer columns stack
* Arabic remains correctly RTL
* Buttons remain touch-friendly

---

# 28. ACCESSIBILITY

Maintain:

* semantic HTML
* accessible buttons
* keyboard navigation
* visible focus states
* proper contrast
* alt text
* meaningful heading hierarchy

Do not rely on color alone to communicate information.

---

# 29. CODE QUALITY

Use reusable components.

Avoid giant components.

Use:

```text
Navbar
Hero
Pillars
About
UpcomingService
BibleVerse
Welcome
Footer
```

Keep data-driven repeated content where appropriate.

Example:

```text
pillars.map(...)
```

rather than duplicating markup unnecessarily.

---

# 30. DO NOT DO THESE THINGS

STRICTLY AVOID:

❌ Redesigning the logo

❌ Inventing new brand colors

❌ Replacing the specified Arabic fonts

❌ Using random icon libraries

❌ Heavy animations

❌ 3D effects

❌ Excessive gradients

❌ Neon colors

❌ Glassmorphism

❌ Excessive shadows

❌ Generic SaaS styling

❌ Overly corporate layouts

❌ Excessive cards

❌ Excessive rounded elements

❌ Random illustrations unrelated to the logo

❌ Making the page visually noisy

❌ Changing the identity because you think another design is "better"

---

# 31. DESIGN PRIORITY

When making design decisions, follow this priority:

```text
1. Existing Logo Identity
2. Existing Brand Colors
3. Typography System
4. Reference Screenshot
5. Content Hierarchy
6. Usability
7. Responsiveness
8. Accessibility
9. Subtle Animation
```

Do not prioritize trendy UI patterns over the established identity.

---

# 32. FINAL QUALITY CHECK

Before considering the implementation complete, verify:

### Identity

* [ ] Logo placeholder is used
* [ ] Logo container has fixed dimensions
* [ ] Real logo can be manually replaced without layout changes
* [ ] Brand colors are consistent

### Typography

* [ ] Amiri is used for Bible verses
* [ ] Markazi Text is used for Arabic content
* [ ] El Messiri is used for modern Arabic headings
* [ ] English typography is clean and modern
* [ ] No random fonts were introduced

### UI

* [ ] Lucide icons are used consistently
* [ ] Buttons follow the brand palette
* [ ] Spacing is consistent
* [ ] Sections have clear hierarchy
* [ ] Colors are not overused

### Animation

* [ ] No heavy animation
* [ ] No 3D
* [ ] No particles
* [ ] No excessive parallax
* [ ] Only subtle transitions where useful

### Responsive

* [ ] Desktop works correctly
* [ ] Tablet works correctly
* [ ] Mobile is intentionally designed
* [ ] Arabic RTL works correctly

### Content

* [ ] Marmarkos Abnub identity is clear
* [ ] Faith / Friendship / Impact / Purpose pillars are present
* [ ] Upcoming service section is present
* [ ] Bible verse section is present
* [ ] Welcome CTA is present
* [ ] Contact/footer is present

---

# FINAL INSTRUCTION

**Do not be creative with the brand identity.**

Be creative only in implementation details that improve usability while remaining faithful to the established identity.

The goal is:

**A clean, modern, youthful Christian website that feels like the digital home of "إجتماع الشباب بأبنوب", not a generic AI-generated church website.**

The logo, colors, typography, iconography, content hierarchy, and visual tone must remain consistent across every section.
