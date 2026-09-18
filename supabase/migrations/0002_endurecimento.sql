-- 0002_endurecimento.sql — correções da auditoria de contas.
-- 1) Admin só altera a coluna `bloqueado`, e nunca a própria linha (não dá pra promover/rebaixar nem trocar email por REST).
-- 2) Escrita de settings/viagens também consulta a tabela profiles: bloqueio vale na hora, não só quando o JWT renova.
-- 3) search_path fixo nas funções usadas por policies e pelo hook (linter 0011 do Supabase).

revoke update on public.profiles from authenticated;
grant update (bloqueado) on public.profiles to authenticated;

drop policy if exists "admin bloqueia e desbloqueia" on public.profiles;
create policy "admin bloqueia e desbloqueia" on public.profiles
  for update to authenticated
  using ((select public.eh_admin()) and id <> (select auth.uid()))
  with check ((select public.eh_admin()) and id <> (select auth.uid()));

-- Bloqueado de verdade = claim do JWT OU linha na tabela (lookup por PK, custo desprezível).
create or replace function public.esta_bloqueado() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'bloqueado')::boolean, false)
      or coalesce((select p.bloqueado from public.profiles p where p.id = (select auth.uid())), false)
$$;

alter function public.eh_admin() set search_path = '';
alter function public.custom_access_token_hook(jsonb) set search_path = '';
