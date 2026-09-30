# Security

Skylink CamCenter stores camera credentials, signs operators in with a session, and limits what each role can do. This note is the short version for the team and for an audit.

## Camera credentials

Camera passwords are not stored in plaintext and are not sent to the browser.

- The app encrypts each password with AES-256-GCM before writing `Camera.encryptedPassword`.
- The key is `CAMERA_ENCRYPTION_KEY`, a base64-encoded 32-byte secret kept in the server environment.
- Each value is `iv.tag.ciphertext`, with a fresh 12-byte IV. The authentication tag rejects tampered ciphertext.
- API responses and pages use a camera DTO that omits the password. Snapshot, PTZ, and stream setup decrypt the password only on the server while talking to the camera.
- User account passwords are separate. Those are hashed with Argon2id and are never encrypted with the camera key.

## Sessions

Sign-in uses Auth.js with the Credentials provider and a JWT session cookie.

- The browser posts email and password to the Auth.js route. The server checks the Argon2id hash and, on success, issues an HttpOnly session cookie.
- The JWT carries the user id, role, and organization id so the edge proxy can require a session for `/dashboard` without opening the database.
- API routes and dashboard pages load the user row again on each request. Role and site access therefore follow the database, not a stale token, as soon as an admin changes them.
- The proxy only checks that a session exists. It does not grant permissions. Every API route checks the role and the sites that user may open.

## Role matrix

A user belongs to one organization. `ADMIN` can open every site in that organization. `OPERATOR` and `VIEWER` can open only the sites listed in `SiteAccess` (`userId`, `siteId`). A camera or alert outside those sites is returned as not found.

| Action | VIEWER | OPERATOR | ADMIN |
| --- | --- | --- | --- |
| View cameras, live video, snapshots, and alerts on assigned sites | Yes | Yes | Yes |
| PTZ (move, stop, home) | No | Yes | Yes |
| Acknowledge alerts | No | Yes | Yes |
| Add, edit, remove, or move cameras | No | No | Yes |
| Test a camera connection or scan the network | No | No | Yes |
| Create, edit, and delete sites | No | No | Yes |
| Create, edit, and delete users, including roles and site access | No | No | Yes |

Hiding a button is not the control. The API returns `403 FORBIDDEN` when the role is not allowed, and `404 NOT_FOUND` when the camera, site, alert, or user is outside the caller's organization or site access.
