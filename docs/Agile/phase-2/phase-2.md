# Phase 2 — Attendance

## Sprint 2 — Attendance Management

### Epic

**ID:** EPIC-002
**Name:** Attendance Management

### Sprint Goal

Enable authorized administrators to record and monitor attendance using the user's personal QR code.

The complete business flow must work:

**Admin → Scan QR → Validate User → Validate Attendance → Record Check-in → Dashboard → Statistics → Absence**

The implementation must establish a reliable attendance history that can later support reporting, payroll, service participation, and analytics.

---

# 1. Sprint Scope

| ID     | Type  | Title                             | Priority    | Points |
| ------ | ----- | --------------------------------- | ----------- | -----: |
| US-006 | Story | Record Attendance by QR           | Must Have   |      8 |
| US-007 | Story | View Today's Attendance           | Must Have   |      5 |
| US-008 | Story | Identify Absent Users             | Must Have   |      5 |
| US-009 | Story | Attendance Statistics & Analytics | Should Have |      5 |

**Total:** 23 Story Points

---

# 2. Business Rules

Before implementation, Sprint 2 should establish these rules explicitly.

### Attendance Identity

Attendance belongs to a specific user.

```text
User
  │
  └──< Attendance
```

### One Check-in Per Day

By default:

> A user can have only one successful attendance check-in per attendance day.

A second scan on the same day must not create another attendance record.

### Attendance Date

Do not rely only on the database timestamp.

Store both:

```text
checkInAt
attendanceDate
```

This allows reliable daily/weekly reporting.

### Timezone

Attendance calculations must use the platform's configured timezone rather than relying blindly on the server timezone.

For the current platform, this should be configurable and initially aligned with the deployment/business timezone.

### Absence

A user is considered absent when:

```text
Expected User
+
Attendance Date
+
No Attendance Record
=
Absent
```

The system should not classify users as absent until the attendance period/day has reached the defined attendance cutoff.

---

# 3. US-006 — Record Attendance by QR

### User Story

> As an admin, I want to scan a user's QR code to record attendance.

### Acceptance Criteria

#### AC-001 — Valid QR

Given an authorized admin scans a valid user QR code,

When the QR is submitted,

Then the system identifies the user.

#### AC-002 — Attendance Creation

If the user has not checked in today,

Then a new attendance record is created.

#### AC-003 — Duplicate Protection

If the user has already checked in today,

Then a second attendance record is not created.

The API returns a clear duplicate-attendance response.

#### AC-004 — Invalid QR

If the QR does not belong to a valid user,

Then attendance is not recorded.

#### AC-005 — Authorization

Only users with the required attendance-management permission can record attendance.

#### AC-006 — Audit Information

The attendance record should preserve sufficient information to determine:

* Who attended
* When they checked in
* Which user/account performed the scan
* Attendance date

#### AC-007 — Successful Response

A successful scan returns enough information for the UI to immediately show:

```text
User Identified
       ↓
Attendance Recorded
       ↓
Name
Attendance Time
Status
```

---

# 4. TASK-001 — Attendance Entity

### Subtasks

* Define Attendance entity
* Define attendance identifier
* Define user relationship
* Define check-in timestamp
* Define attendance date
* Define recorded-by/admin relationship
* Define attendance status
* Define created/updated timestamps
* Define database constraints
* Define indexes
* Create migration

### Suggested Conceptual Model

```text
Attendance
──────────────
id
userId
attendanceDate
checkInAt
recordedBy
status
createdAt
updatedAt
```

The exact fields should follow the project's established architecture and ORM conventions.

---

# 5. TASK-002 — Attendance Database Constraints

### Subtasks

* Add foreign key to User
* Add index on `userId`
* Add index on `attendanceDate`
* Add composite index for daily lookup
* Add uniqueness protection for user + attendance date

Conceptually:

```text
UNIQUE(
    userId,
    attendanceDate
)
```

This is important because duplicate protection should exist at the **database level**, not only in application code.

---

# 6. TASK-003 — QR Validation

### Subtasks

* Receive QR payload
* Validate payload format
* Resolve public user identifier
* Find associated user
* Validate account status
* Reject invalid/unknown QR
* Prevent sensitive information from being trusted from the QR payload
* Return safe user information

### Security Rule

Never trust a user ID supplied by the client simply because it came from a QR scanner.

The backend must validate the QR identity against the database.

---

# 7. TASK-004 — Check-in Use Case

### Subtasks

1. Authenticate admin
2. Validate attendance permission
3. Validate QR payload
4. Resolve user
5. Determine current attendance date
6. Check existing attendance
7. Create attendance if none exists
8. Persist transaction
9. Return attendance result

### Flow

```text
Admin
  ↓
Authenticated?
  ↓
Authorized?
  ↓
Scan QR
  ↓
Validate QR
  ↓
Find User
  ↓
Already Checked In?
  ├── YES → Duplicate Response
  │
  └── NO
       ↓
   Create Attendance
       ↓
   Success
```

---

# 8. TASK-005 — Check-in API

### Endpoint

```http
POST /attendance/check-in
```

### Request

Conceptually:

```json
{
  "qrCode": "USER_PUBLIC_IDENTIFIER"
}
```

### Successful Response

Conceptually:

```json
{
  "success": true,
  "message": "Attendance recorded successfully",
  "attendance": {
    "userId": "...",
    "userName": "...",
    "attendanceDate": "...",
    "checkInAt": "...",
    "status": "PRESENT"
  }
}
```

### Error Scenarios

Handle:

```text
Invalid QR
User Not Found
Inactive User
Unauthorized Admin
Already Checked In
Validation Error
System Error
```

Avoid leaking unnecessary internal information through API errors.

---

# 9. TASK-006 — Duplicate Attendance Protection

Implement duplicate protection at multiple levels.

### Application Level

Before creating attendance:

```text
Find Attendance
WHERE
userId = currentUser
AND
attendanceDate = today
```

### Database Level

Enforce uniqueness:

```text
(userId, attendanceDate)
```

### Concurrency

The implementation must safely handle two scans occurring almost simultaneously.

Example:

```text
Scanner A ──┐
            ├──→ Same User
Scanner B ──┘
```

Only one attendance record should be created.

The database constraint should be the final protection.

---

# 10. US-007 — Today's Attendance

### User Story

> As an admin, I want to see today's attendance.

### Acceptance Criteria

#### AC-001

Admin can retrieve today's attendance records.

#### AC-002

Results include:

* User name
* Attendance time
* Attendance status
* Relevant user identifier

#### AC-003

Results are ordered by check-in time.

#### AC-004

Admin can see the total number of attendees today.

#### AC-005

Only authorized administrators can access the attendance dashboard.

---

# 11. TASK-007 — Attendance History API

### Endpoint

```http
GET /attendance
```

Support filtering by:

```text
date
dateFrom
dateTo
userId
status
```

The exact filters can be restricted in Sprint 2 if the MVP needs a smaller scope.

### Subtasks

* Create query/filter DTO
* Implement date filtering
* Implement user filtering
* Implement status filtering
* Add pagination
* Add sorting
* Add authorization
* Optimize database queries

---

# 12. TASK-008 — Today's Attendance Endpoint

### Endpoint

```http
GET /attendance/today
```

### Response Should Provide

```text
Total Present
Total Expected
Total Absent
Attendance Rate
Attendance Records
```

Where appropriate, pagination should be used for the detailed attendance list.

---

# 13. TASK-009 — Attendance History

### Subtasks

* Query historical attendance
* Filter by date
* Filter by user
* Support pagination
* Support sorting
* Return summary metadata
* Add authorization
* Add tests

### Example

```text
Attendance History

Date        User             Check-in
──────────────────────────────────────
21 Aug      User A           09:05
21 Aug      User B           09:12
20 Aug      User A           09:03
20 Aug      User C           09:17
```

---

# 14. US-008 — Identify Absent Users

### User Story

> As an admin, I want to know who has been absent.

### Important Domain Requirement

The system needs a definition of the **expected attendance population**.

For Sprint 2, this should come from the currently defined user population or an explicitly configured attendance group.

Later phases can introduce:

```text
Service
Class
Group
Enrollment
Attendance Schedule
```

to provide a more precise expected-user population.

### Acceptance Criteria

#### AC-001

Admin can retrieve absent users for a specific attendance date.

#### AC-002

A user with a valid attendance record is not classified as absent.

#### AC-003

A user belonging to the expected attendance population without attendance is classified as absent.

#### AC-004

The absence calculation respects the attendance date and configured timezone.

---

# 15. TASK-010 — Absence Calculation

### Logic

Conceptually:

```text
Expected Users
      -
Present Users
      =
Absent Users
```

### Subtasks

* Determine expected user population
* Query present users
* Compare expected vs present
* Calculate absent users
* Return absence count
* Return absent-user list
* Add date filtering
* Add tests

### Endpoint

```http
GET /attendance/absent?date=YYYY-MM-DD
```

---

# 16. TASK-011 — Absence Rules

Document and implement:

* What population is expected?
* When does an attendance day close?
* Can an attendance record be added after the cutoff?
* Can an admin correct attendance?
* Can an attendance record be deleted?
* How are inactive users handled?
* Are users who joined after the attendance date excluded?

For Sprint 2, keep the rules simple and explicit rather than building a complex scheduling engine.

---

# 17. US-009 — Attendance Statistics & Analytics

### User Story

> As an admin, I want to see attendance statistics so I can understand participation trends.

### Acceptance Criteria

Admin can view:

* Current meeting attendance count
* Current meeting absence count
* Current meeting attendance rate
* Monthly attendance count
* Monthly meeting attendance trend

---

# 18. TASK-012 — Meeting Statistics

### Metrics

```text
Expected
Present
Absent
Attendance Rate
```

### Formula

```text
Attendance Rate =
Present / Expected × 100
```

Handle:

```text
Expected = 0
```

without division errors.

---

# 19. TASK-013 — Monthly Statistics (4 meetings)

### Subtasks

* Define meeting boundaries (Thursday through the following Wednesday)
* Query attendance by meeting date
* Aggregate per-meeting attendance
* Calculate per-meeting rates
* Return monthly summary
* Add tests

### Example

```text
Thu 1 ██████████  92%
Thu 2 █████████   88%
Thu 3 ██████████  95%
Thu 4 ████████    81%
```

The visualization itself belongs to the frontend.

---

# 20. TASK-014 — Attendance Dashboard

### Dashboard Sections

```text
┌─────────────────────────────────────────────┐
│ Attendance Dashboard                        │
├───────────┬───────────┬───────────┬────────┤
│ Present   │ Absent    │ Expected  │ Rate   │
│    82     │    13     │    95     │ 86.3%  │
├───────────┴───────────┴───────────┴────────┤
│                                             │
│ Current Meeting Attendance                  │
│                                             │
├─────────────────────────────────────────────┤
│ Monthly Meeting Attendance Trend            │
│ (4 meetings)                                │
│                                             │
├─────────────────────────────────────────────┤
│ Absent Users                                │
│                                             │
└─────────────────────────────────────────────┘
```

### Subtasks

* Create dashboard page
* Summary cards
* Current meeting attendance table
* Absent users section
* Monthly statistics
* Loading states
* Empty states
* Error states
* Responsive layout

---

# 21. TASK-015 — QR Scanner UI

### Admin Flow

```text
Open Attendance
       ↓
Scan QR
       ↓
User Identified
       ↓
Show User
       ↓
Confirm/Automatic Check-in
       ↓
Success
```

### UI Requirements

* Camera permission handling
* QR scanner
* Scan feedback
* User identification
* Success state
* Duplicate state
* Invalid QR state
* Scanner retry
* Mobile/tablet responsive layout

### Success Example

```text
✓ Attendance Recorded

Ahmed Youssef

Today
09:14 AM

Status: Present
```

---

# 22. TASK-016 — Attendance Frontend Integration

### Subtasks

* Connect QR scanner to check-in API
* Handle authentication
* Handle API errors
* Refresh today's attendance
* Update statistics
* Show duplicate check-in
* Show invalid QR
* Show successful attendance
* Implement loading states

---

# 23. TASK-017 — Attendance Tests

### Unit Tests

Test:

* Attendance creation
* Duplicate detection
* Date calculation
* Absence calculation
* Attendance rate
* Weekly aggregation
* QR validation

### Integration Tests

Test:

```text
Authenticated Admin
      ↓
Check-in API
      ↓
QR Validation
      ↓
User Resolution
      ↓
Attendance Creation
```

### Security Tests

Test:

* Unauthenticated request
* Non-admin request
* Invalid QR
* Inactive user
* Manipulated QR payload
* Duplicate concurrent requests

---

# 24. API Contract

### Check-in

```http
POST /attendance/check-in
```

### Meeting Attendance

```http
GET /attendance/meeting?meeting_date=YYYY-MM-DD
```

### Meeting Calendar

```http
GET /attendance/meetings?year=YYYY&month=M
```

### Attendance History

```http
GET /attendance?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&user_id={uuid}&status={status}
```

### Absence

```http
GET /attendance/absent?meeting_date=YYYY-MM-DD
```

### Statistics

```http
GET /attendance/statistics/meeting?meeting_date=YYYY-MM-DD
GET /attendance/statistics/monthly?year=YYYY&month=M
```

---

# 25. Recommended Backend Module

Attendance should have its own bounded module/domain.

```text
Attendance
├── Domain
│   ├── Attendance
│   ├── AttendanceStatus
│   └── AttendanceRules
│
├── Application
│   ├── CheckIn
│   ├── GetMeetingAttendance
│   ├── GetAttendanceHistory
│   ├── GetAbsentUsers
│   └── GetStatistics
│
├── Infrastructure
│   ├── AttendanceRepository
│   └── AttendanceQueries
│
└── API
    └── AttendanceController
```

The exact folder structure should follow the architecture established in Sprint 1 rather than introducing a second architectural style.

---

# 26. Sprint Dependencies

Sprint 2 depends on Sprint 1:

```text
User
  ↓
Authentication
  ↓
Role Authorization
  ↓
QR Identity
  ↓
Attendance
```

The most important dependency is the user's stable QR/public identifier.

---

# 27. Sprint Execution Plan

## Day 1 — Attendance Foundation

* Attendance domain
* Entity
* Database migration
* Relationships
* Constraints
* Indexes

## Day 2 — QR Check-in Backend

* QR validation
* User resolution
* Check-in use case
* Check-in API

## Day 3 — Duplicate & Security

* Duplicate protection
* Database uniqueness
* Concurrent request protection
* Authorization
* Error handling

## Day 4 — Attendance Queries

* Current meeting attendance
* Attendance history
* Filtering
* Pagination
* Sorting

## Day 5 — Absence

* Expected population
* Absence calculation
* Absent-user API
* Edge cases
* Tests

## Day 6 — Statistics

* Meeting statistics
* Monthly statistics (4 meetings)
* Attendance rate
* Aggregation queries

## Day 7 — QR Scanner

* Scanner UI
* Camera permissions
* QR detection
* Check-in integration

## Day 8 — Admin Dashboard

* Summary cards
* Current meeting attendance
* Absent users
* Monthly meeting chart (4 meetings)
* Responsive layout

## Day 9 — Testing & Hardening

* Unit tests
* Integration tests
* Security tests
* Concurrency testing
* Performance checks
* Bug fixing

## Day 10 — Sprint Completion

* API documentation
* Code review
* Final integration testing
* Sprint Review
* Retrospective

---

# 28. Definition of Ready

A story is Ready when:

* [ ] Attendance business rules are defined
* [ ] Expected attendance population is known
* [ ] Acceptance criteria are testable
* [ ] Required Identity dependencies exist
* [ ] API contract is understood
* [ ] Story is estimated
* [ ] Dependencies are identified
* [ ] No critical business rule is unresolved

---

# 29. Definition of Done

Sprint 2 is Done when:

* [ ] Attendance entity exists
* [ ] Database migration is applied
* [ ] User/attendance relationship works
* [ ] QR validation works
* [ ] Authorized admin can scan QR
* [ ] Valid user is identified
* [ ] Attendance is recorded
* [ ] Duplicate check-in is prevented
* [ ] Database-level duplicate protection exists
* [ ] Current meeting attendance can be retrieved
* [ ] Attendance history works
* [ ] Absence calculation works
* [ ] Meeting statistics work
* [ ] Monthly statistics (4 meetings) work
* [ ] Attendance rate is calculated correctly
* [ ] Admin dashboard is functional
* [ ] QR scanner UI works
* [ ] Error and empty states are handled
* [ ] Authentication/authorization is enforced
* [ ] Unit tests pass
* [ ] Integration tests pass
* [ ] Security tests pass
* [ ] API documentation is updated
* [ ] No critical/high-priority defects remain

---

# 30. Sprint Review — Demo Scenario

The Sprint Review should demonstrate the complete business workflow.

### Scenario

```text
Admin Login
    ↓
Open Attendance
    ↓
Start QR Scanner
    ↓
Scan User QR
    ↓
Backend validates QR
    ↓
User identified
    ↓
Check whether already attended
    ↓
Create Attendance
    ↓
Display success
    ↓
Dashboard updated
    ↓
Statistics updated
    ↓
Absent list updated
```

### Duplicate Scenario

Scan the same QR again:

```text
Scan QR
   ↓
User identified
   ↓
Already Present
   ↓
No new record
   ↓
"Already checked in today"
```

### Invalid QR Scenario

```text
Scan QR
   ↓
Invalid/Unknown QR
   ↓
Attendance NOT created
   ↓
Display validation error
```

---

# 31. Sprint Retrospective Questions

### What went well?

* Was the QR identity mechanism easy to integrate?
* Was the Identity module reusable?
* Did the API contract remain stable?

### What went wrong?

* Were attendance rules ambiguous?
* Were duplicate/concurrent scans handled correctly?
* Did frontend/backend integration cause delays?

### What should change?

* Improve API contracts?
* Improve testing?
* Improve database queries?
* Improve scanner UX?
* Refine attendance business rules?

---

# 32. Final Sprint Deliverable

The final product increment should provide:

```text
                    ADMIN
                      │
                      ▼
              ┌───────────────┐
              │ QR SCANNER    │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ QR VALIDATION │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ USER IDENTIFIED│
              └───────┬───────┘
                      │
                      ▼
             ┌──────────────────┐
             │ DUPLICATE CHECK  │
             └────────┬─────────┘
                      │
                 ┌────▼────┐
                 │  New?   │
                 └────┬────┘
                      │
                      ▼
             ┌──────────────────┐
             │ ATTENDANCE       │
             │ RECORDED         │
             └────────┬─────────┘
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
       Today       Statistics    Absence
       List        Dashboard      List
```

## Sprint 2 Outcome

At the end of Sprint 2, the platform has its first operational service workflow:

**Identity → QR Identity → Attendance → Reporting**

This creates the foundation for later phases such as **service/class assignment, attendance by class, servant management, served-user management, attendance history per service, and eventually payroll or advanced analytics**.
