// Gera items.js (catalogo de equipamentos) a partir do dump oficial do ao-data.
// Rodar quando o jogo ganhar itens novos:  node scripts/gerar-catalogo.js
const fs = require('fs');
const path = require('path');

const URL_ITEMS = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
// Equipamento que o Mercado Negro compra: armas, off-hand, cabeca, peito, botas, capas e bolsas, T4 a T8.
const RE_EQUIP = /^T([4-8])_(MAIN|2H|OFF|HEAD|ARMOR|SHOES|CAPEITEM|CAPE|BAG)(?:_|$|@)/;
const EXCLUIR = /NONTRADABLE|SKIN|_BABY|CRYSTAL|_TOOL_|GATHERER/;
const SLOT = { MAIN: 'Arma', '2H': 'Arma', OFF: 'Off-hand', HEAD: 'Capacete', ARMOR: 'Armadura', SHOES: 'Botas', CAPEITEM: 'Capa', CAPE: 'Capa', BAG: 'Bolsa' };

(async () => {
  const res = await fetch(URL_ITEMS);
  if (!res.ok) throw new Error(`Falha ao baixar items.json: HTTP ${res.status}`);
  const items = await res.json();

  const catalogo = [];
  for (const it of items) {
    const id = it.UniqueName;
    const m = RE_EQUIP.exec(id);
    if (!m || EXCLUIR.test(id) || !it.LocalizedNames) continue;
    const nome = it.LocalizedNames['PT-BR'] || it.LocalizedNames['EN-US'];
    if (!nome) continue;
    const ench = /@(\d)$/.exec(id);
    // [id, nome, tier, encantamento, slot]
    catalogo.push([id, nome, Number(m[1]), ench ? Number(ench[1]) : 0, SLOT[m[2]]]);
  }

  const saida = path.join(__dirname, '..', 'items.js');
  const geradoEm = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(saida, `// Gerado por scripts/gerar-catalogo.js em ${geradoEm}. Nao editar na mao.\nwindow.ALBION_ITEMS = ${JSON.stringify(catalogo)};\n`);
  console.log(`items.js: ${catalogo.length} itens, ${(fs.statSync(saida).size / 1024).toFixed(0)} KB`);
})().catch((e) => { console.error(e.message); process.exit(1); });
