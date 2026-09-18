-- 0003_admin_emails.sql — os dois emails do dono viram admin ao criar conta (aplicado no projeto em 2026-09-18).
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, papel)
  values (
    new.id,
    new.email,
    case when lower(new.email) in ('joaovictordems@gmail.com', 'eunnord@gmail.com') then 'admin'::public.papel_conta else 'user'::public.papel_conta end
  );
  return new;
end $$;

update public.profiles set papel = 'admin' where lower(email) in ('joaovictordems@gmail.com', 'eunnord@gmail.com');
