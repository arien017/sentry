-- auth_firm_id is security definer by design (breaks the users-policy recursion);
   -- restrict who can call it. anon has no business calling it; authenticated must.
   revoke execute on function auth_firm_id() from public, anon;
   grant  execute on function auth_firm_id() to authenticated;