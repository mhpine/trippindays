-- TrippinDays Premium entitlement protection
-- Prevent browser/client sessions from granting themselves Premium.
-- Stripe/server service-role requests remain allowed.

create or replace function public.protect_premium_profile_fields()
returns trigger
language plpgsql
as $$
declare
  request_role text :=
    coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if request_role <> 'service_role' then
    if tg_op = 'INSERT' then
      if coalesce(new.is_premium, false) = true
         or new.stripe_customer_id is not null
         or new.stripe_subscription_id is not null then
        raise exception
          'Premium billing fields are server-managed.';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.is_premium is distinct from old.is_premium
         or new.stripe_customer_id is distinct from old.stripe_customer_id
         or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
        raise exception
          'Premium billing fields are server-managed.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_premium_profile_fields
on public.profiles;

create trigger protect_premium_profile_fields
before insert or update
on public.profiles
for each row
execute function public.protect_premium_profile_fields();
