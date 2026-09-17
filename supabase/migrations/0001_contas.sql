-- 0001_contas.sql — contas, papéis e dados por usuário do Albion Flip de BM.
-- Regras (JEB): RLS em toda tabela; papel resolvido no JWT via Auth Hook; usuário só vê o próprio;
-- admin lê todos os perfis e bloqueia. Sem servidor próprio: a validação de forma dos dados é CHECK no Postgres.

create type public.papel_conta as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  papel public.papel_conta not null default 'user',
  bloqueado boolean not null default false,
  criado_em timestamptz not null default now(),
  ultimo_acesso timestamptz
);
alter table public.profiles enable row level security;

-- Perfil nasce junto com o usuário. O dono do produto vira admin pelo email.
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, papel)
  values (
    new.id,
    new.email,
    case when lower(new.email) = 'eunnord@gmail.com' then 'admin'::public.papel_conta else 'user'::public.papel_conta end
  );
  return new;
end $$;
create trigger perfil_ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Auth Hook: papel e bloqueio entram no JWT. Ativar em Authentication > Hooks > Custom Access Token.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb := event -> 'claims';
  p record;
begin
  select papel, bloqueado into p from public.profiles where id = (event ->> 'user_id')::uuid;
  claims := jsonb_set(claims, '{papel}', to_jsonb(coalesce(p.papel::text, 'user')));
  claims := jsonb_set(claims, '{bloqueado}', to_jsonb(coalesce(p.bloqueado, false)));
  return jsonb_set(event, '{claims}', claims);
end $$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;
create policy "auth admin le perfis pro hook" on public.profiles
  for select to supabase_auth_admin using (true);

-- Helpers lidos do JWT: sem query extra por request.
create or replace function public.eh_admin() returns boolean language sql stable as $$
  select coalesce((select auth.jwt() ->> 'papel') = 'admin', false)
$$;
create or replace function public.esta_bloqueado() returns boolean language sql stable as $$
  select coalesce((select auth.jwt() ->> 'bloqueado')::boolean, false)
$$;

create policy "usuario le o proprio perfil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "admin le todos os perfis" on public.profiles
  for select to authenticated using ((select public.eh_admin()));
create policy "admin bloqueia e desbloqueia" on public.profiles
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));

create or replace function public.registrar_acesso() returns void
language sql security definer set search_path = public as $$
  update public.profiles set ultimo_acesso = now() where id = (select auth.uid())
$$;
revoke execute on function public.registrar_acesso() from public, anon;
grant execute on function public.registrar_acesso() to authenticated;

-- Filtros da ferramenta por conta (o que antes ficava só no localStorage).
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  filtros jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  constraint filtros_objeto check (jsonb_typeof(filtros) = 'object'),
  constraint filtros_tamanho check (pg_column_size(filtros) < 8192)
);
alter table public.user_settings enable row level security;
create policy "usuario gerencia os proprios filtros" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and not (select public.esta_bloqueado()))
  with check ((select auth.uid()) = user_id and not (select public.esta_bloqueado()));

-- Viagens salvas: a cesta com investimento e lucro esperado.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  servidor text not null check (servidor in ('west', 'east', 'europe')),
  cidade text not null check (char_length(cidade) between 1 and 40),
  itens jsonb not null check (jsonb_typeof(itens) = 'array' and pg_column_size(itens) < 65536),
  unidades integer not null check (unidades >= 0),
  investimento bigint not null check (investimento >= 0),
  lucro_esperado bigint not null
);
alter table public.trips enable row level security;
create index trips_usuario_data on public.trips (user_id, criado_em desc);
create policy "usuario gerencia as proprias viagens" on public.trips
  for all to authenticated
  using (user_id = (select auth.uid()) and not (select public.esta_bloqueado()))
  with check (user_id = (select auth.uid()) and not (select public.esta_bloqueado()));
