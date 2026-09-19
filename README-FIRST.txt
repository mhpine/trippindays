TRIPPINDAYS PREMIUM LOCKDOWN

WHAT THIS DOES
1. Adds one shared SERVER-SIDE Premium verifier.
2. Adds /api/premium/status for secure entitlement checks.
3. Patches the CURRENT local src/app/api/plan/route.ts without replacing it:
   - Epic Road Trip => server checks the signed-in Supabase user.
   - Premium Trip Remix => server checks the signed-in Supabase user.
   - guest/free calls get 401/403 instead of Premium output.
4. Patches the CURRENT local src/app/trip/page.tsx so /api/plan sends the user's Supabase bearer token.
5. Includes a Supabase migration that stops browser/client sessions from changing:
   - profiles.is_premium
   - profiles.stripe_customer_id
   - profiles.stripe_subscription_id
6. Leaves ordinary/free trip planning available.

INSTALL

Copy/extract this package into the TrippinDays project root:

C:\Users\mhpin\Documents\trippindays\trippindays

The root must contain package.json.

Then run:

node .\apply-premium-lockdown.mjs

Then restart:

npm run dev

DATABASE LOCK

The included migration is:

supabase/migrations/20260919000000_lock_premium_profile_fields.sql

Apply that migration to Supabase before production. If you do not use Supabase CLI migrations,
open the SQL file and run its contents once in the Supabase SQL editor.

TESTS

1. Signed out:
   Normal planner should work.
   Epic Road Trip should send user to sign-in in the UI; a direct Premium /api/plan request returns 401.

2. Signed in Free:
   Normal planner should work.
   Epic Road Trip / Premium Remix should be blocked; direct Premium /api/plan request returns 403.

3. Signed in Premium:
   Epic Road Trip and Premium Remix should work.

4. On the Water:
   Existing paid data should continue to be server-verified.

BACKUPS CREATED AUTOMATICALLY

src/app/api/plan/route.ts.before-premium-lockdown.bak
src/app/trip/page.tsx.before-premium-lockdown.bak
