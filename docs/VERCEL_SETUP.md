# Truco: new Vercel + Supabase projects

The `main` branch runs on standard Next.js, with Supabase Auth and Postgres. The [Sites version](https://truco.gga.chatgpt.site) is a separate, compatible build that retains ChatGPT sign-in and D1 data. It remains owner-only. Do not deploy this Next.js branch directly through Sites; Google, Facebook, Apple, and email sign-in require the Supabase setup below.

## 1. Create Supabase

Create a new project in your Supabase organization. Save its database password in your password manager. Run `supabase/migrations/20260912000000_truco.sql` once in its SQL editor (or `supabase db push` after linking the project).

All game tables have RLS enabled with **no client policies**. The Next.js server accesses them with the server-side Postgres connection. Never expose `DATABASE_URL` or database credentials in browser variables. Clients cannot read opponents' hands or other users' histories directly.

In **Connect**, copy the Transaction pooler connection string (port 6543) to `DATABASE_URL`. The Vercel integration supplies `POSTGRES_URL`, which is also supported. The app disables prepared statements and verifies TLS using the public Supabase Root 2021 CA in `supabase/prod-ca-2021.crt` (expires April 26, 2031). This is a public trust certificate, not a database credential; its source is the download linked from Supabase Database Settings. Copy the project URL and publishable key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## 2. Create Vercel

The project `giampigas-projects/truco-venezolano` has been created. Its short production address is **https://truco-ve.vercel.app**, attached to the project for future deployments; use it for `NEXT_PUBLIC_SITE_URL` and Supabase Site URL/callback settings. GitHub auto-deployment still needs Vercel access to the private repository. Preview deployment is currently blocked with `TEAM_ACCESS_REQUIRED`: Vercel cannot verify the commit author’s permission, including after switching this repository to the GitHub noreply address. Connect the correct GitHub account in Vercel and grant this project/repository access before retrying. The free Supabase project `truco` (`bhovtgdbgekcrplkntot`) is now provisioned and connected; the existing schema has been applied to all eight game tables with RLS enabled.

Import `Giampiga/truco-venezolano`, select Next.js, and use `main` as the production branch. Set the three variables above and `NEXT_PUBLIC_SITE_URL` to the chosen Vercel domain. Set Node.js 22 or later. Do not set `TRUCO_LOCAL_TEST_AUTH` or `TRUCO_LOCAL_DATABASE` on Vercel.

The app uses polling for rooms and chat. LiveKit runs separately; put its three credentials from `.env.example` in Vercel to enable room voice/camera. Hosting the frontend does not provision media infrastructure.

## 3. Configure sign-in

In Supabase Authentication:

- Set **Site URL** to `https://truco-ve.vercel.app` (no trailing slash). Under **Redirect URLs**, add these patterns, retaining the literal backslash before `?`:

  ```text
  https://truco-ve.vercel.app/auth/callback
  https://truco-ve.vercel.app/auth/callback\?*
  http://localhost:3013/auth/callback
  http://localhost:3013/auth/callback\?*
  ```

  The app sends an encoded `next` query parameter and sometimes `reset=1`. Supabase matches the query string too: `\?` matches a literal question mark and `*` accepts these encoded values while keeping the origin and callback path fixed. Add the same two entries for a specific preview origin when testing there; use its actual local port if different. See [Supabase's wildcard rules](https://supabase.com/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls) and its [query-string matching check](https://github.com/supabase/auth/blob/master/internal/utilities/request_test.go).

- Enable Email/Password, email confirmation, and Anonymous sign-ins. Anonymous users can play casual games; the server blocks profile/friend writes and competitive actions until the user has a confirmed account.
- Configure your SMTP sender for confirmation and password-reset delivery; test actual delivery before launch.
- For cross-device confirmation links, set the confirmation template URL to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` and the recovery template URL to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
- Enable manual identity linking for anonymous account upgrades. Set the Change Email template URL to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`; upgraded guests confirm their email before choosing a password. Creating an email account from the guest session uses Supabase's account upgrade to preserve the same user ID. Signing into an existing account switches identities; histories are not merged by name or email.
- These custom `token_hash` templates always use **Site URL** and do not carry a room invitation: confirmation returns to the lobby; recovery and guest upgrades go through password setup, then the lobby. Reopen the room link afterward. OAuth and the default `{{ .ConfirmationURL }}` email links use the app's supplied callback/`next` and preserve the invitation; the default email flow requires the browser/device that started it because it uses PKCE. Do not append `/auth/confirm` to `{{ .RedirectTo }}` here: this app supplies a complete callback URL, including its query. See [email template variables](https://supabase.com/docs/guides/auth/auth-email-templates) and [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
- Configure Google, Facebook, and Apple under Providers. Their client secrets belong in Supabase, never in this repository. Each provider uses Supabase's displayed callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`). Google includes Gmail and other Google accounts.
- Google: create a web OAuth client, configure the consent screen and authorized redirect URI.
- Facebook: configure Facebook Login in a Meta app, its valid OAuth redirect URI, and app credentials. Complete Meta's requirements before enabling login for the public.
- Apple: configure your Apple developer identifiers, domain/return URL and signing key; generate the provider secret and schedule renewal according to Apple's/Supabase's instructions.

Official instructions: [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook), [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [anonymous account upgrades](https://supabase.com/docs/guides/auth/auth-anonymous), [server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

## 4. Verify before switching traffic

Test email signup → confirmation → profile save → sign-out → login → password recovery, then each social provider with real test accounts. Verify guest casual play and guest rejection from competitive rooms. Complete a casual game and a competitive game; confirm history, Elo and peak Elo survive another session. Confirm preview/prod use the intended database.

Existing Sites accounts use hashed ChatGPT IDs; new accounts use Supabase UUIDs. **They are not automatically linked.** Preserve a Sites database export before any cutover. Importing old profiles, friends and results requires an explicit, verified old-ID → new-ID ownership mapping; never infer ownership from display names. Keep the Sites version available until this migration is agreed and tested. Local AI practice remains browser-local and is not recorded as an online match.

## Local checks without cloud credentials

```
npm ci
TRUCO_LOCAL_DATABASE=/tmp/truco-local-db TRUCO_LOCAL_TEST_AUTH=1 npm run dev -- --port 3013
npm test
npm run typecheck
TRUCO_TEST_URL=http://localhost:3013 npm run test:integration
TRUCO_TEST_URL=http://localhost:3013 npm run test:ranked
TRUCO_TEST_URL=http://localhost:3013 npm run test:matchmaking
TRUCO_TEST_URL=http://localhost:3013 node --experimental-strip-types tests/profile-integration.mts
TRUCO_TEST_URL=http://localhost:3013 node --experimental-strip-types tests/global-chat-integration.mts
TRUCO_TEST_URL=http://localhost:3013 node --experimental-strip-types tests/account-access-integration.mts
npm run build
```

PGlite runs the same Postgres schema for local checks. Test identities only exist when both development mode and the explicit test switch are enabled. These checks do not prove external OAuth credentials, SMTP, real media connections, or hosted Postgres networking work.

## Verification on September 13, 2026

The free project and schema are connected. A temporary confirmed test account passed password login, SSR cookie verification, `/api/account`, and persisted profile reads through the actual Supabase service. The test account and profile were removed. This does not verify email delivery or social login. Email and Anonymous login are now enabled. Guest login passed in the production browser. Google/Facebook/Apple remain disabled until their provider credentials are supplied. The UI now labels unavailable social methods and offers real AI practice without creating an account.
