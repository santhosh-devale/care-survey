# CARE Forms Survey

CARE Forms Survey supports survey entry on phones and desktops, with a desktop dashboard for hospital performance. Call a hospital, record whether the ICU forms in CARE are being filled (Yes / No), and pick a reason code for each No.

Built with Vite, React, TypeScript and Tailwind CSS. Calls are saved on the phone first, then sent to a **Supabase database** (recommended) and, optionally, to a Google Sheet.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Host the `dist/` folder on any static host (Netlify, Vercel, GitHub Pages, or your own server). It must be served over HTTPS for phones to use it reliably.

Without the Supabase publishable key, the app still works locally: calls stay on the device and can go to a Google Sheet.

## Connect Supabase (shared database)

1. **Create or update the tables and security rules.** In Supabase open **SQL Editor > New query**, paste all of `supabase/schema.sql`, and click **Run**. This creates the permission model, adds the state and taluk columns if needed, and restricts survey access based on assigned permissions. Re-running it preserves existing survey rows.
2. **Create the team's logins.** Open **Authentication > Users > Add user > Create new user**. Enter an email and password and tick **Auto Confirm User**. Repeat for each FSM, Hub engineer, manager, and administrator.
3. **Bootstrap the first admin once.** Open `supabase/bootstrap-admin.sql`, replace `YOUR_ADMIN_EMAIL` with the email of the first administrator's existing Supabase Auth account, and run it in **SQL Editor**. This first step is required because no user can grant themselves admin permissions.
4. **Stop strangers signing up.** In **Authentication** (Sign In / Providers, Email) turn off **Allow new users to sign up**.
5. **Configure the publishable key.** Copy the **publishable** key (starts with `sb_publishable_`; the legacy `anon` key also works). Locally, put it in `.env` as `VITE_SUPABASE_KEY`. In Vercel, add the same variable under **Settings > Environment Variables** and redeploy. The public project URL is configured in `src/supabase.ts`.

Never use the Supabase **secret** or **service_role** key in this browser app. Values prefixed with `VITE_` are included in the app downloaded by users; only use the publishable key.

Menu names move around between Supabase updates, but the steps stay the same.

### What gets stored

| Table | One row per | Holds |
| --- | --- | --- |
| `hospital_calls` | hospital call | hospital, state/UT, district, taluk, who was called, caller, rating, follow-up date, remarks |
| `call_answers` | form part per call | Yes or No, reason code R1 to R8, remarks |
| `user_permissions` | app user | survey, dashboard, export, and user-management permissions |
| `v_answers_flat` (view) | form part per call | the two tables joined, ready for Metabase or Excel |

Rules enforced by the database, not just the app:

- Only signed-in users with assigned permissions can submit surveys, read reports, export data, or manage permissions.
- Users with report or export access can see all survey locations. Permissions are assigned per user; area restrictions are not applied.
- Only users with the manage-users permission can grant or change app permissions.
- Sending the same call twice is safe: the second time returns the existing row (matched on `client_id`).

### Using it

- Create each account in Supabase **Authentication > Users**, then an admin assigns its permissions from **Manage user access** in the app. Enter the existing account's email and select any combination of survey entry, dashboard, CSV export, and user management.
- Survey entry is available on phones and desktops. Calls are saved on the device first and sent to Supabase when online; unsent calls can be retried from **History**.
- The desktop **Analytics dashboard** shows latest hospital status, survey counts, monthly trends, repeated problem reasons, and weakest form areas. Filter by state/UT, district, taluk, date range, and hospital name. Hospital coverage counts names already present in survey records; a verified hospital roster is needed to calculate coverage against all 100+ hospitals, including those never surveyed.
- Users with export permission can download filtered survey records as CSV/Excel-compatible data. Dashboard viewing and export are separate permissions.

## How a call works

1. **Call details**: hospital, state/UT, district, taluk, who you spoke to, your name and role. Karnataka district and taluk lists are provided; other states/UTs and unlisted Karnataka locations can be entered manually.
2. **16 parts, one per screen**: Yes or No. Yes moves to the next part. No asks for a reason code (R1 to R8) and optional remarks.
3. **Summary**: score ring, rating, the parts not being filled, then who is responsible per shift, help needed and follow-up date.
4. **Save**: on the phone, and to the database. Share the summary on WhatsApp.

A half-finished call is kept on the phone, so a dropped call loses nothing.

The Karnataka district and taluk suggestions are based on the India Local Government Directory dataset published by [planemad/india-local-government-directory](https://github.com/planemad/india-local-government-directory), retrieved 11 March 2022, under the [Government Open Data License – India](https://data.gov.in/government-open-data-license-india). Names and administrative boundaries can change; manual entry is available when a location is missing.

### Scoring

Rating = parts marked Yes divided by applicable parts. A part marked No with reason **R6 (not applicable)** is not counted against the hospital.

| Percent | Rating |
| --- | --- |
| 80 or more | Compliant |
| 50 to 79 | Needs follow-up |
| Below 50 | Escalate |

Change the cut-offs in `score()` in `src/lib.ts`. The database stores the rating the app calculated at the time of the call.

## Optional: also send each call to a Google Sheet

1. Create a Google Sheet. Open **Extensions > Apps Script**.
2. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this project and save.
3. Click **Deploy > New deployment > Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the web app link.
4. In the app, open **Settings** on the home screen and paste the link.

With Supabase connected, the Sheet is an extra copy and a Sheet failure never blocks saving. Without Supabase, the Sheet is the only destination, and the app says "Sent" when the request leaves the phone because the browser cannot read Apps Script's reply. Anyone with the web app link can add rows, so keep it inside the team.

## Files

| File | What it does |
| --- | --- |
| `supabase/schema.sql` | Tables, permission checks, access rules, `submit_call` function, reporting view |
| `supabase/bootstrap-admin.sql` | One-time setup for the first app administrator |
| `src/data.ts` | The 16 form parts, reason codes, designations |
| `src/locations.ts` | Indian states/UTs and Karnataka district/taluk suggestions |
| `src/lib.ts` | Scoring, CSV and Sheet row, database payload, WhatsApp text, storage |
| `src/supabase.ts`, `src/sync.ts` | Supabase client and sending |
| `src/Login.tsx`, `src/Reports.tsx` | Sign-in screen and desktop analytics |
| `src/UserAccess.tsx` | Admin permission management for existing Supabase Auth users |
| `src/Survey.tsx` | Call details, part-by-part flow, summary |
| `src/Home.tsx`, `src/History.tsx` | Home with settings, saved calls and export |
| `apps-script/Code.gs` | Optional Google Sheet receiver |

To add or rename a form part, edit `PARTS` in `src/data.ts`. The progress bar, scoring and export follow it. The database's `call_answers` table stores each part's id and title as text, so new parts need no database change.
