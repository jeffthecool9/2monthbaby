# Couple Home: one-time setup (about 10 minutes, RM0)

You do this once. After it, both of you log in at `https://2monthbaby.vercel.app/home`.

## 1. Create the free Supabase project

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project**: name `couple-home`, set a database password (save it somewhere), region **Southeast Asia (Singapore)**, plan **Free**.
3. Wait ~2 minutes for it to finish.

## 2. Create the tables

1. Left menu → **SQL Editor** → **New query**.
2. Paste everything from `supabase/migrations/0001_init.sql` → **Run**. It should say "Success".

## 3. Turn off public sign-ups

Left menu → **Authentication** → **Sign In / Providers** → **Email**: keep Email enabled, turn **off** "Allow new users to sign up" (and turn off "Confirm email" so you don't need to click links). Save.

## 4. Add your two accounts

**Authentication** → **Users** → **Add user** → **Create new user**, twice:
- your email + a password
- her email + a password

## 5. Link both accounts to your house

1. **SQL Editor** → **New query** → paste `supabase/seed.sql`.
2. Replace `HER_EMAIL@example.com`, `Her name`, `HIS_EMAIL@example.com`, `Jeff` with your real emails and names (the names show above your heads and in the birthday banner).
3. **Run**. The last result should show both of you with the same `house_id`.

## 6. Connect the website

1. Supabase → **Project Settings** → **API**: copy **Project URL** and the **anon public** key.
2. Vercel → project **2monthbaby** → **Settings** → **Environment Variables**, add for **Production** and **Preview**:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
3. Vercel → **Deployments** → latest → **Redeploy**.

(For running locally, put the same two lines in a `.env` file in the project folder.)

## 7. Done

Open `https://2monthbaby.vercel.app/home` on both iPhones, log in, and tap **Share → Add to Home Screen** for a full-screen app icon.

**Keep it awake:** free Supabase projects pause after 7 days with nobody logging in. Playing most days prevents that; if it ever pauses, open the Supabase dashboard and click **Restore**.

**Without Supabase** (testing only): `/home?local=1&as=her` and `/home?local=1&as=him` in two tabs of the same browser.
