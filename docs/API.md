# Rhyza — API Reference

All REST endpoints are tRPC procedures in practice. This document uses REST notation for readability. All responses are JSON. Authentication via Bearer token (JWT).

Base URL: `https://api.rhyza.app/v1`

---

## Authentication

```
POST   /auth/sso          → initiate SAML SSO flow
POST   /auth/token        → exchange code for JWT
POST   /auth/refresh      → refresh access token
DELETE /auth/token        → sign out
```

---

## Gardens

```
GET    /gardens                         → list org's gardens (with member count, seed count, stage)
POST   /gardens                         → create garden { name, emoji, description }
GET    /gardens/:id                     → garden detail + member list + recent seeds
PATCH  /gardens/:id                     → update garden metadata
GET    /gardens/:id/members             → paginated member list
POST   /gardens/:id/members             → invite by email
DELETE /gardens/:id/members/:userId     → remove member
GET    /gardens/:id/seeds               → list seeds (paginated, filtered by stage)
GET    /gardens/:id/blooms              → list blooms (latest version per seed)
```

---

## Seeds

```
POST   /gardens/:gardenId/seeds         → plant a seed { title, content }
GET    /seeds/:id                       → seed detail + stage distribution + watcher count
PATCH  /seeds/:id                       → edit title/content (author only, before first contribution)
DELETE /seeds/:id                       → soft delete (author or garden steward)

GET    /seeds/:id/contributions         → contributions by dimension { dimension?, cursor }
POST   /seeds/:id/contributions         → add contribution { dimension, content, parent_id? }
PATCH  /contributions/:id              → edit contribution (author, within 5 min)
DELETE /contributions/:id              → soft delete

POST   /contributions/:id/reactions     → toggle reaction { reaction_key }
GET    /contributions/:id/reactions     → reaction counts + who reacted { reaction_key? }
POST   /contributions/:id/endorsements  → endorse a contribution

GET    /seeds/:id/stage-votes           → stage distribution { stage: count, pct }
POST   /seeds/:id/stage-votes           → cast/update stage vote { stage }

GET    /seeds/:id/ai-synthesis          → streaming AI synthesis of all dimensions
  → Server-Sent Events: text/event-stream
  → Events: { type: 'token', content: '...' } | { type: 'done' }
```

---

## Blooms

```
POST   /seeds/:seedId/blooms            → create bloom (triggered when threshold met)
  Request: { title, summary, content, contributor_additions: [{name, email, role}] }
  Side effects:
    - Sets seeds.bloom_id and seeds.stage = 'bloomed'
    - Broadcasts to WebSocket channel seed:{seedId}:bloom
    - Creates notifications for all seed contributors
    - Runs AI lineage attribution

GET    /blooms/:id                      → bloom detail + contributors + version history
GET    /blooms/:id/contributors         → contributors with endorsement counts
POST   /blooms/:id/contributors         → manually add contributor { name, email, role }
POST   /blooms/:id/contributors/:contrib/endorsements → endorse a bloom contributor

GET    /gardens/:gardenId/sacred-tree   → all blooms as tree leaves
  Response: { blooms: [{ id, title, latestVersion, bloomDate, branchPosition, contributors }] }
```

---

## Search

```
GET    /search?q={query}&scope={all|gardens|seeds|blooms|members}&cursor={cursor}
  Response: {
    results: [
      { type: 'seed', id, title, excerpt, gardenName, stage, score }
      { type: 'bloom', id, title, excerpt, version, gardenName, score }
      { type: 'garden', id, name, description, memberCount, score }
      { type: 'member', id, name, recognitions, score }
    ],
    nextCursor: '...',
    totalCount: 142,
    semanticMatches: [...],  // pgvector results
    lexicalMatches: [...]    // FTS results
  }

POST   /search/log            → log click { query, entity_type, entity_id }
```

---

## Users & Profiles

```
GET    /users/me                        → current user profile
PATCH  /users/me                        → update bio, avatar
GET    /users/:id                       → public profile { name, bio, recognitions, gardens, seeds, blooms }
GET    /users/:id/recognition           → recognition labels + endorsement counts
POST   /users/:id/recognition           → award recognition label { label_key, garden_id }
```

---

## Notifications

```
GET    /notifications                   → paginated notifications (unread first)
  Query: { read?: boolean, type?: string, cursor? }
PATCH  /notifications/:id/read          → mark one as read
POST   /notifications/read-all          → mark all as read
DELETE /notifications/:id               → dismiss

GET    /notifications/preferences       → push + email preferences
PATCH  /notifications/preferences       → update preferences
```

---

## Presence & Watchers

```
POST   /seeds/:id/presence/enter        → announce you're viewing (Redis INCR)
DELETE /seeds/:id/presence/exit         → announce you're leaving (Redis DECR)
GET    /seeds/:id/presence              → { count, users: [{ id, name, avatarUrl }] }

POST   /gardens/:id/presence/enter
DELETE /gardens/:id/presence/exit
GET    /gardens/:id/presence
```

---

## Media Uploads

```
POST   /uploads/presigned               → get S3 presigned URL
  Request: { filename, mime_type, entity_type: 'contribution', entity_id }
  Response: { upload_url, cdn_url, attachment_id }

POST   /uploads/:attachmentId/complete  → confirm upload finished
  Response: { attachment } (with thumbnail_url if image/video)

GET    /attachments/:id/unfurl          → OG metadata for link attachments
```

---

## WebSocket Events (Ably Channels)

### Channel: `garden:{gardenId}`
```json
// Inbound (server → client)
{ "event": "seed.created",     "data": { seed } }
{ "event": "bloom.created",    "data": { bloom } }
{ "event": "member.joined",    "data": { user } }
{ "event": "member.left",      "data": { userId } }
```

### Channel: `seed:{seedId}`
```json
// Inbound (server → client)
{ "event": "contribution.created",  "data": { contribution } }
{ "event": "contribution.deleted",  "data": { contributionId } }
{ "event": "reaction.updated",      "data": { contributionId, reactions: { key: count } } }
{ "event": "stage-vote.updated",    "data": { distribution: { seed: 0, germinating: 2, ... } } }
{ "event": "bloom",                 "data": { bloom, triggeredBy: { user } } }
  // This is THE moment. Client fires bloom animation on receipt.
{ "event": "watcher.count",         "data": { count: 14 } }
```

### Channel: `user:{userId}`
```json
{ "event": "notification",          "data": { notification } }
{ "event": "endorsement.received",  "data": { from: { user }, contributionId } }
```

---

## Rate Limits

| Endpoint group       | Limit          |
|----------------------|----------------|
| Stage votes          | 1 per seed per 5 min |
| Bloom votes          | 1 per seed     |
| Contributions        | 10 per minute  |
| Reactions            | 30 per minute  |
| Search               | 60 per minute  |
| Media uploads        | 10 per hour    |

---

## AI Endpoints

```
GET    /seeds/:id/ai-synthesis     → streaming Bloom synthesis (SSE)
POST   /seeds/:id/ai-classify      → classify new contribution into dimension
  Request: { content }
  Response: { dimension: 'foundations', confidence: 0.87 }

POST   /seeds/:id/ai-convergence   → convergence signal
  Response: { signal: 'converging' | 'building' | 'diverging', reason: '...' }

POST   /blooms/:id/ai-version      → generate new bloom version from new contributions
  → SSE stream of updated summary
```

---

## Error Format

```json
{
  "error": {
    "code": "SEED_NOT_FOUND",
    "message": "Seed not found or you do not have access",
    "status": 404,
    "requestId": "req_abc123"
  }
}
```

### Error Codes
```
UNAUTHORIZED        401   No valid auth token
FORBIDDEN           403   No access to this resource
NOT_FOUND           404   Entity doesn't exist
RATE_LIMITED        429   Too many requests
BLOOM_THRESHOLD     409   Bloom already exists for this seed version
VOTE_ALREADY_CAST   409   User already voted for bloom (one per seed)
```
