# Account sync

The account UI is currently removed from the app (see the top-level README); this page is the
setup to finish before switching it back on. The timer works completely without it. `.env.local` holding the project URL and
anon key is what turns the sign-in button in the header on; with those values
empty, the account UI stays hidden and nothing ever leaves the browser.

## The project

|              |                                                             |
| ------------ | ----------------------------------------------------------- |
| Organization | imVansh2010's Organization (`ywjzugjoxouddvpxqmha`)         |
| Project      | `pbtimer` — ref **`ppiqtkvmrgutpgizknbr`**                  |
| Region       | Central EU (Frankfurt)                                      |
| URL          | https://ppiqtkvmrgutpgizknbr.supabase.co                    |
| Dashboard    | https://supabase.com/dashboard/project/ppiqtkvmrgutpgizknbr |

The database password is in `db-password.local` next to this file (git-ignored —
`*.local`). It is only needed for direct Postgres access; the app never uses it.

## Tables

The schema lives in [`migrations/20261028213000_account_sync.sql`](./migrations/20261028213000_account_sync.sql)
and is already applied. To apply a change:

```
npx supabase db push --linked
```

Or paste the file into **SQL Editor → New query** and run it. Both are safe to
repeat: everything is `if not exists` and the policies are dropped and recreated.

That creates `public.solves` and `public.preferences` with row level security
enabled, `force row level security` set, and no grants at all for the `anon`
role. A signed-in request can only ever reach rows where `user_id = auth.uid()`,
and column constraints reject junk even from a tampered client.

## Sign-in methods

**Authentication → Providers**

- **Email** — on by default, with _Confirm email_ on, so an address cannot be used
  before it is verified. Email + password and magic links both work today.
- **Google** — not enabled yet. Turn it on with a Web application OAuth client
  ID/secret from the Google Cloud console, and add this authorized redirect URI
  in Google:

  ```
  https://ppiqtkvmrgutpgizknbr.supabase.co/auth/v1/callback
  ```

  Then add the app's own origins under **Authentication → URL Configuration**:

  ```
  https://<your-deployed-origin>
  http://localhost:5173
  ```

  The Google button in the sign-in dialog already calls the provider; it only
  reports "that sign-in method isn't enabled yet" until this step is done.

## Keys in the app

`.env.local` (git-ignored) holds:

```
VITE_SUPABASE_URL=https://ppiqtkvmrgutpgizknbr.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

`.env.example` documents both. The anon key is public by design — it ships in the
bundle — and row level security is what protects each account's rows. The
`service_role` key must never be placed in this file or anywhere the browser can
read it.

## What syncs

- Every solve: time, penalty, scramble, puzzle, date, and its edits.
- Settings (inspection, hold-to-arm, hide running time, accent).
- The selected puzzle.

Signing in for the first time merges the solves already in the browser into the
account, silently. If the browser last synced a _different_ account, those solves
are set aside for it rather than uploaded into the new one. Deletions are soft
deletes, so a solve removed on one device cannot be re-uploaded by another.
Changes made offline are queued and pushed when the browser comes back online.
Signing out never deletes anything.
