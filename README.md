# Benjamin — public online course

Latest decision, 2 November 2026: open the course directly without passwords,
Google sign-in, approved emails or a Cloudflare Access gate.

Course URL: https://benjamin-science.golfapan.workers.dev

Cloudflare Workers serves the course; D1 saves attempts. A random, secure,
HttpOnly browser cookie separates each visitor's saved work. There is no account
or login step. Use the same browser to resume; different devices/browsers have
separate progress. Clearing the browser cookie can disconnect saved attempts.
The public Progress page shows only that browser's own attempts. Older Google-
owned family records stay separate and are not exposed or imported; the Mac's
private learning database remains unchanged and was not uploaded.

Question entry, marking, corrections, first-pass evidence and prepared solutions
continue to work. Existing independent first-test rules remain. Original teacher
exam answer PDFs and developer files are not public downloads. Public visitors
cannot impersonate teachers by supplying an email header.

## Build and verification

Run `node tests.mjs` and `node public.test.mjs`. The original 2076 Python grading
fixtures and 102 summary fixtures remain; synthetic SQL tests verify public
entry, marking, persistence, own-history access and separation from older private
records. No live student data is used by the local tests.

Deploy the selected cloud package to the existing benjamin-science Worker using
the existing GitHub/Cloudflare build integration. No new site, port, subscription
or paid service is required. `wrangler.jsonc` declares the existing D1 binding.
Google credentials and allowlists are no longer used by the Worker; historical
Google auth code is inactive and is not served as a static asset.

`build.py` prepares the selected snapshot from the portable local course. Do not
upload the private Mac database, credentials, logs, reference library or developer
history. The source repository can remain private while the website is public.

Public version prepared and locally verified; live deployment verification is
recorded in the local cloud_plan.json, not inferred from a source commit alone.
