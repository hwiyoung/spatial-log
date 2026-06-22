# ADR: Preview Asset Delivery Policy

Date: 2026-06-04

## Status

Accepted as Phase 6D UI-contract decision. Backend implementation is deferred.

## Context

Phase 6D improves the image/ortho ViewerShell and source diagnostics. The next production step will require a preview asset delivery strategy for real API data.

This ADR compares delivery options and keeps Phase 6D limited to UI diagnostics and handoff policy.

## Options

### Option A. Public Static Preview Assets

Pros:

- Simple to implement and debug.
- Works well for mock and local development.
- Browser `<img>` rendering is straightforward.
- Minimal backend load.

Cons:

- Weak permission control.
- Harder to revoke access.
- Not suitable for sensitive project assets without additional controls.

### Option B. Authenticated Preview URL Endpoint

Pros:

- Server can enforce permissions.
- Fits app-level auth/session logic.
- Can normalize source errors for the UI.

Cons:

- Requires backend route work.
- Backend must handle file lookup, headers, and error states.
- May need range/streaming decisions for larger previews.

### Option C. Short-Lived Signed URLs

Pros:

- Fits object storage delivery.
- Reduces backend data proxying.
- Access can expire automatically.

Cons:

- Requires expiry and refresh UX.
- Viewer may fail while open if URL expires.
- Error diagnostics must distinguish expired URL from missing/broken asset.

### Option D. Server-Rendered Preview Proxy

Pros:

- Backend controls CORS and auth.
- Backend can hide object storage details.
- Can render/convert previews server-side.

Cons:

- Adds server load.
- Needs caching policy.
- Needs range/streaming policy for media or larger previews.
- Can become a bottleneck if used for heavy assets.

## Decision For Phase 6D

Do not implement a backend delivery option in Phase 6D.

Implement only:

- frontend source diagnostics.
- URL scheme/MIME/load state clarity.
- image/ortho shell controls.
- real API handoff requirements.

The production delivery decision remains open for Phase 6E or later.

## Handoff Recommendation

Recommended staged path:

1. Keep public/static preview assets for mock/local validation.
2. Define real API preview assets using STAC `thumbnail`, `overview`, or `preview` roles.
3. Choose between authenticated endpoint and signed URLs for production based on project security requirements.
4. Add proxy/rendering only when CORS, auth, conversion, or storage constraints require it.

## Not In Phase 6D

- backend route implementation.
- signed URL issuance or refresh.
- auth integration.
- preview generation job implementation.
- DB/API schema changes.
- heavy viewer dependency integration.
