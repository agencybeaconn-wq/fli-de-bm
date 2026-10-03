// Gera receitas.js (receitas de craft e refino, recursos e artefatos) a partir do dump oficial do ao-data.
// Rodar quando o jogo ganhar itens novos:  node scripts/gerar-receitas.js
// Fonte: items.json (dump bruto, tem craftingrequirements) + formatted/items.json (nomes em PT-BR).
const fs = require('fs');
const path = require('path');

const URL_RAW = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
const URL_FMT = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
const ITEMS_JS = path.join(__dirname, '..', 'items.js');
const SAIDA = path.join(__dirname, '..', 'receitas.js');

// Bônus de craft (+15%) por cidade real, da wiki oficial (Local_Production_Bonus, editada em 19/03/2025), pela
// subcategoria do dump. Off-hand é tudo em Martlock; capa e bolsa em Brecilien. Rests (Outlands) não entram.
const BONUS_CRAFT = {
  'Fort Sterling': ['hammer', 'spear', 'holystaff', 'plate_helmet', 'cloth_armor'],
  'Lymhurst': ['sword', 'bow', 'arcanestaff', 'leather_helmet', 'leather_shoes'],
  'Bridgewatch': ['crossbow', 'dagger', 'cursestaff', 'plate_armor', 'cloth_shoes'],
  'Martlock': ['axe', 'quarterstaff', 'froststaff', 'plate_shoes'],
  'Thetford': ['mace', 'naturestaff', 'firestaff', 'leather_armor', 'cloth_helmet'],
  'Caerleon': ['knuckles', 'shapeshifterstaff'],
};
// Rests (zona negra), mesma página da wiki: craft +15% nessas subcategorias.
const BONUS_CRAFT_REST = {
  "Arthur's Rest": ['axe', 'crossbow', 'hammer', 'mace', 'sword', 'knuckles', 'plate_helmet', 'plate_armor', 'plate_shoes'],
  "Merlyn's Rest": ['bow', 'dagger', 'quarterstaff', 'spear', 'naturestaff', 'shapeshifterstaff', 'leather_helmet', 'leather_armor', 'leather_shoes'],
  "Morgana's Rest": ['arcanestaff', 'cursestaff', 'firestaff', 'froststaff', 'holystaff', 'cloth_helmet', 'cloth_armor', 'cloth_shoes'],
};
function restBonusCraft(it) {
  for (const [rest, subs] of Object.entries(BONUS_CRAFT_REST)) if (subs.includes(it['@shopsubcategory1'])) return rest;
  return null;
}
function cidadeBonusCraft(it) {
  const cat = it['@shopcategory'], sub = it['@shopsubcategory1'], id = it['@uniquename'];
  if (cat === 'offhands') return 'Martlock';
  // Caerleon: equipamento de coleta, ferramenta e comida; Brecilien: poção (mesma tabela da wiki).
  if (cat === 'gathering') return 'Caerleon';
  if (cat === 'consumables' && sub === 'food') return 'Caerleon';
  if (cat === 'consumables' && sub === 'potions') return 'Brecilien';
  if (cat === 'capes' || cat === 'bags' || /_(CAPE|CAPEITEM)/.test(id) || /_BAG/.test(id)) return 'Brecilien';
  for (const [cidade, subs] of Object.entries(BONUS_CRAFT)) if (subs.includes(sub)) return cidade;
  return null;
}

// Id do dump -> id da API: material encantado vira "T4_PLANKS_LEVEL1@1".
const idApi = (id) => { const m = /_LEVEL(\d)$/.exec(id); return m ? `${id}@${m[1]}` : id; };
const lista = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

// Escolhe a variante de receita sem ficha de facção e, entre artefato e token de favor, o artefato.
function escolherReceita(cr) {
  const variantes = lista(cr).filter((v) => v && v.craftresource);
  const semToken = variantes.filter((v) => !lista(v.craftresource).some((r) => /FACTION_.*_TOKEN|TOKEN_FAVOR/.test(r['@uniquename'])));
  const v = semToken[0] || variantes[0];
  if (!v) return null;
  return {
    mats: lista(v.craftresource).map((r) => [idApi(r['@uniquename']), Number(r['@count']), r['@maxreturnamount'] === '0' ? 0 : 1]),
    saida: Number(v['@amountcrafted'] || 1),
    foco: Number(v['@craftingfocus']) || 0, // custo de foco com 0 de especialização
  };
}

(async () => {
  const baixar = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`); return r.json(); };
  const [raw, fmt] = await Promise.all([baixar(URL_RAW), baixar(URL_FMT)]);
  const nomes = new Map(fmt.map((f) => [f.UniqueName, f.LocalizedNames?.['PT-BR'] || f.LocalizedNames?.['EN-US'] || f.UniqueName]));
  const dump = new Map();
  for (const grupo of Object.values(raw.items)) if (Array.isArray(grupo)) for (const it of grupo) if (it && it['@uniquename']) dump.set(it['@uniquename'], it);

  // Equipamentos do catálogo da ferramenta (items.js): [id, nome, tier, ench, slot].
  const janela = {}; new Function('window', fs.readFileSync(ITEMS_JS, 'utf8'))(janela);
  const equipamentos = janela.ALBION_ITEMS;
  // Itens só do Craft (o Black Market não compra): ferramenta e equipamento de coleta, comida, poção, montaria, kit de
  // reparo e baú. Saem do dump formatado (que tem os encantamentos com nome), filtrados pela categoria do dump bruto.
  const noCatalogo = new Set(equipamentos.map(([id]) => id));
  const slotExtra = (it, id) => {
    const cat = it['@shopcategory'], sub = it['@shopsubcategory1'];
    if (cat === 'gathering') return /_TOOL_/.test(id) ? 'Ferramenta' : 'Coleta';
    if (cat === 'consumables') return sub === 'potions' ? 'Poção' : sub === 'food' ? 'Comida' : null;
    if (cat === 'mounts') return 'Montaria';
    if (cat === 'furniture') return 'Móvel';
    return null;
  };
  const extras = [];
  for (const f of fmt) {
    const id = f.UniqueName;
    if (!/^T[1-8]_/.test(id) || noCatalogo.has(id) || /NONTRADABLE|SKIN|_BABY|QUEST|TEST/.test(id)) continue;
    const it = dump.get(id.replace(/@\d$/, ''));
    const slot = it && slotExtra(it, id);
    if (!slot) continue;
    // [id, nome, tier, ench, tipo, tem qualidade]
    extras.push([id, nomes.get(id) || id, Number(it['@tier']) || 0, Number((/@(\d)$/.exec(id) || [])[1] || 0), slot, Number(it['@maxqualitylevel'] || 1) > 1 ? 1 : 0]);
  }
  const todosItens = [...equipamentos, ...extras];

  const receitas = {}; // idApi -> { n, t, e, k, rec: { mats: [[idApi, qtd, retorna]], saida } }
  const materiaisUsados = new Set();
  let semReceita = 0;
  for (const [id, nome, tier, ench, slot, temQual] of todosItens) {
    const base = id.replace(/@\d$/, '');
    const it = dump.get(base);
    if (!it) { semReceita++; continue; }
    // Ornamentos de capa e afins: são artefatos (vêm de mob/baú); a "receita" de runas do dump não é craft de estação.
    if (it['@shopcategory'] === 'artefacts') { semReceita++; continue; }
    let rec = null, up = [];
    if (ench === 0) rec = escolherReceita(it.craftingrequirements);
    else {
      const e = lista(it.enchantments?.enchantment).find((x) => Number(x['@enchantmentlevel']) === ench);
      rec = e ? escolherReceita(e.craftingrequirements) : null;
      // Encantar o nível anterior: runas (.1), almas (.2), relíquias (.3). Sem retorno.
      up = e ? lista(e.upgraderequirements?.upgraderesource).map((r) => [idApi(r['@uniquename']), Number(r['@count'])]) : [];
    }
    if (!rec) { semReceita++; continue; }
    receitas[id] = { n: nome, t: tier, e: ench, k: 'equip', rec, up, bonus: cidadeBonusCraft(it), rest: restBonusCraft(it), extra: noCatalogo.has(id) ? null : [slot, temQual] };
    for (const [m] of rec.mats) materiaisUsados.add(m);
    for (const [m] of up) materiaisUsados.add(m);
  }

  // Materiais: recurso refinado (tem receita própria: bruto + refinado do tier anterior), bruto, artefato.
  const fila = [...materiaisUsados];
  while (fila.length) {
    const idA = fila.pop();
    if (receitas[idA]) continue;
    const base = idA.replace(/@\d$/, '');
    const it = dump.get(base);
    if (!it) { console.warn('material fora do dump:', idA); continue; }
    const tier = Number(it['@tier']) || 0;
    const ench = Number((/@(\d)$/.exec(idA) || [])[1] || 0);
    const rec = escolherReceita(it.craftingrequirements);
    const sub = it['@shopsubcategory1'] || '';
    const k = /ARTEFACT/.test(base) ? 'artefato' : /_(RUNE|SOUL|RELIC|SHARD_AVALONIAN)$/.test(base) ? 'encantamento' : sub === 'refinedresources' ? 'refinado' : sub === 'resources' ? 'bruto' : 'outro';
    receitas[idA] = { n: nomes.get(idA) || nomes.get(base) || base, t: tier, e: ench, k, rec: k === 'refinado' && rec ? rec : null, peso: Number(it['@weight']) || 0, valor: Number(it['@itemvalue']) || 0 };
    if (receitas[idA].rec) for (const [m] of receitas[idA].rec.mats) if (!receitas[m]) fila.push(m);
  }

  // Recursos brutos e refinados que não entram em nenhuma receita de equipamento (T2, T3) ainda valem pra busca de preço.
  for (const [base, it] of dump) {
    const sub = it['@shopsubcategory1'] || '';
    if (sub !== 'resources' && sub !== 'refinedresources') continue;
    if (!/^T[2-8]_(WOOD|ORE|HIDE|FIBER|ROCK|PLANKS|METALBAR|LEATHER|CLOTH|STONEBLOCK)(_LEVEL\d)?$/.test(base)) continue;
    const idA = idApi(base);
    if (receitas[idA]) continue;
    const rec = sub === 'refinedresources' ? escolherReceita(it.craftingrequirements) : null;
    receitas[idA] = { n: nomes.get(idA) || nomes.get(base) || base, t: Number(it['@tier']) || 0, e: Number((/_LEVEL(\d)$/.exec(base) || [])[1] || 0), k: sub === 'refinedresources' ? 'refinado' : 'bruto', rec, peso: Number(it['@weight']) || 0, valor: Number(it['@itemvalue']) || 0 };
  }

  // Formato: m = materiais { id: [nome, tier, ench, tipo, peso, valor do item] }; r = receitas (3º campo 0 = não volta) (tipo: bruto, refinado, artefato, encantamento, outro;
  // artefato e encantamento não voltam com a taxa de retorno); r = receitas { id: [[material, quantidade], ...] } de
  // equipamentos e recursos refinados; u = encantar { id@n: [[runa/alma/relíquia, quantidade]] } do nível n-1 pro n.
  // f = custo de foco { id: foco com 0 de especialização } de equipamentos e refinados (valor do equipamento = soma dos materiais).
  // b = cidade com bônus de craft { id base do equipamento: cidade }.
  // rb = Rest com bônus de craft { id base: Rest }.
  // e = itens só do Craft { id: [nome, tier, ench, tipo, tem qualidade] }. Receita e foco ficam por unidade: poção e
  // comida saem 5 ou 10 por craft.
  const saida = { m: {}, r: {}, u: {}, f: {}, b: {}, rb: {}, e: {} };
  for (const [id, x] of Object.entries(receitas)) {
    if (x.k !== 'equip') saida.m[id] = [x.n, x.t, x.e, x.k, x.peso, x.valor];
    const porCraft = (x.rec && x.rec.saida) || 1;
    if (x.rec && x.rec.foco) saida.f[id] = Math.round((x.rec.foco / porCraft) * 100) / 100;
    if (x.extra) saida.e[id] = [x.n, x.t, x.e, ...x.extra];
    if (x.bonus) saida.b[id.replace(/@\d$/, '')] = x.bonus;
    if (x.rest) saida.rb[id.replace(/@\d$/, '')] = x.rest;
    // [material, quantidade] ou [material, quantidade, 0] quando o material não volta no retorno (maxreturnamount 0 no dump).
    if (x.rec) saida.r[id] = x.rec.mats.map(([m, q, ret]) => { const qu = Math.round((q / porCraft) * 10000) / 10000; return ret ? [m, qu] : [m, qu, 0]; });
    if (x.up && x.up.length) saida.u[id] = x.up;
  }
  const geradoEm = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(SAIDA, `// Gerado por scripts/gerar-receitas.js em ${geradoEm}. Nao editar na mao.\nwindow.ALBION_RECEITAS = ${JSON.stringify(saida)};\n`);
  const porTipo = {};
  for (const r of Object.values(receitas)) porTipo[r.k] = (porTipo[r.k] || 0) + 1;
  console.log(`receitas.js: ${Object.keys(receitas).length} entradas, ${(fs.statSync(SAIDA).size / 1024).toFixed(0)} KB, por tipo ${JSON.stringify(porTipo)}, equipamentos sem receita: ${semReceita}`);
  const porSlot = {};
  for (const e of Object.values(saida.e)) porSlot[e[3]] = (porSlot[e[3]] || 0) + 1;
  console.log('itens só do Craft:', Object.keys(saida.e).length, JSON.stringify(porSlot));
  for (const id of ['T4_2H_TOOL_FISHINGROD', 'T4_POTION_HEAL', 'T4_MEAL_SOUP', 'T4_MOUNT_OX', 'T4_HEAD_GATHERER_FIBER@2']) console.log(id, JSON.stringify(saida.e[id]), JSON.stringify(saida.r[id]), 'foco', saida.f[id], 'bônus', saida.b[id.replace(/@\d$/, '')]);
  for (const id of ['T4_MAIN_SWORD@1', 'T4_MAIN_SWORD@3', 'T6_ARMOR_PLATE_AVALON@2']) console.log(id, 'encantar:', JSON.stringify(saida.u[id]));
  console.log('encantáveis:', Object.keys(saida.u).length, '| com foco:', Object.keys(saida.f).length, '| com cidade de bônus:', Object.keys(saida.b).length);
  const porCidade = {};
  for (const c of Object.values(saida.b)) porCidade[c] = (porCidade[c] || 0) + 1;
  console.log('bônus de craft por cidade:', JSON.stringify(porCidade), '| exemplos:', ['T4_MAIN_SWORD', 'T4_2H_HOLYSTAFF', 'T4_OFF_SHIELD', 'T4_CAPE', 'T4_BAG', 'T4_ARMOR_LEATHER_FEY', 'T4_2H_KNUCKLES_SET1'].map((x) => x + '=' + saida.b[x]).join(' '));
  for (const id of ['T4_PLANKS', 'T4_LEATHER_LEVEL1@1', 'T8_PLANKS', 'T4_MAIN_SWORD', 'T4_MAIN_SWORD@2']) console.log(id, 'valor', (saida.m[id] || [])[5], 'foco', saida.f[id]);
})().catch((e) => { console.error(e.message); process.exit(1); });
