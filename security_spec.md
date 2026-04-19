# Security Specification & "Dirty Dozen" Payloads

## Data Invariants
1. **Patient Isolation**: A patient can ONLY read their own data (requests, records, bills, profile).
2. **Staff Access**: Staff (doctors, nurses, etc.) can read all patient data but only update records they are authorized for.
3. **Identity Integrity**: Any `ownerId`, `userId`, or `authorId` fields MUST match the `request.auth.uid`.
4. **MRN Immutability**: Once a patient is assigned an MRN, it cannot be changed.
5. **Terminal State**: Once a bill is 'paid' or an appointment is 'completed', certain fields become immutable.
6. **Relational Integrity**: A record cannot be created without a valid `patientId` that exists in the system.

## The "Dirty Dozen" Payloads (Attacks)

### Attack 1: Identity Spoofing (Users)
**Description**: Authenticated user 'A' tries to update user 'B's profile.
**Payload**: `patch /users/userB { "displayName": "Attacker" }` as `auth.uid = userA`.
**Expectation**: `PERMISSION_DENIED`.

### Attack 2: Role Escalation
**Description**: A patient tries to update their own role to 'admin'.
**Payload**: `patch /users/patientA { "role": "admin" }` as `auth.uid = patientA`.
**Expectation**: `PERMISSION_DENIED`.

### Attack 3: PII Leak (Global Reads)
**Description**: A patient tries to list ALL users to find emails.
**Payload**: `get /users` (no filters).
**Expectation**: `PERMISSION_DENIED`.

### Attack 4: Orphaned Medical Record
**Description**: Creating a medical record for a non-existent patient ID.
**Payload**: `create /medical_records/newRec { "patientId": "non_existent_id", ... }`.
**Expectation**: `PERMISSION_DENIED` (via `exists()` check).

### Attack 5: Bill Amount Manipulation
**Description**: A patient tries to update their own bill amount to zero.
**Payload**: `patch /bills/billA { "totalAmount": 0 }` as `auth.uid = patientA`.
**Expectation**: `PERMISSION_DENIED`.

### Attack 6: MRN Hijacking
**Description**: A staff member tries to change a patient's MRN.
**Payload**: `patch /patients/patientA { "mrn": "MC-99999" }`.
**Expectation**: `PERMISSION_DENIED` (MRN is immutable).

### Attack 7: Unlocked Terminal State
**Description**: Updating a completed appointment's date.
**Payload**: `patch /appointments/appA { "date": "2026-05-01" }` where `status == 'completed'`.
**Expectation**: `PERMISSION_DENIED`.

### Attack 8: Toxic ID Poisoning
**Description**: Creating a document with a massive 1MB ID string.
**Payload**: `create /patients/[1MB_STRING] { ... }`.
**Expectation**: `PERMISSION_DENIED` (via `isValidId()`).

### Attack 9: Metadata Corruption
**Description**: A patient tries to reset the patient counter.
**Payload**: `patch /metadata/counters { "patientCount": 0 }`.
**Expectation**: `PERMISSION_DENIED`.

### Attack 10: Shadow Field Injection
**Description**: Adding a hidden `isVerified: true` field to a user profile.
**Payload**: `patch /users/userA { "displayName": "Name", "isVerified": true }`.
**Expectation**: `PERMISSION_DENIED` (via `hasOnly()` gate).

### Attack 11: Future/Past Timestamp Spoofing
**Description**: Setting `createdAt` to a year in the future.
**Payload**: `create /patients/p1 { "createdAt": "2027-01-01T00:00:00Z", ... }`.
**Expectation**: `PERMISSION_DENIED` (must be `request.time`).

### Attack 12: Messaging Man-in-the-Middle
**Description**: User A tries to read a message sent from User B to User C.
**Payload**: `get /messages/msgBC` as `auth.uid = userA`.
**Expectation**: `PERMISSION_DENIED`.
