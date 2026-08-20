# Phase 1 — Authentication + Users

## Sprint 1 — Identity Foundation

### Epic

**ID:** EPIC-001
**Name:** Identity & User Management

### Sprint Goal

Build the complete identity foundation of the Youth Service Platform so a user can:

**Register → Login → Maintain Session → Access Profile → View Personal QR Code**

The sprint must establish secure authentication, user identity, role authorization, and the foundation required by all future service-management modules.

---

# 1. Sprint Scope

| ID     | Type  | Title                         | Priority  | Points |
| ------ | ----- | ----------------------------- | --------- | -----: |
| US-001 | Story | User Registration             | Must Have |      5 |
| US-002 | Story | Secure Login                  | Must Have |      5 |
| US-003 | Story | User Profile                  | Must Have |      3 |
| US-004 | Story | Personal QR Code              | Must Have |      3 |
| US-005 | Story | Role Authorization Foundation | Must Have |      5 |

**Total:** 21 Story Points

---

# 2. US-001 — User Registration

### User Story

> As a user, I want to register so I can access the youth platform.

### Acceptance Criteria

#### AC-001 — Successful Registration

Given a user provides valid registration information,

When the registration request is submitted,

Then a new user account is created successfully.

#### AC-002 — Duplicate Account

Given an account already exists with the same unique identifier,

When registration is attempted,

Then registration is rejected with an appropriate validation error.

#### AC-003 — Password Security

The system must never store passwords as plain text.

Passwords must be securely hashed using the project's approved password-hashing mechanism.

#### AC-004 — Validation

The API must validate:

* Required fields
* Email/phone format where applicable
* Password requirements
* Unique account identifier
* Invalid input

#### AC-005 — Successful Response

Registration returns the appropriate user/account information without exposing:

* Password
* Password hash
* Refresh token
* Other sensitive credentials

### Tasks

#### TASK-001 — Create User Entity

Subtasks:

* Define User entity
* Define user identifier
* Define authentication fields
* Define profile fields
* Define timestamps
* Define account status
* Define role relationship/value
* Define database constraints
* Create migration

#### TASK-002 — Implement Identity Service

Subtasks:

* Create registration use case
* Validate registration input
* Check account uniqueness
* Hash password
* Create user
* Persist user
* Return safe user response

#### TASK-003 — Registration API

Subtasks:

* Create registration request DTO
* Create registration response DTO
* Implement endpoint
* Add validation
* Add error handling
* Add API documentation

#### TASK-004 — Registration Tests

Subtasks:

* Successful registration
* Duplicate account
* Invalid input
* Weak password
* Password hashing verification
* Sensitive-field exposure test

---

# 3. US-002 — Secure Login

### User Story

> As a user, I want to log in securely.

### Acceptance Criteria

#### AC-001 — Valid Credentials

Given a registered user,

When valid credentials are submitted,

Then authentication succeeds.

#### AC-002 — Invalid Credentials

Invalid credentials must return an appropriate authentication error without revealing whether the account identifier or password was incorrect.

#### AC-003 — Access Token

Successful authentication generates a JWT access token.

#### AC-004 — Refresh Token

Successful authentication generates a refresh token according to the application's token strategy.

#### AC-005 — Protected Resources

A valid access token must allow the user to access authenticated endpoints.

#### AC-006 — Expired Token

An expired access token must not grant access to protected endpoints.

### Tasks

#### TASK-005 — JWT Authentication

Subtasks:

* Define JWT configuration
* Define signing mechanism
* Define token claims
* Define issuer/audience where applicable
* Define access-token lifetime
* Implement token generation
* Implement token validation
* Configure authentication middleware

#### TASK-006 — Refresh Token

Subtasks:

* Define refresh-token model/storage
* Generate refresh token
* Associate token with user
* Store token securely
* Implement refresh endpoint
* Validate expiration
* Validate revocation
* Implement token rotation if required
* Revoke previous token where applicable

#### TASK-007 — Login Use Case

Subtasks:

* Find user
* Verify password
* Validate account status
* Generate access token
* Generate refresh token
* Return authentication response

#### TASK-008 — Login API

Subtasks:

* Create login DTO
* Implement login endpoint
* Add validation
* Add authentication errors
* Document endpoint

#### TASK-009 — Authentication Tests

Test:

* Valid credentials
* Invalid credentials
* Non-existent user
* Expired token
* Invalid JWT
* Refresh token
* Revoked refresh token
* Token rotation

---

# 4. Logout

Logout is treated as part of the Identity authentication lifecycle.

### TASK-010 — Logout

Subtasks:

* Create logout endpoint
* Identify authenticated user/session
* Revoke refresh token
* Invalidate refresh-token session
* Return successful logout response

### Acceptance Criteria

Given an authenticated user,

When logout is requested,

Then the active refresh-token session is revoked.

A revoked refresh token must not be usable to obtain a new access token.

---

# 5. US-003 — User Profile

### User Story

> As a user, I want to see my profile.

### Acceptance Criteria

#### AC-001

An authenticated user can retrieve their own profile.

#### AC-002

A user cannot retrieve another user's private profile through the normal self-profile endpoint.

#### AC-003

The profile response contains only approved public/account information.

#### AC-004

Unauthenticated requests are rejected.

### Tasks

#### TASK-011 — Profile Use Case

Subtasks:

* Extract authenticated user identity
* Load user
* Map entity to profile response
* Exclude sensitive fields

#### TASK-012 — Profile API

Subtasks:

* Create profile endpoint
* Add authentication requirement
* Create response DTO
* Add error handling
* Document endpoint

#### TASK-013 — Profile Tests

Test:

* Authenticated profile request
* Unauthenticated request
* Invalid token
* Missing user
* Sensitive data exclusion

---

# 6. US-004 — Personal QR Code

### User Story

> As a user, I want my own QR code so I can be identified by the youth service platform.

### Important Design Decision

The QR code should **not contain sensitive user information**.

Prefer encoding a stable, non-sensitive identifier or a signed/opaque user reference.

Example conceptual payload:

```text
https://platform.example/users/qr/{public-user-id}
```

or an opaque identifier:

```text
USR_xxxxxxxxx
```

### Acceptance Criteria

#### AC-001

Every registered user has a unique QR identity.

#### AC-002

An authenticated user can retrieve their QR code.

#### AC-003

The QR code belongs only to that user.

#### AC-004

The QR payload does not expose sensitive information.

#### AC-005

The QR code can be rendered by the frontend.

### Tasks

#### TASK-014 — QR Identity

Subtasks:

* Define QR/public identifier strategy
* Ensure uniqueness
* Add database field if required
* Add uniqueness constraint
* Generate identifier for new users

#### TASK-015 — QR Generation Service

Subtasks:

* Select QR generation library
* Implement QR generation
* Define QR payload
* Generate image/SVG representation
* Handle invalid generation requests

#### TASK-016 — QR API

Subtasks:

* Create QR endpoint
* Authenticate request
* Resolve current user
* Generate/retrieve QR
* Return QR representation

#### TASK-017 — QR Display

Subtasks:

* Add profile QR section
* Display QR code
* Add loading state
* Add error state
* Ensure responsive rendering
* Add optional save/download functionality

#### TASK-018 — QR Tests

Test:

* QR generation
* Unique user QR
* Unauthorized access
* QR payload validation
* QR regeneration behavior
* QR readability

---

# 7. US-005 — Role Authorization Foundation

### User Story

> As a platform administrator, I want users to have defined roles so that access to platform functionality can be controlled securely.

### Initial Roles

The exact final role hierarchy can evolve, but Sprint 1 should establish the authorization foundation.

Example:

```text
USER
ADMIN
```

The final domain-specific roles should be confirmed before implementation if they differ.

### Acceptance Criteria

#### AC-001

Every user has an assigned role.

#### AC-002

The default registration role cannot provide administrative privileges.

#### AC-003

Protected endpoints can require authentication.

#### AC-004

Protected endpoints can require specific roles.

#### AC-005

Unauthorized users receive an appropriate authorization error.

### Tasks

#### TASK-019 — Role Model

Subtasks:

* Define role representation
* Define default role
* Define role constraints
* Add migration
* Add seed data if required

#### TASK-020 — Authorization Middleware/Policy

Subtasks:

* Implement authenticated-user check
* Implement role check
* Implement authorization policy
* Handle forbidden requests
* Add reusable authorization mechanism

#### TASK-021 — Authorization Tests

Test:

* Default user
* Authorized role
* Unauthorized role
* Missing authentication
* Invalid token
* Admin-only endpoint protection

---

# 8. Frontend Integration

Although the backend identity layer is the core of this sprint, the complete acceptance flow requires frontend integration.

### TASK-022 — Authentication UI

Subtasks:

* Registration page
* Login page
* Authentication form validation
* API integration
* Loading states
* Error states
* Success handling

### TASK-023 — Session Management

Subtasks:

* Store authentication state according to security architecture
* Handle access-token expiration
* Refresh session where applicable
* Handle logout
* Protect authenticated routes

### TASK-024 — Profile UI

Subtasks:

* Profile page
* User information display
* Role display
* QR code display
* Responsive layout

---

# 9. Database

### TASK-025 — Identity Database

Create the minimum database structure required for:

```text
User
Role
RefreshToken / Session
```

Potential relationship:

```text
Role
  │
  └──< User
          │
          └──< RefreshToken
```

### Database Requirements

* Primary keys
* Unique constraints
* Foreign keys
* Indexes for authentication lookups
* Created/updated timestamps
* Account status
* Secure refresh-token storage strategy

Do not prematurely introduce unnecessary tables or relationships that belong to later service-management phases.

---

# 10. API Contract

The sprint should expose a clean initial authentication API.

### Authentication

```http
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

### User

```http
GET /users/me
GET /users/me/qr
```

### Example Flow

```text
POST /auth/register
        ↓
User Created
        ↓
POST /auth/login
        ↓
Access Token + Refresh Token
        ↓
GET /users/me
        ↓
GET /users/me/qr
        ↓
Display Personal QR
```

---

# 11. Sprint Execution Order

## Day 1 — Foundation

* Project/module structure
* User entity
* Role model
* Database migration
* Identity configuration

## Day 2 — Registration

* Registration use case
* Password hashing
* Registration API
* Validation
* Tests

## Day 3 — Authentication

* JWT
* Login
* Refresh token
* Logout
* Authentication middleware

## Day 4 — User & Authorization

* Profile endpoint
* Role authorization
* Authorization tests

## Day 5 — QR

* Public QR identifier
* QR generation
* QR API
* QR tests

## Day 6 — Frontend Integration

* Registration UI
* Login UI
* Session handling
* Protected routes

## Day 7 — Profile & QR UI

* Profile page
* QR display
* Responsive behavior

## Day 8 — Integration Testing

Full flow:

```text
Register
   ↓
Login
   ↓
Receive Tokens
   ↓
Authenticated Request
   ↓
Profile
   ↓
QR
   ↓
Logout
   ↓
Refresh Token Rejected
```

## Day 9 — Security & Hardening

* Authentication edge cases
* Authorization testing
* Token expiration
* Refresh-token revocation
* Input validation
* Sensitive-data review
* Error handling

## Day 10 — Sprint Completion

* Bug fixing
* API documentation
* Code review
* Definition of Done verification
* Sprint Review
* Retrospective

---

# 12. Dependencies

```text
User Entity
    ↓
Registration
    ↓
Login
    ↓
JWT Authentication
    ↓
Protected Endpoints
    ↓
Profile
    ↓
QR
```

Authorization can be developed in parallel after the User/Role model exists.

Frontend authentication integration depends on stable API contracts.

---

# 13. Definition of Ready

A story is Ready when:

* [ ] User story is clearly defined
* [ ] Acceptance criteria are testable
* [ ] Dependencies are identified
* [ ] Technical approach is understood
* [ ] Required API contracts are defined
* [ ] Story is small enough for the sprint
* [ ] Story has been estimated
* [ ] No major unanswered business question blocks implementation

---

# 14. Definition of Done

Sprint 1 is Done when:

* [ ] User can register
* [ ] Password is securely hashed
* [ ] User can log in
* [ ] JWT authentication works
* [ ] Refresh token flow works
* [ ] Logout revokes the session/refresh token
* [ ] Protected endpoints reject unauthenticated requests
* [ ] Role authorization works
* [ ] User can retrieve their own profile
* [ ] User has a unique QR identity
* [ ] QR code can be generated and displayed
* [ ] Frontend authentication flow works
* [ ] Backend tests pass
* [ ] Integration tests pass
* [ ] No sensitive authentication data is exposed
* [ ] API documentation is updated
* [ ] Code has passed review
* [ ] No critical/high-priority Sprint 1 defects remain

---

# 15. Sprint Review — Demo Scenario

The Sprint Review should demonstrate one complete business flow.

### Scenario

1. Open registration page.
2. Register a new user.
3. Verify the account is persisted.
4. Login with the new account.
5. Receive authentication credentials.
6. Access the protected profile.
7. Display the user's role.
8. Display the user's personal QR code.
9. Logout.
10. Attempt to use the revoked refresh token.
11. Verify the refresh request is rejected.

### Expected Result

```text
Registration       ✅
Authentication     ✅
Authorization      ✅
Profile             ✅
QR Identity         ✅
Logout              ✅
Token Revocation    ✅
```

---

# 16. Sprint Metrics

### Planned Velocity

**21 Story Points**

### Primary Sprint KPI

> A newly registered user can securely authenticate and access their identity profile and personal QR code.

### Secondary KPIs

* Authentication success rate
* Test coverage of identity module
* Number of critical security defects
* API contract stability
* Number of unresolved Sprint 1 bugs

---

# 17. Jira Hierarchy

```text
EPIC-001 — Identity & User Management
│
├── US-001 — User Registration
│   ├── TASK-001 — User Entity
│   ├── TASK-002 — Identity Service
│   ├── TASK-003 — Registration API
│   └── TASK-004 — Registration Tests
│
├── US-002 — Secure Login
│   ├── TASK-005 — JWT Authentication
│   ├── TASK-006 — Refresh Token
│   ├── TASK-007 — Login Use Case
│   ├── TASK-008 — Login API
│   └── TASK-009 — Authentication Tests
│
├── US-003 — User Profile
│   ├── TASK-011 — Profile Use Case
│   ├── TASK-012 — Profile API
│   └── TASK-013 — Profile Tests
│
├── US-004 — Personal QR Code
│   ├── TASK-014 — QR Identity
│   ├── TASK-015 — QR Generation Service
│   ├── TASK-016 — QR API
│   ├── TASK-017 — QR Display
│   └── TASK-018 — QR Tests
│
└── US-005 — Role Authorization
    ├── TASK-019 — Role Model
    ├── TASK-020 — Authorization Policy
    └── TASK-021 — Authorization Tests
```

## Sprint 1 Final Outcome

The sprint establishes the **Identity Boundary** of the platform:

```text
                    ┌─────────────────┐
                    │      User       │
                    └────────┬────────┘
                             │
                  ┌──────────▼──────────┐
                  │      Identity       │
                  │                     │
                  │ Registration        │
                  │ Authentication      │
                  │ Authorization       │
                  │ Session Management  │
                  └──────┬───────┬──────┘
                         │       │
                 ┌───────▼───┐ ┌─▼─────────┐
                 │  Profile  │ │    QR     │
                 └───────────┘ └───────────┘
```

This gives subsequent phases a stable identity mechanism on which to build **user, classes,  service admin, attendance, permissions, and service-specific workflows**.
