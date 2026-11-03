# BIAI LeadFlow — AI-powered CRM demo

A functional Next.js + Firebase Firestore + Gemini AI CRM for the **20 fictional BIAI sample enquiries**. Includes dashboard, enquiry CRUD, CSV import, language-aware AI extraction/reply, sales-only pipeline, duplicate-phone warnings, overdue follow-ups and 48-hour uncontacted counts.

## Quick start

1. Install Node.js 20+.
2. Run `npm install`.
3. Create a Firebase project, enable **Firestore Database**, then Firebase Console > Project settings > Service accounts > Generate new private key. Never commit this JSON.
4. Copy `.env.example` to `.env.local`. Fill `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` from the service account; get `GEMINI_API_KEY` from Google AI Studio; set a long random `ADMIN_SECRET`.
5. Run `npm run dev`, open http://localhost:3000, enter the admin secret and click **Connect**.
6. Go to **Import CSV**, choose `data/sample-enquiries.csv`, click Import. This creates `sample-1` through `sample-20` in Firestore.
7. Go to **Enquiries**, edit any record, click **Analyze with Gemini**, inspect the result, correct it and save. **Existing CSV names and phone numbers are retained** if AI cannot find them in the message.
8. Review sample 7 (support), 11 (spam), 12 (same phone as sample 1), 16 (refund escalation), and 20 (job seeker). The imported default category is `Other` until reviewed by AI/human. Pipeline includes `Sales` only.

## Deploy on Vercel

1. Push project to a **private** GitHub repository (do not commit `.env.local` or Firebase service-account JSON).
2. Import repository at vercel.com/new. Framework should auto-detect Next.js.
3. Add the four environment variables under Vercel Project Settings > Environment Variables. For the private key use the service-account PEM with escaped `\\n` or actual newlines, depending on how it is pasted.
4. Deploy. Open your Vercel URL, enter the same admin secret, import the CSV and test.
5. Never publish or share the admin secret in the Loom video or README. A shared secret is **demo-only**, not proper multi-user authentication. Use Firebase Auth and role-based access before any real customer data.

## Gemini model

`app/api/analyze/route.js` uses `gemini-2.0-flash` as an example model ID. If the model is unavailable for your API key, change it to a currently available Gemini model in your Google AI Studio account. AI calls run on the server. Do not put API keys in `NEXT_PUBLIC_*` variables.

## What the demo intentionally does not do

- No direct WhatsApp, Messenger or phone integrations; messages are pasted/imported.
- No automated sending of AI replies; staff reviews/copies them.
- No authenticated per-user roles or audit logs; the demo uses a single shared secret.
- No scheduled background n8n reminder or weekly summary yet. Dashboard shows overdue and uncontacted-48h counts.
- No automatic classification of all imported rows until each row is analyzed; this avoids silently inventing labels.
- No corporate-leads pipeline: its stages are different and it is outside the chosen core Task 1 scope.
- No AI accuracy claims without human-labeled evaluation.

## Testing checklist

- Import CSV and verify 20 records and correct Bangla text.
- Analyze a Banglish bootcamp enquiry, a Bangla fellowship enquiry and an English corporate training enquiry.
- Analyze sample 7 as Support, 11 as Spam, 16 as Support, 20 as Job; review/correct AI output.
- Verify duplicate phone warning for sample 1 and 12.
- Edit a lead, refresh the page, verify persistence.
- Move a Sales lead between New, Contacted, Interested, Paid and Lost.
- Verify missing phone stays blank and AI does not invent a price.
- Verify invalid admin secret rejects access.

