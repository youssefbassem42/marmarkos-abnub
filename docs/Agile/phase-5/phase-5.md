# Phase 5 — Bible Verses, Weekly Content & Quizzes

## Sprint 5 — Bible Engagement & Quiz System

### Epic

**EPIC-005 — Bible Engagement**

### Sprint Goal

Build a complete Bible Verse engagement system where **Servants and Admins** can create, manage, schedule, and analyze Bible Verse posts and related quizzes.

Users should be able to:

```text
Open Bible Verses
      ↓
View Weekly Verse
      ↓
Read Content
      ↓
Mark Verse as Read
      ↓
Open Related Quiz
      ↓
Answer Questions
      ↓
Timer Ends / Submit
      ↓
Automatic Grading
      ↓
Points Awarded
      ↓
Profile Points Updated
```

Servants and Admins should be able to:

```text
Create Verse
      ↓
Create Quiz
      ↓
Schedule Publication
      ↓
Automatic Publication
      ↓
Email Notification
      ↓
Monitor Reads / Opens
      ↓
Monitor Quiz Participation
      ↓
View Marks & Points
      ↓
Monthly Analytics
```

---

# 1. Roles & Permissions

The Bible Engagement module is controlled by:

```text
ADMIN
SERVANT
```

Both roles can manage Bible content and quizzes unless a specific permission says otherwise.

### User

Can:

* View published Bible Verse posts
* Open a post
* Mark a post as read
* Open the related quiz
* Start a quiz
* Answer questions
* Submit/finish quiz
* Receive automatically calculated score
* View own points
* View historical monthly points

### Servant

Can:

* Create Bible Verse posts
* Edit Bible Verse posts
* Delete/archive Bible Verse posts
* Schedule posts
* Publish posts
* Create quizzes
* Edit quizzes
* Configure quiz timer
* View post analytics
* View quiz analytics
* View user scores
* View monthly points

### Admin

Everything a Servant can do, plus:

* Full administrative control
* Manage/remove content created by servants
* View all analytics
* Manage quiz configuration
* Manage scoring configuration where applicable

---

# 2. Sprint Scope

| ID     | Story                                |    Priority | Points |
| ------ | ------------------------------------ | ----------: | -----: |
| US-020 | Bible Verse CRUD                     |   Must Have |      5 |
| US-021 | Weekly Verse Publishing & Scheduling |   Must Have |      8 |
| US-022 | Verse Reading & Engagement Tracking  |   Must Have |      5 |
| US-023 | Quiz Management                      |   Must Have |      8 |
| US-024 | Quiz Taking & Timer                  |   Must Have |      8 |
| US-025 | Automatic Quiz Grading & Points      |   Must Have |      5 |
| US-026 | User Points & Monthly History        |   Must Have |      5 |
| US-027 | Bible & Quiz Analytics               |   Must Have |      8 |
| US-028 | Publication Notifications            | Should Have |      3 |

### Estimated Sprint Capacity

**55 Story Points**

This is a large sprint.

If the team is working with a normal 1–2 week sprint, I would recommend either:

### Option A — Full Sprint 5

Keep the complete scope if the team has sufficient capacity.

### Option B — Split

```text
Sprint 5A
Bible Verse + Scheduling + Reading

Sprint 5B
Quiz + Scoring + Points + Analytics
```

Architecturally, however, these should be designed together because **Verse → Quiz → Attempt → Score → Points → Analytics** is one connected domain.

---

# 3. Domain Model

Do NOT make `BibleVerse` responsible for everything.

Recommended domain structure:

```text
User
 │
 ├───────────────┐
 │               │
 ▼               ▼
VerseRead      QuizAttempt
                  │
                  ▼
              QuizAnswer
                  │
                  ▼
               Points
```

Content:

```text
BibleVerse
    │
    └──< Quiz
           │
           └──< QuizQuestion
                    │
                    └──< QuizOption
```

Scheduling:

```text
BibleVerse
    │
    └── PublicationSchedule
```

Notifications:

```text
Publication
    │
    └── Notification
```

Analytics:

```text
BibleVerse
 ├── Views
 └── Reads

Quiz
 └── Attempts
      └── Answers
```

---

# 4. US-020 — Bible Verse CRUD

### User Story

> As a servant or admin, I want to create, edit, delete, and manage Bible Verse posts so I can publish weekly spiritual content.

### Acceptance Criteria

* [ ] Servant can create a verse
* [ ] Admin can create a verse
* [ ] Servant can edit verse content
* [ ] Admin can edit verse content
* [ ] Authorized users can delete/archive a verse
* [ ] Normal users cannot manage verses
* [ ] Required fields are validated
* [ ] Draft verses are not visible to normal users
* [ ] Published verses are visible to users

### Verse Fields

Recommended:

```text
id
title
verseText
book
chapter
verse
content
coverImage
status
createdBy
createdAt
updatedAt
publishedAt
```

Possible statuses:

```text
DRAFT
SCHEDULED
PUBLISHED
ARCHIVED
```

### Tasks

#### TASK-001 — Bible Verse Entity

Subtasks:

* Create entity
* Define fields
* Define status enum
* Define creator relationship
* Add timestamps
* Add indexes
* Create migration

#### TASK-002 — Verse CRUD Service

Subtasks:

* Create verse
* Get verse
* List verses
* Update verse
* Archive/delete verse
* Validate permissions

#### TASK-003 — Verse API

```http
POST   /bible-verses
GET    /bible-verses
GET    /bible-verses/{id}
PATCH  /bible-verses/{id}
DELETE /bible-verses/{id}
```

#### TASK-004 — Verse Management UI

Create:

```text
Bible Verses
├── All Verses
├── Create
├── Drafts
├── Scheduled
├── Published
└── Archived
```

---

# 5. US-021 — Weekly Verses & Scheduling

### User Story

> As a servant or admin, I want to schedule Bible Verse posts for future weeks so they are automatically published without manual intervention.

### Core Requirement

A servant/admin can create:

```text
Week 1 → Verse A
Week 2 → Verse B
Week 3 → Verse C
Week 4 → Verse D
```

The system automatically publishes each verse at its configured publication date/time.

---

# 6. Publication Schedule

Create a separate scheduling concept.

### Entity

```text
VersePublicationSchedule
```

Fields:

```text
id
verseId
scheduledAt
status
publishedAt
createdBy
createdAt
updatedAt
```

Status:

```text
SCHEDULED
PUBLISHED
CANCELLED
FAILED
```

### Important Rule

A scheduled post must never be published twice.

The publication process must be **idempotent**.

---

# 7. TASK-005 — Schedule Verse

### Subtasks

* Create scheduling entity
* Create schedule API
* Validate scheduled date
* Prevent invalid past schedules
* Associate schedule with verse
* Change verse status to `SCHEDULED`
* Add database indexes

### API

```http
POST /bible-verses/{id}/schedule
```

Example:

```json
{
  "scheduledAt": "2026-09-06T09:00:00"
}
```

---

# 8. TASK-006 — Automatic Publication Worker

The backend needs a scheduled process.

Conceptually:

```text
Every X minutes
       ↓
Find SCHEDULED posts
where scheduledAt <= now
       ↓
Publish
       ↓
Create publication event
       ↓
Send notification
       ↓
Mark schedule as completed
```

### Requirements

* Safe to run repeatedly
* No duplicate publication
* Transaction-safe
* Logs publication failures
* Supports retry
* Does not publish archived/cancelled content

---

# 9. Weekly Verse UI

Users should have a dedicated section:

```text
Bible Verses
─────────────────────────

This Week

┌────────────────────────┐
│ Psalm 23:1             │
│                        │
│ "The Lord is my..."    │
│                        │
│ Read More →            │
└────────────────────────┘
```

Users should primarily see **published** content.

Draft and scheduled content must never be exposed.

---

# 10. US-022 — Verse Opening & Reading Tracking

### User Story

> As a user, I want to open a Bible Verse and mark it as read so I can track my participation.

### Important Distinction

Track:

### Open

User opened the post.

### Read

User explicitly clicked:

**"Mark as Read"**

These are different metrics.

---

# 11. TASK-007 — Verse Open Tracking

When a user opens a published verse:

```text
Verse opened
     ↓
Record view
```

### Requirements

Track:

* Verse
* User
* Opened at

For analytics, decide whether repeated openings count as:

```text
Total Opens
```

or:

```text
Unique Users
```

I recommend tracking both.

### Metrics

```text
Total Opens
Unique Users
```

---

# 12. TASK-008 — Mark Verse as Read

### API

```http
POST /bible-verses/{id}/read
```

### UI

At the bottom of the verse:

```text
┌──────────────────────────────┐
│                              │
│        ✓ Mark as Read        │
│                              │
└──────────────────────────────┘
```

### Rules

* User must be authenticated
* User can mark a verse as read only once
* Repeated requests must be idempotent
* User can see that the verse has already been read

### Entity

```text
VerseRead
──────────────
id
verseId
userId
readAt
```

Database constraint:

```text
UNIQUE(
    verseId,
    userId
)
```

---

# 13. US-023 — Quiz Management

### User Story

> As a servant or admin, I want to create quizzes related to Bible Verses so users can test their understanding.

### Quiz Relationship

Each quiz belongs to a Bible Verse.

```text
Bible Verse
     │
     └── Quiz
          │
          ├── Question 1
          ├── Question 2
          └── Question 3
```

A user accesses the quiz **from the related Bible Verse**.

---

# 14. Quiz Entity

Recommended:

```text
Quiz
────────────
id
verseId
title
description
durationSeconds
totalPoints
status
createdBy
createdAt
updatedAt
```

Status:

```text
DRAFT
PUBLISHED
ARCHIVED
```

---

# 15. Quiz Question

```text
QuizQuestion
──────────────
id
quizId
question
points
order
```

Each question has multiple choices.

```text
QuizOption
──────────────
id
questionId
optionText
isCorrect
```

The correct answer must never be exposed to the frontend before the user submits/finishes the quiz.

---

# 16. TASK-009 — Quiz CRUD

### APIs

```http
POST   /bible-verses/{verseId}/quiz
GET    /bible-verses/{verseId}/quiz
PATCH  /quizzes/{id}
DELETE /quizzes/{id}
```

### Subtasks

* Create quiz
* Add questions
* Add options
* Configure correct answers
* Configure points
* Configure timer
* Validate quiz
* Publish quiz
* Edit quiz
* Archive quiz

---

# 17. Quiz Validation Rules

Before publishing:

* [ ] Quiz has at least one question
* [ ] Every question has valid options
* [ ] Every question has exactly one correct answer
* [ ] Question points are valid
* [ ] Timer is valid
* [ ] Quiz belongs to a valid published/eligible verse

---

# 18. US-024 — User Quiz Taking

### User Story

> As a user, I want to take the quiz associated with the Bible Verse so I can earn points.

### User Flow

```text
Bible Verse
     ↓
Read Content
     ↓
Quiz Available
     ↓
Start Quiz
     ↓
Timer Starts
     ↓
Answer Questions
     ↓
Submit
     ↓
Automatic Grading
     ↓
Score
     ↓
Points
```

---

# 19. Quiz Access

Inside the Bible Verse:

```text
────────────────────────────

Psalm 23:1

"The Lord is my shepherd..."

[ ✓ Mark as Read ]

────────────────────────────

Quiz

Test your understanding

5 Questions
2 Minutes
10 Points

[ Start Quiz ]

────────────────────────────
```

The quiz should not be a completely independent navigation concept for users.

The main entry point is:

**Bible Verse → Related Quiz**

---

# 20. TASK-010 — Quiz Attempt

Create:

```text
QuizAttempt
──────────────
id
quizId
userId
startedAt
submittedAt
finishedAt
expiresAt
status
score
totalPoints
```

Statuses:

```text
IN_PROGRESS
COMPLETED
AUTO_FINISHED
```

---

# 21. TASK-011 — Quiz Answer

Create:

```text
QuizAnswer
──────────────
id
attemptId
questionId
selectedOptionId
isCorrect
pointsAwarded
answeredAt
```

Do not trust `isCorrect` or `pointsAwarded` from the frontend.

The backend calculates them.

---

# 22. US-025 — Quiz Timer

### User Story

> As a servant or admin, I want to control the quiz timer so users have a defined amount of time to complete the quiz.

### Timer Configuration

Example:

```text
1 minute
2 minutes
5 minutes
10 minutes
```

Or configurable duration:

```text
durationSeconds
```

### Requirements

* Timer starts when quiz attempt starts
* Timer is displayed to user
* Timer continues independently of frontend rendering
* Backend determines whether the attempt expired
* When timer reaches zero, quiz automatically finishes
* User cannot submit answers after expiration
* Answers submitted before expiration are preserved

---

# 23. Critical Timer Architecture

Do not rely exclusively on JavaScript:

```text
Frontend Timer ❌
```

The frontend timer is only a visual representation.

The backend must enforce:

```text
expiresAt = startedAt + quiz.duration
```

When submission occurs:

```text
now > expiresAt
```

Then:

```text
AUTO_FINISHED
```

This prevents users from manipulating the browser timer.

---

# 24. TASK-012 — Start Quiz API

```http
POST /quizzes/{id}/attempts
```

Backend:

```text
Validate User
     ↓
Validate Quiz
     ↓
Check Eligibility
     ↓
Create Attempt
     ↓
Calculate expiresAt
     ↓
Return Questions
```

---

# 25. TASK-013 — Submit Quiz API

```http
POST /quiz-attempts/{id}/submit
```

Backend:

```text
Validate Attempt
      ↓
Check Expiration
      ↓
Load Questions
      ↓
Load Correct Answers
      ↓
Evaluate Answers
      ↓
Calculate Score
      ↓
Calculate Points
      ↓
Finalize Attempt
      ↓
Update User Points
```

---

# 26. Automatic Grading

Each question has:

```text
Question
 ├── Option A
 ├── Option B
 ├── Option C ✓
 └── Option D
```

User selects:

```text
Option C
```

Backend:

```text
selectedOptionId == correctOptionId
```

Then:

```text
isCorrect = true
pointsAwarded = question.points
```

Otherwise:

```text
isCorrect = false
pointsAwarded = 0
```

---

# 27. Quiz Score

Example:

```text
Question 1 → 2 points ✓
Question 2 → 2 points ✓
Question 3 → 2 points ✗
Question 4 → 2 points ✓
Question 5 → 2 points ✓

Score = 8 / 10
```

Return:

```text
Score
Total Points
Correct Answers
Incorrect Answers
Percentage
```

---

# 28. US-026 — User Points

### User Story

> As a user, I want to see my total quiz points so I can track my progress.

The user's profile should contain:

```text
My Points
──────────────

Total Points
     85

This Week
     12

This Month
     35
```

---

# 29. Important Points Architecture

Do not calculate historical points only from the current user's quiz attempts.

Create a points ledger.

### Entity

```text
PointTransaction
────────────────────
id
userId
quizAttemptId
points
periodStart
periodEnd
createdAt
```

This makes historical reporting reliable.

---

# 30. Weekly Points

Every completed quiz contributes to the user's points.

Example:

```text
Week 1
Quiz A → 8
Quiz B → 7

Weekly Total = 15
```

At the beginning of a new week:

```text
Current Week = 0
Previous Week = 15
```

The historical week remains available.

---

# 31. Monthly Points

Monthly points should be stored as historical periods.

Example:

```text
August 2026
──────────────
Ahmed       85
Mina        72
Peter       64
```

September starts a new monthly period:

```text
September 2026
──────────────
Ahmed       0
Mina        0
Peter       0
```

August must remain unchanged.

---

# 32. Recommended Point Model

Separate:

### Lifetime Points

All points ever earned.

### Weekly Points

Points earned during current week.

### Monthly Points

Points earned during current month.

### Historical Points

Immutable historical totals.

```text
Lifetime
   │
   ├── Monthly
   │     ├── August
   │     ├── September
   │     └── October
   │
   └── Weekly
         ├── Week 34
         ├── Week 35
         └── Week 36
```

---

# 33. TASK-014 — Points Service

### Responsibilities

* Award points
* Prevent duplicate awarding
* Calculate weekly points
* Calculate monthly points
* Calculate lifetime points
* Retrieve point history

### Critical Rule

A quiz attempt must not award points twice.

Example:

```text
Submit Quiz
     ↓
Award 8 points
     ↓
Repeat API request
     ↓
Must NOT award another 8
```

Use the completed quiz attempt as an idempotency boundary.

---

# 34. Profile Points UI

Add to user profile:

```text
┌──────────────────────────────┐
│ My Bible Quiz Points         │
├──────────────────────────────┤
│                              │
│ Total Points       125       │
│ This Month          35       │
│ This Week           12       │
│                              │
├──────────────────────────────┤
│ Monthly History              │
│                              │
│ August 2026         35       │
│ July 2026            48       │
│ June 2026            42       │
│                              │
└──────────────────────────────┘
```

---

# 35. US-027 — Bible & Quiz Analytics

### User Story

> As a servant or admin, I want to see Bible Verse engagement and quiz performance so I can understand user participation.

Analytics must cover two areas:

```text
Verse Analytics
Quiz Analytics
```

---

# 36. Verse Analytics

For every Bible Verse:

### Metrics

```text
Total Opens
Unique Users Opened
Total Reads
Unique Users Read
Read Rate
```

### Example

```text
Psalm 23:1

Opened
142

Unique Users
97

Marked Read
74

Read Rate
76.3%
```

### Read Rate

```text
Unique Readers
─────────────── × 100
Unique Viewers
```

---

# 37. TASK-015 — Verse Analytics API

```http
GET /bible-verses/{id}/analytics
```

Response should contain:

```text
totalOpens
uniqueOpens
totalReads
uniqueReaders
readRate
```

---

# 38. Quiz Analytics

For every quiz:

```text
Total Participants
Completed Attempts
Auto-Finished Attempts
Average Score
Highest Score
Lowest Score
Total Points Awarded
```

---

# 39. User Quiz Analytics

Servant/Admin must be able to see:

```text
User
Quiz
Score
Percentage
Points
Completion Status
Completed At
```

Example:

```text
User        Quiz              Score    Points
──────────────────────────────────────────────
Ahmed       Psalm 23 Quiz     8/10       8
Mina        Psalm 23 Quiz     10/10     10
Peter       Psalm 23 Quiz     6/10       6
```

---

# 40. Monthly User Analytics

Admin/Servant can select:

```text
August 2026
```

and see:

```text
User          Quizzes    Points
────────────────────────────────
Ahmed            5         42
Mina             4         37
Peter            3         28
```

---

# 41. All-Time User Analytics

Provide:

```text
User
Total Quizzes
Total Points
Average Score
Best Score
```

---

# 42. TASK-016 — Quiz Analytics API

Recommended endpoints:

```http
GET /quizzes/{id}/analytics

GET /quiz-analytics/users

GET /quiz-analytics/users/{userId}

GET /quiz-analytics/monthly?month=2026-08
```

Filters:

```text
quiz
user
month
dateFrom
dateTo
```

---

# 43. TASK-017 — Analytics Dashboard

Servant/Admin dashboard:

```text
Bible Engagement
──────────────────────────────────

Total Posts       24
Published         20
Total Opens       1,248
Total Reads         913

Read Rate          73.2%
```

Quiz:

```text
Quiz Analytics
──────────────────────────────────

Participants       184
Completed          176
Auto Finished        8

Average Score      7.8 / 10
Points Awarded      1,240
```

---

# 44. User Ranking / Monthly Leaderboard

Although not explicitly required, the data model should support it.

Example:

```text
August 2026

🥇 Ahmed      85 pts
🥈 Mina       79 pts
🥉 Peter      71 pts
```

This can remain hidden from users until a future phase if leaderboard functionality is not part of Sprint 5.

---

# 45. US-028 — Publication Notification

### User Story

> As a servant or admin, I want to be notified when my scheduled Bible Verse is automatically published so I know the scheduled content has gone live.

### Important Clarification

The notification goes to the **user who created the scheduled post**, not all users.

Example:

```text
Servant creates:

Verse A
Scheduled:
August 30, 2026 — 09:00

        ↓

August 30 — 09:00

Automatic publication
        ↓
Email creator
```

---

# 46. Publication Email

Subject:

```text
Your scheduled Bible Verse has been published
```

Content:

```text
Hello,

Your scheduled Bible Verse has been automatically published today.

Verse:
Psalm 23:1

Published:
August 30, 2026

You can open the platform to view the published post.

— Youth Service Platform
```

---

# 47. TASK-018 — Notification Event

When publication succeeds:

```text
Verse Published
      ↓
Publication Event
      ↓
Notification Service
      ↓
Creator Email
```

Do not make the scheduler directly responsible for email delivery.

Use an application/domain event:

```text
BibleVersePublished
```

Then:

```text
EmailNotificationHandler
```

handles the email.

This keeps scheduling and notification responsibilities separated.

---

# 48. TASK-019 — Email Delivery

### Requirements

* Send email only after successful publication
* Send to creator
* Prevent duplicate emails
* Record notification status
* Handle failed email delivery
* Retry transient failures
* Log final failures

Notification status:

```text
PENDING
SENT
FAILED
```

---

# 49. Frontend Structure

Recommended user navigation:

```text
Bible Verses
│
├── This Week
│
├── Previous
│
└── Verse Details
       │
       ├── Content
       │
       ├── Mark as Read
       │
       └── Quiz
             │
             └── Start Quiz
```

Servant/Admin:

```text
Bible Management
│
├── Verses
│   ├── All
│   ├── Draft
│   ├── Scheduled
│   └── Published
│
├── Create Verse
│
├── Quizzes
│
└── Analytics
    ├── Verse Analytics
    ├── Quiz Analytics
    ├── User Scores
    └── Monthly Points
```

---

# 50. Verse Details Page

Example:

```text
┌────────────────────────────────────────┐
│ Bible Verse                             │
│                                        │
│ Psalm 23:1                             │
│                                        │
│ "The Lord is my shepherd; I shall not │
│  want."                                │
│                                        │
│ ────────────────────────────────────── │
│                                        │
│ Reflection                             │
│                                        │
│ Lorem ipsum...                         │
│                                        │
│ ────────────────────────────────────── │
│                                        │
│ ✓ Mark as Read                         │
│                                        │
├────────────────────────────────────────┤
│ Weekly Quiz                            │
│                                        │
│ 5 Questions • 10 Points • 2 Minutes   │
│                                        │
│              [ Start Quiz ]            │
└────────────────────────────────────────┘
```

---

# 51. Quiz Screen

```text
┌────────────────────────────────────────┐
│ Psalm 23 Quiz                    01:42 │
├────────────────────────────────────────┤
│                                        │
│ Question 2 of 5                        │
│                                        │
│ Who is described as the shepherd?     │
│                                        │
│ ○ Moses                                │
│ ○ David                                │
│ ● The Lord                             │
│ ○ Peter                                │
│                                        │
│                          [ Next ]      │
└────────────────────────────────────────┘
```

Timer:

```text
01:42
```

must be synchronized with the server-side `expiresAt`.

---

# 52. Quiz Result Screen

```text
┌────────────────────────────────────────┐
│ Quiz Completed                          │
├────────────────────────────────────────┤
│                                        │
│              8 / 10                    │
│                                        │
│ Correct Answers     4 / 5              │
│ Points Earned       8                   │
│                                        │
│ This Month's Points                    │
│                    35                  │
│                                        │
│ [ Back to Bible Verse ]                │
└────────────────────────────────────────┘
```

---

# 53. Admin / Servant Quiz Analytics

Quiz details:

```text
Psalm 23 Quiz
────────────────────────────────────

Participants              42
Completed                 40
Auto Finished              2

Average Score           8.1/10
Total Points             324
```

### User Results

```text
User       Score       Points       Status
────────────────────────────────────────────
Ahmed      10/10         10        Completed
Mina        8/10          8        Completed
Peter       6/10           6        Completed
John        7/10           7        Auto Finished
```

---

# 54. Monthly Analytics

Servant/Admin selects:

```text
[ August 2026 ▼ ]
```

Dashboard:

```text
August 2026

Users Participated       86
Quizzes Completed        312
Total Points            2,480
Average Score             7.9
```

User breakdown:

```text
User       Quizzes      Points      Avg Score
──────────────────────────────────────────────
Ahmed         8           72          90%
Mina          7           64          91%
Peter         6           51          85%
```

---

# 55. API Overview

## Bible Verses

```http
POST   /bible-verses
GET    /bible-verses
GET    /bible-verses/{id}
PATCH  /bible-verses/{id}
DELETE /bible-verses/{id}
```

## Scheduling

```http
POST /bible-verses/{id}/schedule
POST /bible-verses/{id}/publish
DELETE /bible-verses/{id}/schedule
```

## Reading

```http
POST /bible-verses/{id}/open
POST /bible-verses/{id}/read
GET  /bible-verses/{id}/analytics
```

## Quiz

```http
POST   /bible-verses/{id}/quiz
GET    /bible-verses/{id}/quiz
PATCH  /quizzes/{id}
DELETE /quizzes/{id}
```

## Quiz Attempts

```http
POST /quizzes/{id}/attempts
GET  /quiz-attempts/{id}
POST /quiz-attempts/{id}/submit
```

## Points

```http
GET /users/me/points
GET /users/me/points/history
GET /users/me/points/monthly
```

## Analytics

```http
GET /quizzes/{id}/analytics
GET /quiz-analytics/users
GET /quiz-analytics/users/{userId}
GET /quiz-analytics/monthly
```

---

# 56. Database Model

Recommended minimum model:

```text
User
 │
 ├──< BibleVerse
 │       │
 │       ├──< VersePublicationSchedule
 │       │
 │       ├──< VerseView
 │       │
 │       ├──< VerseRead
 │       │
 │       └──── Quiz
 │                │
 │                ├──< QuizQuestion
 │                │       │
 │                │       └──< QuizOption
 │                │
 │                └──< QuizAttempt
 │                         │
 │                         └──< QuizAnswer
 │
 └──< PointTransaction
```

---

# 57. Security Requirements

This sprint contains several important security boundaries.

### Quiz Correct Answers

Never send:

```text
isCorrect
```

to the client before submission.

### Quiz Points

Never trust:

```text
pointsAwarded
score
isCorrect
```

from frontend requests.

### Timer

Never rely on the frontend timer.

### Authorization

Verse/quiz management:

```text
ADMIN
SERVANT
```

Verse reading:

```text
AUTHENTICATED USER
```

Quiz taking:

```text
AUTHENTICATED USER
```

Analytics:

```text
ADMIN
SERVANT
```

### Ownership

A user can access their own:

* Quiz attempts
* Points
* Point history

but cannot manipulate them.

---

# 58. Idempotency Requirements

The following operations must be idempotent:

```text
Mark Verse Read
Publish Scheduled Verse
Send Publication Notification
Complete Quiz
Award Quiz Points
```

Example:

```text
Submit Quiz
     ↓
Score = 8
     ↓
Award 8 points
```

If the request is accidentally repeated:

```text
Submit Quiz Again
     ↓
Existing completed attempt
     ↓
Return existing result
     ↓
NO additional points
```

---

# 59. Sprint Execution Plan

## Day 1 — Domain & Database

* BibleVerse
* PublicationSchedule
* VerseView
* VerseRead
* Quiz
* QuizQuestion
* QuizOption
* QuizAttempt
* QuizAnswer
* PointTransaction
* Migrations
* Relationships
* Constraints

---

## Day 2 — Bible Verse CRUD

* Verse service
* CRUD APIs
* Permissions
* Validation
* Admin/Servant UI
* Draft state

---

## Day 3 — Scheduling

* Scheduling API
* Scheduler/worker
* Automatic publication
* Status transitions
* Idempotency
* Failure handling

---

## Day 4 — Reading & Engagement

* Verse details
* Open tracking
* Read tracking
* Mark-as-read
* Engagement API
* Engagement tests

---

## Day 5 — Quiz Management

* Quiz entity
* Question management
* Options
* Correct-answer validation
* Timer configuration
* Quiz publishing

---

## Day 6 — Quiz Taking

* Start attempt
* Attempt state
* Question delivery
* Answer submission
* Timer UI
* Server-side expiration

---

## Day 7 — Grading & Points

* Automatic grading
* Score calculation
* Point transaction
* Weekly points
* Monthly points
* Lifetime points
* Profile integration

---

## Day 8 — Notifications

* Publication event
* Email handler
* Creator notification
* Retry mechanism
* Notification status
* Duplicate notification protection

---

## Day 9 — Analytics

* Verse analytics
* Quiz analytics
* User scores
* Monthly analytics
* Admin/Servant dashboard
* Charts/tables

---

## Day 10 — Integration & Hardening

Complete flow:

```text
Create Verse
     ↓
Create Quiz
     ↓
Schedule Verse
     ↓
Automatic Publication
     ↓
Creator Email
     ↓
User Opens Verse
     ↓
Open Count +1
     ↓
User Marks Read
     ↓
Read Count +1
     ↓
User Opens Quiz
     ↓
Start Timer
     ↓
Answer Questions
     ↓
Submit / Timer Expires
     ↓
Automatic Grading
     ↓
Points Awarded
     ↓
Profile Updated
     ↓
Admin Analytics Updated
```

Then:

* Integration tests
* Security testing
* Concurrency testing
* Scheduler testing
* Email testing
* Timer testing
* Point duplication testing
* Performance testing
* Bug fixing
* Code review
* Documentation

---

# 60. Definition of Ready

A story is Ready when:

* [ ] User story is clear
* [ ] Acceptance criteria are testable
* [ ] Role permissions are defined
* [ ] Domain entities are identified
* [ ] API contract is defined
* [ ] Scheduling behavior is defined
* [ ] Quiz scoring rules are defined
* [ ] Timer behavior is defined
* [ ] Points rules are defined
* [ ] Analytics metrics are defined
* [ ] Dependencies are known
* [ ] Story is estimated

---

# 61. Definition of Done

Sprint 5 is Done when:

### Bible Verses

* [ ] Servant can create verses
* [ ] Admin can create verses
* [ ] Servant can edit verses
* [ ] Admin can edit verses
* [ ] Authorized users can archive/delete verses
* [ ] Draft/published/scheduled states work

### Scheduling

* [ ] Verse can be scheduled
* [ ] Scheduled verse automatically publishes
* [ ] Scheduler is idempotent
* [ ] Failed publications are handled
* [ ] Creator receives publication email
* [ ] Duplicate emails are prevented

### Engagement

* [ ] Post opens are tracked
* [ ] Unique readers are tracked
* [ ] User can mark verse as read
* [ ] Duplicate read records are prevented
* [ ] Read analytics are available

### Quiz

* [ ] Quiz can be created
* [ ] Questions can be created
* [ ] Multiple choices work
* [ ] Exactly one correct answer is enforced
* [ ] Quiz is attached to a Bible Verse
* [ ] User accesses quiz through verse
* [ ] Timer is configurable
* [ ] Server enforces timer
* [ ] Expired quiz auto-finishes
* [ ] Quiz can be submitted

### Grading

* [ ] Answers are automatically graded
* [ ] Score is calculated
* [ ] Percentage is calculated
* [ ] Correct/incorrect results are available
* [ ] Points are calculated server-side
* [ ] Points cannot be awarded twice

### Points

* [ ] Weekly points work
* [ ] Monthly points work
* [ ] Lifetime points work
* [ ] Historical monthly points remain available
* [ ] Profile displays points
* [ ] Point transactions are auditable

### Analytics

* [ ] Admin can see verse opens
* [ ] Admin can see verse reads
* [ ] Servant can see verse opens
* [ ] Servant can see verse reads
* [ ] Admin can see quiz participants
* [ ] Servant can see quiz participants
* [ ] Admin can see marks per quiz
* [ ] Servant can see marks per quiz
* [ ] Admin can see user monthly points
* [ ] Servant can see user monthly points
* [ ] Historical monthly analytics work

### Quality

* [ ] Authorization is enforced
* [ ] Correct answers are not exposed
* [ ] Timer cannot be bypassed through frontend manipulation
* [ ] Points cannot be manipulated from frontend
* [ ] Duplicate submissions are handled
* [ ] Automated tests pass
* [ ] Integration tests pass
* [ ] API documentation is updated
* [ ] No critical/high-priority defects remain

---

# 62. Sprint Review Demo

The Sprint Review should use one complete realistic scenario.

## Part 1 — Servant

```text
Login
 ↓
Bible Management
 ↓
Create Bible Verse
 ↓
Create Related Quiz
 ↓
Add 5 Questions
 ↓
Set 2 Minute Timer
 ↓
Schedule for Sunday 09:00
```

## Part 2 — Automatic System

```text
Sunday 09:00
 ↓
Scheduler detects post
 ↓
Verse becomes PUBLISHED
 ↓
Quiz becomes available
 ↓
Creator receives email
```

## Part 3 — User

```text
Open Bible Verses
 ↓
Open Weekly Verse
 ↓
Open counter increases
 ↓
Read verse
 ↓
Mark as Read
 ↓
Read counter increases
 ↓
Open Quiz
 ↓
Start
 ↓
Timer starts
 ↓
Answer 5 questions
 ↓
Submit
 ↓
8/10
 ↓
8 Points
```

## Part 4 — Profile

```text
Profile

Lifetime Points     85
This Month          35
This Week            8

Monthly History

August 2026          35
July 2026            42
June 2026             8
```

## Part 5 — Servant/Admin Analytics

```text
Bible Verse Analytics

Opened             97
Read               74
Read Rate        76.3%


Quiz Analytics

Participants       42
Completed          40
Average Score     8.1


User Results

Ahmed             8/10
Mina             10/10
Peter              6/10


August Points

Ahmed              42
Mina               37
Peter              28
```

---

# 63. Recommended Sprint 5 Architecture

The most important architectural decision is to treat this as **five cooperating domains**, rather than one giant "Bible Verse" feature:

```text
┌──────────────────────────────────────────────┐
│              BIBLE ENGAGEMENT                │
├──────────────┬──────────────┬────────────────┤
│   CONTENT    │  SCHEDULING  │   ENGAGEMENT   │
│              │              │                │
│ Bible Verse  │ Publication  │ Opens          │
│ Quiz         │ Worker       │ Reads          │
│ Questions    │ Events       │                │
├──────────────┴──────────────┴────────────────┤
│                    QUIZ                       │
│                                              │
│ Attempts → Answers → Grading → Score        │
├──────────────────────────────────────────────┤
│                  POINTS                       │
│                                              │
│ Weekly → Monthly → Lifetime → History       │
├──────────────────────────────────────────────┤
│                 ANALYTICS                     │
│                                              │
│ Verse → Quiz → User → Monthly                │
└──────────────────────────────────────────────┘
```

This separation is particularly important because future phases can reuse the same architecture for **devotionals, church announcements, service challenges, educational content, competitions, or other scheduled engagement content** without rebuilding the entire system.

---

# 64. Final Sprint 5 Deliverable

The Sprint 5 increment is complete when the platform supports:

```text
SERVANT / ADMIN
       │
       ▼
Create Bible Verse
       │
       ├──────────────► Create Quiz
       │                       │
       │                       ├── Questions
       │                       ├── Choices
       │                       ├── Correct Answers
       │                       └── Timer
       │
       ▼
Schedule Weekly Publication
       │
       ▼
AUTOMATIC PUBLISH
       │
       ├──────────────► Email Creator
       │
       ▼
USER
       │
       ▼
Open Bible Verse
       │
       ├──────────────► Open Count
       │
       ▼
Mark as Read
       │
       ├──────────────► Read Count
       │
       ▼
Open Related Quiz
       │
       ▼
Start Timer
       │
       ▼
Answer Questions
       │
       ├──────────────► Timer Expires
       │
       ▼
Automatic Grading
       │
       ▼
Score + Points
       │
       ▼
User Profile
       │
       ├── Weekly Points
       ├── Monthly Points
       ├── Lifetime Points
       └── Historical Months
       │
       ▼
ADMIN / SERVANT
       │
       ├── Verse Opens
       ├── Verse Reads
       ├── Quiz Participants
       ├── Quiz Marks
       ├── User Points
       ├── Monthly Scores
       └── Historical Analytics
```

### Sprint 5 Success Metric

> **A servant/admin can schedule a Bible Verse and its quiz, the system automatically publishes it, notifies its creator, users can read and quiz on it, scores and points are automatically calculated, and servants/admins can analyze engagement and performance at both quiz and monthly-user levels.**
