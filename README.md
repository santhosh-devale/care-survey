# CARE Forms Survey

Mobile-first checklist for FSM and Hub coordinators. Call a hospital, record whether the ICU forms in CARE are being filled (Yes / No), and pick a reason code for each No.

Built with Vite, React, TypeScript and Tailwind CSS. No backend: calls are saved in the phone's browser and can be sent to a Google Sheet.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Host the `dist/` folder on any static host (Netlify, Vercel, GitHub Pages, or your own server). It must be served over HTTPS for phones to use it reliably.

## How a call works

1. **Call details**: hospital, district or taluk, who you spoke to, your name and role.
2. **16 parts, one per screen**: Yes or No. Yes moves to the next part. No asks for a reason code (R1 to R8) and optional remarks.
3. **Summary**: score ring, rating, the parts not being filled, then who is responsible per shift, help needed and follow-up date.
4. **Save**: on the phone, and optionally to a Google Sheet. Share the summary on WhatsApp.

A half-finished call is kept on the phone, so a dropped call loses nothing.

### Scoring

Rating = parts marked Yes divided by applicable parts. A part marked No with reason **R6 (not applicable)** is not counted against the hospital.

| Percent | Rating |
| --- | --- |
| 80 or more | Compliant |
| 50 to 79 | Needs follow-up |
| Below 50 | Escalate |

Change the cut-offs in `score()` in `src/lib.ts`.

## Connect a Google Sheet

1. Create a Google Sheet. Open **Extensions > Apps Script**.
2. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this project and save.
3. Click **Deploy > New deployment > Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the web app link.
4. In the app, open **Settings** on the home screen and paste the link.

Each saved call then arrives as one row in a `Responses` tab. The header row is created on the first call.

Notes:

- The browser cannot read Apps Script's reply, so the app says "Sent" when the request leaves the phone. Open the Sheet to confirm.
- A call sent twice is ignored the second time (matched on `Call ID`).
- "Anyone" access means anyone with the link can add rows. Do not share the link outside the team. This survey holds no patient data.
- Offline calls stay on the phone. Use **History > Send unsent** later.

## Files

| File | What it does |
| --- | --- |
| `src/data.ts` | The 16 form parts, reason codes, designations |
| `src/lib.ts` | Scoring, CSV and Sheet row, WhatsApp text, storage |
| `src/Survey.tsx` | Call details, part-by-part flow, summary |
| `src/Home.tsx`, `src/History.tsx` | Home with settings, saved calls and export |
| `apps-script/Code.gs` | Google Sheet receiver |

To add or rename a form part, edit `PARTS` in `src/data.ts`. The progress bar, scoring and export columns follow it.
