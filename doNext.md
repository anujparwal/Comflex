# Comflex — What To Do Next

> This file is for the next developer (or AI model) to continue work on Comflex with minimal context-loading. It describes the current state, what was just implemented, and the planned roadmap.

## Current State (Phase 3 — Just Completed)

### What Was Just Built
- **Google OAuth** — Registration via "Continue with Google" (college email only)
- **Username selection** — Post-registration username picker with availability check
- **Password setting** — Google users set a password after first login
- **Email service** — Pluggable email system (console/SMTP) for password resets and verification
- **Personal email** — Users can add and verify a secondary personal email
- **Friends system** — Send/accept/reject friend requests, bidirectional friendships
- **Direct messaging** — 1-on-1 DMs between friends, with WebSocket real-time delivery
- **Admin auto-join rules** — Configure which groups users join based on year/branch
- **Branch detection** — Extract branch code from email via regex capture groups
- **Group creation permissions** — Admin can delegate `canCreateGroups` to any user

### Tech Stack
- **Backend:** Express + Prisma/MongoDB + Socket.IO + JWT
- **Frontend:** React 19 + Vite + Tailwind 4
- **Email:** Nodemailer (SMTP) / Console fallback

---

## Immediate Next Steps (Priority Order)

### 1. Admin Dashboard UI Enhancements
The admin dashboard (`AdminDashboard.jsx`) needs the following UI additions:
- **Branch detection config** — UI for editing `branchCaptureGroup`, `branchMapping` in `emailParsingRules`
- **Auto-join rules manager** — UI to create/edit/delete auto-join rules (matchField, matchValue, groupId)
- **"Can Create Groups" toggle** — Show toggle on user rows in admin user list

### 2. User Search Endpoint
Currently `FriendsPage.jsx` uses the admin user listing endpoint for search. Need a dedicated public `/api/v1/users/search?q=` endpoint that doesn't require admin ring.

### 3. Profile Page — Personal Email Section
Add a UI section in `ProfilePage.jsx` to:
- Show current personal email and verification status
- Allow adding/changing personal email
- Show "Verification sent" message

### 4. Notification System
- Real-time notifications via Socket.IO
- Types: friend request received, DM received, group message mention, admin action
- Toast notifications in UI + notification bell with count

---

## Future Phases (Roadmap)

### Phase 4 — Economy & Gamification
- [ ] Credit system — Earn/spend credits for actions
- [ ] SBT (Soulbound Token) minting — Achievement badges on-chain
- [ ] Leaderboard system — Rankings by credits, activity, CF rating
- [ ] Badge display — Showcase achievements on profile

### Phase 5 — Academic Integration
- [ ] Codeforces integration — Fetch and display CF ratings, sync handles
- [ ] Content library — Shared resources, notes, study materials
- [ ] AI notes assistant — Use LLM to summarize and organize notes
- [ ] Event management — Campus events, RSVPs, announcements

### Phase 6 — Production Readiness
- [ ] File storage migration — Move from local `/uploads` to S3/Cloudflare R2
- [ ] Rate limiting — Express-rate-limit on API endpoints
- [ ] Testing infrastructure — Jest for backend, Vitest for frontend
- [ ] CI/CD pipeline — GitHub Actions for lint, test, deploy
- [ ] Docker setup — Containerized deployment
- [ ] Monitoring — Health checks, error tracking (Sentry), logging (Pino)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | All data models (User, Friendship, DirectMessage, etc.) |
| `backend/src/config/env.js` | All env vars centralized here |
| `backend/src/services/authService.js` | Auth logic: register, login, Google OAuth, password |
| `backend/src/services/cohortService.js` | Email parsing, year/branch extraction, auto-join |
| `backend/src/services/friendService.js` | Friend request lifecycle |
| `backend/src/services/dmService.js` | Direct messaging business logic |
| `backend/src/services/emailService.js` | Pluggable email transport |
| `backend/src/services/chatSocketService.js` | WebSocket events (groups + DMs) |
| `frontend/src/context/AuthContext.jsx` | Global auth state, all auth actions |
| `frontend/src/App.jsx` | All routes |
| `RULES.md` | Design rules, RBAC spec, API contracts |

## Key Design Rules
1. **Zero Hardcoded Institution Data** — All institution-specific config is in the database
2. **Ring-Based RBAC** — Ring 0 > Ring 1 > Ring 2 > Ring 3; lower ring = more power
3. **API-First** — All data flows through versioned REST endpoints
4. **Service Layer Pattern** — Business logic in services, routes are thin controllers
