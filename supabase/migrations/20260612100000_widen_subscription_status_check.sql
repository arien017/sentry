do $$
begin
  alter table public.firms
    drop constraint if exists firms_subscription_status_check;
  alter table public.firms
    add constraint firms_subscription_status_check
    check (subscription_status in (
      'trialing','active','past_due','canceled',
      'incomplete','incomplete_expired','unpaid','paused'
    ));
end $$;