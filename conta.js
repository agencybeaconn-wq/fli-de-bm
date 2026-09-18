// Contas do Albion Flip de BM: login, cadastro, perfil (papel e bloqueio), filtros por conta,
// viagens salvas e painel do admin. Roda no navegador com a chave publishable; tudo passa por RLS.
const cfg = window.FLIPBM_CONFIG;
const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('pt-BR');
const dataTxt = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MAX_ITENS_VIAGEM = 150; // trips.itens tem CHECK de 64 KB

let sb = null;
let perfil = null;          // { id, email, papel, bloqueado }
let timerFiltros = null;
let modoLogin = 'entrar';   // 'entrar' | 'criar' | 'nova-senha'
let entrando = null;        // promise de entrar() em voo: evita rodar em dobro (TOKEN_REFRESHED + INITIAL_SESSION)

// ---- mensagens de erro do Supabase em português ----
const ERROS = [
  [/invalid login credentials/i, 'Email ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu email antes de entrar. Olhe a caixa de entrada e o spam.'],
  [/already registered|already been registered/i, 'Esse email já tem conta. Use "Entrar".'],
  [/password should be at least/i, 'A senha precisa de pelo menos 8 caracteres.'],
  [/rate limit|too many requests/i, 'Muitas tentativas. Espere um minuto e tente de novo.'],
  [/invalid email|unable to validate email/i, 'Esse email não parece válido.'],
  [/network|failed to fetch/i, 'Sem conexão com o servidor de contas. Tente de novo.'],
  [/row-level security|violates row-level/i, 'Sem permissão pra isso. Se sua conta mudou, saia e entre de novo.'],
  [/itens_?tamanho|check constraint/i, 'Cesta grande demais pra salvar. Reduza os itens da viagem.'],
];
const traduzir = (err) => (ERROS.find(([re]) => re.test(err?.message || ''))?.[1]) || `Não deu certo: ${err?.message || 'erro desconhecido'}.`;

// ---- telas ----
function setMsg(texto, erro = false) {
  const m = $('loginMsg');
  m.textContent = texto || '';
  m.classList.toggle('erro', !!erro);
  m.hidden = !texto;
}
function mostrarLogin(msg, erro = false) {
  $('app').hidden = true;
  $('telaLogin').hidden = false;
  setModo(modoLogin === 'nova-senha' ? 'nova-senha' : 'entrar');
  setMsg(msg, erro);
}
function setModo(modo) {
  modoLogin = modo;
  const criar = modo === 'criar', nova = modo === 'nova-senha';
  $('loginTituloEntrar').classList.toggle('ativa', modo === 'entrar');
  $('loginTituloCriar').classList.toggle('ativa', criar);
  $('loginAbas').hidden = nova;
  $('loginEmail').closest('.campo').hidden = nova;
  $('loginSenhaLabel').textContent = nova ? 'Nova senha' : 'Senha';
  $('loginSenha').autocomplete = nova || criar ? 'new-password' : 'current-password';
  $('loginBotao').textContent = nova ? 'Salvar nova senha' : criar ? 'Criar conta' : 'Entrar';
  $('loginEsqueci').hidden = criar || nova;
  $('loginDica').hidden = !criar;
}
function mostrarApp() {
  $('telaLogin').hidden = true;
  $('app').hidden = false;
  $('contaBox').hidden = false;
  $('contaEmail').textContent = perfil.email;
  $('abaBtnAdmin').hidden = perfil.papel !== 'admin';
  $('viagens').hidden = false;
}
// Nada do usuário anterior fica no DOM depois de sair.
function limparTelaDaConta() {
  $('contaBox').hidden = true;
  $('contaEmail').textContent = '';
  $('abaBtnAdmin').hidden = true;
  $('usuarios').innerHTML = '';
  $('usuariosQtd').textContent = '';
  $('listaViagens').innerHTML = '';
  $('viagensQtd').textContent = '';
  $('viagens').hidden = true;
  document.querySelector('.aba[data-aba="ferramenta"]')?.click();
}

// ---- sessão ----
async function carregarPerfil(user) {
  const { data, error } = await sb.from('profiles').select('id, email, papel, bloqueado').eq('id', user.id).maybeSingle();
  return { data, error };
}
async function entrar(user) {
  if (entrando) return entrando;
  entrando = (async () => {
    const { data, error } = await carregarPerfil(user);
    if (error) { // rede caiu, 5xx, limite: a sessão continua; só avisa
      mostrarLogin('Não deu pra carregar sua conta agora. Clique em Entrar de novo em instantes.', true);
      return;
    }
    if (!data) { await sb.auth.signOut({ scope: 'local' }); mostrarLogin('Sua conta existe, mas o perfil não foi encontrado. Fale com o administrador.', true); return; }
    if (data.bloqueado) { await sb.auth.signOut({ scope: 'local' }); mostrarLogin('Sua conta está bloqueada. Fale com o administrador.', true); return; }
    perfil = data;
    mostrarApp();
    sb.rpc('registrar_acesso').then(() => {});
    const { data: s } = await sb.from('user_settings').select('filtros').eq('user_id', perfil.id).maybeSingle();
    if (s?.filtros && Object.keys(s.filtros).length) window.FlipBM.aplicarFiltros(s.filtros);
    listarViagens();
    if (perfil.papel === 'admin') listarUsuarios();
  })().finally(() => { entrando = null; });
  return entrando;
}
async function sair() {
  clearTimeout(timerFiltros);
  perfil = null;
  limparTelaDaConta();
  await sb.auth.signOut({ scope: 'local' });
  mostrarLogin('Você saiu.');
}

// ---- formulário de login / cadastro / nova senha ----
function ligarFormulario() {
  $('loginTituloEntrar').addEventListener('click', () => { setModo('entrar'); setMsg(''); });
  $('loginTituloCriar').addEventListener('click', () => { setModo('criar'); setMsg(''); });
  $('loginEsqueci').addEventListener('click', async () => {
    const email = $('loginEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg('Digite seu email no campo acima e clique de novo.', true); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    setMsg(error ? traduzir(error) : 'Se esse email tiver conta, chegou um link pra redefinir a senha.', !!error);
  });
  $('formLogin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('loginEmail').value.trim();
    const senha = $('loginSenha').value;
    const botao = $('loginBotao');
    if (modoLogin !== 'nova-senha' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg('Esse email não parece válido.', true); return; }
    if (senha.length < 8) { setMsg('A senha precisa de pelo menos 8 caracteres.', true); return; }
    botao.disabled = true;
    try {
      if (modoLogin === 'criar') {
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) { setMsg(traduzir(error), true); return; }
        // Com confirmação de email ligada, identities vem vazio quando o email já existe (o Supabase não revela).
        if (data.user && data.user.identities && data.user.identities.length === 0) { setMsg('Esse email já tem conta. Use "Entrar" ou "Esqueci a senha".', true); return; }
        setModo('entrar');
        setMsg('Conta criada. Confirme pelo link que mandamos no seu email e depois entre aqui.');
      } else if (modoLogin === 'nova-senha') {
        const { error } = await sb.auth.updateUser({ password: senha });
        if (error) { setMsg(traduzir(error), true); return; }
        modoLogin = 'entrar';
        setMsg('Senha alterada. Entrando…');
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user) entrar(session.user);
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) { setMsg(traduzir(error), true); return; }
      }
    } catch (err) {
      setMsg(traduzir(err), true);
    } finally {
      botao.disabled = false;
    }
  });
  $('sair').addEventListener('click', sair);
}

// ---- filtros por conta ----
function salvarFiltros(v) {
  if (!perfil) return;
  clearTimeout(timerFiltros);
  timerFiltros = setTimeout(async () => {
    if (!perfil) return; // saiu antes do timer
    const { error } = await sb.from('user_settings').upsert({ user_id: perfil.id, filtros: v, atualizado_em: new Date().toISOString() });
    if (error) console.error('Filtros não salvos na conta:', error.message);
  }, 800);
}

// ---- viagens salvas ----
async function salvarViagem() {
  if (!perfil) return;
  const v = window.FlipBM.resumoCesta();
  if (!v || !v.itens.length) { window.FlipBM.status('Marque itens na cesta antes de salvar a viagem.', true); return; }
  if (v.itens.length > MAX_ITENS_VIAGEM) { window.FlipBM.status(`A viagem pode ter no máximo ${MAX_ITENS_VIAGEM} itens (a cesta tem ${v.itens.length}).`, true); return; }
  const { error } = await sb.from('trips').insert({ user_id: perfil.id, servidor: v.servidor, cidade: v.cidade, itens: v.itens, unidades: v.unidades, investimento: v.investimento, lucro_esperado: v.lucro });
  if (error) { window.FlipBM.status('Não deu pra salvar a viagem: ' + traduzir(error), true); return; }
  window.FlipBM.status(`Viagem salva: ${v.itens.length} itens, ${fmt.format(v.investimento)} de investimento.`);
  listarViagens();
}
async function listarViagens() {
  const { data, error, count } = await sb.from('trips').select('id, criado_em, servidor, cidade, unidades, investimento, lucro_esperado, itens', { count: 'exact' }).order('criado_em', { ascending: false }).limit(10);
  const alvo = $('listaViagens');
  if (error) { alvo.innerHTML = `<p class="vazio-mini">Não deu pra carregar: ${escapar(traduzir(error))}</p>`; return; }
  $('viagensQtd').textContent = count ? (count > data.length ? `(últimas ${data.length} de ${count})` : `(${count})`) : '';
  if (!data.length) { alvo.innerHTML = '<p class="vazio-mini">Nenhuma viagem salva ainda. Monte a cesta e clique em "Salvar viagem".</p>'; return; }
  alvo.innerHTML = data.map((t) => `<div class="viagem" data-id="${t.id}">
      <span class="quando">${dataTxt(t.criado_em)}</span>
      <span><b>${escapar(t.cidade)}</b> → BM · ${t.itens.length} itens · ${fmt.format(t.unidades)} un</span>
      <span>investe <b class="c-custo">${fmt.format(t.investimento)}</b> · lucro <b class="c-lucro">${fmt.format(t.lucro_esperado)}</b> · ROI <b class="c-roi">${t.investimento ? Math.round(t.lucro_esperado / t.investimento * 100) : 0}%</b></span>
      <span class="itens">${t.itens.slice(0, 6).map((i) => `${escapar(i.nome)} ×${i.qtd}`).join(', ')}${t.itens.length > 6 ? '…' : ''}</span>
      <button type="button" class="link apagar" data-id="${t.id}">apagar</button>
    </div>`).join('');
}
function ligarViagens() {
  $('salvarViagem').addEventListener('click', salvarViagem);
  $('listaViagens').addEventListener('click', async (ev) => {
    const b = ev.target.closest('.apagar');
    if (!b) return;
    const { error } = await sb.from('trips').delete().eq('id', b.dataset.id);
    if (error) { window.FlipBM.status('Não deu pra apagar: ' + traduzir(error), true); return; }
    listarViagens();
  });
}

// ---- admin ----
async function listarUsuarios() {
  const { data, error } = await sb.from('profiles').select('id, email, papel, bloqueado, criado_em, ultimo_acesso').order('criado_em', { ascending: false });
  const alvo = $('usuarios');
  if (error) { alvo.innerHTML = `<p class="vazio-mini">Não deu pra carregar: ${escapar(traduzir(error))}</p>`; return; }
  if (data.length <= 1 && perfil.papel === 'admin') $('usuariosQtd').textContent = 'só a sua conta apareceu: se houver outras, saia e entre de novo pra renovar o acesso de admin';
  else $('usuariosQtd').textContent = `${data.length} conta${data.length === 1 ? '' : 's'}`;
  alvo.innerHTML = `<table><thead><tr><th>Email</th><th>Papel</th><th>Criada em</th><th>Último acesso</th><th>Situação</th><th></th></tr></thead><tbody>${data.map((u) => `<tr>
      <td>${escapar(u.email)}</td>
      <td>${u.papel === 'admin' ? '<span class="est">admin</span>' : 'usuário'}</td>
      <td>${dataTxt(u.criado_em)}</td>
      <td>${u.ultimo_acesso ? dataTxt(u.ultimo_acesso) : '—'}</td>
      <td>${u.bloqueado ? '<span class="c-custo">bloqueada</span>' : '<span class="c-lucro">ativa</span>'}</td>
      <td>${u.id === perfil.id ? '' : `<button type="button" class="link bloquear" data-id="${u.id}" data-bloquear="${u.bloqueado ? '0' : '1'}">${u.bloqueado ? 'desbloquear' : 'bloquear'}</button>`}</td>
    </tr>`).join('')}</tbody></table>`;
}
function ligarAdmin() {
  $('usuarios').addEventListener('click', async (ev) => {
    const b = ev.target.closest('.bloquear');
    if (!b) return;
    const { data, error } = await sb.from('profiles').update({ bloqueado: b.dataset.bloquear === '1' }).eq('id', b.dataset.id).select('id');
    if (error) { window.FlipBM.status('Não deu pra alterar: ' + traduzir(error), true); return; }
    if (!data || !data.length) { window.FlipBM.status('Sem permissão pra alterar (acesso de admin desatualizado). Saia e entre de novo.', true); return; }
    listarUsuarios();
  });
}

// ---- boot: o supabase-js vem de CDN com versão fixa; se não carregar, a página diz em vez de ficar em branco ----
(async () => {
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm');
    sb = mod.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  } catch (err) {
    $('telaLogin').hidden = false;
    setMsg('Não deu pra carregar o serviço de contas (bloqueador ou rede). Recarregue a página.', true);
    console.error(err);
    return;
  }
  ligarFormulario();
  ligarViagens();
  ligarAdmin();
  window.Conta = { salvarFiltros };

  sb.auth.onAuthStateChange((evento, sessao) => {
    if (evento === 'PASSWORD_RECOVERY') { modoLogin = 'nova-senha'; mostrarLogin('Defina sua nova senha.'); return; }
    if (modoLogin === 'nova-senha') return; // no fluxo de nova senha, a sessão de recuperação não entra no app
    if (evento === 'TOKEN_REFRESHED' && perfil && sessao?.user) {
      // bloqueio feito pelo admin passa a valer no próximo refresh do token, não só no próximo login
      carregarPerfil(sessao.user).then(({ data }) => { if (data?.bloqueado) sair().then(() => mostrarLogin('Sua conta foi bloqueada. Fale com o administrador.', true)); });
      return;
    }
    if (sessao?.user) { if (!perfil || perfil.id !== sessao.user.id) entrar(sessao.user); }
    else if (!perfil || evento === 'SIGNED_OUT') mostrarLogin();
  });
})();
