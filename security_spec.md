# Firebase Security Specification (TDD)

## 1. Data Invariants
The security rule set for **tasks** requires absolute compliance with the following logical constraints:
- **Ownership (Identity Isolation)**: A student can only view, create, update, or delete their own tasks. The `ownerId` field must match `request.auth.uid`.
- **Email Verification**: Only authenticated students with verified email accounts (`request.auth.token.email_verified == true`) are permitted to write records.
- **Immutability**: Once written, the fields `ownerId` and `createdAt` cannot be modified.
- **Validation Strictness**: All string fields have strict size boundaries (`title` <= 200, `subject` <= 100, `notes` <= 1000, `dueDate` == 10). Value ranges are strictly controlled (`difficulty` between 1 and 5, `estimatedHours` between 0.5 and 24.0).
- **System Integrity (Temporal Validation)**: `createdAt` must equal the server timestamp `request.time` on creation.

---

## 2. The "Dirty Dozen" Malicious Payloads
The following payloads describe 12 attempts to bypass our security constraints and corrupt application state.

### Payload 1: Zero-Trust Identity Bypass (Identity Spoofing)
An authenticated attacker (`uid_attacker`) tries to write a task for a victim (`uid_victim`) to pollute their feed.
```json
{
  "title": "Malicious task insertion",
  "subject": "Math",
  "dueDate": "2026-05-30",
  "estimatedHours": 2,
  "difficulty": 3,
  "cognitiveType": "analytical",
  "completed": false,
  "ownerId": "uid_victim"
}
```
*Expected Result:* `PERMISSION_DENIED` - The rule must check that `incoming().ownerId == request.auth.uid`.

### Payload 2: No-Auth / Unauthenticated Write
An unauthenticated request attempts to create a task document.
```json
{
  "title": "Anonymous disruption task",
  "subject": "Chemistry",
  "dueDate": "2026-05-30",
  "estimatedHours": 1,
  "difficulty": 1,
  "cognitiveType": "memorization",
  "completed": false,
  "ownerId": ""
}
```
*Expected Result:* `PERMISSION_DENIED` - Checked by the `request.auth != null` rule.

### Payload 3: Email Verification Spoof (Unverified Write)
A user who registered but did not verify their email attempts to create a task.
```json
{
  "title": "Unverified assignment task",
  "subject": "History",
  "dueDate": "2026-05-30",
  "estimatedHours": 1.5,
  "difficulty": 2,
  "cognitiveType": "synthesis",
  "completed": false,
  "ownerId": "uid_unverified"
}
```
*Expected Result:* `PERMISSION_DENIED` - Checked by `request.auth.token.email_verified == true`.

### Payload 4: Immutable Field Pollution (Hijacking Tasks)
An attacker tries to update an existing user document to transfer its ownership to someone else.
```json
{
  "ownerId": "uid_victim_attacker_changed"
}
```
*Expected Result:* `PERMISSION_DENIED` - The `allow update` pattern forbids altering `ownerId` (`incoming().ownerId == existing().ownerId`).

### Payload 5: Deny-Of-Wallet Injection (Excessive Field Size)
An attacker injects a 5MB trash-text block into the `title` field to blow up database storage and bandwidth costs.
```json
{
  "title": "REPEATED_TRASH_STRING_OF_SIZE_5_MEGABYTES...",
  "subject": "Physics",
  "dueDate": "2026-05-30",
  "estimatedHours": 1,
  "difficulty": 3,
  "cognitiveType": "analytical",
  "completed": false,
  "ownerId": "uid_valid"
}
```
*Expected Result:* `PERMISSION_DENIED` - Rejected because `title.size() <= 200`.

### Payload 6: Negative Hours Burnout Attack (Invalid values)
An attacker sets `estimatedHours` to a negative value or zero to break metrics.
```json
{
  "title": "Negative math study",
  "subject": "Math",
  "dueDate": "2026-05-30",
  "estimatedHours": -5.5,
  "difficulty": 2,
  "cognitiveType": "analytical",
  "completed": false,
  "ownerId": "uid_valid"
}
```
*Expected Result:* `PERMISSION_DENIED` - Rejected because `estimatedHours` must be greater than or equal to `0.5`.

### Payload 7: Out of Bounds Difficulty Range
An attacker writes an assignment with difficulty level 99.
```json
{
  "title": "Impossible exam assignment",
  "subject": "Math",
  "dueDate": "2026-05-30",
  "estimatedHours": 3,
  "difficulty": 99,
  "cognitiveType": "analytical",
  "completed": false,
  "ownerId": "uid_valid"
}
```
*Expected Result:* `PERMISSION_DENIED` - Checked by `difficulty >= 1 && difficulty <= 5`.

### Payload 8: Custom Cognitive Type Spoofing
Writing an unsupported enum value into `cognitiveType` to break the UI layout or backend processors.
```json
{
  "title": "Cheat study methods",
  "subject": "Math",
  "dueDate": "2026-05-30",
  "estimatedHours": 4,
  "difficulty": 3,
  "cognitiveType": "lucid-dreaming",
  "completed": false,
  "ownerId": "uid_valid"
}
```
*Expected Result:* `PERMISSION_DENIED` - Checked by allowed enums constraints.

### Payload 9: Temporal Hijacking (Spoofing Timestamp)
A user tries to post a manual timestamp for `createdAt` in the future instead of server-verified time.
```json
{
  "title": "Historical study logs",
  "subject": "History",
  "dueDate": "2026-05-30",
  "estimatedHours": 2,
  "difficulty": 2,
  "cognitiveType": "synthesis",
  "completed": false,
  "ownerId": "uid_valid",
  "createdAt": "2030-01-01T00:00:00Z"
}
```
*Expected Result:* `PERMISSION_DENIED` - Only a real Firestore server timestamp (`request.time`) is accepted for `createdAt`.

### Payload 10: Client Query Leakage (Blanket List Retrieval)
An attacker queries list records omitting their owner filter, requesting all records of the entire tasks collection.
```
firestore.collection("tasks").get()
```
*Expected Result:* `PERMISSION_DENIED` - Security rules do not allow listing unless `resource.data.ownerId == request.auth.uid` is evaluated.

### Payload 11: Task-Stitching Shadow Fields (Keys Spill)
An attacker injects an undocumented "shadow field" like `isVerifiedAdministrator: true` into their task schema.
```json
{
  "title": "Adversary task record",
  "subject": "History",
  "dueDate": "2026-05-30",
  "estimatedHours": 1,
  "difficulty": 1,
  "cognitiveType": "synthesis",
  "completed": false,
  "ownerId": "uid_valid",
  "isVerifiedAdministrator": true
}
```
*Expected Result:* `PERMISSION_DENIED` - Rejected because document keys size must strictly equal the documented schema properties size (N = 9 standard keys or 10 keys including notes).

### Payload 12: Terminal Lock Bypass (Editing Finished Tasks)
An attacker tries to update the cognitive parameters (`difficulty`, `estimatedHours`) of a task that has already been finalized as `completed` to manipulate aggregate dashboard counts or cheat streak trackers.
```json
{
  "id": "task-completed",
  "title": "Already completed Chemistry Exam Review",
  "subject": "Chemistry",
  "dueDate": "2026-05-30",
  "estimatedHours": 10.0,
  "completed": true,
  "ownerId": "uid_valid"
}
```
*Expected Result:* `PERMISSION_DENIED` - Terminal tasks completed are locked for edits except toggle-completion transitions or deletes.

---

## 3. Test Runner Invariant
All requests falling out of this specification will be blocked immediately at the Firestore boundary before reaching any data nodes. This is mathematically validated in our `firestore.rules`.
