# 📜 RULES.md — Comflex Platform

> **⚠️ MANDATORY READING** — Every human developer and every AI coding agent **MUST** read this file **in its entirety** before writing, reviewing, or generating a single line of code in any Comflex repository.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Git & Branching Workflow](#3-git--branching-workflow)
4. [API-First Development](#4-api-first-development-crucial)
5. [Authentication, Roles & Ring Hierarchy](#5-authentication-roles--ring-hierarchy)
6. [Group Chat System](#6-group-chat-system-discord-style)
7. [User Profiles, Badges & Achievements](#7-user-profiles-badges--achievements)
8. [Coding Standards & AI Agent Directives](#8-coding-standards--ai-agent-directives)

---

## 1. Project Overview

**Comflex** is a decoupled, multi-tenant college community platform designed to serve students, coordinators, and administrators across any institution — **without hardcoding a single piece of institution-specific data.**

### Core Capabilities

| Feature | Summary |
|---|---|
| **Ring-Based Hierarchy (RBAC)** | A concentric-ring permission model (Ring 0 = Admin → Ring N = Members) with cascading elevation rights. |
| **Automated Cohort Tagging** | Users are auto-assigned to cohort groups based on their institutional email. **Tagging logic is fully controlled by the Admin via a configuration UI — not by developers.** |
| **Discord-Style Group Chat** | Real-time messaging in cohort groups with granular, per-user permissions (delete, mute, tag, add members, manage economy, create events). |
| **Web3 Credits System** | An on-chain or hybrid credit economy rewarding contributions. |
| **Soulbound Tokens (SBTs)** | Non-transferable achievement NFTs minted for milestones. |
| **Codeforces API Integration** | Real-time competitive programming stats pulled from Codeforces. |
| **Content Library** | A curated, searchable repository of study materials, resources, and past papers. |
| **AI Notes Assistant** | An AI-powered tool that helps students create, summarize, and query notes. |
| **Event & Leaderboard System** | Event scheduling, participation tracking, and dynamic leaderboards. |
| **User Profiles & Badges** | Rich profiles with avatars, bios, displayable badges/achievements, and purchasable cosmetics (Discord-style). |

### 🔴 Critical Rule: Zero Hardcoded Institution Data

```
ABSOLUTELY NO institution names, logos, email domains, cohort years, or
any other institution-specific data may be hardcoded in source code.

ALL such data MUST be:
  → Stored in the database (configurable at runtime by the Admin), OR
  → Loaded from environment variables / configuration files.

The ADMIN decides the email parsing rules, cohort naming, and tagging
logic through the Admin Dashboard — NOT through code changes.
```

### 🔴 Critical Rule: Seed Admin on Deployment

```
On first deployment, the system MUST automatically create a Seed Admin
account using credentials provided via environment variables:

  SEED_ADMIN_EMAIL=
  SEED_ADMIN_PASSWORD=
  SEED_ADMIN_DISPLAY_NAME=

This Seed Admin is Ring 0 and has FULL platform control. The Seed Admin
is responsible for:
  1. Configuring the email-based cohort tagging rules.
  2. Setting up institution-specific settings.
  3. Creating additional Admins if needed.

The seed process MUST be idempotent — running it again does NOT create
duplicate accounts or reset the existing admin's settings.
```

---

## 2. Architecture & Tech Stack

### Decoupled Architecture

The platform follows a **strictly decoupled frontend/backend architecture**. The frontend and backend live in **separate repositories** and communicate **ONLY** via documented REST APIs (and WebSockets for real-time chat).

```
┌─────────────────────┐    REST API (JSON) + WebSocket    ┌──────────────────────┐
│                     │ ◄──────────────────────────────► │                      │
│   FRONTEND REPO     │         HTTPS / JWT / WS          │   BACKEND REPO       │
│                     │                                    │                      │
└─────────────────────┘                                    └──────────────────────┘
```

**There must be NO direct database access, shared ORM models, or server-side rendering logic that couples the two.**

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | `[INSERT FRONTEND FRAMEWORK]` |
| **Frontend State Management** | `[INSERT STATE MANAGEMENT LIBRARY]` |
| **Frontend Styling** | `[INSERT CSS FRAMEWORK / APPROACH]` |
| **Backend Framework** | `[INSERT BACKEND FRAMEWORK]` |
| **Database** | `[INSERT DATABASE]` |
| **ORM / Query Builder** | `[INSERT ORM]` |
| **Real-Time Messaging** | WebSocket (via `[INSERT WS LIBRARY, e.g. Socket.IO / ws]`) |
| **Authentication** | JWT (JSON Web Tokens) — issued by the backend |
| **Web3 Layer** | `[INSERT BLOCKCHAIN / WEB3 PROVIDER]` |
| **AI Notes Engine** | `[INSERT AI/LLM PROVIDER]` |
| **Codeforces Data** | Codeforces Public API (`https://codeforces.com/api/`) |
| **Hosting / Deployment** | `[INSERT HOSTING PROVIDER]` |
| **CI/CD** | `[INSERT CI/CD TOOL]` |

> **Action Required:** Replace every `[INSERT ...]` placeholder with the actual technology before the first sprint.

---

## 3. Git & Branching Workflow

We follow a **strict Feature Branch Workflow**. No exceptions.

### Branch Hierarchy

```
main          ← Production-ready code ONLY. Protected. No direct pushes.
  └── dev     ← Integration branch. All features merge here first.
       ├── feature/cohort-tagging
       ├── feature/sbt-minting
       ├── fix/login-redirect
       └── ...
```

### Branch Naming Convention

| Type | Pattern | Example |
|---|---|---|
| New feature | `feature/[short-name]` | `feature/web3-credits` |
| Bug fix | `fix/[short-name]` | `fix/token-expiry` |
| Hotfix (production) | `hotfix/[short-name]` | `hotfix/null-email-crash` |
| Chore / refactor | `chore/[short-name]` | `chore/lint-warnings` |

### Standard Development Flow

Every developer (human or AI) **MUST** follow this exact sequence:

```bash
# 1. Start from dev — always.
git checkout dev

# 2. Pull the latest changes.
git pull origin dev

# 3. Create your feature branch.
git checkout -b feature/your-feature-name

# 4. Write your code. Commit early, commit often.
#    Use conventional commit messages (see below).
git add .
git commit -m "feat(module): add cohort auto-tagging logic"

# 5. Push your branch to the remote.
git push origin feature/your-feature-name

# 6. Open a Pull Request (PR) targeting the `dev` branch.
#    - Fill in the PR template (title, description, testing steps).
#    - Request at least ONE reviewer.
#    - Link related issues.

# 7. After approval, the PR is SQUASH MERGED into dev.
#    Do NOT merge directly; always via the GitHub/GitLab UI.
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

Types: feat | fix | docs | style | refactor | test | chore | ci
Scope: the module or area affected (e.g., auth, credits, chat, ui)
```

**Examples:**
```
feat(auth): implement email-based cohort auto-tagging
feat(chat): add message deletion with ring check
fix(leaderboard): correct score calculation for ties
docs(api): add request/response schema for /events endpoint
chore(deps): upgrade jwt library to v3.1.0
```

### Rules

- 🔴 **Never push directly to `main`.**
- 🔴 **Never push directly to `dev`.**
- 🟡 All PRs require at least **1 code review** before merge.
- 🟡 All PRs must pass CI checks (lint, tests) before merge.
- 🟢 Delete feature branches after merge.

---

## 4. API-First Development (CRUCIAL)

> This is the **single most important workflow rule** for a decoupled architecture. Violations will cause integration hell.

### The Contract-First Process

```
Step 1: Frontend dev + Backend dev AGREE on a JSON data contract.
Step 2: The contract is documented in the shared API spec (see below).
Step 3: Backend builds the real endpoint matching the contract.
Step 4: Frontend builds the UI using MOCK DATA based on the contract.
Step 5: Once the backend endpoint is merged into dev, frontend swaps
        mocks for real API calls.
Step 6: Integration testing.
```

### JSON Data Contract Template

Before any endpoint is built, both sides **MUST** agree on and document a contract like this:

```json
// POST /api/v1/events
// Description: Create a new event

// REQUEST BODY
{
  "title": "string (required, max 200 chars)",
  "description": "string (optional, max 2000 chars)",
  "date": "ISO 8601 datetime string (required)",
  "location": "string (optional)",
  "tags": ["string"],
  "maxParticipants": "integer (optional, default: unlimited)"
}

// SUCCESS RESPONSE — 201 Created
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "date": "ISO 8601",
    "location": "string",
    "tags": ["string"],
    "maxParticipants": "integer",
    "createdBy": "uuid",
    "createdAt": "ISO 8601"
  }
}

// ERROR RESPONSE — 400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable error message",
    "details": [
      { "field": "title", "issue": "Title is required" }
    ]
  }
}
```

### API Spec Location

All contracts **MUST** be documented in:

```
/docs/api/
  ├── auth.md
  ├── users.md
  ├── profiles.md
  ├── chat.md
  ├── groups.md
  ├── events.md
  ├── credits.md
  ├── leaderboard.md
  ├── content-library.md
  ├── notes.md
  ├── badges.md
  └── codeforces.md
```

### Rules for Frontend Developers

- ✅ **Always mock** API responses while the backend endpoint is in development.
- ✅ Centralize all API calls in a service/utility layer (e.g., `api/chatService.js`).
- 🔴 **Never** shape your components around a response format that hasn't been agreed upon.
- 🔴 **Never** call an endpoint that isn't documented in `/docs/api/`.

### Rules for Backend Developers

- ✅ **Always** return the exact response shape defined in the contract.
- ✅ Use proper HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `500`).
- ✅ Validate all incoming request bodies and return structured error responses.
- 🔴 **Never** change a response shape without updating the contract **and** notifying the frontend team.

---

## 5. Authentication, Roles & Ring Hierarchy

### Seed Admin & First Boot

On **first deployment**, the backend automatically creates a **Seed Admin** (Ring 0) using environment variables. This admin then:

1. Logs in to the Admin Dashboard.
2. Configures the **email parsing rules** (regex, domain, year extraction logic).
3. Configures institution settings (name, logo, etc.).
4. Optionally creates additional Ring 0 or Ring 1 users.

**No other user can exist until the Seed Admin configures the tagging rules.** Registration is gated behind a valid tagging configuration.

### Login Flow

```
                                  ┌──────────────────┐
  User enters email & password    │                  │
  ─────────────────────────────► │  Backend /login   │
                                  │                  │
                                  └────────┬─────────┘
                                           │
                              ┌────────────▼────────────┐
                              │ 1. Validate credentials  │
                              │ 2. Extract cohort year   │
                              │    using ADMIN-DEFINED    │
                              │    parsing rules          │
                              │ 3. Auto-assign cohort    │
                              │    tags + groups          │
                              │ 4. Set default ring       │
                              │    (see Ring Hierarchy)   │
                              │ 5. Generate JWT           │
                              │ 6. Return JWT + user obj │
                              └────────────┬─────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │  Frontend stores  │
                                  │  JWT in memory /  │
                                  │  httpOnly cookie   │
                                  └──────────────────┘
```

### Email-Based Auto-Tagging (Admin-Controlled)

The Admin configures the tagging logic through the Admin Dashboard. Developers **never** decide or hardcode the parsing rules.

#### Admin Configuration UI Provides:

| Setting | Example | Purpose |
|---|---|---|
| Email regex pattern | `(\d{2})bcs\d+@institution\.edu` | Extract year identifier from email |
| Year extraction group | `$1` | Which capture group holds the year |
| Year-to-cohort mapping | `28 → Class of 2028` | Map extracted year to cohort name |
| Cross-year senior offset | `-1` | Auto-join group with N-1 year |
| Cross-year junior offset | `+1` | Auto-join group with N+1 year |
| Fallback behavior | `no-tags` / `require-manual` | What happens when email can't be parsed |

#### Auto-Tagging Result Example

User registers with `28bcs045@institution.edu` → Admin's regex extracts `28`:

| Auto-Assigned Group | Group Type | User's Default Ring in Group |
|---|---|---|
| `cohort-28` | Primary cohort | Ring 3 (Member) |
| `cohort-28-27` | Cross-year (seniors=27, juniors=28) | Ring 3 (Member — juniors are default) |
| `cohort-27-28` | Cross-year (seniors=28, juniors=27) | Ring 2 (Auto-elevated — seniors get elevated, see below) |

### 🔵 The Ring Hierarchy System

Permissions in Comflex are modeled as **concentric rings** — inspired by CPU protection rings. **Lower ring number = more power.** This applies **per-group** — a user can be Ring 1 in one group and Ring 3 in another.

```
┌─────────────────────────────────────────────────────┐
│                     RING 0 — Admin                   │
│  Full platform control. Created on deployment.       │
│  Can do everything. Can modify any ring.             │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │              RING 1 — Manager                    │ │
│  │  Elevated by Ring 0. Can manage groups,          │ │
│  │  elevate users UP TO Ring 1 (not Ring 0).        │ │
│  │  Cannot de-elevate or change permissions         │ │
│  │  of users at same or higher ring.                │ │
│  │                                                  │ │
│  │  ┌──────────────────────────────────────────┐    │ │
│  │  │          RING 2 — Elevated Member         │   │ │
│  │  │  Auto-assigned to seniors in cross-year   │   │ │
│  │  │  groups. Can add/remove/mute Ring 3+      │   │ │
│  │  │  users. Cannot change permissions of      │   │ │
│  │  │  users at Ring 2 or above.                │   │ │
│  │  │                                           │   │ │
│  │  │  ┌──────────────────────────────────┐     │   │ │
│  │  │  │      RING 3 — Member (Default)   │     │   │ │
│  │  │  │  Default ring for new users.     │     │   │ │
│  │  │  │  Can read, write messages,       │     │   │ │
│  │  │  │  react. No moderation powers.    │     │   │ │
│  │  │  │                                  │     │   │ │
│  │  │  │  ┌────────────────────────┐      │     │   │ │
│  │  │  │  │ RING 4+ — Restricted   │      │     │   │ │
│  │  │  │  │ Muted, read-only, etc. │      │     │   │ │
│  │  │  │  │ Applied as punishment  │      │     │   │ │
│  │  │  │  │ or restriction.        │      │     │   │ │
│  │  │  │  └────────────────────────┘      │     │   │ │
│  │  │  └──────────────────────────────────┘     │   │ │
│  │  └──────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Ring Rules — STRICT

```
ELEVATION RULES:
  1. A user at Ring N can elevate any user at Ring > N up to Ring N.
     (i.e., you can raise someone to your own level, but NOT above.)
  2. A user at Ring N can NEVER elevate someone to Ring < N.
  3. Ring 0 (Admin) is the ONLY ring that can elevate to Ring 0.

DE-ELEVATION RULES:
  4. A user at Ring N can ONLY de-elevate users at Ring > N.
     (i.e., you can only demote those below you.)
  5. A user CANNOT de-elevate someone at the same ring or above.
  6. A user CANNOT de-elevate themselves.

PERMISSION RULES:
  7. A user at Ring N can assign/revoke GRANULAR PERMISSIONS only
     for users at Ring > N.
  8. Permissions are per-group (not global).
  9. Ring 0 has ALL permissions implicitly — they cannot be revoked.
```

### Granular Permissions (Per-Group, Per-User)

These permissions are assigned by higher-ring users (Discord-style). They determine what a user can do **within a specific group/chat**.

| Permission Key | Description | Default for Ring 3 |
|---|---|---|
| `can_send_messages` | Send text messages in the group chat | ✅ |
| `can_delete_own_messages` | Delete their own messages | ✅ |
| `can_delete_others_messages` | Delete other users' messages | ❌ |
| `can_mute_members` | Mute other members (Ring > self only) | ❌ |
| `can_kick_members` | Remove members from the group | ❌ |
| `can_add_members` | Add new members to the group | ❌ |
| `can_tag_members` | Use @mentions to tag other members | ✅ |
| `can_manage_economy` | Award/deduct credits within the group | ❌ |
| `can_create_events` | Create events scoped to the group | ❌ |
| `can_pin_messages` | Pin messages in the group chat | ❌ |
| `can_manage_roles` | Change ring levels (subject to ring rules) | ❌ |
| `can_edit_group_info` | Change group name, description, avatar | ❌ |

> **Ring 2 (Elevated/Senior) defaults:** `can_delete_others_messages`, `can_mute_members`, `can_kick_members`, `can_add_members`, `can_pin_messages` are all **✅** by default.

### Senior Auto-Elevation in Cross-Year Groups

In a **cross-year group** (e.g., `cohort-28-27` which contains students from `'27` and `'28`):

- The **senior cohort** (`'27` in this example) is **automatically elevated to Ring 2**.
- The **junior cohort** (`'28` in this example) remains at **Ring 3** (default member).

This means seniors get moderation powers (add/remove/mute) over juniors by default, but **cannot change permissions** of other Ring 2 users or anyone at Ring 1/0.

```
cohort-28-27 group:
  '27 students → Ring 2 (auto-elevated seniors)
  '28 students → Ring 3 (default members)

cohort-27-28 group:  ← same physical group, different naming
  Same ring assignments apply.
```

### JWT Payload Standard (Updated)

All JWTs issued by the backend **MUST** contain at minimum:

```json
{
  "sub": "user-uuid",
  "email": "user@institution.edu",
  "globalRing": 0,
  "cohortTags": ["cohort-28", "cohort-28-27"],
  "displayBadges": ["code-warrior", "streak-master"],
  "avatarUrl": "https://storage.example.com/avatars/user-uuid.webp",
  "iat": 1700000000,
  "exp": 1700086400
}
```

> **Note:** Per-group ring levels and permissions are **NOT** in the JWT (too dynamic). They are fetched per-group via API. The `globalRing` indicates the user's platform-wide administrative level.

> **Note:** Sensitive data (passwords, private keys) must **NEVER** appear in the JWT.

---

## 6. Group Chat System (Discord-Style)

### Architecture

Chat uses **WebSocket** for real-time messaging and **REST API** for CRUD operations, history retrieval, and moderation.

```
Frontend ←─── WebSocket ───→ Backend (Chat Server)
                                   │
                              ┌────▼────┐
                              │ Message  │
                              │ Queue /  │
                              │ Broker   │
                              └────┬─────┘
                                   │
                              ┌────▼────┐
                              │ Database │
                              │ (persist │
                              │ messages)│
                              └─────────┘
```

### Chat API Rules

Every chat-related API endpoint **MUST** enforce the following:

```
BEFORE processing any chat action:

1. VERIFY the user is a member of the target group.
2. VERIFY the user's ring level in that specific group.
3. VERIFY the user has the required granular permission for the action.
4. If the action targets another user (e.g., mute, kick, delete message),
   verify the target's ring is STRICTLY GREATER than the actor's ring.
5. REJECT with 403 if any check fails. Include a clear error message
   explaining WHICH permission is missing.
```

### Message Schema

Every message stored and transmitted **MUST** follow this structure:

```json
{
  "id": "uuid",
  "groupId": "uuid",
  "authorId": "uuid",
  "author": {
    "displayName": "string",
    "avatarUrl": "string | null",
    "ring": "integer",
    "displayBadges": [
      {
        "id": "badge-id",
        "name": "Code Warrior",
        "iconUrl": "https://..."
      }
    ]
  },
  "content": "string",
  "attachments": [],
  "mentions": ["user-uuid-1", "user-uuid-2"],
  "isPinned": false,
  "isDeleted": false,
  "createdAt": "ISO 8601",
  "editedAt": "ISO 8601 | null"
}
```

> **Key point:** The `author` object **MUST** include `displayBadges` — the badges the user has chosen to display. This is rendered alongside their name in the chat UI (just like Discord roles/badges).

### WebSocket Events

| Event (Server → Client) | Payload | Description |
|---|---|---|
| `message:new` | Full message object | New message in a group |
| `message:delete` | `{ messageId, groupId }` | A message was deleted |
| `message:edit` | Updated message object | A message was edited |
| `member:muted` | `{ userId, groupId, mutedUntil }` | A member was muted |
| `member:kicked` | `{ userId, groupId }` | A member was removed |
| `member:ring_changed` | `{ userId, groupId, oldRing, newRing }` | A member's ring changed |
| `typing:start` | `{ userId, groupId }` | A user started typing |
| `typing:stop` | `{ userId, groupId }` | A user stopped typing |

| Event (Client → Server) | Payload | Description |
|---|---|---|
| `message:send` | `{ groupId, content, mentions? }` | Send a message |
| `typing:start` | `{ groupId }` | Notify typing started |
| `typing:stop` | `{ groupId }` | Notify typing stopped |

---

## 7. User Profiles, Badges & Achievements

### Profile Data

Every user has a rich profile containing:

| Field | Type | Description |
|---|---|---|
| `displayName` | string | Chosen display name |
| `avatarUrl` | string | Profile picture URL (uploaded to object storage) |
| `bio` | string | Short biography (max 500 chars) |
| `cohortTags` | string[] | Auto-assigned cohort groups |
| `globalRing` | integer | Platform-wide ring level |
| `displayBadges` | Badge[] | Currently displayed badges (user-selected, max 5) |
| `allBadges` | Badge[] | All badges earned or purchased |
| `achievements` | Achievement[] | Milestone achievements list |
| `cfHandle` | string | Linked Codeforces handle |
| `cfRating` | integer | Current CF rating |
| `creditBalance` | integer | Current Web3 credit balance |
| `joinedAt` | datetime | Account creation date |

### Badges

Badges are **cosmetic identifiers** displayed next to a user's name in chats, profiles, and leaderboards. They can be **earned** (via achievements) or **purchased** (via the credits economy).

#### Badge Types

| Type | Source | Examples |
|---|---|---|
| **Achievement Badge** | Auto-awarded when achievement conditions are met | "Code Warrior", "Streak Master", "Content Star" |
| **SBT Badge** | Awarded when an SBT is minted for the user | Mirrors the SBT achievement |
| **Purchased Badge** | Bought using Web3 credits from the badge store | Cosmetic-only badges designed by admins |
| **Admin-Granted Badge** | Manually awarded by an Admin | "Community Builder", "Founding Member" |

#### Badge Display Rules

```
1. A user can CHOOSE which badges to display (max 5 active at a time).
2. Displayed badges appear:
   - Next to the user's name in group chat messages.
   - On the user's profile page.
   - On leaderboard entries.
3. Badges CANNOT be transferred between users.
4. Purchased badges are bought with credits and are non-refundable.
5. Achievement badges are permanently bound — they cannot be removed
   (only hidden from display).
```

### Achievement System

| Achievement | Trigger | Reward |
|---|---|---|
| Code Warrior | Reach Codeforces `Expert` or higher | Badge + SBT + Credits |
| Streak Master | 30-day login streak | Badge + SBT + Credits |
| Content Star | 10+ approved content contributions | Badge + SBT |
| Event Champion | Win a platform event | Badge + SBT |
| Community Builder | Admin-granted for community work | Badge + SBT |
| First Steps | Complete profile (avatar, bio, CF link) | Badge |
| Social Butterfly | Join 5+ groups | Badge |
| Chatterbox | Send 1000+ messages | Badge |

### Profile Picture Rules

```
1. Users upload a profile picture via the profile edit page.
2. Accepted formats: JPEG, PNG, WebP. Max size: 5MB.
3. Images are resized server-side to standard dimensions (256x256, 64x64 thumbnail).
4. Stored in object storage (S3-compatible), served via CDN/signed URLs.
5. A default avatar (generated from initials) is used if no picture is uploaded.
6. Profile pictures appear in: chat messages, profile pages, leaderboards,
   member lists, and event attendee lists.
```

---

## 8. Coding Standards & AI Agent Directives

### General Coding Standards (All Developers)

#### Code Quality

- ✅ Write **clean, modular, and DRY** code.
- ✅ Every function, component, and module **MUST** have a clear, descriptive name.
- ✅ Add **comments** to explain **why**, not just **what** (the code should explain the what).
- ✅ Keep functions small — each should do **one thing**.
- ✅ Use **constants** for magic numbers and strings.

#### Error Handling

- ✅ Every API call **MUST** have proper error handling (`try/catch`, `.catch()`, etc.).
- ✅ Display user-friendly error messages — never expose raw error objects or stack traces in the UI.
- ✅ Log errors with sufficient context (endpoint, payload, user ID) for debugging.

#### UI Standards (Frontend)

- ✅ **Every data-fetching component** must implement three states:
  1. **Loading** — show a skeleton or spinner.
  2. **Success** — render the data.
  3. **Error** — show a meaningful error message with a retry option.
- ✅ All interactive elements must be **accessible** (ARIA labels, keyboard navigation, focus management).
- ✅ All layouts must be **responsive** (mobile-first).

#### Chat UI Standards

- ✅ Messages **MUST** display the author's avatar, display name, ring indicator, and selected badges.
- ✅ New messages must appear in real-time (WebSocket) — no polling.
- ✅ Implement infinite scroll / virtual scrolling for message history.
- ✅ Typing indicators must be visible to all group members.
- ✅ Deleted messages show "[Message deleted]" placeholder — not removed from DOM.

#### Testing

- ✅ Write unit tests for all utility functions and business logic.
- ✅ Write integration tests for API endpoints.
- ✅ Write tests for **ring-based permission checks** — these are security-critical.
- ✅ Aim for minimum **80% code coverage** on critical paths (auth, credits, SBTs, chat permissions).

---

### 🤖 AI Agent Directives

> **If you are an AI coding agent (Copilot, Cursor, Cody, Claude, GPT-based, or any other), the following rules are BINDING. Violations are unacceptable.**

#### 1. Code Generation Rules

```
✅ DO:
  - Write clean, modular, and HEAVILY commented code.
  - Follow the file/folder structure already established in the repo.
  - Implement loading, success, and error states for EVERY UI component
    that fetches data.
  - Use TypeScript types / interfaces (if applicable) for all data structures.
  - Follow the Conventional Commits format for any suggested commit messages.
  - Always enforce ring checks before any moderation action in chat.
  - Include badge display data in all user-facing response objects.

🔴 DO NOT:
  - Install or suggest installing new dependencies without EXPLICITLY
    asking the human developer for approval first.
  - Break or deviate from the agreed API contracts in /docs/api/.
  - Hardcode ANY institution-specific data (names, emails, logos, years).
  - Hardcode ring numbers or permission defaults — these are configurable.
  - Generate placeholder or dummy implementations without clearly marking
    them as TODO with a clear description of what needs to be implemented.
  - Remove existing comments, tests, or documentation.
  - Refactor code outside the scope of the current task without approval.
  - Skip ring validation on ANY endpoint that modifies user permissions,
    group membership, or message state.
```

#### 2. Before Writing Any Code, Verify:

```
□ Have I read the full RULES.md?
□ Have I read the relevant API contract in /docs/api/?
□ Am I following the correct branching workflow?
□ Am I writing code in the correct repository (frontend vs backend)?
□ Is my code modular and well-commented?
□ Have I implemented loading/error states (if frontend)?
□ Have I implemented input validation and error responses (if backend)?
□ Am I hardcoding anything that should be configurable? (Answer must be NO)
□ Have I enforced ring-level checks for all permission-gated actions?
□ Am I including badge/avatar data in user-facing responses?
```

#### 3. Dependency Management

```
When you need a new package:

1. STOP.
2. Tell the human developer:
   - What package you want to install.
   - Why it's needed.
   - What alternatives exist.
   - The package's size, maintenance status, and last publish date.
3. WAIT for explicit approval.
4. Only then install it.
```

#### 4. API Contract Compliance

```
When consuming or producing an API endpoint:

1. READ the contract in /docs/api/ first.
2. MATCH the request/response schema EXACTLY.
3. If the contract doesn't exist yet, STOP and ask the human developer
   to define it with the other team.
4. NEVER invent endpoint schemas on your own.
```

#### 5. Chat & Permission-Specific Rules

```
When implementing ANY chat or group feature:

1. ALWAYS check the actor's ring vs the target's ring before allowing
   moderation actions (mute, kick, delete, elevate).
2. NEVER allow a user to act on someone at the same ring or above.
3. ALWAYS include the author's badge list in message payloads.
4. ALWAYS handle WebSocket disconnects gracefully with auto-reconnect.
5. NEVER send a full message history on WebSocket connect — use
   paginated REST fetch + WebSocket for new messages only.
```

---

## Appendix: Quick Reference Card

```
╔════════════════════════════════════════════════════════════════════════╗
║                       COMFLEX — QUICK RULES                           ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  🔴 NO direct pushes to main or dev                                   ║
║  🔴 NO hardcoded institution data                                      ║
║  🔴 NO coding without an API contract                                  ║
║  🔴 NO new dependencies without human approval                         ║
║  🔴 NO moderation actions without ring-level validation                ║
║  🔴 NO chat messages without badge/avatar in author payload            ║
║                                                                        ║
║  🟢 ALWAYS branch from dev                                            ║
║  🟢 ALWAYS follow feat/fix naming convention                          ║
║  🟢 ALWAYS implement loading + error states (frontend)                ║
║  🟢 ALWAYS validate inputs + return structured errors (backend)       ║
║  🟢 ALWAYS comment your code (explain WHY)                            ║
║  🟢 ALWAYS check ring hierarchy before permission operations          ║
║  🟢 Seed Admin is created on deploy — Admin controls tagging logic    ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

**Last Updated:** 2026-04-07
**Maintained By:** Comflex Core Team
**Version:** 2.0.0
