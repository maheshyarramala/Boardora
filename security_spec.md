# ClassicPlay 10-in-1 — Firestore Security Specification

## 1. Data Invariants
1. **Owner Isolation (`/users/{userId}` and subcollections):** Every user profile, match record, session, achievement, and daily challenge belongs strictly to `userId == request.auth.uid`, requires verified Google email (`request.auth.token.email_verified == true`), and contains zero public PII exposure (`allow list` and `allow get` strictly enforce `request.auth.uid == userId`).
2. **Immutable Creation Metadata:** `uid`, `ownerId`, `createdAt`, `hostUid`, and `roomCode` can never be reassigned after document creation; `createdAt == request.time` on create and `updatedAt == request.time` on update.
3. **Strict Schema & Bounds:** Every string has explicit `.size()` bounds; every array (`seatUids`, `readyUids`) is bounded to `<= 4`; `preferences` and `privacyConsent` maps validate bounded fields; ghost/shadow keys are rejected via `keys().hasAll(...) && keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.
4. **Authoritative Multiplayer Integrity (`/rooms/{roomCode}`):**
   - Online game state, move legality, turn enforcement, and match outcomes are evaluated exclusively by the authoritative Express + WebSocket server (`server.ts` + `RoomManager`).
   - Any room metadata mirrored to Firestore enforces terminal-state locking (`existing().status != 'finished'`), immutable `hostUid`/`roomCode`/`gameId`/`createdAt`, strict action-based updates (Join seat, Toggle Ready, Start Match, Sync State), and Master Gate `get()` verification on `/rooms/{roomCode}/actions/{actionId}`.
   - Client-submitted `winnerUid` or `authoritativeReceipt` tampering after finish or by non-participants is strictly denied.
5. **No Orphaned Subcollections & No List Scraping:** `allow list` on `/rooms` requires `request.auth.uid in resource.data.seatUids` (never `get()` or `exists()` inside `allow list`).

## 2. "Dirty Dozen" Attack Payloads (Must All Be Rejected)
1. **Identity Spoofing (Profile):** Authenticated user `alice` creates `/users/bob` with `uid: "bob"`. -> `PERMISSION_DENIED`.
2. **Privilege / Ghost Field Injection (Shadow Update):** Authenticated user `alice` writes `/users/alice` with `{ ..., isAdmin: true }`. -> `PERMISSION_DENIED`.
3. **Unverified Email Write:** Authenticated token with `email_verified: false` attempts to create `/users/alice`. -> `PERMISSION_DENIED`.
4. **Immutable Timestamp Tampering:** User sets `createdAt` to a past timestamp (`createdAt != request.time`) on create. -> `PERMISSION_DENIED`.
5. **Owner Reassignment Update:** User attempts to mutate `ownerId` on `/users/alice/matches/m1`. -> `PERMISSION_DENIED`.
6. **Denial-of-Wallet String Poisoning:** User sends a 2,000-character `opponentLabel` or `sessionId` > 128 chars. -> `PERMISSION_DENIED`.
7. **Room Hijack / Host Override:** Non-host player updates `hostUid` or `gameId` on `/rooms/ABC123`. -> `PERMISSION_DENIED`.
8. **Terminal State Replay:** Player attempts to update `/rooms/ABC123` after `status == 'finished'` to flip `winnerUid`. -> `PERMISSION_DENIED`.
9. **Room Seat Overflow:** User attempts to push a 5th UID into `seatUids` (`seatUids.size() > 4`). -> `PERMISSION_DENIED`.
10. **Outsider Action Injection:** User not in `rooms/ABC123.seatUids` attempts to create `/rooms/ABC123/actions/act1`. -> `PERMISSION_DENIED`.
11. **Global Room Scraping:** Authenticated user runs `collection('rooms').get()` (`allow list`) without seat membership. -> `PERMISSION_DENIED`.
12. **Client-Foraged Match Tampering:** User updates a completed `/users/alice/matches/m1` to change `outcome: "loss"` to `"win"` or inflate `xpAwarded`. -> `PERMISSION_DENIED` (completed matches are immutable).
