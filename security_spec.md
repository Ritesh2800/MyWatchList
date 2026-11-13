# Reelist Firestore Security Specification

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document under `/users/{userId}` and `/users/{userId}/entries/{entryId}` belongs exclusively to `userId`. A user can never read, list, create, update, or delete another user's documents (`request.auth.uid == userId`).
2. **Verified Identity**: All reads and writes require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`), which Google Sign-In provides automatically.
3. **Path-Payload Identity Binding**:
   - On `/users/{userId}`, `incoming().userId == userId` and `userId == request.auth.uid`.
   - On `/users/{userId}/entries/{entryId}`, `incoming().id == entryId` and `incoming().userId == userId`.
4. **Immutable Ownership & Creation Metadata**: On `update` to `/users/{userId}/entries/{entryId}`, `id`, `userId`, `tmdbId`, `mediaType`, and `addedAt` cannot be mutated (`incoming().field == existing().field`).
5. **Strict Key Allowlisting & Volumetric Bounds**:
   - Unknown ("shadow" / "ghost") fields are rejected via `data.keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.
   - Every string and list has explicit `.size()` bounds (`title <= 300`, `notes <= 2000`, `genres.size() <= 15`, `id <= 128`).
6. **Query Enforcer on List Operations**: `allow list` on `/users/{userId}/entries/{entryId}` verifies `isOwner(userId) && resource.data.userId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/users/u1/entries/95396_tv` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'u1', email_verified: false }` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read/Write**: `auth = { uid: 'attacker', email_verified: true }` targeting `/users/victim/entries/95396_tv` -> `PERMISSION_DENIED`.
4. **Owner Spoofing in Payload**: `auth = { uid: 'u1' }` writing `userId: 'u2'` to `/users/u1/entries/95396_tv` -> `PERMISSION_DENIED`.
5. **Entry ID Mismatch**: Writing `id: 'other_id'` to `/users/u1/entries/95396_tv` -> `PERMISSION_DENIED`.
6. **Invalid Path ID Injection**: Path `entryId` containing spaces/slashes or `> 128` characters -> `PERMISSION_DENIED`.
7. **Shadow / Ghost Field Injection**: Including `"isAdmin": true` or `"ghostField": "x"` in entry payload -> `PERMISSION_DENIED`.
8. **Invalid Enum Value**: Setting `status: "hacked"` or `mediaType: "podcast"` -> `PERMISSION_DENIED`.
9. **String Overflow (Denial of Wallet)**: Setting `title` to 500 chars or `notes` to 5000 chars -> `PERMISSION_DENIED`.
10. **Array Overflow**: Setting `genres` to 25 items -> `PERMISSION_DENIED`.
11. **Immutable Field Mutation on Update**: Changing `addedAt`, `userId`, or `tmdbId` during an update -> `PERMISSION_DENIED`.
12. **Out-of-Bounds Rating**: Setting `rating: 99` or `rating: -5` -> `PERMISSION_DENIED`.

## 3. Red Team Audit Conflict Report
- **Identity Spoofing**: Blocked by `isOwner(userId) && data.userId == userId && data.id == entryId`.
- **State Shortcutting**: `status` is strictly restricted to `['watching', 'watchlist', 'watched', 'dropped', 'onhold']` and immutable fields (`id`, `userId`, `tmdbId`, `mediaType`, `addedAt`) are locked on `update`.
- **Resource Poisoning**: Blocked by `isValidId(userId)`, `isValidId(entryId)`, and `.size()` caps on every string, map, and list.
- **Value Poisoning on Update**: Blocked because `isValidEntry(incoming(), entryId, userId)` wraps the entire `allow update` expression alongside `affectedKeys().hasOnly(...)`.
