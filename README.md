# Albion Flip de BM

Ferramenta pra achar itens que valem comprar no mercado de uma cidade real e vender pra ordem de compra do Black Market (Caerleon), no Albion Online. Site estático com contas via Supabase.

## Uso

1. Entrar ou criar conta (confirmação por email).
2. Escolher servidor, cidade onde vai comprar (ou "Todas as cidades"), prata disponível, tier, encantamento e tipo de item, e clicar em **Atualizar preços**.
3. A tabela lista só o que dá lucro após a taxa de venda (4% premium, 8% sem), ordenada por ROI. A aba **Guia** explica cada parte.
4. **Montar pela melhor ROI** monta a cesta com até N itens (campo ao lado do botão, padrão 20), uma unidade cada, do maior ROI pro menor, dentro da prata; o lucro por unidade exigido cresce com a bag, e cada ordem do BM conta uma vez. Quantidade é sempre 1 porque a API não mostra a quantidade de nenhuma ordem; quem viu mais no jogo digita em Levar. **Salvar viagem** guarda a cesta na conta.

5. **Aba Craft**: busca o item base (recurso, artefato ou equipamento) e troca o encantamento por chips. Cada material da receita aparece com o preço em todas as cidades (menor ordem de venda, com a idade do dado); a mais barata vem escolhida e o clique troca; o preço unitário é editável. Material refinado tem "comprar pronto" ou "refinar do bruto" (bruto e refinado do tier anterior, cada um com suas cidades). Retorno é a porcentagem que o painel da estação mostra no jogo (já conta cidade, bônus diário e foco), digitada por etapa: uma pro craft e uma pra cada material refinado; artefato não retorna. Cada material diz quantas unidades comprar já descontando o retorno reaproveitado entre um craft e outro (só a devolução do último sobra na bag); linha e total mostram compra, sobra, taxas e custo líquido. A venda é uma grade cidade × qualidade, com o Black Market como linha (só compra equipamento, na hora): em cada célula, o preço daquela qualidade (maior ordem de compra ou menor ordem de venda) com a idade, o outro lado e a média de 7 dias com vendas por dia; quem paga mais vem escolhido e o clique troca. Resultado: custo líquido, venda líquida, lucro e ROI.

6. **O que craftar** (modo da aba Craft que abre primeiro; cobre também o que o Black Market não compra: ferramentas, equipamento de coleta, comida, poção, montaria, kit de reparo e baú, que vêm do dump pelo gerador como itens só do Craft, com receita por unidade porque comida e poção saem várias por craft; bônus +15% de Caerleon em coleta, ferramenta e comida e de Brecilien em poção): motor de rotas de craft, no estilo do Crafting Advisor do Albion Analyser. Recorte (tier, encantamento, tipo), prata, foco, cidades na rota, idade do preço, mínimo de vendas/dia, prazo pra vender, taxa da estação (por 100 de nutrição) e taxa de venda. Pra cada item testa a rota (direto ou craftar um nível abaixo e encantar), a cidade de cada material (2 mais baratas ou tudo numa), a cidade de craft (bônus +15% da categoria, tabela da wiki Local_Production_Bonus guardada no receitas.js, ou uma cidade já na rota) e a venda (7 cidades e Black Market; na hora, por ordem, ou pela média quando não há ordem). Mostra passos (Compre / Crafte / Encante / Venda), a conta embaixo de cada número, "Melhor uso da sua prata agora" com quantidades totais e "mais rotas". Foco só onde o dump tem custo de foco; material marcado como "não volta" no dump (artefato, equipamento usado como material, ficha) não entra no retorno. Ornamentos de capa (artefatos) não têm receita de craft.
7. **Refino** (modo da aba Craft): motor de rotas. Recurso (ou todos), foco sim/não (com foco disponível e especialização), prata pra investir, cidades na rota (1 a 3), idade máxima do preço, mínimo de vendas/dia, prazo pra vender tudo, bônus diário do recurso, taxa da estação (prata por 100 de nutrição; nutrição = 11,25% do valor do item, que vem do dump) e taxa de venda. Quantidade = menor entre o que a prata compra, o que o foco cobre (custo de foco do dump, metade a cada 25 níveis de especialização) e o que a cidade vende no prazo. Regras de retorno conferidas na wiki oficial (Resource Return Rate, Local Production Bonus). Pra cada tier e encantamento testa todas as combinações de cidade do bruto e do refinado anterior, cidade de refino (bônus da cidade do recurso +40%, estação 18%, foco +59%, retorno = bônus ÷ (1 + bônus)) e cidade e modo de venda (na hora, ordem, ou média de 7 dias quando não há ordem atual), descarta preço velho, fora da realidade (abaixo de 25% da referência; venda acima de 3×) e cidade sem volume, e devolve a rota de maior lucro por unidade (empate de 1% decide por menos cidades e preço mais novo), com custo, venda, média e vendas/dia, lucro, ROI e, com a prata, unidades, investimento, lucro total e em quantos dias escoa. "Mais rotas" mostra alternativas; a linha abre na calculadora. Duas requisições por recurso.
8. **Calculadora**: taxa da estação de craft e de refino por 100 de nutrição (convertida pelo valor do item); rotas (craftar direto × craftar um nível abaixo e encantar) com custo aproximado e a mais barata marcada; lista de compras por cidade com peso; resumo no cartão do item; especialização por item (nível 0 a 100) e foco por craft copiado do painel do jogo, salvos com os filtros na conta, que viram "lucro por 1.000 de foco".

Os preços vêm ao vivo da [albion-online-data](https://www.albion-online-data.com/), direto do navegador de cada usuário. A conta guarda só filtros e viagens; preço nunca é guardado.

## Média de 7 dias

A "média" do histórico é o preço do meio das vendas, pesado pela quantidade. Um dia fora da curva não puxa o número: em 26/09/2026 Lymhurst registrou 610 facas de esfolar T4 a 149.698, quando o normal era 2 mil, e a média aritmética de 7 dias dava 27 mil.

## Rests (zona negra)

Arthur's, Merlyn's e Morgana's Rest entram como mercados no Refino, no O que craftar, na Calculadora e como cidade de compra na aba principal (não em "Todas as cidades", que ficaria pesada). A API junta todos os mercados de contrabandista numa rede: o código `4300` traz a rede inteira (38 mercados) e a página fica só com os três Rests. Regras da wiki: refino no Rest com 15% de bônus e nenhum recurso com bônus; craft com 18% e +15% nas categorias de cada Rest (Arthur's placa e armas de corte/impacto, Merlyn's couro e armas de destreza, Morgana's tecido e cajados). Os passos marcam "zona negra". Em outubro de 2026 a rede não tinha histórico de vendas nos últimos 7 dias, então os Rests entram como lugar de compra, refino e craft, e só viram lugar de venda quando houver vendas por dia comprovadas.

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
- `receitas.js`: receitas de craft e refino, recursos e artefatos (dump bruto + nomes PT-BR), carregado só quando a aba Craft abre. Regenerar junto: `node scripts/gerar-receitas.js`.
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

Desde o fim de setembro de 2026 o servidor Americas responde pelo IP 85.234.70.x, que o albiondata-client 0.1.59 não reconhece: ele captura e descarta tudo em silêncio (log com "Sending" e sem "Successfully sent"). Correção: iniciar com `-i https+pow://pow.west.albion-online-data.com`. O gateway ignora o campo serverid, então o destino fixo basta.
