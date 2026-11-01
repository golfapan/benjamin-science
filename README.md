# Benjamin — private online course

Cloudflare Workers serves the course; D1 saves online attempts. The original Mac course and its learning database remain unchanged. Earlier Mac work has not been imported.

Google sign-in protects every production request. No Cloudflare Zero Trust subscription or billing card is required. Only golfapan@gmail.com (teacher) and benjaminpanics@gmail.com (learner) are allowed. The Worker verifies Google token signatures, issuer, client audience, expiry, email verification and a single-use browser nonce. An HttpOnly secure cookie refers to a hashed, seven-day session in D1; client identity headers are ignored. Static files and exam PDFs also require authentication. Original exam answer PDFs require the teacher role. Preview URLs are disabled.

## Deployment

Set the D1 database ID in wrangler.jsonc. Apply schema.sql to the new benjamin-progress database. Set GOOGLE_CLIENT_ID to the web login client with the exact production origin. The server enforces the two-email allowlist before creating a session. Keep run_worker_first enabled. Deploy with npm install and npm run deploy. No private Mac database, credentials, logs, reference library or developer history belongs in this repository.

## Validation

Run npm test. Golden fixtures are generated from the original Python grading and summary implementation using synthetic, in-memory records. Tests cover corrections, help evidence, first-test sealing, SQL persistence, concurrent update rejection, ownership and access guards.

build.py is a local snapshot preparation utility; it requires the original course directories and is not a Cloudflare build step. The deployed snapshot contains only the selected current course resources. Course material and solutions are bundled in the Worker, outside the static directory.

Deployment status is recorded in the local cloud_plan.json. Repository creation alone does not mean hosting or email login is live.

## Current rollout

Course URL: https://benjamin-science.golfapan.workers.dev

The private Worker and D1 schema are deployed. Google user-data policy consent, the exact production JavaScript origin and the two approved Google test users are configured. No credit card was bound and Cloudflare Zero Trust checkout was cancelled. A sign-out control is available for switching accounts.

Live sign-in verification is incomplete: Google Identity Services currently reports that the origin is not allowed, despite the saved origin matching the course URL. Google documents a propagation interval of five minutes to several hours for client changes (https://support.google.com/cloud/answer/15549257). Propagation is a possible cause, not yet confirmed. Anonymous course/API access remains blocked. Do not treat the course as ready for learner use until an approved Google login and live progress round-trip have passed. Earlier Mac records remain separate and have not been imported.
