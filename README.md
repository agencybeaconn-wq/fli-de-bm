# Albion Flip de BM

Ferramenta pra achar itens que valem comprar no mercado de uma cidade real e vender pra ordem de compra do Black Market (Caerleon), no Albion Online. Site estático com contas via Supabase.

## Uso

1. Entrar ou criar conta (confirmação por email).
2. Escolher servidor, cidade onde vai comprar (ou "Todas as cidades"), prata disponível, tier, encantamento e tipo de item, e clicar em **Atualizar preços**.
3. A tabela lista só o que dá lucro após a taxa de venda (4% premium, 8% sem), ordenada por ROI. A aba **Guia** explica cada parte.
4. **Montar pela melhor ROI** monta a cesta gastando a prata do maior ROI pro menor, respeitando quantas unidades o BM compra por dia. **Salvar viagem** guarda a cesta na conta.

Os preços vêm ao vivo da [albion-online-data](https://www.albion-online-data.com/), direto do navegador de cada usuário. A conta guarda só filtros e viagens; preço nunca é guardado.

## Arquivos

- `index.html`: a ferramenta inteira (lógica inline) e o guia.
- `conta.js`: login, cadastro, perfil, filtros por conta, viagens e painel admin (Supabase JS via CDN).
- `config.js`: URL do projeto Supabase e chave publishable (pública por desenho; tudo passa por RLS).
- `items.js`: catálogo gerado do dump oficial. Regenerar quando o jogo ganhar itens: `node scripts/gerar-catalogo.js`.
- `supabase/migrations/0001_contas.sql`: tabelas, RLS, trigger de perfil e Auth Hook.

## Contas e papéis

- `profiles` (papel `admin` ou `user`, bloqueado), `user_settings` (filtros), `trips` (viagens). RLS em toda tabela: usuário só lê e escreve o próprio; admin lê todos os perfis e bloqueia.
- O papel vai no JWT pelo Auth Hook `public.custom_access_token_hook`. Precisa ser ativado no painel: Authentication → Hooks → Custom Access Token → função `custom_access_token_hook`.
- O dono vira admin pelo email definido na trigger `criar_perfil` (migration).

## Deploy

- GitHub `agencybeaconn-wq/fli-de-bm` conectado ao Vercel (site estático, sem build).
- No Supabase, Authentication → URL Configuration: Site URL = URL do site no Vercel, e a mesma URL em Redirect URLs (links de confirmação e de redefinir senha voltam pra lá).
- Chaves secret e service_role nunca entram no frontend nem no repositório.

## Dado fresco

A API só sabe o que alguém viu no jogo. Rodar o [albiondata-client](https://github.com/ao-data/albiondata-client) (com Npcap em modo compatível com WinPcap) enquanto joga e abrir o Black Market e o mercado da cidade faz seus próprios dados alimentarem a API em segundos. Os dois filtros de idade são separados de propósito: quem escaneia o BM aperta a idade do BM e afrouxa a da cidade.
