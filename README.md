# Deal Alert App

Checks once a day whether **Mewgenics**, **Endacopia**, or **CrossOver**
(CodeWeavers' Windows-on-Mac software) currently have a discount, and
emails you a summary whenever one of them does.

## What it checks and how

- **Mewgenics** and **Endacopia** - both are sold on Steam, so this reads
  Steam's own public pricing data for each game.
- **CrossOver** - CodeWeavers sells it directly from their own site
  (it's not on Steam), so this checks their promotions page for whether
  it still says "no promotions currently active."

Nothing needs to stay open on your phone or computer - once deployed,
this runs in the cloud on its own schedule.

> **One extra step for this copy:** the file `api/check-deals.js` has
> been renamed to `api/check-deals.js.txt`, because email providers like
> Gmail block `.js` files as attachments. Once this is on your computer,
> rename it back to `check-deals.js` (just delete the `.txt` at the end)
> before you upload it to GitHub in Step 2.

## Setup (roughly 10 minutes, two free accounts, no coding required)

### Step 1 - Create a Resend account (this sends the email)

1. Go to **resend.com** and sign up **using the email address you want
   the alerts sent to** - this matters, see the note below.
2. Once signed in, go to **API Keys -> Create API Key**. Copy the key
   (it starts with `re_`) somewhere safe - you'll paste it in Step 3.

> **Why it has to be your own email:** Resend's free tier lets you send
> from a shared test address (`onboarding@resend.dev`) with zero extra
> setup, but only to the email address on your own Resend account.
> That's exactly what we want here, so there's no domain setup needed.

### Step 2 - Put this project on GitHub

1. Go to **github.com/new** and create a new repository (any name you
   like; Private is fine). Sign up for a free account first if you
   don't have one.
2. On the new repo's page, click **"uploading an existing file"**.
3. Drag in every file and folder from this project (including the
   `api` folder with `check-deals.js` inside it - keep that folder
   structure intact).
4. Click **Commit changes**.

### Step 3 - Deploy to Vercel

1. Go to **vercel.com** and sign up, choosing **"Continue with GitHub"**
   so the two are connected.
2. Click **Add New -> Project**, then find and **Import** the repo you
   just created.
3. Before clicking Deploy, open the **Environment Variables** section
   and add these two:
   - `NOTIFY_EMAIL` -> your email address (same one from Step 1)
   - `RESEND_API_KEY` -> the key you copied in Step 1
4. Click **Deploy**.

That's it. Vercel will now run the check once a day automatically (the
schedule lives in `vercel.json`) and email `NOTIFY_EMAIL` any time
something's on sale.

## Testing it right away

You don't have to wait a day to know it's working. Once deployed, visit:

```
https://YOUR-PROJECT-NAME.vercel.app/api/check-deals?test=1
```

(Vercel shows you the exact project URL right after deploying.) This
runs every check immediately and sends you an email regardless of
whether anything's actually discounted, so you can confirm the whole
pipeline - checking and emailing - works end to end.

## Good to know

- **Once a day, not instantly.** Free Vercel accounts can only run
  scheduled jobs once every 24 hours (hourly checks need a paid plan).
  That's plenty here, since sales run for days, not minutes - the
  current schedule is 14:00 UTC (roughly 9-10am US Eastern); edit the
  `schedule` line in `vercel.json` if you'd like a different time
  (it's in UTC, and Vercel only guarantees it fires sometime within
  that hour).
- **Repeat emails during a sale.** If a sale runs for several days,
  you'll get an email each day it's still active, not just once at the
  start. That's a simplicity trade-off - avoiding repeat emails means
  remembering "did I already tell you about this," which needs a small
  database (one more free account to set up). Say the word if you'd
  like that added later.
- **CrossOver is the least reliable of the three checks.** Steam has a
  proper public API; CodeWeavers doesn't, so that check is reading their
  webpage's wording. If they redesign that page, this check may need
  updating.
- **Email only, for now.** Text messages are possible too (via a
  service like Twilio), but unlike Resend that isn't free. Happy to add
  it if you'd like.
