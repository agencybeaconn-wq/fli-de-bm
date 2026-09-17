# Flip do Mercado Negro

Ferramenta local pra achar itens que valem comprar no mercado de uma cidade real e vender pra ordem de compra do Black Market (Caerleon), no Albion Online.

## Uso

1. Abrir `index.html` no navegador (duplo clique). Não precisa de servidor.
2. Escolher servidor, cidade onde vai comprar (ou "Todas as cidades"), prata disponível, tier, encantamento e tipo de item, e clicar em **Atualizar preços**.
3. A tabela lista só o que dá lucro após a taxa de venda (4% premium, 8% sem), ordenada por ROI.
4. **Montar pela melhor ROI** monta a cesta gastando a prata do maior ROI pro menor, respeitando quantas unidades o BM compra por dia de cada item. A cesta mostra investimento (prata em risco na estrada), lucro esperado e ROI da viagem. Dá pra marcar linhas e editar quantidades na mão.

Os preços vêm ao vivo da [albion-online-data](https://www.albion-online-data.com/). A página lembra os filtros escolhidos entre aberturas (só os filtros; preço nunca é guardado).

## Colunas

- **Custo (cidade)**: menor ordem de venda atual na cidade. Embaixo, onde há registro do item mais barato entre as 7 cidades reais.
- **Estimado**: menor preço atual em outra cidade real; se nenhuma cidade tem, média de vendas da própria cidade em 30 dias (endpoint `history`). O lucro só usa o estimado quando não há custo atual.
- **BM paga**: maior ordem de compra do Black Market. Com "cruzar qualidades", uma ordem de qualidade menor aceita item de qualidade maior e a linha mostra qual ordem usa.
- **BM 7 dias**: preço médio a que o BM comprou e vendas por dia (endpoint `history` no Black Market). É o teto de quanto levar.
- **Levar / Potencial**: quantidade sugerida (cabe na prata, limitada pelas vendas por dia; sem volume conhecido, 1) e lucro dessa quantidade.

## Modos

- **Cruzar qualidades** (ligado por padrão): usa a regra de ordem de compra aceitar qualidade igual ou melhor. Confirmar uma vez no jogo.
- **Comprar por ordem de compra**: custo vira o preço da ordem que você colocaria (acima da maior ordem atual, nunca abaixo de 70% do preço de venda) mais 2,5% de taxa. Lucro só sai se a ordem preencher.
- **Todas as cidades**: uma linha por cidade com preço, pra decidir pra onde ir.

## Dado fresco

A API só sabe o que alguém viu no jogo. Rodar o [albiondata-client](https://github.com/ao-data/albiondata-client) (precisa do Npcap em modo compatível com WinPcap) enquanto joga e abrir o Black Market e o mercado da cidade faz seus próprios dados alimentarem a API em segundos. Os dois filtros de idade são separados de propósito: quem escaneia o BM aperta a idade do BM e afrouxa a da cidade. O resumo mostra a cobertura (quantos itens têm preço no BM e na cidade).

## Catálogo de itens

`items.js` é gerado a partir do dump oficial. Regenerar quando o jogo ganhar itens novos:

```
node scripts/gerar-catalogo.js
```
