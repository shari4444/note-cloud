# Shari'z notecloud

A modern, cloud-connected notes workspace with Supabase Authentication, PostgreSQL database, Row Level Security (RLS), and real-time Note Collaboration.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials in `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-or-publishable-key
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚡ Supabase Setup & SQL Schema

1. **Run Database Schema**:
   - In your [Supabase Dashboard](https://supabase.com/dashboard) > **SQL Editor**.
   - Copy the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   - This creates:
     - `public.notes` table (stores note title, HTML content, timestamps, and ownership).
     - `public.note_collaborators` table (stores collaboration invitations, status, and tokens).
     - Row Level Security (RLS) policies granting **view and edit access** only to note owners and accepted collaborators.

2. **Google OAuth Provider**:
   - In **Authentication** > **Providers** > **Google**, enable Google sign-in with your Client ID and Client Secret.
   - Add Supabase Callback URL (`https://<project-id>.supabase.co/auth/v1/callback`) to your Google Cloud Console **Authorized redirect URIs**.

3. **URL Configuration**:
   - In **Authentication** > **URL Configuration**, add `http://localhost:5173/**` and `http://localhost:5173/dashboard/index.html` to **Redirect URLs**.

---

## 🤝 Note Collaboration Feature

### How to Invite a Collaborator:
1. On any note in your dashboard, click the **`COLLABORATE`** button.
2. Enter the collaborator's registered Google email address.
3. Click **Send Invite**.
4. The modal generates:
   - A direct one-click action link (`Accept` / `Decline`).
   - A pre-formatted **Email Invitation link** that opens the user's email client.
   - Real-time status tracking (`Pending`, `Accepted`, `Declined`) with access revocation.

### How Collaborators Accept & Edit:
- **Via Email / URL Link**: Opening the link with `?invite=<token>&action=accept` automatically joins the note.
- **In-App Notification**: When the invited Google account logs into their dashboard, an incoming invitation banner appears with **[Accept]** and **[Decline]** buttons.
- **Shared Workspace**: Once accepted, the note appears in the collaborator's dashboard note list with a **`✦ Collaborated`** badge. Both users can view, check off tasks, and make live edits.
