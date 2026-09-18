# Albion Flip de BM

Ferramenta pra achar itens que valem comprar no mercado de uma cidade real e vender pra ordem de compra do Black Market (Caerleon), no Albion Online. Site estático com contas via Supabase.

## Uso

1. Entrar ou criar conta (confirmação por email).
2. Escolher servidor, cidade onde vai comprar (ou "Todas as cidades"), prata disponível, tier, encantamento e tipo de item, e clicar em **Atualizar preços**.
3. A tabela lista só o que dá lucro após a taxa de venda (4% premium, 8% sem), ordenada por ROI. A aba **Guia** explica cada parte.
4. **Montar pela melhor ROI** monta a cesta com até N itens (campo ao lado do botão, padrão 20), uma unidade cada, do maior ROI pro menor, dentro da prata; o lucro por unidade exigido cresce com a bag, e cada ordem do BM conta uma vez. Quantidade é sempre 1 porque a API não mostra a quantidade de nenhuma ordem; quem viu mais no jogo digita em Levar. **Salvar viagem** guarda a cesta na conta.

Os preços vêm ao vivo da [albion-online-data](https://www.albion-online-data.com/), direto do navegador de cada usuário. A conta guarda só filtros e viagens; preço nunca é guardado.

## Como a atualização funciona

1. Uma requisição por lote de itens traz BM + as 7 cidades reais. A tabela aparece aqui e o botão libera.
2. Só com "Estimar" ligado, o histórico da cidade (30 dias) traz a média de vendas, usada como custo estimado quando a cidade não tem preço atual. Fica em cache por 30 minutos. Não há busca de volume: a ferramenta não tira quantidade de nada.
3. Toda atualização volta a ordenar por ROI. Trocar "Qualidade do item" recalcula na hora, sem nova busca; trocar cidade ou servidor rebusca sozinho. O botão Atualizar só libera no fim da carga, pra duas buscas não correrem juntas.
4. Limite da API: 180 requisições por minuto e 300 a cada 5 minutos. Num 429 a página respeita o `Retry-After` e pausa todos os lotes juntos.
5. Ícones vêm do servidor de imagens do Albion por uma fila de 6 com timeout de 6 s (um ícone inexistente demora até 50 s pra dar 404 e travaria a fila). Ícone órfão por redesenho da tabela volta pra fila; falha real tenta de novo após 15 s; quem falha mostra o tier no lugar.

## Arquivos

- `index.html`: a ferramenta inteira (lógica inline) e o guia.
- `conta.js`: login, cadastro, perfil, filtros por conta, viagens e painel admin (Supabase JS via CDN).
- `config.js`: URL do projeto Supabase e chave publishable (pública por desenho; tudo passa por RLS).
- `items.js`: catálogo gerado do dump oficial. Regenerar quando o jogo ganhar itens: `node scripts/gerar-catalogo.js`.
- `supabase/migrations/0001_contas.sql`: tabelas, RLS, trigger de perfil e Auth Hook. `0002_endurecimento.sql`: admin só altera `bloqueado` (nunca a própria linha), bloqueio vale na hora (policy consulta a tabela), search_path fixo.

## Contas e papéis

- `profiles` (papel `admin` ou `user`, bloqueado), `user_settings` (filtros), `trips` (viagens). RLS em toda tabela: usuário só lê e escreve o próprio; admin lê todos os perfis e bloqueia.
- O papel vai no JWT pelo Auth Hook `public.custom_access_token_hook`. Precisa ser ativado no painel: Authentication → Hooks → Custom Access Token → função `custom_access_token_hook`.
- O dono vira admin pelos emails definidos na trigger `criar_perfil` (migrations 0001 e 0003).

## Deploy

- GitHub `agencybeaconn-wq/fli-de-bm` conectado ao Vercel (site estático, sem build).
- No Supabase, Authentication → URL Configuration: Site URL = URL do site no Vercel, e a mesma URL em Redirect URLs (links de confirmação e de redefinir senha voltam pra lá).
- Chaves secret e service_role nunca entram no frontend nem no repositório.

## Dado fresco

A API só sabe o que alguém viu no jogo. Rodar o [albiondata-client](https://github.com/ao-data/albiondata-client) (com Npcap em modo compatível com WinPcap) enquanto joga e abrir o Black Market e o mercado da cidade faz seus próprios dados alimentarem a API em segundos. Os dois filtros de idade vêm em 1 hora. Medido em 18/09/2026 numa amostra de 245 preços de Fort Sterling na API: 4 tinham menos de 1 hora, 22 menos de 6 horas, 245 menos de 24 horas. Com 24 horas a tabela mostra listagem que já foi comprada; com 1 hora mostra o que alguém viu agora há pouco. O BM é escaneado o tempo todo (na mesma medição, 861 de 1.645 preços tinham menos de 15 minutos). Quando faltam preços recentes da cidade, a página avisa embaixo do resumo.
