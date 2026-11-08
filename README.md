# CARE Forms Survey

Mobile-first checklist for FSM and Hub coordinators. Call a hospital, record whether the ICU forms in CARE are being filled (Yes / No), and pick a reason code for each No.

Built with Vite, React, TypeScript and Tailwind CSS. Calls are saved on the phone first, then sent to a **Supabase database** (recommended) and, optionally, to a Google Sheet.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Host the `dist/` folder on any static host (Netlify, Vercel, GitHub Pages, or your own server). It must be served over HTTPS for phones to use it reliably.

Without the Supabase keys below, the app still works: calls stay on the phone and can go to a Google Sheet.

## Connect Supabase (shared database)

1. **Create the tables.** In your Supabase project open **SQL Editor > New query**, paste all of `supabase/schema.sql`, and click **Run**. You should see "Success. No rows returned".
2. **Create the team's logins.** Open **Authentication > Users > Add user > Create new user**. Enter an email and password and tick **Auto Confirm User**. Repeat for each FSM and Hub engineer.
3. **Stop strangers signing up.** In **Authentication** (Sign In / Providers, Email) turn off **Allow new users to sign up**. Only users you create can then get in.
4. **Copy the keys.** In **Project Settings > API Keys** copy the Project URL and the **publishable** key (starts with `sb_publishable_`; the older "anon" key also works). The **Connect** button at the top of the dashboard shows both.
5. **Add them to the app.** Copy `.env.example` to `.env` in the project folder and fill in the two values. Stop and restart `npm run dev` so it reads the file.

Never put the **secret** or **service_role** key in `.env`. Anything in `.env` ends up inside the app that every user downloads.

Menu names move around between Supabase updates, but the steps stay the same.

### What gets stored

| Table | One row per | Holds |
| --- | --- | --- |
| `hospital_calls` | hospital call | hospital, district, who was called, caller, rating, follow-up date, remarks |
| `call_answers` | form part per call | Yes or No, reason code R1 to R8, remarks |
| `v_answers_flat` (view) | form part per call | the two tables joined, ready for Metabase or Excel |

Rules enforced by the database, not just the app:

- Only signed-in team members can read or add data.
- Everyone on the team sees every call. A person can only add calls as themselves and delete their own.
- Sending the same call twice is safe: the second time returns the existing row (matched on `client_id`).

### Using it

- Sign in once while online. After that, calls can be saved offline and sent later from **History > Send unsent**.
- **Reports** (on the home screen) show, for each hospital's latest call: how many are Compliant, Need follow-up or Escalate, which forms are filled least, why forms are not filled, and who is due a follow-up. Filter by district.
- To export everything, open **Table Editor** in Supabase and use its CSV export, or query `v_answers_flat`.

## How a call works

1. **Call details**: hospital, district or taluk, who you spoke to, your name and role.
2. **16 parts, one per screen**: Yes or No. Yes moves to the next part. No asks for a reason code (R1 to R8) and optional remarks.
3. **Summary**: score ring, rating, the parts not being filled, then who is responsible per shift, help needed and follow-up date.
4. **Save**: on the phone, and to the database. Share the summary on WhatsApp.

A half-finished call is kept on the phone, so a dropped call loses nothing.

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
| `supabase/schema.sql` | Tables, access rules, `submit_call` function, reporting view |
| `src/data.ts` | The 16 form parts, reason codes, designations |
| `src/lib.ts` | Scoring, CSV and Sheet row, database payload, WhatsApp text, storage |
| `src/supabase.ts`, `src/sync.ts` | Supabase client and sending |
| `src/Login.tsx`, `src/Reports.tsx` | Sign-in screen and reports |
| `src/Survey.tsx` | Call details, part-by-part flow, summary |
| `src/Home.tsx`, `src/History.tsx` | Home with settings, saved calls and export |
| `apps-script/Code.gs` | Optional Google Sheet receiver |

To add or rename a form part, edit `PARTS` in `src/data.ts`. The progress bar, scoring and export follow it. The database's `call_answers` table stores each part's id and title as text, so new parts need no database change.
