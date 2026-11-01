# Benjamin

Private course migration workspace. Not a live learning website.

## Current status — 2 November 2026

- Private GitHub repository created.
- Current course-source migration candidate prepared locally, excluding student records.
- Source files have not yet been uploaded to this repository.
- No website, authentication gate or cloud progress database has been deployed.

## Proposed configuration

Use GitHub for private source/version history and Cloudflare Workers + D1 + Access for the online course. Workers supplies a workers.dev address, so no purchased domain is required. Access should use emailed one-time PINs for the two family addresses approved by Stephen; do not enable public sign-up or domain-wide access. Keep teacher and learner permissions separate.

The existing course is Python/SQLite on the Mac. It needs a checked cloud backend adaptation before deployment; uploading HTML alone would break grading, corrections and progress evidence. Preserve question identities and separate first submissions, corrections and help use. The local database remains the current learning-record authority until an explicit, verified cutover.

Do not upload Data, live SQLite files, answers/progress history, credentials, certificates, original reserved exam PDFs, caches or recovery archives. The question bank contains solutions and must stay server-side. Static resources and API routes both require authenticated access.

## Next step

Review this configuration, create/connect the Cloudflare account, prepare and test the cloud adapter, then verify sign-in, denied anonymous access, learner/teacher roles and durable progress before issuing a learning URL. Start within free-tier limits; do not enable paid services without Stephen's approval.
