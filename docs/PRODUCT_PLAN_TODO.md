# The plan of the points of `TODO.md`

**Status:** ready to execute · **Written:** 2026-10-29 · **Base:** the commit
`9933d0a` (the audit of the codebase is `docs/CODEBASE_AUDIT_REPORT.md`)

This document turns the seven points of `TODO.md` into phases that can be
executed one after the other. Every phase states **what must be true when it
is done** (the requirements), **the tasks** and **the sub-tasks** in the order
they have to be done, the **files** they touch, and **how they are proved**
(the tests).

---

## 0. How to read this document

| The word | What it means |
|---|---|
| **Requirement** | A property that can be checked. "The page works on a phone" is not a requirement; "the page is usable at 360 px and the menu opens with the keyboard" is. |
| **Task** | A unit of work that ends with a commit. **One concern per commit**, always. |
| **Sub-task** | The steps of a task, in the order they must be done. |
| **Acceptance** | The proof that the phase is done: the gate that must be green, and the behaviour that must be visible. |
| **Decision** | A question for the owner. The work **stops** at a decision - nothing is assumed. The open decisions are collected in §12. |

### The rules of the work (they come from the audit, not from taste)

1. **One concern per commit.** The message of the commit says what it changes
   and cites the point of `TODO.md` it belongs to.
2. **The behaviour never breaks.** Every change is additive first: a new
   endpoint before the frontend uses it, a new column before the code reads
   it, a feature flag before the feature is on.
3. **The contract is checked on both sides.** The answer of the API is
   checked with a schema at the edge of the frontend (`frontend/src/lib/schemas/`),
   the types are the inference of the schema, and three guard tests keep the
   two sides in step (`test_frontend_routes_match.py`,
   `test_frontend_schemas_match_dto.py`, `test_dto_fields_are_declared.py`).
   **A new endpoint that the frontend uses must come with its schema.**
4. **The gates stay green.** `ruff`, `ruff format`, `mypy`, `pytest`,
   `prettier`, `eslint --max-warnings 0`, `tsc -b`, `vitest --coverage`,
   `npm run build`, `npm audit`, `alembic check`, the end-to-end run. The
   coverage floors **only go up** (they are 72/61/65/74 for the frontend and
   77 % for the backend today).
5. **The Arabic is the product.** The platform is Arabic only: every new
   string goes to `frontend/src/i18n/resources/ar.ts`, never to a component.
6. **The accessibility is not optional.** Every control has an accessible
   name, every page has one `h1`, the keyboard reaches everything.
7. **The migration is safe.** Additive, with a default; the downgrade is
   written; the migrations run behind the PostgreSQL advisory lock.

---

## 1. The design system (the rules of every frontend task)

Every screen of this plan uses the components and the colours that the
platform already uses. **No new colour, no new font, no new radius, no new
pattern** - a screen that looks like another one is a screen that is done.

### The colours (the tokens of `frontend/src/index.css`)

| The token | The value | Where it is used |
|---|---|---|
| `--brand-navy` | `#253d63` | The primary: the buttons, the headings (`text-ink`), the surfaces of the dark mode |
| `--brand-blue` | `#2672b0` | The links, the focus ring (`--ring`), the second colour of the charts |
| `--brand-mint` | `#53cb9e` | The accent: the highlights, the success, the primary of the dark mode |
| `--brand-orange` | `#f96702` | The warning (the late attendance) |
| `--brand-red` | `#9e150b` | The danger (the absence, the destructive actions) |
| `--ink` | `#253d63` | The strong text |
| `--soft` | `oklch(0.975 0.006 240)` | The fill behind the cards |
| `--shadow-card` | one navy shadow | The elevation of the cards (`card-elevated`) |

**The rule:** a utility of Tailwind (`bg-navy`, `text-mint`, `text-ink`,
`bg-soft`, `card-elevated`, `font-arabic`, `font-heading`, `focus-ring`,
`btn-primary`, `btn-outline`) - **never a raw hexadecimal value** in a
component.

### The components that already exist (the ones to reuse)

`frontend/src/components/ui/` (the shadcn set, restyled):
`button`, `card`, `badge`, `input`, `textarea`, `label`, `form`, `select`,
`checkbox`, `switch`, `radio-group`, `table`, `tabs`, `dialog`,
`alert-dialog`, `sheet`, `dropdown-menu`, `popover`, `calendar`,
`sonner` (the toasts), `skeleton`, `pagination`, `tooltip`, `avatar`,
`separator`, `progress`, `empty` (if it exists).

`frontend/src/components/common/` (the shared pieces of the platform):
`AppPagination`, `StatCard`, `AdminDashboardTiles`, `ErrorRetry`,
`PageSkeleton`, `EmptyState` - **the way back to a page is a
shared component** (see the point 6). The confirmation of a deletion is the
`AlertDialog` of `components/ui/` (there is no `ConfirmDialog` in the
platform - the new pages use the primitive, they do not invent a wrapper).

`frontend/src/components/layout/`: `Navbar`, `Footer`, `AdminSidebar`,
`AdminTopbar`, `AdminUserMenu`, `ThemeToggle`.

### The rules of a screen

- The direction and the language live in **one place** (`frontend/src/i18n/direction.ts`):
  **no `dir="rtl"` and no `lang="ar"` in a component** (the guard test
  `frontend/src/test/__tests__/localisation.test.ts` fails the build if one
  appears).
- The Arabic text goes to `ar.ts`; a component never holds a literal that a
  member reads (except the numerals and the dates, which are formatted with
  `Intl` and the locale `ar-EG`).
- The radius is `--radius` (`rounded-2xl` for the cards, `rounded-xl` for the
  controls), the shadows are `card-elevated` / `card-elevated-strong`.
- The icons come from `lucide-react`, with `aria-hidden="true"` when they
  decorate a text.
- Every icon-only button has an `aria-label` in the Arabic of the product.
- The empty state, the loading state (the skeleton) and the error state
  (`ErrorRetry`) exist on **every** screen that loads something.

---

## 2. What the codebase already has (the state of the seven points)

The plan does not start from zero: this is what exists today, so no phase
rebuilds what is already there.

| The point of `TODO.md` | The state today | What is missing |
|---|---|---|
| **1. About Us** | The route `/about-us` exists and shows a **placeholder** (`src/pages/placeholder/PlaceholderPage.tsx`). The landing page has an `About` section (`src/pages/landing/sections/About.tsx`). | The page itself (the logo + the text), the link to it, the content. |
| **2. My points** | The page `/points` is **complete**: the KPIs (the lifetime, the week, the month), the chart of the months, the list of the months, the recent activity (the ledger, with the title of the quiz). The backend answers `GET /users/me/points`, `/monthly`, `/history`. | The **points of each quiz** grouped (the ledger is a list of transactions, not a summary per quiz), and the **monthly total** that is easy to read (the month is not chosen by the member). |
| **3. The gallery** | The route `/gallery` is a **placeholder**; there is **no content** (no model, no table, no upload). The link is in the navbar and in the footer. | The route and the links must go; the old address must not answer 404 (a redirect). |
| **4. The landing page and the slider** | The hero has **two buttons** that point to the sections of the page (`#events`, `#about` - both sections exist ✔). The navbar links work. The **footer's links are anchors to the sections of the landing page** (`#home`, `#about`, `#ministries`): they work **on the landing page only** - the footer is also on the notifications page, where every one of them is **dead**. The hero shows **one static image** (`src/assets/hero-worship.jpg`). | Every button of the landing page must go somewhere real (the footer's links must work on **every** page); the **slider with images that the admin changes** (the table, the admin page, the public endpoint, the slider itself). |
| **5. The analysis and the reports** | Three pages: `/admin/analytics/verses`, `/admin/analytics/quizzes`, `/admin/analytics/monthly`. The monthly page shows the users with the most points (with the search and the export) ✔. The quizzes page shows only the **overview tiles**. The backend has the per-quiz endpoints (`GET /quizzes/{id}/analytics`, `.../users`, `.../export`). | The **per-quiz analysis** in the page (the list of the quizzes, the analysis of one), and the **proof that the calculations are right** (the numbers are not pinned by a test today). |
| **6. The way back** | The navbar's brand goes to `/` ✔; the administration has a sidebar ✔. The member pages (the profile, the points, the notifications) and the administration pages have **no way back** to the parent page. | A **shared header with the way back** (the breadcrumb), used by every screen. |
| **7. The blog** | The backend has the **scaffolding**: the models (`BlogPost`, `BlogCategory`, `BlogPostCategory`, `BlogPostLike`, `Comment` with `parent_comment_id` for the replies), the events (`BlogPostPublished`, `CommentCreated`), the statuses, the repositories. **The application layer, the DTOs and the router do not exist** → the module is **not exposed at all**. The frontend `/blog` is a placeholder. The notification of a published post exists but its consumer **sleeps** (it is dormant on purpose). | Everything else: the API, the pages, the editor, the comments, the likes, the tags, the schedule, the mail. |

---

## 3. Phase 0 — The foundations (before any point)

Nothing of the seven points can start before these four things are in place.
They are small, they unblock everything, and three of them are needed by more
than one point.

### 0.1 The shared header with the way back (the point 6, first)

The point 6 asks for a way back on every screen. The component is needed by
the blog, the slider administration and the new pages, so it comes first.

**Requirements**
1. A shared component renders a title, an optional description, an optional
   set of actions and **a link back to the parent route**.
2. The link back is a real `<Link>`: it can be opened in a new tab, and the
   keyboard reaches it (it is the first thing in the tab order).
3. The component has **no colour of its own**: it uses the tokens (§1) and
   the classes of the platform (`font-heading`, `text-ink`, `text-muted-foreground`).
4. The breadcrumb is optional and reads from right to left in Arabic
   (`aria-label` on the `<nav>`).
5. The component is covered by a render test: the title, the description, the
   actions and the link back are visible, and the link points to the right
   route.

**Tasks**
- 0.1.1 `components/common/PageHeader.tsx` — the props: `title`, `description?`,
  `backTo?`, `backLabel?`, `actions?`.
- 0.1.2 The icon of the way back: `ArrowRight` (the platform is RTL, the way
  back is to the **right**) with `aria-hidden`.
- 0.1.3 The strings in `ar.ts` (`common.back`, `common.backTo`).
- 0.1.4 The test `components/common/__tests__/pageHeader.test.tsx`.
- 0.1.5 Use it on **three** pages as the proof: the profile, the points and
  the admin dashboard (the rest comes with the point 6).

**Acceptance**: the test is green; the three pages show the header; the
coverage of the new component is above 90 %.

### 0.2 The media service takes the size of the file (the point 7)

**Requirements**
1. The image upload accepts the **maximum size** as a parameter (the default
   stays 2 MB - the verse covers keep it).
2. The blog uses **1 MB** (the owner wrote it).
3. A file that is too big is refused with the error of the domain
   (`ValidationError`), **not** with a 500, and the message says the limit.

**Tasks**
- 0.2.1 `shared/infrastructure/services/image_upload.py` — the parameter
  `max_bytes`.
- 0.2.2 The test of the limit (the file of 1 MB + 1 byte is refused).
- 0.2.3 The routes that upload an image pass their own limit.

**Acceptance**: the tests are green; the existing uploads (the avatar, the
cover of a verse) keep their 2 MB.

### 0.3 The rules of the content that the admin writes (the points 1, 4, 7)

Every content of the platform that an admin writes is **text in Arabic** with
a length, and it is shown to the members. The rules are written once, in
`docs/business-rules.md` (the catalogue that the audit created), with the
identifiers `BR-xx`.

**Requirements**
1. Every new rule has an identifier, a text in the catalogue and a **test**
   that the code obeys it (the catalogue already has a guard test).
2. The rules of the content are: the title (the length), the excerpt, the
   body, the tag (the length and the number per post), the comment (the
   **500 words**), the image (the size).

**Tasks**
- 0.3.1 Write the rules in `docs/business-rules.md` (the table of the rules
  of the blog, of the slides and of the About page).
- 0.3.2 The guard test that the catalogue and the code agree
  (`backend/tests/unit/test_business_rules_catalogue.py` already exists).

**Acceptance**: the catalogue test is green.

### 0.4 The decisions (the questions of the owner)

The seven points carry **nine decisions** that change what is built (§12).
They are asked **before** the phase that needs them starts - not after the
code is written.

---

## 4. Point 1 — The page "About Us"

**The wish of the owner:** *"Content: Logo and some text"*.

### 4.1 The content of the page

**Requirements**
1. The page shows the **logo** of the platform (the same mark as the navbar
   and the footer - one asset, `frontend/src/assets/`, not a copy).
2. The page shows the **text** of the platform: the mission, the meeting, the
   audience, the contact.
3. The text lives in **one place** (`frontend/src/i18n/resources/ar.ts`, the
   namespace `aboutUs`) - not in the component.
4. The text is **readable on a phone** and on a desktop, in Arabic, with the
   line height and the measure of the platform (`max-w-prose`, `leading-8`).
5. **Decision D-1**: the text is written in the repository (the first version)
   or edited from the administration (the second version). The plan does the
   first: the content of a page that does not change often does not need a
   table, a router and an admin screen.

**Tasks**
- 4.1.1 The text of the page in `ar.ts` (the namespace `aboutUs`: the
  mission, the meeting, the audience, the contact, the verse of the day).
- 4.1.2 The decisions: the owner writes the final text (the plan writes a
  first version with the texts of the landing page, so the page is never
  empty).

### 4.2 The page itself

**Requirements**
1. The route `/about-us` shows the page (the placeholder is **replaced**).
2. The page has the **navbar and the footer** of the platform (the same
  shell as the landing page).
3. The page uses the design system: the soft fill (`bg-soft`), the cards
   (`card-elevated`, `rounded-2xl`), the navy headings (`text-ink`,
   `font-heading`), the mint accent (`text-mint`).
4. The logo has an alternative text that says what it is.
5. The page has **one `h1`** and a hierarchy of headings that makes sense.
6. The page is reachable from the **footer** (the quick links) and from the
   **About** section of the landing page (a link, not a dead end).
7. The page is covered by a render test: the title, the sections and the logo
   are visible.

**Tasks**
- 4.2.1 `pages/about/AboutUsPage.tsx` (the folder `pages/about/`, the first
  page that is not a placeholder).
- 4.2.2 The section of the logo (`rounded-2xl`, `bg-white/10`, the mark in
  its box) and the sections of the text.
- 4.2.3 The route in `router.tsx` (the placeholder is replaced).
- 4.2.4 The link in `Footer.tsx` (the quick links become real links - the
  point 4.1 does the same work, they share the commit).
- 4.2.5 The test `pages/about/__tests__/aboutUsPage.test.tsx`.

**Acceptance**: the page is rendered in the test; the route is in the router
test; the coverage of the page is above 80 %; the build is green.

---

## 5. Point 2 — "My points": the points of each quiz and the total of each month

**The wish of the owner:** *"My Points in each Quiz i have solved and the
total points in each month so user can check monthly points total easily"*.

**What exists:** the KPIs, the chart of the months, the list of the months and
the ledger of the recent activity (each line carries the title of the quiz).
**What is missing:** the points **grouped by quiz** (a summary per quiz, not a
list of transactions), and the **month that the member chooses** to read the
total of.

### 5.1 The backend: the points by quiz

**Requirements**
1. `GET /users/me/points/by-quiz` answers the points of the member **per
   quiz**: the id and the title of the quiz, the points, the number of the
   attempts, the average score out of ten, the date of the last attempt.
2. The answer is **paginated** (`Page[...]`, the same envelope as the rest of
   the platform) and ordered by the points (the biggest first).
3. The points of a member are only **his own** (the guard of the current
   member; the endpoint never takes an id of a member).
4. The total of the member (the lifetime) is **not** recomputed by the
   frontend: the endpoint answers it too (the frontend must not add the
   lines itself).
5. The calculation is **pinned by a test**: a member with two attempts on the
   same quiz and one on another sees the sum of the first (the points of the
   ledger, never the maximum of the attempts).

**Tasks**
- 5.1.1 The DTO `PointsByQuizItem` and the envelope in
  `app/modules/points/application/dto/points_dto.py`.
- 5.1.2 The query in `app/modules/points/application/queries/points_queries.py`
  (one grouped query over the ledger of the member, joined with the quizzes).
- 5.1.3 The route in `app/modules/points/presentation/router.py` (the
  `points_router`, under `/users/me/points`).
- 5.1.4 The test `tests/unit/api/v1/test_points_by_quiz.py` (the sums, the
  order, the pagination, the isolation of the members).
- 5.1.5 The guard test of the contract passes **without any change**: the
  frontend schema does not exist yet → the guard only checks the endpoints
  that the frontend uses (the rule of the audit).

**Acceptance**: the tests are green; the OpenAPI describes the answer (the
`alembic check` and the contract test stay green).

### 5.2 The frontend: the section "my points per quiz"

**Requirements**
1. The schema `pointsByQuizSchema` in `frontend/src/lib/schemas/member.ts`
   (the `loose()` helper, never `z.object` - the guard test forbids it).
2. The types are the **inference** of the schema (`z.infer`).
3. The client uses `apiGet` (the answer is **checked at the edge**).
4. The page shows a **table** (the platform's `Table`): the quiz, the points,
   the attempts, the average, the last attempt. The table is the same as the
   one of the administration (the same classes).
5. The points are shown with `Intl.NumberFormat("ar-EG")` (the Arabic digits,
   like the rest of the platform).
6. The section has the **empty state**, the **skeleton** and the **error
   state** (`ErrorRetry`).
7. The pagination uses the shared `AppPagination`.
8. The render test proves: the lines are shown, the empty state is shown, the
   error is shown.

**Tasks**
- 5.2.1 The schema + the types.
- 5.2.2 The client (`pointsApi.getByQuiz`) and the hook.
- 5.2.3 The component `modules/points/components/PointsByQuizTable.tsx`.
- 5.2.4 The section in `PointsPage.tsx` (below the activity, or above it -
   the owner decides where; the recommendation is **above** the activity:
   the summary first, the detail after).
- 5.2.5 The test `modules/points/pages/__tests__/pointsPages.test.tsx` (the
  three cases).

**Acceptance**: the test is green; the contract guard passes; the coverage
of the new component is above 80 %.

### 5.3 The month that the member chooses

**Requirements**
1. The member chooses a month with a **select** (the months that have
   points), and the page shows: the total of that month, the number of the
   quizzes of that month and the average.
2. The choice is **remembered** in the URL (`?month=YYYY-MM`) - a link can be
   shared, and the back button works.
3. The month that is not in the URL is the **current** month.
4. The chart and the list of the months keep their behaviour; the select is
   **in addition**, not instead.
5. The answer of the server for the month is **not** recomputed by the
   frontend (the same rule as 5.1.4).

**Tasks**
- 5.3.1 The backend: the endpoint answers the total of a chosen month
  (`GET /users/me/points/monthly?month=YYYY-MM` already answers the series -
  the page uses the item of the chosen month; **no new endpoint is needed**).
- 5.3.2 The frontend: the select of the month, the reading of the URL
  (`useSearchParams`), the state of the month.
- 5.3.3 The card of the month (the total, the quizzes, the average) with the
  `StatCard` of the platform.
- 5.3.4 The test (the month of the URL is the one that is shown; a month
  without points shows the empty state).

**Acceptance**: the tests are green; the URL carries the month; the coverage
of the new code is above 80 %.

---

## 6. Point 3 — The gallery page goes away

**The wish of the owner:** *"delete Gallery Page and it's content if there to
save storage"*.

**The finding:** there is **no content** - the page is a placeholder, there
is no table, no upload and no image of the gallery. **Nothing is stored**, so
nothing has to be deleted from the database; only the page and its links go
away. (The audit found that the design images of the repository are **52 MB
in the history**; that is a different question - the history rewrite is a
decision of the team, §12 D-9.)

**Requirements**
1. The route `/gallery` **does not exist** any more.
2. The old address **does not answer 404**: it redirects to the landing page
   (the links of the platform and of the bookmarks keep working).
3. The links to the gallery are gone from the navbar, the footer and the
   landing page.
4. The strings of the gallery are gone from `ar.ts` (no dead key).
5. The router test proves that `/gallery` redirects and that the navbar has
   no link to it.

**Tasks**
- 6.1.1 The route in `router.tsx`: a `<Navigate to="/" replace />` (the
  redirect) - the route stays in the router **on purpose**: it is the
  bookmark that answers.
- 6.1.2 The links: the navbar, the footer, the landing page.
- 6.1.3 The strings of `ar.ts` (`nav.gallery`, `footer.gallery`,
  `placeholder.gallery`).
- 6.1.4 The test in `src/__tests__/router.test.tsx` (the redirect; the navbar
  without the link).

**Acceptance**: the test is green; `/gallery` lands on the landing page; the
parity test of the translations is green (no key without a use, no use
without a key).

---

## 7. Point 4 — The landing page and the slider that the admin controls

**The wish of the owner:** *"Make all Landing Page clickable buttons redirect
to something 'e.g about us page, SignIn,..etc', Add Slider with images control
from admin panel so admin can change images easily"*.

### 7.1 Every button of the landing page goes somewhere

**Requirements**
1. **No button of the landing page is dead**: each one is a `<Link>` (an
   internal route) or an anchor that points to a section that **exists**.
2. The two buttons of the hero go to the sections of the page (`#events`,
   `#about` - the sections exist ✔) and the hero gains a **third button** that
   goes to a real route (the recommendation: `/bible-verses` - "the verse of
   the day" - the page the members use the most).
3. The **footer's quick links** work on **every** page: today they are
   anchors to the sections of the landing page (`#about`) and they are dead
   everywhere else (the footer is on the notifications page too). They become
   `Link`s that carry the landing page (`/#about`) or that go to a real route.
4. The **social part of the footer** keeps **Facebook only** (the decision of
   the owner): the **account** and the **group**, each with its own icon (the
   account and the group of the same network - the icon of the group is the
   one of the people). The icons of **Instagram and YouTube are removed**:
   the platform has no account there, and a link that goes nowhere is worse
   than no link. The two links carry `rel="noopener noreferrer"` and
   `target="_blank"`.
4. The buttons of the **About Us** section and of the **Upcoming service**
   go to the real routes.
5. Every link has an **accessible name** and the external ones carry
   `rel="noopener noreferrer"` and `target="_blank"`.
6. The links are in the router test (the route exists).

**Tasks**
- 7.1.1 The inventory: every `<a>` and every `<button>` of the landing page
  (the sections, the navbar, the footer) is listed and given a destination.
- 7.1.2 The footer's lists become `Link`s (the arrays of `Footer.tsx` carry a
  route next to the label).
- 7.1.3 The hero's third button + the other sections.
- 7.1.4 The test: every link of the landing page points to a route that the
  router knows (a test that parses the links of the rendered page and checks
  them against the routes - the router's test already knows the list).

**Acceptance**: the test is green; no `<a href="#">` and no `<button>` without
an action survives in the landing page.

### 7.2 The backend of the slider

**Requirements**
1. A table `landing_slides`: the id, the image (the URL), the title, the
   subtitle, the **order**, the **active** flag, the created/updated stamps.
2. The admin manages the slides: the list, the create, the update, the
   delete, the **order** (up/down), the activation.
3. The **public** endpoint `GET /landing/slides` answers the active slides,
   ordered, with the public fields only.
4. The image goes through the **media service** (the limit of 0.2.1: the
   slides use 2 MB, like the covers).
5. The answers are **checked at the edge** by the frontend (the schema).
6. The slide that is not active is never seen by a member.

**Tasks**
- 7.2.1 The model `app/modules/media/infrastructure/persistence/models.py`
  (the slides belong to the media module) + the **migration**
  (`alembic revision`, additive, with the downgrade).
- 7.2.2 The DTOs, the commands and the queries in the media module (the
  module has no application layer yet - this phase creates it).
- 7.2.3 The router: `app/modules/media/presentation/router.py` with the
  public list and the admin CRUD, mounted in `app/api/v1/router.py`.
- 7.2.4 The permissions: **the admin alone** (the decision D-3 of the
  owner): the routes of the administration are behind the guard of the
  admin; the servant reads, the admin writes.
- 7.2.5 The tests: the CRUD, the order, the activation, the public answer.
- 7.2.6 The contract guard passes (the route exists in the OpenAPI).

**Acceptance**: the tests are green; `alembic check` is green; the OpenAPI
describes the answers.

### 7.3 The administration of the slides

**Requirements**
1. The page `/admin/landing/slides` lists the slides (the image, the title,
   the order, the active flag).
2. The admin can add a slide (the image, the title, the subtitle), edit it,
   delete it, activate it and **change the order** (the buttons up/down).
3. The page uses the design system: the `Table` of the platform, the
   `Button` with the variants, the `Dialog` of the administration for the
   form, the `Switch` for the activation, the `AlertDialog` of
   `components/ui/` for the confirmation of the deletion.
4. The image is **uploaded** with a preview (the same pattern as the cover of
   a verse).
5. The empty state, the skeleton and the error state exist.
6. The render test proves the list, the form and the error.

**Tasks**
- 7.3.1 The route and the link in the admin sidebar: a **new section
  "Content Management"** (`إدارة المحتوى`) is added to the sidebar of the
  administration, and the entry **"the slider carousel"** (`السلايدر`) lives
  inside it. The section holds the content that the platform shows to the
  members and that the admin changes without a deployment.
- 7.3.2 The list page + the form (the shared `FormProvider` + the local
  `zodResolver` - the audit's own adapter, not a new dependency).
- 7.3.3 The upload with the preview.
- 7.3.4 The test `modules/media/pages/__tests__/landingSlidesPage.test.tsx`.

**Acceptance**: the test is green; the coverage of the page is above 70 %.

### 7.4 The slider of the landing page

**Requirements**
1. The hero shows the **slides** of the server (the active ones), with the
   **automatic rotation** (every 6 seconds) and the **manual control** (the
   arrows and the dots).
2. The slider is **usable with the keyboard**: the arrows move the focus, the
   left/right keys change the slide, `aria-roledescription="carousel"`, the
   dots are buttons with an accessible name ("the slide 2 of 5").
   **The platform already has the carousel**: `components/ui/carousel.tsx`
   (the shadcn carousel on `embla-carousel-react`, the dependency is already
   installed) → **no new dependency** is needed for the slider; the component
   is built on it, with the tokens of the platform.
3. The rotation **stops** when the mouse is over the slider and when the tab
   is hidden (`prefers-reduced-motion` is honoured: no rotation at all).
4. The slide is a **link** (the button of the slide: the verse of the day, the
   quiz, the service).
5. **When the server has no slide**, the current static image stays (the
   platform never shows an empty hero).
6. The image has `alt` (the title of the slide) and `width`/`height` (no
   layout shift).
7. The render test proves: the slides are shown, the dots work, the fallback
   works.

**Tasks**
- 7.4.1 The schema + the client + the hook (`modules/media/`).
- 7.4.2 The component `modules/media/components/LandingSlider.tsx`, built on
  the existing `components/ui/carousel.tsx` (embla - already installed).
- 7.4.3 The hero uses the slider (the static image becomes the fallback).
- 7.4.4 The test (the slides, the dots, the fallback).

**Acceptance**: the test is green; the landing page still works with no
slide; the coverage of the slider is above 70 %.

---

## 8. Point 5 — The analysis and the reports

**The wish of the owner:** *"Analysis that not completed - Reports Section
complete it and check if all data valid or calculations is right or not also
there is missing analysis e.g: Quizzes analysis, monthly analysis and monthly
analysis is displaying the most points users got so admin can get a report
with them"*.

**The finding:** the monthly analysis **already shows the users with the most
points** (with the search and the export ✔). The **quizzes analysis is
incomplete**: the page shows the overview tiles but **not** the analysis of a
quiz, even though the backend answers it (`GET /quizzes/{id}/analytics`,
`/users`, `/export`). The **calculations are not pinned** by a test: a number
that changes silently is not noticed.

### 8.1 The audit of the calculations

**Requirements**
1. Every number of the three pages has a **test that pins it** with a
   known set of data (a member, a quiz, an attempt, a transaction).
2. The rules are written down: what counts as an attempt (the status), what
   the average is (the score out of ten, not the raw points), what the
   completion rate is, when a month starts (the platform timezone, not the
   server), which attempts are counted (the hidden ones? the archived
   quizzes?).
3. A **discrepancy** between the page and the ledger is impossible: the
   numbers of the page come from the same query as the export.

**Tasks**
- 8.1.1 The rules in `docs/business-rules.md` (`BR-xx`: the counting of the
  attempts, the average, the month, the time zone).
- 8.1.2 The tests `tests/unit/api/v1/test_analytics_calculations.py`: a
  dataset with two members, two quizzes, three attempts (one completed, one
  auto-finished, one in progress) and the expected numbers, written down.
- 8.1.3 The test that the **export** carries the same numbers as the page
  (the same fixture, two paths).

**Acceptance**: the tests are green; every number of the three pages has a
line in the catalogue.

**What this phase can discover:** a rule that the code does not obey is a
**defect** - it is fixed here, with a test, before the screens are touched.

### 8.2 The analysis of a quiz (the missing part)

**Requirements**
1. The page `/admin/analytics/quizzes` shows a **list of the quizzes** (the
   title, the status, the number of the attempts, the average) and opens the
   **analysis of one**: the participants, the distribution of the scores, the
   status of the completion, the users with their result.
2. The data comes from the endpoints that **already exist** (`/quizzes/{id}/analytics`,
   `/users`, `/export`) → **no new endpoint** (the schema of the frontend is
   what is missing).
3. The export (the CSV) is reachable from the page (the button of the
   analysis).
4. The page keeps the **design system**: the `StatCard` for the tiles, the
   `Table` for the users, the charts on-brand (`--chart-1` mint, `--chart-2`
   blue, `--chart-3` orange, `--chart-4` red, `--chart-5` navy).
5. The empty state (a quiz without an attempt), the skeleton and the error
   state exist.
6. The render test proves the list, the analysis of one and the empty state.

**Tasks**
- 8.2.1 The schemas of the frontend (the analysis of a quiz, the user, the
  distribution) in `frontend/src/lib/schemas/quiz.ts`.
- 8.2.2 The client and the hooks (`useQuizAnalytics`, `useQuizAnalyticsUsers`).
- 8.2.3 The list + the detail on the page.
- 8.2.4 The button of the export.
- 8.2.5 The tests.

**Acceptance**: the tests are green; the contract guard passes; the coverage
of the new code is above 70 %.

### 8.3 The report that the admin can take away

**Requirements**
1. The export of the monthly analysis answers **the users of the month with
   the most points** (it does today ✔) and the export of the quizzes answers
   the users of a quiz (the endpoint exists ✔).
2. The exports are **CSV with the BOM** (the Excel of the members opens the
   Arabic correctly - the attendance export already does this ✔).
3. The name of the file carries the month and the title of the quiz.
4. A test pins the header and the number of the lines.

**Tasks**
- 8.3.1 The shared export helper (the attendance already has one:
  `modules/attendance/lib/csv.ts` → it moves to `lib/download.ts` **if** it
  is not there already) and the blog and the analytics use it.
- 8.3.2 The tests (the header, the BOM, the escaping, the name of the file).

**Acceptance**: the tests are green; the two exports open in Excel with the
Arabic in the right order.

---

## 9. Point 6 — The way back on every screen

**The wish of the owner:** *"Buttons to add more accessibility to the full
platform - e.g. if i'm in the profile page add button to return to landing
page again, if im in dashboard add button to return to the main page or route
of the dashboard, if in the attendance page return to last page, etc so full
platform has a UI accessibility"*.

### 9.1 The rules of the way back

**Requirements**
1. Every screen has **one** way back, and it is the **same component**
   (0.1.1): the member pages go back to the landing page (`/`), the
   administration pages go back to the dashboard of the administration
   (`/admin/dashboard`), the screens of a section go back to the **list of
   that section** (the quiz builder → the management of the quizzes, the
   verse form → the list of the verses).
2. The way back is **visible on a phone** (it is in the header, not in a menu
   that hides it).
3. The way back is a **link** (the middle button opens it in a new tab).
4. The screens of the administration keep the **sidebar**: the way back is in
   the header of the page, not a replacement of the sidebar.
5. The "return to the last page" of the attendance is the **history of the
   browser** (`navigate(-1)`) **only** when the member came from inside the
   platform; otherwise the link is the section's list (a rule that is decided
   by the code, not by the member: the link is always there, the button of
   the history appears only when there is a history).

**Tasks**
- 9.1.1 The table of the routes and their parent (a small map in the
  component or in the route definitions - the recommendation: the parent is
  **declared in the route** (`handle: { parent: "/admin/dashboard" }`), so the
  header reads it and does not guess).
- 9.1.2 The header of the pages of the members: the profile, the points, the
  notifications, the verses, the verse, the quiz, the result of the quiz, the
  check-in, the history of the attendance, the messages.
- 9.1.3 The header of the pages of the administration: the dashboard, the
  members, the verses, the quizzes, the builder, the form of the verse, the
  schedule, the analytics (the three), the check-in, the history, the
  absences, the notifications, the anonymous messages.
- 9.1.4 The tests: the router test proves that every route of the platform
  has a parent (a test that walks the routes and checks the map).

**Acceptance**: the test is green; no screen of the platform is without a way
back; the coverage of the header is above 90 %.

### 9.2 The keyboard and the focus

**Requirements**
1. The way back is the **first** element of the tab order of the page.
2. After a navigation, the focus goes to the `h1` of the new page (a member
   who navigates with the keyboard does not have to tab through the whole
   page to know where they are).
3. The skip link ("to the content") is on every page (the platform may
   already have one - it is checked here).

**Tasks**
- 9.2.1 The focus on the navigation (a `RouteFocus` component in the router,
  the same one for every route).
- 9.2.2 The skip link, if it is missing.
- 9.2.3 The test (the focus after a navigation).

**Acceptance**: the test is green.

---

## 10. Point 7 — The blog (the biggest point)

**The wish of the owner:** posts with a photo (max 1 MB), a text and tags;
comments with a limit of 500 words, emojis, bullets, underline and colour,
a hierarchy of replies, deleted by the admin/servant/owner; likes by every
role with the count, the list of who liked it for the owner and the admin;
the filtering by the tags; the list of the posts as a list and as cards; the
deletion by the admin/the owner; the **schedule** by a date; a **notification**
in the platform for every post; the **mail** with the content and the link,
chosen by the owner of the post.

**The finding:** the backend has the **models, the events, the statuses and
the repositories** - the module is a scaffold without an application layer
and without a router. The frontend has a placeholder. **The work is big and
it is split into eight phases that can be delivered one by one.**

### 10.1 The rules of the blog (the decisions and the catalogue)

**Requirements**
1. The rules of the content are in `docs/business-rules.md` with their
   identifiers: the title (the length), the excerpt, the body, the cover
   (1 MB), the number of the tags, the name of a tag, the length of a
   comment (500 **words**), the depth of the replies (**without a limit** - the
   model already carries the tree; the owner wrote "a tree"), the statuses of a post
   (**the model has `DRAFT`, `PUBLISHED`, `ARCHIVED`** - the schedule is the
   **derived** state "a draft with a date in the future", it is **not** a new
   status: no migration of the enum), who may write.
2. **The tags are the categories that the model already has**
   (`BlogCategory` + `BlogPostCategory`) → the owner calls them "tags", the
   database calls them "categories": **the tables keep their name and the
   interface says "tags"** (the decision D-4 of the owner). The DTOs and the
   schemas are named `tag`/`tags`; the models stay as they are: no migration
   of the tables.
3. The comment counts **words**, not characters (the owner wrote "500 Word"):
   the backend counts them, the frontend shows the counter as the member
   types.

**Tasks**
- 10.1.1 The rules in the catalogue + the guard test.
- 10.1.2 The decisions of the owner (D-4 the tags, D-5 the editor, D-6
  who writes, D-7 the HTML and the depth) are written in the catalogue as
  the rules of the blog.

### 10.2 The backend: the posts

**Requirements**
1. The routes of the blog: the public list (the published posts, filtered by
   the tag, paginated, searched by the title), the detail of a post, and the
   admin routes (the list of **all** the posts, the create, the update, the
   delete, the publish, the schedule).
2. The create and the update take: the title, the excerpt, the body, the
   cover (the URL), the tags, and **the date of the publication** (the
   schedule).
3. A post with a date in the future is **scheduled**: it is not in the public
   list and not in the public detail until the date passes. A post with a
   date in the past is published at once. The **publication is the platform's
   own scheduler**: `POST /internal/scheduler/tick` (the cron calls it every
   minute) already publishes the scheduled verses and drains the outbox → the
   blog uses **the same tick** (a `publish_due` for the posts, like the one of
   the verses). **No new infrastructure is needed.**
4. The deletion is **soft** (`status = DELETED` - the model has the statuses):
   the public answers never show it.
5. The permissions: the **owner** of the post and the **admin** may change or
   delete it; the **servant** may read the administration (the decision D-6
   says who writes).
6. The answers are declared in the OpenAPI (the response models) and the
   frontend schemas mirror them (the guard tests).

**Tasks**
- 10.2.1 The DTOs in `app/modules/blog/application/dto/`.
- 10.2.2 The commands (create, update, delete, publish, schedule) in
  `app/modules/blog/application/commands/`.
- 10.2.3 The queries (the public list with the filters, the detail, the
  admin list) in `app/modules/blog/application/queries/`.
- 10.2.4 The router `app/modules/blog/presentation/router.py` + the mount in
  `app/api/v1/router.py`.
- 10.2.5 The tests: the CRUD, the permissions (a member cannot change the
  post of another member), the schedule (a post of tomorrow is invisible), the
  soft deletion.
- 10.2.6 The guard test of the contract (the OpenAPI vs. the DTOs).

**Acceptance**: the tests are green; the OpenAPI is honest; the module
cycle guard still passes (the blog does not import the other modules' domain
objects).

### 10.3 The notification and the mail of a published post

**Requirements**
1. The event `BlogPostPublished` **wakes the consumer** that sleeps today:
   every member gets a **notification in the platform** (the type
   **`NotificationType.BLOG_POST` already exists** ✔ - the five types are
   `BLOG_POST`, `ANONYMOUS_MESSAGE`, `ATTENDANCE`, `SYSTEM`, `BIBLE_VERSE` -
   **no migration is needed**; the copy and the consumer are what is missing).
2. The notification carries the id of the post, and the bell opens the post.
3. The owner of the post may **choose** to send a **mail** to the members
   (a flag on the post: "notify by mail").
4. The mail carries the title, an excerpt and **the link** to the post, and it
   is sent in the **background** (the outbox - the same mechanism as the other
   mails).
5. The mail is sent **once** (the idempotence of the outbox), and a member
   who is not signed in does not get it (the recipients are the members with
   an address).
6. The notification of a type that the frontend does not know **does not
   crash** (the rule of the audit: the accent has a fallback ✔).

**Tasks**
- 10.3.1 The type `BLOG_POST` in the notifications + the copy in
  `notifications/application/copy.py`.
- 10.3.2 The consumer of `BlogPostPublished` (the outbox → the notification
  service).
- 10.3.3 The flag of the post (`notify_by_mail`) + the **migration**.
- 10.3.4 The mail (the template, the link) in the shared email service.
- 10.3.5 The tests: the notification is created, the mail is queued once, the
  post without the flag sends no mail.

**Acceptance**: the tests are green; the notification appears in the bell of
a member; the mail is in the outbox.

### 10.4 The frontend: the list of the posts

**Requirements**
1. The page `/blog` shows the **published** posts as **cards**: the cover,
   the title, the excerpt, the tags, the date, the number of the comments and
   the number of the likes.
2. The same page offers the **list** of the posts (the switch of the owner:
   "posts appear in a list clickable to open post ... also another way of
   listing is cards") → a **toggle** between the two views, and the choice is
   remembered in the URL (`?view=cards|list`).
3. The posts are **filtered by tag** (the tags are links; the filter is in the
   URL) and **searched** by the title.
4. The pagination uses the shared `AppPagination`.
5. The card uses the design system: `rounded-2xl`, `card-elevated`, the
   cover with `aspect-[16/9]` and `object-cover`, the tags as `Badge`
   (the mint for the accent), the title as `text-ink font-heading`.
6. The empty state (no post, no post with that tag), the skeleton and the
   error state exist.
7. The render test proves the cards, the list, the filter and the empty
   state.

**Tasks**
- 10.4.1 The schemas + the client + the hooks (`modules/blog/`).
- 10.4.2 The component `BlogCard.tsx` and `BlogListRow.tsx`.
- 10.4.3 The page `pages/blog/BlogListPage.tsx` + the route (the placeholder
  is replaced).
- 10.4.4 The toggle, the filter and the search.
- 10.4.5 The tests.

**Acceptance**: the tests are green; the coverage of the new code is above
70 %.

### 10.5 The frontend: the page of a post and the administration

**Requirements**
1. The page of a post shows the cover, the title, the date, the author, the
   tags, the **body**, the likes and the comments.
2. The **administration** (`/admin/blog`) lists all the posts (the drafts,
   the scheduled, the published) with their status and their date.
3. The form of a post: the title, the excerpt, the cover (the upload with a
   preview, the limit of 1 MB), the body (**the editor TipTap** - the
   decision D-5 of the owner), the
   tags (a select of the existing ones + the creation of a new one), the
   date of the publication, the flag of the mail.
4. The **schedule** is a date and a time (the platform timezone); the form
   says when the post will be published ("سيُنشر غدًا في ٧ مساءً").
5. The owner can **delete** their post (with the confirmation) and the admin
   can delete any post. **The admin and the servant may write** (the decision
   D-6 of the owner) and the administration of the posts lives in the section
   **"Content Management"** of the sidebar, next to the slider.
6. The status of the post is visible in the administration (a `Badge`: the
   draft in the muted, the scheduled in the orange, the published in the
   mint).
7. The pages use the design system and the shared `PageHeader` (the way back
   to the list of the posts).

**Tasks**
- 10.5.0 The **dependency**: `@tiptap/react`, `@tiptap/starter-kit` and the
  extensions of the toolbar (the underline, the colour, the bullet list, the
  emoji) - pinned, with `npm audit` green and the lock file committed. The
  editor is **one** component (`modules/blog/components/RichTextEditor.tsx`)
  that the post and the comment both use.
- 10.5.1 The page of a post (`pages/blog/BlogPostPage.tsx`).
- 10.5.2 The administration (the list + the form + the delete).
- 10.5.3 The upload of the cover (the limit of 1 MB - 0.2.2).
- 10.5.4 The date and the time of the publication (the `Calendar` of the
  platform + the time of the platform).
- 10.5.5 The tests.

**Acceptance**: the tests are green; the end-to-end test of the blog (the
admin writes, publishes, the member reads) is green.

### 10.6 The backend of the comments

**Requirements**
1. The routes: the list of the comments of a post (**the tree**), the create,
   the update (the owner of the comment), the delete (the owner, the admin,
   the servant).
2. A comment has a **parent** (`parent_comment_id` ✔ the model has it): the
   answers are a **tree**, the replies are nested under their comment.
3. The content is at most **500 words** (the backend counts them; the
   frontend shows the counter).
4. The formatting that the owner asked for (the bullets, the underline, the
   colour, the emojis) is **stored as sanitized HTML** - the backend never
   trusts the HTML: a **sanitizer** removes the scripts and the dangerous
   attributes. **The sanitizer is not installed today** → the phase adds the
   dependency (`bleach`, pinned; `pip-audit` must stay clean).
   **Decision D-7**: the policy of the tags that are allowed.
5. The deletion is **soft** (`status = DELETED` ✔ the model has the statuses):
   the text becomes "تم حذف التعليق" and the replies stay.
6. A comment on a post of another member **notifies** the owner of the post
   and the owner of the parent comment (the event `CommentCreated` exists ✔,
   its consumer sleeps today).
7. The comment of a **member** is not editable by the admin (the admin can
   delete it, not change it) - the rule is written in the catalogue.

**Tasks**
- 10.6.1 The DTOs, the commands and the queries of the comments module.
- 10.6.2 The router + the mount.
- 10.6.3 The **sanitizer** (the policy of the tags: `p`, `br`, `strong`,
   `em`, `u`, `s`, `ul`, `ol`, `li`, `blockquote`, `span` with a colour from
   the palette, `a` with a safe `href`).
- 10.6.4 The count of the words (the backend, the limit of 500).
- 10.6.5 The consumer of `CommentCreated` (the notification).
- 10.6.6 The tests: the tree, the limit, the sanitizer (a script is removed),
   the permissions, the soft deletion, the notification.

**Acceptance**: the tests are green; a comment with a script is stored
without it.

### 10.7 The frontend of the comments

**Requirements**
1. The comments are shown as a **tree**: the replies are indented under their
   comment, with a line that shows the depth (the platform's colours: the
   border in `--border`, the indent of 4 per level).
2. The member writes with a **rich editor**: the text, the **bullets**, the
   **underline**, the **colour** (the palette of the platform: the navy, the
   blue, the mint, the orange, the red) and the **emojis**. The editor is
   **TipTap** (the decision D-5 of the owner): the same one as the body of a
   post, so the toolbar and the rules are written once.
3. The editor counts the **words** and shows the counter (the limit of 500,
   the colour of the warning when it is near).
4. The member can **reply** to a comment, **edit** their own and **delete**
   their own (the admin and the servant can delete any comment).
5. The button of the delete asks for a confirmation (`AlertDialog`).
6. The notification of a comment arrives in the bell (the type
   `BLOG_COMMENT`).
7. The render test proves: the tree, the counter, the reply, the delete.

**Tasks**
- 10.7.1 The schemas + the client + the hooks (`modules/comments/`).
- 10.7.2 The component `CommentThread.tsx` + `CommentItem.tsx` (the tree).
- 10.7.3 The editor (the toolbar of the platform: the bold, the bullets, the
   underline, the colour, the emoji).
- 10.7.4 The counter of the words.
- 10.7.5 The tests.

**Acceptance**: the tests are green; the coverage of the new code is above
70 %.

### 10.8 The likes

**Requirements**
1. Every role (member, servant, admin) may like a post and **unlike** it
   (the same endpoint, it toggles).
2. The post shows the **count** of the likes.
3. The **owner of the post** and the **admin** alone see **who** liked it (a
   list with the name and the avatar of each member) - the list is not
   public.
4. A member may like a post only **once** (the table has a unique
   constraint? → the repository enforces it).
5. The count is the number of the **active** likes (the revoked ones do not
   count).
6. The render test proves the button, the count and the list for the owner.

**Tasks**
- 10.8.1 The backend: the toggle, the count, the list (the repository
   exists ✔ - the commands and the queries are missing).
- 10.8.2 The frontend: the button with the count, the panel of "who liked
   it" (the owner and the admin).
- 10.8.3 The tests.

**Acceptance**: the tests are green.

---

## 11. The order of the phases

The phases are **sequential**: the next one starts when the previous one is
accepted. The order follows the dependencies (the table below) and the
**value for the members** (the points that the members use first come first).

| # | The phase | The point | Depends on | The size |
|---|---|---|---|---|
| 0.1 | The shared header with the way back | 6 | — | half a day |
| 0.2 | The media service takes the size | 7 | — | 2 hours |
| 0.3 | The rules of the content | 1, 4, 7 | — | half a day |
| 1.1-1.2 | The page "About Us" | 1 | 0.1, 0.3 | 1 day |
| 2.1-2.3 | "My points": per quiz and per month | 2 | — | 2 days |
| 3.1 | The gallery goes away | 3 | — | 1 hour |
| 4.1 | The links of the landing page | 4 | — | half a day |
| 4.2-4.4 | The slider that the admin controls | 4 | 0.2, 4.1 | 3 days |
| 5.1-5.3 | The audit of the calculations | 5 | — | 2 days |
| 5.2 | The analysis of a quiz | 5 | 5.1 | 2 days |
| 5.3 | The report that can be taken away | 5 | 5.1 | 1 day |
| 6.1-6.2 | The way back on every screen | 6 | 0.1 | 2 days |
| 7.1 | The rules of the blog | 7 | 0.3 | half a day |
| 7.2 | The backend of the posts | 7 | 7.1 | 3 days |
| 7.3 | The notification and the mail | 7 | 7.2 | 2 days |
| 7.4 | The list of the posts | 7 | 7.2 | 2 days |
| 7.5 | The page of a post and the administration | 7 | 7.2, 7.4 | 3 days |
| 7.6 | The backend of the comments | 7 | 7.2 | 3 days |
| 7.7 | The frontend of the comments | 7 | 7.6, 7.5 | 3 days |
| 7.8 | The likes | 7 | 7.2, 7.5 | 2 days |

**The critical path:** 7.1 → 7.2 → 7.5 → 7.7 (the blog). The other points
can be delivered **in parallel** by another person, because they touch
different modules.

**The recommended order for one person:** 3.1 (one hour, the gallery) →
0.1 → 1.1-1.2 (About) → 4.1 (the links) → 6.1-6.2 (the way back) → 2.1-2.3
(my points) → 5.1-5.3 (the analysis) → 0.2 → 4.2-4.4 (the slider) → the blog
(the eight phases).

**The total:** about **30 working days** for the seven points, the blog
included.

---

## 12. The decisions of the owner (2026-10-29 — all of them are taken)

The owner answered **every** question on 2026-10-29. The answers are the
contract of the phases below: they are written in the plan, they are in the
commit of the phase, and they are in `docs/business-rules.md` when they are a
rule of the platform.

| # | The question | The answer of the owner | What it changes in the plan |
|---|---|---|---|
| **D-1** | The text of the "About Us" page: in the repository or in the administration? | **(a) in the repository** | The phase 1.1 writes the text in `ar.ts` (the namespace `aboutUs`). There is **no table, no router and no admin screen** for it |
| **D-2** | The social links of the footer | **Only Facebook: the account and the group. The other icons are removed.** The account: `https://www.facebook.com/share/1DR39SM7cS/` · the group: `https://www.facebook.com/share/g/1W86NCJfkF/` | The phase 4.1 removes the Instagram and the YouTube icons and the third entry, and keeps the two links of Facebook (the two icons are the same network: the **account** and the **group**) |
| **D-3** | Who manages the slides of the landing page? | **The admin alone.** The slides live in a **new section of the administration: "Content Management"** ("إدارة المحتوى"), and **inside it the management of the slider carousel** | The phase 4.2 (the API) protects the routes with the admin only. The phase 4.3 adds the section **"Content Management"** to the sidebar of the administration, with the entry **"the slider carousel"** inside it |
| **D-4** | The "tags" of the posts | **The tables keep the name "categories"; the interface says "tags"** | The DTOs and the schemas are named `tag`/`tags`; the models stay `BlogCategory`/`BlogPostCategory`. No migration of the tables |
| **D-5** | The editor of the body of a post and of a comment | **TipTap is added** | The phases 7.5 and 7.7 add `@tiptap/react` + the starter kit (pinned; Renovate keeps them up to date). The output is HTML, sanitized by the backend |
| **D-6** | Who may write a post? | **The admin and the servant** | The permissions of the blog: the **owner of the post**, the **admin** and the **servant** may write; a member may only read and comment |
| **D-7** | The HTML of the comments and the depth of the replies | **The allowed HTML as recommended, and the replies without a limit** | The policy of the sanitizer: `p, br, strong, em, u, s, ul, ol, li, blockquote, span (the colours of the palette), a (a safe href)`. The tree has no depth limit |
| **D-8** | The depth of the replies | **Without a limit** (the same answer as D-7) | The model carries the tree; the interface indents and shows the depth |
| **D-9** | The 52 MB of PNG in the history of the repository | **Not decided** - it does not block any phase of this plan | Nothing in this plan changes; the working tree is 4.5 MB and the question stays with the team |

### 12.1 What the decisions add to the plan

1. **A new section in the administration: "Content Management"** (`إدارة المحتوى`).
   It holds the **slider carousel** (phase 4.3). It is the home of the content
   that the platform shows to the members and that the admin changes without
   a code deployment. The **blog** (phase 7.5) joins the same section: it is
   content of the same nature, and a second place for the posts would split
   the work of the admin in two.
2. **The footer's social part**: two links of Facebook (the account and the
   group), the icons of Instagram and YouTube are **removed** (they are not
   links to anything).
3. **The blog is written by the servants too**: the form of the post is under
   the guard of the **servant** (and the admin), and the administration of
   the posts is in the section "Content Management".
4. **TipTap** is the editor of the body of a post and of a comment. It is a
   **new dependency** of the frontend: it is pinned, it goes through
   `npm audit` and the review of Renovate, and the content is **sanitized by
   the backend** whatever the editor sends.

## 13. The definition of "done" (the same for every phase)

A phase is done when **all** of it is true:

1. The **code** is on the branch, one concern per commit, with a message that
   says what it changes and names the point of `TODO.md`.
2. The **gates** are green: `ruff`, `ruff format --check`, `mypy`, `pytest`
   (the coverage floor of 77 % holds), `prettier --check`,
   `eslint --max-warnings 0`, `tsc -b`, `vitest --coverage` (the floors
   72/61/65/74 hold **and never go down**), `npm run build`, `npm audit`,
   `alembic check`, `gitleaks`.
3. The **tests** of the new behaviour exist: the unit tests for the logic, a
   render test for every new screen, an end-to-end test for every new
   journey.
4. The **contract** is guarded: a new endpoint comes with its schema, and
   the three guard tests pass.
5. The **strings** are in `ar.ts` (no literal in a component), and the
   translation parity test is green.
6. The **accessibility** is checked: every control has a name, the keyboard
   reaches everything, the focus is visible (`focus-ring`).
7. The **documentation** is up to date: the rules in `docs/business-rules.md`,
   the progress in `docs/AUDIT_REMEDIATION_PLAN.md`, and the defects that
   were found in the feedback document.
8. The **decision** of the phase (if there is one) was asked **before** the
   work, and the answer is written in the commit.

---

## 14. The risks that are known today

| The risk | Where it hurts | The answer |
|---|---|---|
| The blog is a **new module with a new surface** (the comments, the notifications, the mail, the editor) | 7.2 → 7.8 | The phases are small and each one is behind a guard. The first phase (the backend of the posts) has **no** frontend: the API is proved by its tests before a screen is built on it |
| The editor is a **new dependency** | 7.5, 7.7 | D-5. If the answer is no, the phases 7.5 and 7.7 lose the formatting and the sanitizer (the body is then plain text and the backend keeps the sanitizer for the future) |
| The **media** grows (the covers of the posts, the slides) | 0.2, 4.2, 7.5 | The limits are explicit (1 MB for a post, 2 MB for a slide); the storage is outside the repository (Cloudinary); the audit found no file in the repository |
| The **coverage floors** must not go down while the new code arrives | every phase | The floors are set on the **measured** value and they only go up. A phase that adds a lot of untested code raises the floor with its tests |
| The **secret rotation** is still open (the human task of the audit) | the deployment | It does not block these phases, but it must not be mixed with them: the rotation is its own day, with its own recipe (R-01 of the audit report) |
