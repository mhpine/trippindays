-- TrippinDays Premium lock-down
-- Run ONCE in Supabase SQL Editor after installing the code files.
-- This keeps Free/SOS features available while locking paid water alerts,
-- push registration and the Premium entitlement flag itself.

-- ---------------------------------------------------------
-- 1) Stripe/Premium state columns on profiles
-- ---------------------------------------------------------
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists premium_status text,
  add column if not exists premium_current_period_end timestamptz,
  add column if not exists premium_updated_at timestamptz;

create unique index if not exists profiles_stripe_customer_id_uidx
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists profiles_stripe_subscription_id_idx
  on public.profiles(stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ---------------------------------------------------------
-- 2) Never let a normal signed-in browser grant itself Premium
-- ---------------------------------------------------------
create or replace function public.protect_premium_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' then
      if coalesce(new.is_premium, false) = true
         or new.stripe_customer_id is not null
         or new.stripe_subscription_id is not null
         or new.premium_status is not null
         or new.premium_current_period_end is not null
         or new.premium_updated_at is not null then
        raise exception 'Premium entitlement fields are server managed';
      end if;
    else
      if new.is_premium is distinct from old.is_premium
         or new.stripe_customer_id is distinct from old.stripe_customer_id
         or new.stripe_subscription_id is distinct from old.stripe_subscription_id
         or new.premium_status is distinct from old.premium_status
         or new.premium_current_period_end is distinct from old.premium_current_period_end
         or new.premium_updated_at is distinct from old.premium_updated_at then
        raise exception 'Premium entitlement fields are server managed';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_premium_profile_fields_trigger
  on public.profiles;

create trigger protect_premium_profile_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_premium_profile_fields();

-- ---------------------------------------------------------
-- 3) Reusable RLS check for paid-only database features
-- ---------------------------------------------------------
create or replace function public.current_user_is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_premium = true
  );
$$;

revoke all on function public.current_user_is_premium() from public;
grant execute on function public.current_user_is_premium() to authenticated;

-- ---------------------------------------------------------
-- 4) Premium-only condition alerts
-- ---------------------------------------------------------
alter table public.water_condition_alerts enable row level security;

-- Remove all old policies on this paid-only table so a permissive owner-only
-- policy cannot accidentally bypass the Premium requirement.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'water_condition_alerts'
  loop
    execute format(
      'drop policy if exists %I on public.water_condition_alerts',
      p.policyname
    );
  end loop;
end $$;

create policy "Premium users can view own water alerts"
on public.water_condition_alerts
for select
to authenticated
using (
  auth.uid() = user_id
  and public.current_user_is_premium()
);

create policy "Premium users can create own water alerts"
on public.water_condition_alerts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.current_user_is_premium()
);

create policy "Premium users can update own water alerts"
on public.water_condition_alerts
for update
to authenticated
using (
  auth.uid() = user_id
  and public.current_user_is_premium()
)
with check (
  auth.uid() = user_id
  and public.current_user_is_premium()
);

-- Let an owner delete old alert rows even after Premium ends.
create policy "Users can delete own water alerts"
on public.water_condition_alerts
for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 5) Premium-only browser/device push registration
-- ---------------------------------------------------------
alter table public.water_push_subscriptions enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'water_push_subscriptions'
  loop
    execute format(
      'drop policy if exists %I on public.water_push_subscriptions',
      p.policyname
    );
  end loop;
end $$;

create policy "Premium users can view own water push devices"
on public.water_push_subscriptions
for select
to authenticated
using (
  auth.uid() = user_id
  and public.current_user_is_premium()
);

create policy "Premium users can register own water push devices"
on public.water_push_subscriptions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.current_user_is_premium()
);

create policy "Premium users can update own water push devices"
on public.water_push_subscriptions
for update
to authenticated
using (
  auth.uid() = user_id
  and public.current_user_is_premium()
)
with check (
  auth.uid() = user_id
  and public.current_user_is_premium()
);

-- Let a user remove/unsubscribe their device after Premium ends.
create policy "Users can delete own water push devices"
on public.water_push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);
