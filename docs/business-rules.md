# The business rules of the platform

Every rule of the platform has an identifier. The code cites it in the
docstrings (`BR-9`, `D-13`, `P5-031` …) so that a reader can tell **why**
a line exists and not only **what** it does.

This file is the catalogue: it says what every identifier means, which
module owns it, and where it is implemented. A test in the pipeline
(`backend/tests/unit/test_business_rules_catalogue.py`) fails when the
code cites an identifier that is not listed here.

## How the identifiers are built

| Prefix | Meaning | Where the rule comes from |
|---|---|---|
| `BR-xx` | A **business rule**: what must be true for the members and for the platform | The phase plans in `docs/Agile/phase-*/` |
| `D-xx` | A **decision**: a choice the team made (and can revisit) | The phase plans in `docs/Agile/phase-*/` |
| `P5-xxx` | A **phase-5 task**: a piece of work of the last phase | `docs/Agile/phase-5/` |
| `DR-xx` | A **design rule** of the interface (from the frontend) | The design guide (`docs/Design-Guide.md`) |

## Two things a reader has to know

1. **The numbering restarts in every phase.** `BR-1` is the timezone in
   the attendance module and the feed of the notifications module. The
   catalogue therefore gives the **module** as the second key: the
   identifier alone is not enough. This is a defect of the original
   plans (the rules were numbered per phase), not of the code.
2. **The rules of the last phases were never written down.** `BR-1`
   to `BR-17` have their statement in the phase plans; `BR-18` to
   `BR-40` are cited by the code and mentioned in the prose of the
   phase-5 plan, but their statement is **not** in the repository. The
   entries below are therefore written from the implementation - they
   say what the code does, which is the truth that matters.

---

## Attendance

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-2` | A check-in after the meeting start + the grace period is `LATE`, otherwise `PRESENT` | `app/modules/attendance/application/commands/check_in_command.py` |
| `BR-3` | `PRESENT` and `LATE` both count as attended; a late member never counts as absent | `app/modules/attendance/application/services/absence_service.py` |
| `BR-4` | The expected population of a meeting: the `ACTIVE` members whose account existed at the end of that meeting week | `app/modules/attendance/application/services/absence_service.py` |
| `BR-5` | The absent list of the open meeting is provisional until the absence cutoff; the answers carry `is_final` | `app/modules/attendance/application/services/statistics_service.py` |
| `BR-6` | The attendance records are append-only: the only correction is `EXCUSED` | `app/modules/attendance/application/commands/excuse_attendance_command.py` |
| `BR-7` | Every management route of the attendance needs `ADMIN` or `SERVANT`; a member reads only their own record | `app/modules/attendance/presentation/router.py` |
| `BR-8` | A check-in writes the attendance row, the outbox event and the audit row in **one** transaction | `app/modules/attendance/application/commands/check_in_command.py` |
| `BR-10` | The notification of a recorded attendance joins the same unit of work; a failing notification never aborts the check-in | `app/modules/attendance/application/commands/check_in_command.py` |
| `D-8` | The legacy attendance models (`ServiceSession`, `AttendanceRecord`) are **frozen**: they are not migrated, not extended and not removed | `app/modules/attendance/infrastructure/persistence/attendance_repository.py` |

## Notifications

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-1` | The feed of a member: their own rows **and** the broadcasts, newest first | `app/modules/notifications/presentation/router.py` |
| `BR-2` | A notification is read for a member when a `notification_reads` row exists for the pair | `app/modules/notifications/infrastructure/persistence/notification_read_repository.py` |
| `BR-3` | Marking a notification as read is idempotent: the second call changes nothing and answers 200 | `app/modules/notifications/infrastructure/persistence/notification_read_repository.py` |
| `BR-4` | "Mark all as read" marks every notification that is visible and unread at that moment | `app/modules/notifications/presentation/router.py` |
| `BR-5` | Every notification carries both languages and neither may be empty | `app/modules/notifications/application/copy.py` |
| `BR-6` | Only `ADMIN` may push a broadcast; `SERVANT` and `MEMBER` get 403 | `app/modules/notifications/presentation/router.py` |
| `BR-7` | Reading and changing **one's own** notifications needs only an authentication | `app/modules/notifications/presentation/router.py` |
| `BR-8` | The notification row and the audit row are committed **before** the mails go out; a failing mail never undoes the notification | `app/modules/notifications/application/services/notification_service.py` |
| `BR-9` | A published blog post creates one broadcast of type `BLOG_POST` and fans the mails out | `app/modules/notifications/application/copy.py` |
| `BR-10` | A recorded attendance creates one per-user notification of type `ATTENDANCE` | `app/modules/notifications/application/copy.py` |
| `D-4` | The unread badge and the counters of the tabs | `app/modules/notifications/presentation/router.py` |
| `D-6` | The creation time of a notification is the moment it was written, so the feed and the mails always agree | `app/modules/notifications/application/copy.py` |
| `D-13` | The blog consumer waits for the publish command (the blog module has only its data layer so far) | `app/modules/notifications/application/services/notification_service.py` |
| `D-24` | The feed can be filtered with a lower time bound (`since`) | `app/modules/notifications/presentation/router.py` |

## Bible (the verses)

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-1` | A verse is created with a validated body; the publication is optional | `app/modules/bible/application/commands/verse_commands.py` |
| `BR-2` | The validation of a verse mirrors the rules exactly; every field carries a description | `app/modules/bible/application/dto/verse_dto.py` |
| `BR-3` | A member sees a verse only when it is `PUBLISHED`; otherwise the route answers 404 | `app/modules/bible/presentation/router.py` |
| `BR-4` | A lifecycle transition moves the verse between `DRAFT`, `PUBLISHED` and `ARCHIVED` | `app/modules/bible/infrastructure/persistence/verse_repository.py` |
| `BR-5` | Only `DRAFT↔PUBLISHED` and `ARCHIVED→DRAFT` are allowed | `app/modules/bible/application/dto/verse_dto.py` |
| `BR-6` | Deleting a verse archives it and archives its quiz with it | `app/modules/bible/application/commands/verse_commands.py` |
| `BR-7` | Editing a published verse never touches its publication metadata | `app/modules/bible/application/commands/verse_commands.py` |
| `BR-8` | A publication may not be scheduled further than two years ahead | `app/modules/bible/application/commands/schedule_commands.py` |
| `BR-9` | A verse has at most one active publication schedule; a new one replaces it | `app/modules/bible/application/commands/schedule_commands.py` |
| `BR-10` | A scheduled publication runs **once**: the row is locked for the whole transaction | `app/modules/bible/application/services/publication_service.py` |
| `BR-11` | The publication runner has a retry budget; an exhausted budget is reported to the admins | `app/modules/bible/application/services/publication_service.py` |
| `BR-12` | The attempt chain of a scheduled publication | `app/modules/bible/infrastructure/persistence/models.py` |
| `BR-13` | The member engagement is counted per opening (a filtered counter) | `app/modules/bible/application/dto/analytics_dto.py` |
| `BR-14` | The engagement of a member is written with `ON CONFLICT DO NOTHING` | `app/modules/bible/infrastructure/persistence/engagement_repository.py` |
| `BR-16` | The aggregates of the engagement feed the analytics | `app/modules/bible/infrastructure/persistence/engagement_repository.py` |
| `BR-18` | The member projection of the feed leaves the quizzes of the member out | `app/modules/bible/application/queries/verse_queries.py` |
| `BR-24` | The publication notification is retried (five attempts at most) and never blocks the publication | `app/modules/bible/application/handlers/bible_verse_published_handler.py` |
| `BR-37` | The analytics of the verses | `app/modules/bible/application/queries/verse_analytics_query.py` |
| `BR-40` | The CSV export of the engagement table (UTF-8 BOM, for Excel and Arabic) | `app/core/csv/__init__.py` |
| `D-2` | "This week": the newest published verse; none → 204 | `app/modules/bible/application/queries/verse_queries.py` |
| `D-6` | "Mark as read" is required before a quiz of the verse may be started | `app/core/exceptions/errors.py` |
| `D-11` | `DELETE` is an archive, never a hard delete | `app/modules/bible/application/commands/verse_commands.py` |
| `D-16` | Two openings of the same verse within the de-duplication window count once | `app/modules/bible/infrastructure/persistence/engagement_repository.py` |
| `P5-005` | The persistence of the engagement (the openings and the reads) | `app/modules/bible/infrastructure/persistence/engagement_repository.py` |
| `P5-008` | The shared dependencies of the module | `app/modules/bible/presentation/dependencies.py` |
| `P5-009` | The DTOs of the verses | `app/modules/bible/application/dto/verse_dto.py` |
| `P5-010` | The queries of the verses (the list, the stats, the detail, the feed) | `app/modules/bible/application/queries/verse_queries.py` |
| `P5-011` | The content management of the verses | `app/modules/bible/presentation/router.py` |
| `P5-012` | Only `https` URLs on the configured Cloudinary host are accepted | `app/modules/bible/application/dto/verse_dto.py` |
| `P5-013` | The scheduling of the verses | `app/modules/bible/presentation/router.py` |
| `P5-014` | The runner of the scheduled publications (idempotent) | `app/modules/bible/application/services/publication_service.py` |
| `P5-017` | The handler of the `bible_verse.published` event | `app/modules/bible/application/handlers/bible_verse_published_handler.py` |
| `P5-033` | The analytics of the verses | `app/modules/bible/presentation/router.py` |
| `P5-036` | The CSV export of the engagement table | `app/modules/bible/presentation/router.py` |

## Quiz

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-14` | The take path is gated: the member may only take a quiz they are allowed to take | `app/modules/quiz/application/commands/attempt_commands.py` |
| `BR-18` | Every mutation recomputes `total_points` from the questions | `app/modules/quiz/application/commands/quiz_commands.py` |
| `BR-19` | The correct answer is never exposed to a member | `app/modules/quiz/application/dto/quiz_dto.py` |
| `BR-20` | A question has 2–6 options and exactly one correct answer | `app/modules/quiz/application/commands/question_commands.py` |
| `BR-21` | A quiz may only be published when it is publishable; the answer says which rule failed | `app/core/exceptions/errors.py` |
| `BR-22` | The snapshot of a quiz is immutable while it is taken | `app/modules/quiz/application/commands/attempt_commands.py` |
| `BR-24` | There is no wall-clock deadline: the attempt ends when the member submits | `app/modules/quiz/infrastructure/persistence/models.py` |
| `BR-26` | The current selection is upserted; the answer returns the fresh budget anchor | `app/modules/quiz/presentation/router.py` |
| `BR-27` | The snapshot of a quiz is immutable while it is taken (the other half of BR-22) | `app/modules/quiz/application/commands/attempt_commands.py` |
| `BR-28` | The result and the review of a finished attempt belong to their owner only | `app/modules/quiz/application/queries/attempt_queries.py` |
| `BR-29` | The awarding is idempotent: a second grading of the same attempt pays nothing | `app/modules/quiz/application/commands/attempt_commands.py` |
| `BR-30` | There is no wall-clock deadline (the other half of BR-24) | `app/modules/quiz/infrastructure/persistence/models.py` |
| `BR-31` | The awarding is idempotent at the level of the ledger | `app/modules/quiz/application/commands/attempt_commands.py` |
| `BR-35` | The points of a finished attempt come from the ledger | `app/modules/quiz/application/dto/attempt_dto.py` |
| `BR-37` | The analytics of the quizzes | `app/modules/quiz/application/queries/quiz_analytics_query.py` |
| `BR-38` | The analytics of the quizzes (the second half) | `app/modules/quiz/application/queries/quiz_analytics_query.py` |
| `D-4` | One attempt per member and quiz; an attempt in progress is resumed, never restarted | `app/modules/quiz/application/commands/attempt_commands.py` |
| `D-12` | Exactly one quiz per verse | `app/modules/quiz/infrastructure/persistence/models.py` |
| `D-13` | The options of an edit keep their identity (the id of the option is sent back) | `app/modules/quiz/application/dto/quiz_dto.py` |
| `D-17` | The grading is pure mathematics, free of the database and unit-testable | `app/modules/quiz/application/services/grading_service.py` |
| `P5-006` | The persistence of the questions and their options | `app/modules/quiz/infrastructure/persistence/question_repository.py` |
| `P5-008` | The shared dependencies of the module | `app/modules/quiz/presentation/dependencies.py` |
| `P5-023` | The permissions of the service boundary | `app/modules/quiz/application/commands/permissions.py` |
| `P5-025` | The reordering payload must be a permutation of the questions | `app/core/exceptions/errors.py` |
| `P5-026` | The content queries of the quizzes | `app/modules/quiz/application/queries/quiz_queries.py` |
| `P5-027` | The DTOs of the attempts | `app/modules/quiz/application/dto/attempt_dto.py` |
| `P5-028` | Starting the one attempt of a member and a quiz | `app/modules/quiz/presentation/router.py` |
| `P5-029` | Reloading one's own attempt in progress, with the stored selection | `app/modules/quiz/application/commands/attempt_commands.py` |
| `P5-031` | Grading and awarding, idempotent; submitting is the only way an attempt ends | `app/modules/quiz/application/commands/attempt_commands.py` |
| `P5-032` | The card of the points of a member (the finished attempts, the average score) | `app/modules/quiz/infrastructure/persistence/attempt_repository.py` |
| `P5-034` | The analytics of the quizzes | `app/modules/quiz/presentation/router.py` |
| `P5-035` | The number of quizzes published in a month | `app/modules/quiz/infrastructure/persistence/quiz_repository.py` |
| `P5-036` | The CSV export of the quizzes | `app/modules/quiz/presentation/router.py` |
| `P5-057` | The aggregated statistics of the quizzes for the dashboard | `app/modules/quiz/presentation/router.py` |

## Points

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-29` | The caller reads `inserted=False` as "the attempt was already paid out" | `app/modules/points/infrastructure/persistence/point_transaction_repository.py` |
| `BR-31` | The ledger pays an attempt exactly once, at the level of the database | `app/modules/points/infrastructure/persistence/models.py` |
| `BR-32` | The ledger is append-only and immutable: one row per finished attempt | `app/modules/points/infrastructure/persistence/models.py` |
| `BR-33` | The period keys are computed in the platform timezone at the moment of the award | `app/modules/points/infrastructure/persistence/models.py` |
| `BR-34` | The lifetime points of a member | `app/modules/points/application/dto/points_dto.py` |
| `BR-36` | The persistence of the ledger | `app/modules/points/infrastructure/persistence/point_transaction_repository.py` |
| `BR-39` | The monthly leaderboard and the exports | `app/modules/points/presentation/analytics_router.py` |
| `BR-40` | The CSV export of the monthly users table | `app/modules/points/presentation/analytics_router.py` |
| `D-5` | The week and the month of the platform start on Monday and on the first of the month | `app/core/time/periods.py` |
| `P5-007` | The persistence of the ledger | `app/modules/points/infrastructure/persistence/point_transaction_repository.py` |
| `P5-008` | The shared dependencies of the module | `app/modules/points/presentation/dependencies.py` |
| `P5-032` | The history of the points, joined with the title of the quiz and the reference of the verse | `app/modules/points/infrastructure/persistence/point_transaction_repository.py` |
| `P5-035` | The monthly analytics | `app/modules/points/application/queries/monthly_analytics_query.py` |
| `P5-036` | The CSV export of the monthly users table | `app/modules/points/presentation/analytics_router.py` |

## Anonymous messages

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-11` | The row never holds a user id, an author id, a session or an IP; no endpoint may return one | `app/modules/anonymous_messages/application/dto/anonymous_message_dto.py` |
| `BR-12` | The rate-limit key is a salted hash: the identity itself is never stored | `app/core/rate_limit/__init__.py` |
| `BR-13` | The row is persisted **before** the delivery; a failing Telegram call never loses the message | `app/modules/anonymous_messages/application/services/anonymous_message_service.py` |
| `BR-14` | Every attempt is counted exactly once (`attempts`, `last_attempt_at`) | `app/modules/anonymous_messages/infrastructure/persistence/anonymous_message_repository.py` |
| `BR-15` | Exceeding a limit answers 429 with a `Retry-After`; the message says how long to wait | `app/modules/anonymous_messages/presentation/router.py` |
| `BR-16` | The bounds of the form: 10–1000 characters, a sender name of at most 80 | `app/config.py` |
| `D-1` | The message carries no identity at all | `app/modules/anonymous_messages/infrastructure/persistence/anonymous_message_repository.py` |
| `D-3` | The delivery is inline in the request; an admin may retry it | `app/modules/anonymous_messages/infrastructure/persistence/anonymous_message_repository.py` |
| `D-9` | The submission is public: an expired token does not block it | `app/modules/anonymous_messages/presentation/dependencies.py` |
| `D-11` | The admin listing, newest first | `app/modules/anonymous_messages/presentation/router.py` |
| `D-20` | The Telegram delivery: one chat, forward only | `app/modules/anonymous_messages/infrastructure/telegram/client.py` |
| `D-22` | The rate limits live in the memory of the instance (a sliding window) | `app/modules/anonymous_messages/presentation/router.py` |

## Core and shared kernel

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-5` | A status transition outside the matrix is refused | `app/core/exceptions/errors.py` |
| `BR-8` | A scheduled publication may not be in the past nor too far ahead | `app/core/exceptions/errors.py` |
| `BR-9` | The verse already has an active publication schedule | `app/core/exceptions/errors.py` |
| `BR-12` | The rate-limit keys arrive pre-hashed (a salted SHA-256, never reversible) | `app/core/rate_limit/__init__.py` |
| `BR-15` | The rate limits are sliding windows in the memory of the instance | `app/config.py` |
| `BR-16` | The bounds of the anonymous message form | `app/config.py` |
| `BR-21` | The publication validation failed; `data.failed_rules` says why | `app/core/exceptions/errors.py` |
| `BR-23` | The verse or the quiz is not published for the member | `app/core/exceptions/errors.py` |
| `BR-26` | The grace of five seconds absorbs the latency of the network | `app/config.py` |
| `BR-33` | The first day of the month that contains the day | `app/core/time/periods.py` |
| `BR-40` | The CSV helper writes a UTF-8 BOM (Excel and Arabic) | `app/core/csv/__init__.py` |
| `D-4` | One attempt per member and quiz; `data.attempt_id` resumes it | `app/core/exceptions/errors.py` |
| `D-5` | The Monday of the ISO week that contains the day | `app/core/time/periods.py` |
| `D-6` | "Mark as read" is required before starting the quiz | `app/core/exceptions/errors.py` |
| `D-12` | One quiz per verse | `app/core/exceptions/errors.py` |
| `D-16` | The de-duplication window of the openings | `app/config.py` |
| `D-20` | The Telegram delivery: one chat, forward only | `app/config.py` |
| `D-22` | The rate limits stay in the memory until abuse is observed | `app/core/rate_limit/__init__.py` |
| `P5-015` | The outbox: the handlers own their terminal conditions | `app/shared/infrastructure/persistence/outbox.py` |
| `P5-025` | The reorder payload is not a permutation of the questions | `app/core/exceptions/errors.py` |
| `P5-036` | The CSV helper with the UTF-8 BOM | `app/core/csv/__init__.py` |

## The scheduler (internal module)

| Identifier | The rule | Where it lives |
|---|---|---|
| `D-3` | The scheduler runs on a cron tick | `app/modules/internal/__init__.py` |
| `P5-019` | The tick endpoint of the scheduler | `app/modules/internal/presentation/router.py` |

---

## The calculations of the reports (the point 5 of the plan)

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-41` | What counts as an attempt: a finished attempt is one whose status is `COMPLETED` (submitted by the member) or `AUTO_FINISHED`; `IN_PROGRESS` never counts as finished, in the monthly report nor in the per-quiz analytics | `app/modules/quiz/infrastructure/persistence/attempt_repository.py` (`quiz_kpis`, `score_distribution`, `completion_status_counts`, `results_page`) |
| `BR-42` | What the average score is: the average of the scores out of ten (`round(score / total_points * 10, 1)` per finished attempt), rounded to one decimal, over the finished attempts paid out in the period; attempts whose snapshotted total is zero count as zero | `app/modules/points/infrastructure/persistence/point_transaction_repository.py` (`monthly_kpis`) |
| `BR-43` | What the completion rate is: finished attempts of the member in the month ÷ quizzes published in the month × 100, rounded to one decimal; the denominator is at least one (`max(published, 1)`) so a month without published quizzes never divides by zero | `app/modules/points/application/queries/monthly_analytics_query.py` (`monthly_users_query`, `monthly_users_export`) |
| `BR-44` | The month: the platform timezone (`Africa/Cairo`, neither the server nor the browser) and the first day of the local month as the period key (`month_start` of the award moment); a month runs from its first instant `00:00` local to the first instant of the next month | `app/core/time/periods.py` (`month_start`, `month_bounds`), `app/core/time/clock.py` (`platform_timezone`) |
| `BR-45` | The participants: the distinct members with at least one finished attempt paid out in the month | `app/modules/points/infrastructure/persistence/point_transaction_repository.py` (`monthly_kpis`) |
| `BR-46` | The auto-finished attempts: they count as finished — they count in the participants, the completed count, the average score and the points of the month; only `IN_PROGRESS` is left out | `app/modules/quiz/infrastructure/persistence/attempt_repository.py` (`quiz_kpis` filters `status != IN_PROGRESS`) |
| `BR-47` | The export carries the same numbers as the page: the same query, the same filters (`q`, `min_points`, `score_range`, `completion_rate`, `min_quizzes`) and the same completion-rate denominator; only the pagination disappears (every matching row) | `app/modules/points/presentation/analytics_router.py` (`monthly_users_export`) and `app/modules/quiz/presentation/router.py` (`quiz_analytics_users_export`) |
| `BR-48` | The archived or hidden quizzes: the reports do not filter by the quiz's status, so an attempt on a quiz that is `DRAFT` or `ARCHIVED` still counts in the monthly report and in the per-quiz analytics, as long as the quiz row still exists | `app/modules/points/infrastructure/persistence/point_transaction_repository.py` (`monthly_kpis` joins no quiz-status filter); `app/modules/quiz/application/queries/quiz_analytics_query.py` (`quiz_analytics_query` checks the quiz exists but not its status) |
| `BR-49` | The attempts of a deleted member: the platform protects those records by cascade — deleting a member deletes their attempts and their ledger rows, so they disappear from the reports instead of dangling | `app/modules/quiz/infrastructure/persistence/models.py` (`quiz_attempts.user_id`, `ondelete=CASCADE`); `app/modules/points/infrastructure/persistence/models.py` (`point_transactions.user_id`, `ondelete=CASCADE`) |
| `BR-50` | The average score of a quiz (per-quiz analytics): `round(total points awarded ÷ participants ÷ max possible points × 10, 1)`, which is not the per-attempt average of the monthly report | `app/modules/quiz/application/queries/quiz_analytics_query.py` (`quiz_analytics_query`) |

---

## The known defect of the numbering

The rules were numbered per phase, so the same number means different
things in different modules (`BR-1` is the timezone of the attendance
and the feed of the notifications). The code cites the number without
the module ✗ → a reader has to know the module to understand the
citation.

The clean fix is to number the rules once, for the whole platform
(`BR-A-1` for the attendance, `BR-N-1` for the notifications, …) and
to change the citations with it. That touches every docstring that
cites a rule (about 300 places ✗) and the phase plans. It is a
mechanical change with no behaviour, but it is **not** part of this
remediation: it touches the traceability of every rule of the
platform, and it deserves its own review.

Until then, this catalogue is the map: read the module first, then the
number.

## The slides of the landing page (the point 4 of the plan)

| Identifier | The rule | Where it lives |
|---|---|---|
| `BR-41` | The slides of the landing page are managed by the admin alone; the public list is open to everyone (no token) | `app/modules/media/presentation/router.py` |
| `BR-42` | The public list answers only the active slides, ordered by their `order` | `app/modules/media/application/queries/landing_slide_queries.py` |
| `BR-43` | A slide is created with an uploaded image, an optional title and an optional subtitle | `app/modules/media/application/commands/landing_slide_commands.py` |
| `BR-44` | Deleting a slide removes it physically; the media module has no soft-delete pattern | `app/modules/media/application/commands/landing_slide_commands.py` |
| `BR-45` | The image goes through the shared media upload service; slides use the 2 MB limit, like the verse covers | `app/shared/infrastructure/services/image_upload.py` |

