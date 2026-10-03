// Gera receitas.js (receitas de craft e refino, recursos e artefatos) a partir do dump oficial do ao-data.
// Rodar quando o jogo ganhar itens novos:  node scripts/gerar-receitas.js
// Fonte: items.json (dump bruto, tem craftingrequirements) + formatted/items.json (nomes em PT-BR) +
// achievements.json (Quadro do Destino: níveis de maestria de craft).
const fs = require('fs');
const path = require('path');

const URL_RAW = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
const URL_FMT = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
const URL_ACH = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/achievements.json';
// Nome em PT-BR de cada nó de maestria de craft e do nó anterior a ele, como aparece no Quadro do Destino. Copiados do
// localization.json do dump (@DESTINYBOARD_TITLE_<id>): o arquivo tem 92 MB, por isso não é baixado a cada geração.
// Nó novo no jogo sem nome aqui aparece com o id.
const TITULO_NO = {
  CRAFT_ARCANESTAFFS: 'Fabricante de Cajados Arcanos',
  CRAFT_AXES: 'Fabricante de Machados de Guerra',
  CRAFT_BAG: 'Alfaiate de Bolsas',
  CRAFT_BOOKS: 'Fabricante de Tomos',
  CRAFT_BOWS: 'Fabricante de Arcos',
  CRAFT_CAPE: 'Alfaiate de Capas',
  CRAFT_CLOTH_ARMORS: 'Fabricante de Robe de Tecido',
  CRAFT_CLOTH_HEADS: 'Fabricante de Capotes de Tecido',
  CRAFT_CLOTH_SHOES: 'Fabricante de Sandálias de Tecido',
  CRAFT_CROSSBOWS: 'Fabricante de Bestas',
  CRAFT_CURSEDSTAFFS: 'Fabricante de Cajados Amaldiçoados',
  CRAFT_DAGGERS: 'Fabricante de Adagas',
  CRAFT_FIRESTAFFS: 'Fabricante Cajados de Fogo',
  CRAFT_FROSTSTAFFS: 'Fabricante de Cajados de Gelo',
  CRAFT_HAMMERS: 'Fabricante de Martelos',
  CRAFT_HOLYSTAFFS: 'Fabricante de Cajados Sagrados',
  CRAFT_KNUCKLES: 'Fabricante de Luvas de Guerra',
  CRAFT_LEATHER_ARMORS: 'Fabricante de Casacos de Couro',
  CRAFT_LEATHER_HEADS: 'Fabricante de Capuzes de Couro',
  CRAFT_LEATHER_SHOES: 'Fabricante de Sapatos de Couro',
  CRAFT_MACES: 'Fabricante de Maças',
  CRAFT_NATURESTAFFS: 'Fabricante de Cajados da Natureza',
  CRAFT_PLATE_ARMORS: 'Fabricante de Armadura de Placas',
  CRAFT_PLATE_HEADS: 'Fabricante de Elmos de Placas',
  CRAFT_PLATE_SHOES: 'Fabricante de Botas de Placas',
  CRAFT_QUARTERSTAFFS: 'Fabricante de Bordões',
  CRAFT_SHAPESHIFTER: 'Fabricante Metamorfo',
  CRAFT_SHIELDS: 'Fabricante de Escudos',
  CRAFT_SPEARS: 'Fabricante de Lanças',
  CRAFT_SWORDS: 'Fabricante de Espadas',
  CRAFT_TOOL_AXE: 'Fabricante de Machados',
  CRAFT_TOOL_FISHINGROD: 'Fabricante de Pescador',
  CRAFT_TOOL_HAMMER: 'Fabricante de Martelos de Pedra',
  CRAFT_TOOL_KNIFE: 'Fabricante de Facas de Esfolar',
  CRAFT_TOOL_PICK: 'Fabricante de Picaretas',
  CRAFT_TOOL_SICKLE: 'Fabricante de Foices',
  CRAFT_TOOL_SIEGEHAMMER: 'Fabricante de Equipamentos de Cerco',
  CRAFT_TOOL_TRACKING: 'Fabricante de Kits de Rastreamento',
  CRAFT_TORCHES: 'Fabricante de Tochas',
  CRAFT_HUNTER: 'Fabricante da Cabana do Caçador Iniciante',
  CRAFT_MAGE: 'Fabricante da Torre do Mago Iniciante',
  CRAFT_TOOL: 'Ferramenteiro Iniciante',
  CRAFT_WARRIOR: 'Fabricante da Forja do Guerreiro Iniciante',
};
const GRUPO_NO = {
  '@ACHIEVEMENT_SUBCATEGORY_CRAFT_TOOL': 'Ferramenteiro',
  '@ACHIEVEMENT_SUBCATEGORY_CRAFT_WARRIOR': 'Forja do Guerreiro',
  '@ACHIEVEMENT_SUBCATEGORY_CRAFT_HUNTER': 'Cabana do Caçador',
  '@ACHIEVEMENT_SUBCATEGORY_CRAFT_MAGE': 'Torre do Mago',
};
// Equipamento T3: o Black Market não compra (fica fora do catálogo), mas é o que se crafta do nível 0 ao 1 da maestria.
const SLOT_EQUIP = { mainhand: 'Arma', offhand: 'Off-hand', head: 'Capacete', armor: 'Armadura', shoes: 'Botas', cape: 'Capa', bag: 'Bolsa' };
const CATEGORIA_EQUIP = new Set(['weapons', 'armors', 'head', 'shoes', 'offhands', 'capes', 'bags']);
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
  const [raw, fmt, ach] = await Promise.all([baixar(URL_RAW), baixar(URL_FMT), baixar(URL_ACH)]);
  const nomes = new Map(fmt.map((f) => [f.UniqueName, f.LocalizedNames?.['PT-BR'] || f.LocalizedNames?.['EN-US'] || f.UniqueName]));
  const dump = new Map();
  for (const grupo of Object.values(raw.items)) if (Array.isArray(grupo)) for (const it of grupo) if (it && it['@uniquename']) dump.set(it['@uniquename'], it);

  // Equipamentos do catálogo da ferramenta (items.js): [id, nome, tier, ench, slot].
  const janela = {}; new Function('window', fs.readFileSync(ITEMS_JS, 'utf8'))(janela);
  const equipamentos = janela.ALBION_ITEMS;
  // Itens só do Craft (o Black Market não compra): ferramenta e equipamento de coleta, comida, poção, montaria, kit de
  // reparo, baú e equipamento T3. Saem do dump formatado (que tem os encantamentos com nome), filtrados pela categoria
  // do dump bruto.
  const noCatalogo = new Set(equipamentos.map(([id]) => id));
  const slotExtra = (it, id) => {
    const cat = it['@shopcategory'], sub = it['@shopsubcategory1'];
    if (/^T3_/.test(id) && CATEGORIA_EQUIP.has(cat)) return SLOT_EQUIP[it['@slottype']] || null;
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
  // p = progresso de craft (ver abaixo).
  const saida = { m: {}, r: {}, u: {}, f: {}, b: {}, rb: {}, e: {}, p: null };

  // Progresso de craft, do achievements.json: template CRAFT_BASE (100 níveis de maestria) e os nós que o usam.
  //   n = fama pra subir cada nível (índice 0 = do nível 0 ao 1), antes do multiplicador do nó
  //   t = { tier: nível que libera o craft daquele tier }
  //   mi = tier mínimo do item que conta fama em cada nível
  //   nos = [id, nome, grupo, multiplicador da fama exigida, padrões de item (? = 1 caractere, * = qualquer resto),
  //          [nome do nó anterior, fama que ele pede com itens T2] ou null]
  //   af = { item sem o tier: fator de fama do item de artefato } (@destinyandjournalcraftfamefactor do items.json)
  const modelo = lista(ach.achievements.template).find((t) => t['@name'] === 'CRAFT_BASE');
  if (!modelo || !/^Fame;LP;MissionTargetMinTier;MissionTargetMaxTier;MissionItemMinTier;MissionItemMaxTier;UnlockTier/.test(modelo.baselevels['@structure'])) throw new Error('achievements.json: template CRAFT_BASE mudou de formato');
  const niveis = modelo.baselevels['#text'].trim().split(/\s*\n\s*/).map((l) => l.split(';'));
  const nosFixos = new Map(lista(ach.achievements.achievement).map((x) => [x['@id'], x]));
  const liberaTier = {};
  niveis.forEach((l, i) => { if (l[6]) liberaTier[Number(l[6])] = i + 1; });
  const fatorArtefato = {};
  for (const [id, it] of dump) { const f = Number(it['@destinyandjournalcraftfamefactor']); if (f && f !== 1 && /^T\d_/.test(id)) fatorArtefato[id.replace(/^T\d_/, '')] = f; }
  saida.p = {
    n: niveis.map((l) => Number(l[0])),
    t: liberaTier,
    mi: niveis.map((l) => Number(l[4])),
    nos: lista(ach.achievements.templateachievement).filter((x) => x['@usetemplate'] === 'CRAFT_BASE').map((no) => {
      const pai = lista(no.parentachievements?.achievement).map((x) => nosFixos.get(x['@id'])).find(Boolean);
      const missao = pai?.masterylevels?.masterylevel?.missions?.mission;
      return [no['@id'], TITULO_NO[no['@id']] || no['@id'], GRUPO_NO[no['@subcategorylocatag']] || 'Outros', Number(no['@famemultiplier']) || 1, lista(no.itemlist?.itempattern).map((x) => x['@pattern']), pai ? [TITULO_NO[pai['@id']] || pai['@id'], Number(missao?.['@value']) || 0] : null];
    }),
    af: fatorArtefato,
  };
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
  const acumulado = (ate) => saida.p.n.slice(0, ate).reduce((a, x) => a + x, 0);
  console.log('progresso de craft:', saida.p.nos.length, 'nós |', saida.p.n.length, 'níveis | libera', JSON.stringify(saida.p.t), '| fama acumulada', Object.values(saida.p.t).map((nv) => `nv${nv}=${acumulado(nv)}`).join(' '), '| fatores de artefato:', Object.keys(saida.p.af).length);
  console.log('nó de exemplo:', JSON.stringify(saida.p.nos.find((x) => x[0] === 'CRAFT_TOOL_FISHINGROD')), '| T3:', ['T3_MAIN_SWORD', 'T3_ARMOR_PLATE_SET1', 'T3_BAG'].map((x) => `${x}=${JSON.stringify(saida.e[x])} ${JSON.stringify(saida.r[x])}`).join(' '));
})().catch((e) => { console.error(e.message); process.exit(1); });
