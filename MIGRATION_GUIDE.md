# Supabase Migration & Setup Guide

To successfully migrate from Firebase to Supabase and resolve issues like "Could not find the table 'public.users'", you need to initialize your Supabase schema and handle data migration.

## 1. Setup Supabase Tables and Buckets (Required)

Your app requires specific PostgreSQL tables and Storage Buckets to mimic the previous NoSQL environment.

1. Go to your [Supabase Dashboard](https://app.supabase.com/).
2. Select your project.
3. Go to the **SQL Editor** on the left sidebar.
4. Click **New Query**.
5. Copy the contents of the automatically generated `supabase-schema.sql` file (found in the root of this project) and paste it into the editor.
6. Click **Run**.

This SQL script creates all necessary tables using flexible `JSONB` columns, creates all the required Storage Buckets (images, profiles, drivers, etc.), and applies proper Row Level Security (RLS) policies.

---

## 2. Migrating Firebase Auth Users to Supabase Auth (Optional)

Supabase provides an official guide and tool to migrate your Firebase Auth users to Supabase Auth so users can log in with their same credentials (including password hashes).

### Option A: Using the Supabase Firebase Migration Tool (Recommended)

1. Ensure you have Node.js installed locally.
2. In your terminal, run the official Supabase migration tool:
   ```bash
   npx supabase-auth-migration@latest --firebase
   ```
3. The tool will prompt you for your Firebase configuration (you will need a Service Account JSON file from Firebase Project Settings > Service Accounts).
4. The tool will also prompt you for your Supabase Project URL and **Service Role Key** (found in Project Settings > API).
5. The tool will download your Firebase users and securely upload them into Supabase Auth (`auth.users`), maintaining their hashed passwords!

*For detailed instructions, refer to the [Supabase Docs for Firebase Migration](https://supabase.com/docs/guides/auth/migrating-from-firebase).*

### Option B: Migrating User Data Collections
If you have data inside Firebase Firestore (e.g., `users` or `orders` collection) that you also need to migrate to your new Supabase `public.users` or `public.orders` tables, you can write a small node script or export your Firestore data as JSON and import it into Supabase via the Supabase Dashboard CSV/JSON importer.

When uploading JSON into your new tables, ensure it follows this structure:
```json
[
  { "id": "user1-uid", "data": { "name": "John", "role": "admin" } }
]
```
Since we implemented a dynamic `JSONB` adapter, all document fields must be wrapped inside a `data` object, and the document ID goes into the `id` string field.
