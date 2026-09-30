// ==========================================
// ESTADO GLOBAL
// ==========================================
const estado = {
  plantel: [],
  jogo: null,
  jogadorSelecionado: null,
  cronometroInterval: null
};

let jogoTemporario = null;
let subEscolhida = { saiId: null, entraId: null };
let jogadorEmEdicaoId = null;

// ==========================================
// ORDENAÇÃO DE JOGADORES
// ==========================================
const ORDEM_POSICOES = { GR: 1, FIXO: 2, ALA: 3, PIVOT: 4, UNIVERSAL: 5 };

function ordenarJogadores(lista) {
  return lista.slice().sort((a, b) => {
    const posA = ORDEM_POSICOES[a.posicao] || 99;
    const posB = ORDEM_POSICOES[b.posicao] || 99;
    if (posA !== posB) return posA - posB;
    return a.numero - b.numero;
  });
}

// ==========================================
// CÁLCULO DE MINUTOS
// ==========================================
function calcularMinutosPorJogo(jogo, jogadorId) {
  const convocados = jogo.convocados || [];
  if (!convocados.includes(jogadorId)) return 0;

  let duracaoTotal = 0;
  if (jogo.terminado) {
    let maxMin = jogo.minuto || 0;
    (jogo.eventos || []).forEach(ev => {
      if (ev.minuto > maxMin) maxMin = ev.minuto;
    });
    duracaoTotal = maxMin + 1;
  } else {
    duracaoTotal = jogo.minuto || 0;
  }

  const subsJogador = (jogo.substituicoes || []).filter(s =>
    s.saiId === jogadorId || s.entraId === jogadorId
  );

  let entrouEm = null;
  let saiuEm = null;
  const esteveDesdeInicio = (jogo.titulares || jogo.convocados || []).includes(jogadorId);
  if (esteveDesdeInicio) entrouEm = 0;

  subsJogador
    .sort((a, b) => (a.parte - b.parte) * 1000 + a.minuto - b.minuto)
    .forEach(s => {
      const minutoEfetivo = (s.parte - 1) * (duracaoTotal / 2) + s.minuto;
      if (s.entraId === jogadorId) entrouEm = minutoEfetivo;
      else if (s.saiId === jogadorId) saiuEm = minutoEfetivo;
    });

  if (entrouEm === null) return 0;
  const fim = saiuEm !== null ? saiuEm : duracaoTotal;
  return Math.max(0, Math.round(fim - entrouEm));
}

// ==========================================
// NAVEGAÇÃO
// ==========================================
function mostrarEcra(id) {
  document.querySelectorAll('.ecra').forEach(e => e.classList.add('escondido'));
  document.getElementById(id).classList.remove('escondido');

  // Registo no histórico para o botão físico funcionar
  if (id !== 'ecra-home') {
    history.pushState({ ecra: id }, '', '');
  }

  atualizarBotaoVoltar();
}// ==========================================
// PLANTEL
// ==========================================
const listaPlantel = document.getElementById('lista-plantel');

document.getElementById('btn-add-jogador').onclick = async () => {
  const numInput = document.getElementById('input-numero');
  const nomeInput = document.getElementById('input-nome');
  const posInput = document.getElementById('input-posicao');
  const numero = parseInt(numInput.value);
  const nome = nomeInput.value.trim();
  const posicao = posInput.value;

  if (!numero || !nome) return alert('Preenche o número e o nome!');
  if (estado.plantel.some(j => j.numero === numero)) {
    return alert('Já existe um jogador com esse número!');
  }

  const jogador = { id: 'p_' + Date.now(), numero, nome, posicao };
  await dbGuardarJogador(jogador);
  estado.plantel.push(jogador);

  numInput.value = '';
  nomeInput.value = '';
  numInput.focus();
  renderizarPlantel();
};

async function removerJogador(id) {
  if (!confirm('Remover este jogador do plantel?')) return;
  await dbRemoverJogador(id);
  estado.plantel = estado.plantel.filter(j => j.id !== id);
  renderizarPlantel();
}

function renderizarPlantel() {
  listaPlantel.innerHTML = '';
  if (estado.plantel.length === 0) {
    listaPlantel.innerHTML = '<li style="justify-content:center;color:#6b7280">Sem jogadores. Adiciona!</li>';
    return;
  }
  ordenarJogadores(estado.plantel).forEach(j => {
    const li = document.createElement('li');
    li.dataset.pos = j.posicao || 'ALA';
    li.innerHTML = `
      <span class="num">${j.numero}</span>
      <span class="nome">${j.nome}</span>
      <span class="pos-tag pos-${j.posicao || 'ALA'}">${j.posicao || 'ALA'}</span>
      <button class="btn-editar-jogador btn-secundario" title="Editar"
        style="padding:8px 10px;font-size:13px">✏️</button>
      <button class="btn-remover-jogador btn-secundario" title="Remover"
        style="padding:8px 10px;font-size:13px">✕</button>
    `;
    li.querySelector('.btn-editar-jogador').onclick = (e) => {
      e.stopPropagation();
      abrirEdicaoJogador(j.id);
    };
    li.querySelector('.btn-remover-jogador').onclick = (e) => {
      e.stopPropagation();
      removerJogador(j.id);
    };
    listaPlantel.appendChild(li);
  });
}

// ==========================================
// EDIÇÃO DE JOGADOR
// ==========================================
const painelEditar = document.getElementById('painel-editar-jogador');

function abrirEdicaoJogador(jogadorId) {
  const jogador = estado.plantel.find(j => j.id === jogadorId);
  if (!jogador) return;
  jogadorEmEdicaoId = jogadorId;
  document.getElementById('edit-numero').value = jogador.numero;
  document.getElementById('edit-nome').value = jogador.nome;
  document.getElementById('edit-posicao').value = jogador.posicao || 'ALA';
  painelEditar.classList.remove('escondido');
}

document.getElementById('btn-cancelar-edit').onclick = () => {
  painelEditar.classList.add('escondido');
  jogadorEmEdicaoId = null;
};

document.getElementById('btn-guardar-edit').onclick = async () => {
  if (!jogadorEmEdicaoId) return;
  const numero = parseInt(document.getElementById('edit-numero').value);
  const nome = document.getElementById('edit-nome').value.trim();
  const posicao = document.getElementById('edit-posicao').value;

  if (!numero || !nome) return alert('Preenche o número e o nome!');
  const duplicado = estado.plantel.some(j => j.id !== jogadorEmEdicaoId && j.numero === numero);
  if (duplicado) return alert('Já existe outro jogador com esse número!');

  const jogador = estado.plantel.find(j => j.id === jogadorEmEdicaoId);
  if (!jogador) return;

  jogador.numero = numero;
  jogador.nome = nome;
  jogador.posicao = posicao;
  await dbGuardarJogador(jogador);

  painelEditar.classList.add('escondido');
  jogadorEmEdicaoId = null;
  renderizarPlantel();
};

// ==========================================
// HOME — LISTA DE JOGOS
// ==========================================
async function renderizarListaJogos() {
  const jogos = await dbCarregarJogos();
  const lista = document.getElementById('lista-jogos');
  lista.innerHTML = '';

  if (jogos.length === 0) {
    lista.innerHTML = '<li style="justify-content:center;color:#6b7280;cursor:default;box-shadow:none;background:transparent">Ainda não há jogos. Cria o primeiro!</li>';
    return;
  }

  jogos.forEach(j => {
    const li = document.createElement('li');
    const dataFmt = new Date(j.data).toLocaleDateString('pt-PT');
    const estadoTxt = j.terminado ? 'Terminado' : 'Em curso';
    li.innerHTML = `
      <button class="btn-apagar-jogo" title="Apagar jogo">🗑️</button>
      <div class="jogo-topo">
        <span>vs ${j.adversario}</span>
        <span class="jogo-res">${j.golosCasa} - ${j.golosFora}</span>
      </div>
      <div class="jogo-sub">
        ${dataFmt}${j.competicao ? ' · ' + j.competicao : ''}
        <span class="estado ${j.terminado ? 'terminado' : ''}" style="margin-left:8px">${estadoTxt}</span>
      </div>
    `;
    li.onclick = () => retomarJogo(j);
    li.querySelector('.btn-apagar-jogo').onclick = async (e) => {
      e.stopPropagation();
      const confirmar = confirm(
        `Apagar o jogo contra "${j.adversario}"?\n\n` +
        `Data: ${dataFmt}\n` +
        `Resultado: ${j.golosCasa} - ${j.golosFora}\n\n` +
        `⚠️ Esta ação não pode ser desfeita.`
      );
      if (!confirmar) return;
      await dbRemoverJogo(j.id);
      await renderizarListaJogos();
    };
    lista.appendChild(li);
  });
}

// ==========================================
// NOVO JOGO
// ==========================================
document.getElementById('btn-novo-jogo').onclick = () => {
  if (estado.plantel.length === 0) return alert('Adiciona jogadores ao plantel primeiro!');
  document.getElementById('input-data').valueAsDate = new Date();
  document.getElementById('input-adversario').value = '';
  document.getElementById('input-competicao').value = '';
  jogoTemporario = { titulares: [], banco: [] };
  renderizarConvocatoria();
  mostrarEcra('ecra-novo-jogo');
};

function renderizarConvocatoria() {
  const lista = document.getElementById('lista-convocatoria');
  lista.innerHTML = '';

  const ctEl = document.getElementById('count-titulares');
  const cbEl = document.getElementById('count-banco');
  if (ctEl) ctEl.textContent = jogoTemporario.titulares.length;
  if (cbEl) cbEl.textContent = jogoTemporario.banco.length;

  ordenarJogadores(estado.plantel).forEach(j => {
    const isTitular = jogoTemporario.titulares.includes(j.id);
    const isBanco = jogoTemporario.banco.includes(j.id);

    const li = document.createElement('li');
    li.dataset.pos = j.posicao || 'ALA';

    let estadoTxt, estadoCls;
    if (isTitular) { li.classList.add('titular'); estadoTxt = 'TITULAR'; estadoCls = 'titular'; }
    else if (isBanco) { li.classList.add('banco'); estadoTxt = 'BANCO'; estadoCls = 'banco'; }
    else { estadoTxt = 'Toca'; estadoCls = 'fora'; }

    li.innerHTML = `
      <span class="num">${j.numero}</span>
      <span class="nome">${j.nome}</span>
      <span class="pos-tag pos-${j.posicao || 'ALA'}">${j.posicao || 'ALA'}</span>
      <span class="estado-conv ${estadoCls}">${estadoTxt}</span>
    `;

    li.onclick = () => {
      if (isTitular) {
        jogoTemporario.titulares = jogoTemporario.titulares.filter(id => id !== j.id);
        jogoTemporario.banco.push(j.id);
      } else if (isBanco) {
        jogoTemporario.banco = jogoTemporario.banco.filter(id => id !== j.id);
      } else {
        jogoTemporario.titulares.push(j.id);
      }
      renderizarConvocatoria();
    };
    lista.appendChild(li);
  });
}

document.getElementById('btn-comecar-jogo').onclick = async () => {
  const data = document.getElementById('input-data').value;
  const adversario = document.getElementById('input-adversario').value.trim();
  const competicao = document.getElementById('input-competicao').value.trim();

  if (!data) return alert('Escolhe a data!');
  if (!adversario) return alert('Escreve o adversário!');
  if (jogoTemporario.titulares.length === 0) return alert('Escolhe pelo menos 1 titular!');

  const todosConvocados = [...jogoTemporario.titulares, ...jogoTemporario.banco];

  const novoJogo = {
    id: 'j_' + Date.now(),
    data, adversario, competicao,
    convocados: todosConvocados,
    titulares: jogoTemporario.titulares.slice(),
    emCampo: jogoTemporario.titulares.slice(),
    eventos: [], golosCasa: 0, golosFora: 0,
    minuto: 0, segundo: 0, parte: 1,
    terminado: false, pausado: false,
    substituicoes: [], criadoEm: Date.now()
  };

  await dbGuardarJogo(novoJogo);
  jogoTemporario = null;
  iniciarJogo(novoJogo);
  mostrarEcra('ecra-jogo');
};

// ==========================================
// JOGO
// ==========================================
function iniciarJogo(jogo) {
  estado.jogo = jogo;
  if (!estado.jogo.emCampo) estado.jogo.emCampo = jogo.convocados.slice();
  if (!estado.jogo.substituicoes) estado.jogo.substituicoes = [];
  if (estado.jogo.pausado === undefined) estado.jogo.pausado = false;

  const advEl = document.getElementById('header-adversario');
  if (advEl) advEl.textContent = jogo.adversario;

  atualizarCronometro();
  atualizarResultado();
  atualizarIndicadorParte();
  atualizarBotaoPausa();
  renderizarGridJogadores();

  if (estado.cronometroInterval) clearInterval(estado.cronometroInterval);
  if (!jogo.terminado && !jogo.pausado) arrancarCronometro();
}

function arrancarCronometro() {
  if (estado.cronometroInterval) clearInterval(estado.cronometroInterval);
  estado.cronometroInterval = setInterval(() => {
    estado.jogo.segundo++;
    if (estado.jogo.segundo >= 60) { estado.jogo.segundo = 0; estado.jogo.minuto++; }
    atualizarCronometro();
  }, 1000);
}

function retomarJogo(jogo) {
  iniciarJogo(jogo);
  mostrarEcra('ecra-jogo');
}

function atualizarCronometro() {
  const el = document.getElementById('cronometro');
  if (!el) return;
  const m = String(estado.jogo.minuto).padStart(2, '0');
  const s = String(estado.jogo.segundo).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

function atualizarResultado() {
  const el = document.getElementById('resultado');
  if (!el) return;
  el.textContent = `${estado.jogo.golosCasa} - ${estado.jogo.golosFora}`;
}

function renderizarGridJogadores() {
  const grid = document.getElementById('grid-jogadores');
  grid.innerHTML = '';
  ordenarJogadores(estado.plantel.filter(j => estado.jogo.emCampo.includes(j.id)))
    .forEach(j => {
      const btn = document.createElement('button');
      btn.dataset.pos = j.posicao || 'ALA';
      btn.innerHTML = `
        <span class="g-num">${j.numero}</span>
        <span class="g-nome">${j.nome.split(' ')[0]}</span>
      `;
      btn.dataset.jogadorId = j.id;
      btn.onclick = () => abrirPainelAcoes(j.id, btn);
      grid.appendChild(btn);
    });
}

// ==========================================
// PAINEL DE AÇÕES
// ==========================================
const painelAcoes = document.getElementById('painel-acoes');

function abrirPainelAcoes(jogadorId, botaoEl) {
  if (estado.jogo.terminado) {
    alert('Este jogo já terminou. Não é possível registar mais eventos.');
    return;
  }
  estado.jogadorSelecionado = jogadorId;
  document.querySelectorAll('.grid-jogadores button').forEach(b => b.classList.remove('selecionado'));
  botaoEl.classList.add('selecionado');
  const jogador = estado.plantel.find(j => j.id === jogadorId);
  document.getElementById('painel-jogador-nome').textContent = `#${jogador.numero} ${jogador.nome}`;
  painelAcoes.classList.remove('escondido');
}

document.getElementById('btn-fechar-acoes').onclick = () => {
  painelAcoes.classList.add('escondido');
  document.querySelectorAll('.grid-jogadores button').forEach(b => b.classList.remove('selecionado'));
  estado.jogadorSelecionado = null;
};

document.querySelectorAll('.botoes-acoes .acao').forEach(btn => {
  btn.onclick = () => {
    const tipo = btn.dataset.tipo;
    if (tipo === 'substituicao') {
      if (!estado.jogadorSelecionado) { alert('Primeiro toca no jogador que sai.'); return; }
      abrirPainelSubstituicao();
      return;
    }
    if (!estado.jogadorSelecionado) return;
    registarEvento(tipo, btn.dataset.resultado || null, estado.jogadorSelecionado);
  };
});

// ==========================================
// REGISTO DE EVENTOS
// ==========================================
async function registarEvento(tipo, resultado, jogadorId) {
  const evento = {
    id: 'e_' + Date.now() + Math.random().toString(36).slice(2, 6),
    tipo, resultado,
    jogadorId: tipo === 'golo-deles' ? null : jogadorId,
    minuto: estado.jogo.minuto,
    segundo: estado.jogo.segundo,
    parte: estado.jogo.parte,
    timestamp: Date.now()
  };
  estado.jogo.eventos.push(evento);

  if (tipo === 'golo-nosso') { estado.jogo.golosCasa++; atualizarResultado(); }
  else if (tipo === 'golo-deles') { estado.jogo.golosFora++; atualizarResultado(); }

  await dbGuardarJogo(estado.jogo);

  const nomes = {
    'golo-nosso': 'GOLO!', 'golo-deles': 'Golo sofrido',
    'assistencia': 'Assistência', 'falta-cometida': 'Falta cometida',
    'falta-sofrida': 'Falta sofrida', 'cartao-amarelo': 'Cartão amarelo',
    'cartao-vermelho': 'Cartão vermelho', 'remate': 'Remate',
    'defesa-gr': 'Defesa GR', 'substituicao': 'Substituição'
  };
  const painel = document.getElementById('painel-acoes-titulo');
  painel.textContent = `✓ ${nomes[tipo] || tipo} registado!`;
  setTimeout(() => {
    painelAcoes.classList.add('escondido');
    document.querySelectorAll('.grid-jogadores button').forEach(b => b.classList.remove('selecionado'));
    estado.jogadorSelecionado = null;
    painel.textContent = '';
  }, 400);
}

// ==========================================
// DESFAZER
// ==========================================
document.getElementById('btn-undo').onclick = async () => {
  if (estado.jogo.terminado) { alert('Jogo terminado — não é possível desfazer.'); return; }
  if (!estado.jogo || estado.jogo.eventos.length === 0) return;
  const ultimo = estado.jogo.eventos.pop();

  if (ultimo.tipo === 'golo-nosso') { estado.jogo.golosCasa--; atualizarResultado(); }
  else if (ultimo.tipo === 'golo-deles') { estado.jogo.golosFora--; atualizarResultado(); }
  else if (ultimo.tipo === 'substituicao') {
    estado.jogo.emCampo = estado.jogo.emCampo.filter(id => id !== ultimo.jogadorId);
    estado.jogo.emCampo.push(ultimo.jogadorSaiId);
    estado.jogo.substituicoes = estado.jogo.substituicoes.filter(
      s => !(s.saiId === ultimo.jogadorSaiId && s.entraId === ultimo.jogadorId && s.minuto === ultimo.minuto)
    );
    renderizarGridJogadores();
  }
  await dbGuardarJogo(estado.jogo);
};

// ==========================================
// SAIR DO JOGO
// ==========================================
document.getElementById('btn-sair-jogo').onclick = async () => {
  if (!estado.jogo) { mostrarEcra('ecra-home'); return; }
  if (estado.jogo.terminado) {
    clearInterval(estado.cronometroInterval);
    await renderizarListaJogos();
    mostrarEcra('ecra-home');
    return;
  }
  const sair = confirm(
    'Sair do jogo?\n\n' +
    'O jogo fica guardado como "Em curso" e podes voltar mais tarde.\n' +
    'O cronómetro fica pausado.'
  );
  if (!sair) return;
  clearInterval(estado.cronometroInterval);
  estado.jogo.pausado = true;
  await dbGuardarJogo(estado.jogo);
  await renderizarListaJogos();
  mostrarEcra('ecra-home');
};

// ==========================================
// GUARDAR / TERMINAR
// ==========================================
document.getElementById('btn-guardar-jogo').onclick = async () => {
  const terminar = confirm('Guardar e terminar o jogo?\n\n(Cancelar = apenas guardar e continuar)');
  await dbGuardarJogo(estado.jogo);
  if (terminar) {
    clearInterval(estado.cronometroInterval);
    estado.jogo.terminado = true;
    await dbGuardarJogo(estado.jogo);
    await renderizarListaJogos();
    mostrarEcra('ecra-home');
  }
};

// ==========================================
// CONTROLO DE TEMPO
// ==========================================
function atualizarIndicadorParte() {
  const parteEl = document.getElementById('indicador-parte');
  const cronEl = document.getElementById('cronometro');
  const btnParte = document.getElementById('btn-proxima-parte');
  const controlos = document.getElementById('controlos-tempo');
  const aviso = document.getElementById('aviso-terminado');

  if (estado.jogo.terminado) {
    if (parteEl) { parteEl.textContent = 'Fim'; parteEl.classList.remove('pausado'); parteEl.classList.add('terminado'); }
    if (cronEl) { cronEl.classList.remove('pausado'); cronEl.classList.add('terminado'); }
    if (controlos) controlos.classList.add('escondido');
    if (aviso) aviso.classList.remove('escondido');
    return;
  }

  if (controlos) controlos.classList.remove('escondido');
  if (aviso) aviso.classList.add('escondido');
  if (parteEl) parteEl.classList.remove('terminado');
  if (cronEl) cronEl.classList.remove('terminado');

  if (parteEl) {
    parteEl.textContent = estado.jogo.parte === 1 ? '1ª Parte' : '2ª Parte';
    parteEl.classList.toggle('pausado', estado.jogo.pausado);
  }
  if (cronEl) cronEl.classList.toggle('pausado', estado.jogo.pausado);
  if (btnParte) {
    btnParte.textContent = estado.jogo.parte === 1 ? '⏭️ Terminar 1ª Parte' : '🏁 Terminar Jogo';
  }
}

function atualizarBotaoPausa() {
  const btn = document.getElementById('btn-pausa');
  if (!btn) return;
  btn.textContent = estado.jogo.pausado ? '▶️ Retomar' : '⏸️ Pausa';
}

document.getElementById('btn-pausa').onclick = async () => {
  estado.jogo.pausado = !estado.jogo.pausado;
  if (estado.jogo.pausado) clearInterval(estado.cronometroInterval);
  else arrancarCronometro();
  atualizarBotaoPausa();
  atualizarIndicadorParte();
  await dbGuardarJogo(estado.jogo);
};

document.getElementById('btn-proxima-parte').onclick = async () => {
  if (estado.jogo.parte === 1) {
    if (!confirm('Terminar a 1ª parte?')) return;
    estado.jogo.parte = 2;
    estado.jogo.minuto = 0;
    estado.jogo.segundo = 0;
    estado.jogo.pausado = true;
    clearInterval(estado.cronometroInterval);
    atualizarCronometro();
    atualizarIndicadorParte();
    atualizarBotaoPausa();
    await dbGuardarJogo(estado.jogo);
    alert('Intervalo! Clica ▶️ Retomar quando começar a 2ª parte.');
  } else {
    if (!confirm('Terminar o jogo?')) return;
    clearInterval(estado.cronometroInterval);
    estado.jogo.terminado = true;
    estado.jogo.pausado = false;
    await dbGuardarJogo(estado.jogo);
    await renderizarListaJogos();
    mostrarEcra('ecra-home');
  }
};

// ==========================================
// SUBSTITUIÇÕES
// ==========================================
const painelSub = document.getElementById('painel-substituicao');

function abrirPainelSubstituicao() {
  if (!estado.jogadorSelecionado) { alert('Primeiro escolhe quem sai.'); return; }
  subEscolhida = { saiId: estado.jogadorSelecionado, entraId: null };
  const sai = estado.plantel.find(j => j.id === subEscolhida.saiId);
  document.getElementById('sub-sai-nome').textContent = `#${sai.numero} ${sai.nome.split(' ')[0]}`;
  document.getElementById('sub-entra-nome').textContent = 'Escolhe no banco';
  renderizarBanco();
  document.getElementById('btn-confirmar-sub').disabled = true;
  painelAcoes.classList.add('escondido');
  painelSub.classList.remove('escondido');
}

function renderizarBanco() {
  const lista = document.getElementById('sub-banco-lista');
  lista.innerHTML = '';
  const banco = ordenarJogadores(
    estado.plantel.filter(j => estado.jogo.convocados.includes(j.id) && !estado.jogo.emCampo.includes(j.id))
  );
  if (banco.length === 0) {
    lista.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#6b7280;padding:10px">Sem jogadores no banco</div>';
    return;
  }
  banco.forEach(j => {
    const btn = document.createElement('button');
    btn.innerHTML = `
      <span class="b-num">${j.numero}</span>
      <span class="b-nome">${j.nome.split(' ')[0]}</span>
    `;
    if (subEscolhida.entraId === j.id) btn.classList.add('selecionado');
    btn.onclick = () => {
      subEscolhida.entraId = j.id;
      const entra = estado.plantel.find(x => x.id === j.id);
      document.getElementById('sub-entra-nome').textContent = `#${entra.numero} ${entra.nome.split(' ')[0]}`;
      document.getElementById('btn-confirmar-sub').disabled = false;
      renderizarBanco();
    };
    lista.appendChild(btn);
  });
}

document.getElementById('btn-cancelar-sub').onclick = () => {
  painelSub.classList.add('escondido');
  subEscolhida = { saiId: null, entraId: null };
};

document.getElementById('btn-confirmar-sub').onclick = async () => {
  if (!subEscolhida.saiId || !subEscolhida.entraId) return;

  const evento = {
    id: 'e_' + Date.now() + Math.random().toString(36).slice(2, 6),
    tipo: 'substituicao',
    jogadorId: subEscolhida.entraId,
    jogadorSaiId: subEscolhida.saiId,
    minuto: estado.jogo.minuto,
    segundo: estado.jogo.segundo,
    parte: estado.jogo.parte,
    timestamp: Date.now()
  };
  estado.jogo.eventos.push(evento);
  estado.jogo.substituicoes.push({
    saiId: subEscolhida.saiId, entraId: subEscolhida.entraId,
    minuto: estado.jogo.minuto, segundo: estado.jogo.segundo, parte: estado.jogo.parte
  });
  estado.jogo.emCampo = estado.jogo.emCampo.filter(id => id !== subEscolhida.saiId);
  estado.jogo.emCampo.push(subEscolhida.entraId);
  await dbGuardarJogo(estado.jogo);

  painelSub.classList.add('escondido');
  subEscolhida = { saiId: null, entraId: null };
  estado.jogadorSelecionado = null;
  document.querySelectorAll('.grid-jogadores button').forEach(b => b.classList.remove('selecionado'));
  renderizarGridJogadores();
};

// ==========================================
// ESTATÍSTICAS
// ==========================================
const painelStats = document.getElementById('painel-stats');

document.getElementById('btn-abrir-stats').onclick = () => {
  renderizarEstatisticas();
  painelStats.classList.remove('escondido');
};
document.getElementById('btn-fechar-stats').onclick = () => painelStats.classList.add('escondido');

function calcularEstatisticas() {
  const eventos = estado.jogo.eventos;
  const porJogador = {};
  estado.plantel.forEach(j => {
    porJogador[j.id] = {
      jogador: j, golos: 0, assistencias: 0, remates: 0, defesas: 0,
      faltasCometidas: 0, faltasSofridas: 0,
      cartoesAmarelos: 0, cartoesVermelhos: 0, minutos: 0
    };
  });

  eventos.forEach(ev => {
    if (!ev.jogadorId) return;
    const s = porJogador[ev.jogadorId];
    if (!s) return;
    switch (ev.tipo) {
      case 'golo-nosso':       s.golos++; break;
      case 'assistencia':      s.assistencias++; break;
      case 'remate':           s.remates++; break;
      case 'defesa-gr':        s.defesas++; break;
      case 'falta-cometida':   s.faltasCometidas++; break;
      case 'falta-sofrida':    s.faltasSofridas++; break;
      case 'cartao-amarelo':   s.cartoesAmarelos++; break;
      case 'cartao-vermelho':  s.cartoesVermelhos++; break;
    }
  });

  estado.plantel.forEach(j => {
    porJogador[j.id].minutos = calcularMinutosPorJogo(estado.jogo, j.id);
  });

  const totais = {
    golos: 0, assistencias: 0, remates: 0, defesas: 0,
    faltasCometidas: 0, faltasSofridas: 0,
    cartoesAmarelos: 0, cartoesVermelhos: 0
  };
  Object.values(porJogador).forEach(s => {
    totais.golos += s.golos;
    totais.assistencias += s.assistencias;
    totais.remates += s.remates;
    totais.defesas += s.defesas;
    totais.faltasCometidas += s.faltasCometidas;
    totais.faltasSofridas += s.faltasSofridas;
    totais.cartoesAmarelos += s.cartoesAmarelos;
    totais.cartoesVermelhos += s.cartoesVermelhos;
  });
  return { porJogador, totais };
}

function renderizarEstatisticas() {
  const { porJogador, totais } = calcularEstatisticas();

  document.getElementById('resumo-equipa').innerHTML = `
    <div class="resumo-item"><div class="valor">${totais.golos}</div><div class="label">Golos</div></div>
    <div class="resumo-item"><div class="valor">${totais.assistencias}</div><div class="label">Assist.</div></div>
    <div class="resumo-item"><div class="valor">${totais.remates}</div><div class="label">Remates</div></div>
    <div class="resumo-item"><div class="valor">${totais.defesas}</div><div class="label">Defesas</div></div>
    <div class="resumo-item"><div class="valor">${totais.faltasCometidas}</div><div class="label">Faltas Com.</div></div>
    <div class="resumo-item"><div class="valor">${totais.faltasSofridas}</div><div class="label">Faltas Sof.</div></div>
    <div class="resumo-item"><div class="valor">${totais.cartoesAmarelos}</div><div class="label">🟨</div></div>
    <div class="resumo-item"><div class="valor">${totais.cartoesVermelhos}</div><div class="label">🟥</div></div>
  `;

  const lista = document.getElementById('lista-stats-jogadores');
  lista.innerHTML = '';

  const ordenados = Object.values(porJogador)
    .filter(s => estado.jogo.convocados.includes(s.jogador.id))
    .sort((a, b) => {
      if (b.golos !== a.golos) return b.golos - a.golos;
      if (b.assistencias !== a.assistencias) return b.assistencias - a.assistencias;
      return a.jogador.numero - b.jogador.numero;
    });

  ordenados.forEach(s => {
    const semAcao = s.golos === 0 && s.assistencias === 0 && s.remates === 0 &&
      s.defesas === 0 && s.faltasCometidas === 0 && s.faltasSofridas === 0 &&
      s.cartoesAmarelos === 0 && s.cartoesVermelhos === 0;

    const cartao = document.createElement('div');
    cartao.className = 'cartao-jogador' + (semAcao ? ' vazio' : '');
    cartao.innerHTML = `
      <div class="cartao-jogador-header">
        <span class="num">${s.jogador.numero}</span>
        <span>${s.jogador.nome}</span>
        <span style="margin-left:auto;color:#6b7280;font-size:13px">⏱️ ${s.minutos}'</span>
      </div>
      <div class="cartao-jogador-stats">
        <span><strong>${s.golos}</strong> golos</span>
        <span><strong>${s.assistencias}</strong> assist.</span>
        <span><strong>${s.remates}</strong> remates</span>
        ${s.defesas > 0 ? `<span><strong>${s.defesas}</strong> defesas</span>` : ''}
        <span><strong>${s.faltasCometidas}</strong> faltas com.</span>
        ${s.faltasSofridas > 0 ? `<span><strong>${s.faltasSofridas}</strong> faltas sof.</span>` : ''}
        ${s.cartoesAmarelos > 0 ? `<span>🟨 <strong>${s.cartoesAmarelos}</strong></span>` : ''}
        ${s.cartoesVermelhos > 0 ? `<span>🟥 <strong>${s.cartoesVermelhos}</strong></span>` : ''}
      </div>
    `;
    lista.appendChild(cartao);
  });

  const listaSubs = document.getElementById('lista-substituicoes');
  listaSubs.innerHTML = '';
  const subs = estado.jogo.substituicoes || [];
  if (subs.length === 0) {
    listaSubs.innerHTML = '<div style="color:#6b7280;font-size:13px;padding:6px">Sem substituições registadas.</div>';
  } else {
    subs.forEach(s => {
      const sai = estado.plantel.find(j => j.id === s.saiId);
      const entra = estado.plantel.find(j => j.id === s.entraId);
      if (!sai || !entra) return;
      const item = document.createElement('div');
      item.className = 'sub-item';
      item.innerHTML = `
        <span class="sub-minuto">${s.minuto}'</span>
        <span class="sub-sai">↓ ${sai.numero} ${sai.nome.split(' ')[0]}</span>
        <span>→</span>
        <span class="sub-entra">↑ ${entra.numero} ${entra.nome.split(' ')[0]}</span>
      `;
      listaSubs.appendChild(item);
    });
  }
}

// ==========================================
// RELATÓRIO DO JOGO
// ==========================================
const painelRelatorio = document.getElementById('painel-relatorio');

document.getElementById('btn-exportar').onclick = () => {
  if (!estado.jogo) return;
  renderizarRelatorio();
  painelRelatorio.classList.remove('escondido');
};
document.getElementById('btn-fechar-relatorio').onclick = () => painelRelatorio.classList.add('escondido');

document.getElementById('btn-guardar-imagem').onclick = async () => {
  const conteudo = document.getElementById('relatorio-conteudo');
  const btn = document.getElementById('btn-guardar-imagem');
  btn.textContent = '⏳ A gerar...';
  btn.disabled = true;
  try {
    const canvas = await html2canvas(conteudo, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const link = document.createElement('a');
    const data = estado.jogo.data || new Date().toISOString().slice(0, 10);
    const adversario = estado.jogo.adversario.replace(/\s+/g, '_');
    link.download = `relatorio_${data}_vs_${adversario}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error(err);
    alert('Erro ao gerar imagem. Vê o Console.');
  } finally {
    btn.textContent = '🖼️ Guardar imagem';
    btn.disabled = false;
  }
};
document.getElementById('btn-imprimir').onclick = () => window.print();

function renderizarRelatorio() {
  const jogo = estado.jogo;
  const { porJogador, totais } = calcularEstatisticas();
  const dataFmt = new Date(jogo.data).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const jogadoresOrd = Object.values(porJogador)
    .filter(s => jogo.convocados.includes(s.jogador.id))
    .sort((a, b) => {
      if (b.golos !== a.golos) return b.golos - a.golos;
      if (b.assistencias !== a.assistencias) return b.assistencias - a.assistencias;
      return a.jogador.numero - b.jogador.numero;
    });

  const linhasJogadores = jogadoresOrd.map(s => `
    <tr>
      <td class="num">${s.jogador.numero}</td>
      <td>
        ${s.jogador.nome}
        <span class="pos-badge pos-${s.jogador.posicao || 'ALA'}">${s.jogador.posicao || 'ALA'}</span>
      </td>
      <td style="text-align:center">${s.minutos}'</td>
      <td style="text-align:center;font-weight:bold">${s.golos}</td>
      <td style="text-align:center">${s.assistencias}</td>
      <td style="text-align:center">${s.remates}</td>
      <td style="text-align:center">${s.defesas}</td>
      <td style="text-align:center">${s.faltasCometidas}</td>
      <td style="text-align:center">${s.faltasSofridas}</td>
      <td style="text-align:center">${s.cartoesAmarelos}</td>
      <td style="text-align:center">${s.cartoesVermelhos}</td>
    </tr>
  `).join('');

  const eventosCronologia = [];
  (jogo.eventos || []).forEach(ev => {
    let descricao = null, icone = '', classeExtra = '';
    if (ev.tipo === 'golo-nosso') {
      const j = estado.plantel.find(p => p.id === ev.jogadorId);
      if (!j) return;
      icone = '⚽'; descricao = `Golo — #${j.numero} ${j.nome}`; classeExtra = 'crono-golo';
    } else if (ev.tipo === 'golo-deles') {
      icone = '🥅'; descricao = 'Golo do adversário'; classeExtra = 'crono-golo-adv';
    } else if (ev.tipo === 'assistencia') {
      const j = estado.plantel.find(p => p.id === ev.jogadorId);
      if (!j) return;
      icone = '🎯'; descricao = `Assistência — #${j.numero} ${j.nome}`; classeExtra = 'crono-assist';
    } else if (ev.tipo === 'substituicao') {
      const sai = estado.plantel.find(p => p.id === ev.jogadorSaiId);
      const entra = estado.plantel.find(p => p.id === ev.jogadorId);
      if (!sai || !entra) return;
      icone = '🔄';
      descricao = `<span class="crono-sai">↓ ${sai.numero} ${sai.nome.split(' ')[0]}</span> · <span class="crono-entra">↑ ${entra.numero} ${entra.nome.split(' ')[0]}</span>`;
      classeExtra = 'crono-sub';
    } else if (ev.tipo === 'cartao-amarelo') {
      const j = estado.plantel.find(p => p.id === ev.jogadorId);
      if (!j) return;
      icone = '🟨'; descricao = `Cartão amarelo — #${j.numero} ${j.nome}`; classeExtra = 'crono-amarelo';
    } else if (ev.tipo === 'cartao-vermelho') {
      const j = estado.plantel.find(p => p.id === ev.jogadorId);
      if (!j) return;
      icone = '🟥'; descricao = `Cartão vermelho — #${j.numero} ${j.nome}`; classeExtra = 'crono-vermelho';
    } else if (ev.tipo === 'falta-cometida') {
      const j = estado.plantel.find(p => p.id === ev.jogadorId);
      if (!j) return;
      icone = '🟡'; descricao = `Falta cometida — #${j.numero} ${j.nome}`; classeExtra = 'crono-falta';
    } else if (ev.tipo === 'falta-sofrida') {
      const j = estado.plantel.find(p => p.id === ev.jogadorId);
      if (!j) return;
      icone = '🩹'; descricao = `Falta sofrida — #${j.numero} ${j.nome}`; classeExtra = 'crono-falta-sofrida';
    }
    if (descricao) {
      eventosCronologia.push({
        minuto: ev.minuto, segundo: ev.segundo, parte: ev.parte,
        icone, descricao, classeExtra
      });
    }
  });

  eventosCronologia.sort((a, b) => {
    if (a.parte !== b.parte) return a.parte - b.parte;
    if (a.minuto !== b.minuto) return a.minuto - b.minuto;
    return a.segundo - b.segundo;
  });

  const cronologiaHtml = eventosCronologia.length === 0
    ? '<div style="color:#94a3b8;font-size:12px">Sem eventos registados.</div>'
    : eventosCronologia.map(ev => `
        <div class="crono-item ${ev.classeExtra}">
          <span class="crono-min">${ev.minuto}'</span>
          <span class="crono-icone">${ev.icone}</span>
          <span class="crono-txt">${ev.descricao}</span>
        </div>
      `).join('');

  document.getElementById('relatorio-conteudo').innerHTML = `
    <div class="rel-header">
      <h1>⚽ Relatório de Jogo</h1>
      <div class="rel-resultado">${jogo.golosCasa} - ${jogo.golosFora}</div>
      <div class="rel-sub"><strong>GRCP Casal do Rato</strong> vs <strong>${jogo.adversario}</strong></div>
      <div class="rel-sub" style="margin-top:4px">${dataFmt}${jogo.competicao ? ' · ' + jogo.competicao : ''}</div>
    </div>

    <div class="rel-seccao">
      <h2>Resumo da Equipa</h2>
      <div class="rel-resumo">
        <div class="rel-item"><div class="valor">${totais.golos}</div><div class="label">Golos</div></div>
        <div class="rel-item"><div class="valor">${totais.assistencias}</div><div class="label">Assist.</div></div>
        <div class="rel-item"><div class="valor">${totais.remates}</div><div class="label">Remates</div></div>
        <div class="rel-item"><div class="valor">${totais.defesas}</div><div class="label">Defesas</div></div>
        <div class="rel-item"><div class="valor">${totais.faltasCometidas}</div><div class="label">Faltas Com.</div></div>
        <div class="rel-item"><div class="valor">${totais.faltasSofridas}</div><div class="label">Faltas Sof.</div></div>
        <div class="rel-item"><div class="valor">${totais.cartoesAmarelos}</div><div class="label">🟨</div></div>
        <div class="rel-item"><div class="valor">${totais.cartoesVermelhos}</div><div class="label">🟥</div></div>
      </div>
    </div>

    <div class="rel-seccao">
      <h2>Cronologia do Jogo</h2>
      <div class="rel-cronologia">${cronologiaHtml}</div>
    </div>

    <div class="rel-seccao">
      <h2>Estatísticas por Jogador</h2>
      <table class="rel-tabela">
        <thead>
          <tr>
            <th>#</th><th>Jogador</th><th>Min.</th>
            <th>G</th><th>A</th><th>Rem.</th><th>Def.</th>
            <th>FC</th><th>FS</th><th>🟨</th><th>🟥</th>
          </tr>
        </thead>
        <tbody>${linhasJogadores}</tbody>
      </table>
    </div>

    <div class="rel-footer">Gerado por MatchTrack · ${new Date().toLocaleString('pt-PT')}</div>
  `;
}

// ==========================================
// HISTÓRICO POR JOGADOR
// ==========================================
const listaJogadoresHist = document.getElementById('lista-jogadores-hist');

document.getElementById('btn-ir-jogadores').onclick = async () => {
  await renderizarListaJogadores();
  mostrarEcra('ecra-jogadores');
};
document.getElementById('btn-voltar-home-3').onclick = () => mostrarEcra('ecra-home');
document.getElementById('btn-voltar-jogadores').onclick = () => mostrarEcra('ecra-jogadores');

async function renderizarListaJogadores() {
  const jogos = await dbCarregarJogos();
  listaJogadoresHist.innerHTML = '';

  if (estado.plantel.length === 0) {
    listaJogadoresHist.innerHTML = '<li style="justify-content:center;color:#6b7280">Sem jogadores no plantel.</li>';
    return;
  }

  const resumo = {};
  estado.plantel.forEach(j => { resumo[j.id] = { golos: 0, assistencias: 0, jogos: 0 }; });

  jogos.forEach(jogo => {
    const eventos = jogo.eventos || [];
    const jogs = new Set();
    eventos.forEach(ev => {
      if (!ev.jogadorId) return;
      if (!resumo[ev.jogadorId]) return;
      jogs.add(ev.jogadorId);
      if (ev.tipo === 'golo-nosso') resumo[ev.jogadorId].golos++;
      if (ev.tipo === 'assistencia') resumo[ev.jogadorId].assistencias++;
    });
    jogs.forEach(id => { if (resumo[id]) resumo[id].jogos++; });
  });

  ordenarJogadores(estado.plantel).forEach(j => {
    const r = resumo[j.id];
    const li = document.createElement('li');
    li.dataset.pos = j.posicao || 'ALA';
    li.dataset.jogId = j.id;
    li.innerHTML = `
      <span class="num">${j.numero}</span>
      <span class="nome">${j.nome}</span>
      <span class="pos-tag pos-${j.posicao || 'ALA'}">${j.posicao || 'ALA'}</span>
      <span class="jog-mini-stats">
        <strong>${r.golos}</strong>G · <strong>${r.assistencias}</strong>A · <strong>${r.jogos}</strong>J
      </span>
    `;
    li.onclick = () => abrirDetalheJogador(j.id);
    listaJogadoresHist.appendChild(li);
  });
}

async function abrirDetalheJogador(jogadorId) {
  const jogador = estado.plantel.find(j => j.id === jogadorId);
  if (!jogador) return;

  estado.jogadorAtualDetalheId = jogadorId;

  document.getElementById('jd-num').textContent = jogador.numero;
  document.getElementById('jd-nome').textContent = jogador.nome;
  document.getElementById('jd-pos').textContent = jogador.posicao || 'ALA';

  const jogos = await dbCarregarJogos();

  const totais = {
    jogos: 0, golos: 0, assistencias: 0, remates: 0, defesas: 0,
    faltasCometidas: 0, faltasSofridas: 0,
    cartoesAmarelos: 0, cartoesVermelhos: 0, minutos: 0
  };
  const jogosDoJogador = [];

  jogos.forEach(jogo => {
    const eventos = (jogo.eventos || []).filter(ev => ev.jogadorId === jogadorId);
    const foiConvocado = jogo.convocados && jogo.convocados.includes(jogadorId);
    if (eventos.length === 0 && !foiConvocado) return;

    const s = {
      golos: 0, assistencias: 0, remates: 0, defesas: 0,
      faltasCometidas: 0, faltasSofridas: 0,
      cartoesAmarelos: 0, cartoesVermelhos: 0,
      minutos: calcularMinutosPorJogo(jogo, jogadorId)
    };
    eventos.forEach(ev => {
      switch (ev.tipo) {
        case 'golo-nosso':       s.golos++; break;
        case 'assistencia':      s.assistencias++; break;
        case 'remate':           s.remates++; break;
        case 'defesa-gr':        s.defesas++; break;
        case 'falta-cometida':   s.faltasCometidas++; break;
        case 'falta-sofrida':    s.faltasSofridas++; break;
        case 'cartao-amarelo':   s.cartoesAmarelos++; break;
        case 'cartao-vermelho':  s.cartoesVermelhos++; break;
      }
    });

    totais.jogos++;
    totais.golos += s.golos;
    totais.assistencias += s.assistencias;
    totais.remates += s.remates;
    totais.defesas += s.defesas;
    totais.faltasCometidas += s.faltasCometidas;
    totais.faltasSofridas += s.faltasSofridas;
    totais.cartoesAmarelos += s.cartoesAmarelos;
    totais.cartoesVermelhos += s.cartoesVermelhos;
    totais.minutos += s.minutos;

    jogosDoJogador.push({ jogo, stats: s });
  });

  jogosDoJogador.sort((a, b) => new Date(b.jogo.data) - new Date(a.jogo.data));

  document.getElementById('jd-totais').innerHTML = `
    <div class="resumo-item"><div class="valor">${totais.jogos}</div><div class="label">Jogos</div></div>
    <div class="resumo-item"><div class="valor">${totais.minutos}'</div><div class="label">Minutos</div></div>
    <div class="resumo-item"><div class="valor">${totais.golos}</div><div class="label">Golos</div></div>
    <div class="resumo-item"><div class="valor">${totais.assistencias}</div><div class="label">Assist.</div></div>
    <div class="resumo-item"><div class="valor">${totais.remates}</div><div class="label">Remates</div></div>
    <div class="resumo-item"><div class="valor">${totais.defesas}</div><div class="label">Defesas</div></div>
    <div class="resumo-item"><div class="valor">${totais.faltasCometidas}</div><div class="label">Faltas Com.</div></div>
    <div class="resumo-item"><div class="valor">${totais.faltasSofridas}</div><div class="label">Faltas Sof.</div></div>
    <div class="resumo-item"><div class="valor">${totais.cartoesAmarelos}</div><div class="label">🟨</div></div>
    <div class="resumo-item"><div class="valor">${totais.cartoesVermelhos}</div><div class="label">🟥</div></div>
  `;

  const lista = document.getElementById('jd-lista-jogos');
  lista.innerHTML = '';
  if (jogosDoJogador.length === 0) {
    lista.innerHTML = '<div class="sem-jogos">Sem jogos registados para este jogador.</div>';
  } else {
    jogosDoJogador.forEach(({ jogo, stats }) => {
      const dataFmt = new Date(jogo.data).toLocaleDateString('pt-PT');
      const item = document.createElement('div');
      item.className = 'jogo-jogador-item';
      item.innerHTML = `
        <div class="topo">
          <div>
            <strong>vs ${jogo.adversario}</strong>
            <div>${dataFmt}${jogo.competicao ? ' · ' + jogo.competicao : ''}</div>
          </div>
          <div class="resultado-mini">${jogo.golosCasa} - ${jogo.golosFora}</div>
        </div>
        <div class="stats-linha">
          <span>⏱️ <strong>${stats.minutos}'</strong></span>
          ${stats.golos > 0 ? `<span class="badge-golo">⚽ ${stats.golos} golo${stats.golos > 1 ? 's' : ''}</span>` : ''}
          ${stats.assistencias > 0 ? `<span><strong>${stats.assistencias}</strong> assist.</span>` : ''}
          ${stats.remates > 0 ? `<span><strong>${stats.remates}</strong> remates</span>` : ''}
          ${stats.defesas > 0 ? `<span><strong>${stats.defesas}</strong> defesas</span>` : ''}
          ${stats.faltasCometidas > 0 ? `<span><strong>${stats.faltasCometidas}</strong> faltas com.</span>` : ''}
          ${stats.cartoesAmarelos > 0 ? `<span>🟨 <strong>${stats.cartoesAmarelos}</strong></span>` : ''}
          ${stats.cartoesVermelhos > 0 ? `<span>🟥 <strong>${stats.cartoesVermelhos}</strong></span>` : ''}
        </div>
      `;
      lista.appendChild(item);
    });
  }

  mostrarEcra('ecra-jogador-detalhe');
  setTimeout(() => renderizarGrafico(jogadorId), 60);
}

// ==========================================
// GRÁFICO DE EVOLUÇÃO
// ==========================================
let graficoJogador = null;

document.getElementById('grafico-metrica').onchange = () => {
  if (estado.jogadorAtualDetalheId) renderizarGrafico(estado.jogadorAtualDetalheId);
};

async function renderizarGrafico(jogadorId) {
  const metrica = document.getElementById('grafico-metrica').value;
  const jogos = await dbCarregarJogos();

  const jogosDoJogador = [];
  jogos.forEach(jogo => {
    const eventos = (jogo.eventos || []).filter(ev => ev.jogadorId === jogadorId);
    const foiConvocado = jogo.convocados && jogo.convocados.includes(jogadorId);
    if (eventos.length === 0 && !foiConvocado) return;

    const s = { golos: 0, assistencias: 0, remates: 0, defesas: 0, minutos: 0 };
    eventos.forEach(ev => {
      switch (ev.tipo) {
        case 'golo-nosso':    s.golos++; break;
        case 'assistencia':   s.assistencias++; break;
        case 'remate':        s.remates++; break;
        case 'defesa-gr':     s.defesas++; break;
      }
    });
    s.minutos = calcularMinutosPorJogo(jogo, jogadorId);
    jogosDoJogador.push({ jogo, stats: s });
  });

  jogosDoJogador.sort((a, b) => new Date(a.jogo.data) - new Date(b.jogo.data));

  const labels = jogosDoJogador.map(({ jogo }) => {
    const d = new Date(jogo.data);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const valores = jogosDoJogador.map(({ stats }) => {
    switch (metrica) {
      case 'golos':        return stats.golos;
      case 'assistencias': return stats.assistencias;
      case 'minutos':      return stats.minutos;
      case 'remates':      return stats.remates;
      case 'defesas':      return stats.defesas;
      case 'golosAssist':  return stats.golos + stats.assistencias;
      default:             return 0;
    }
  });

  const nomesMetrica = {
    golos: 'Golos', assistencias: 'Assistências', minutos: 'Minutos',
    remates: 'Remates', defesas: 'Defesas GR', golosAssist: 'Golos + Assist.'
  };
  const coresMetrica = {
    golos: '#16a34a', assistencias: '#0284c7', minutos: '#7c3aed',
    remates: '#ea580c', defesas: '#7c3aed', golosAssist: '#dc2626'
  };

  if (graficoJogador) { graficoJogador.destroy(); graficoJogador = null; }

  const canvas = document.getElementById('grafico-jogador');
  const ctx = canvas.getContext('2d');

  graficoJogador = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: nomesMetrica[metrica],
        data: valores,
        borderColor: coresMetrica[metrica],
        backgroundColor: coresMetrica[metrica] + '20',
        borderWidth: 3,
        tension: 0.3,
        pointBackgroundColor: coresMetrica[metrica],
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#1f2937', font: { size: 13, weight: 'bold' } } },
        tooltip: {
          backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#fff',
          padding: 10, cornerRadius: 8, displayColors: false,
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              const { jogo } = jogosDoJogador[idx];
              const d = new Date(jogo.data).toLocaleDateString('pt-PT');
              return `${d} · vs ${jogo.adversario}`;
            },
            label: (item) => `${nomesMetrica[metrica]}: ${item.parsed.y}`
          }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#6b7280', font: { size: 12 }, precision: 0 }, grid: { color: '#f3f4f6' } },
        x: { ticks: { color: '#6b7280', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

// ==========================================
// RANKING
// ==========================================
document.getElementById('btn-ir-ranking').onclick = async () => {
  await popularFiltroCompeticoes();
  await renderizarRanking();
  mostrarEcra('ecra-ranking');
};
document.getElementById('btn-voltar-home-4').onclick = () => mostrarEcra('ecra-home');
document.getElementById('ranking-metrica').onchange = () => renderizarRanking();
document.getElementById('ranking-competicao').onchange = () => renderizarRanking();

async function popularFiltroCompeticoes() {
  const jogos = await dbCarregarJogos();
  const comps = [...new Set(jogos.map(j => j.competicao).filter(c => c))].sort();
  const sel = document.getElementById('ranking-competicao');
  const valorAtual = sel.value;
  sel.innerHTML = '<option value="">Todas as competições</option>' +
    comps.map(c => `<option value="${c}">${c}</option>`).join('');
  sel.value = valorAtual;
}

async function renderizarRanking() {
  const metrica = document.getElementById('ranking-metrica').value;
  const filtroComp = document.getElementById('ranking-competicao').value;
  const jogos = await dbCarregarJogos();

  const stats = {};
  estado.plantel.forEach(j => {
    stats[j.id] = {
      jogador: j, golos: 0, assistencias: 0, remates: 0, defesas: 0,
      faltasCometidas: 0, faltasSofridas: 0,
      cartoesAmarelos: 0, cartoesVermelhos: 0,
      minutos: 0, jogos: 0
    };
  });

  jogos.forEach(jogo => {
    if (filtroComp && jogo.competicao !== filtroComp) return;
    const convocados = jogo.convocados || [];
    convocados.forEach(id => { if (stats[id]) stats[id].jogos++; });
    (jogo.eventos || []).forEach(ev => {
      if (!ev.jogadorId) return;
      const s = stats[ev.jogadorId];
      if (!s) return;
      switch (ev.tipo) {
        case 'golo-nosso':       s.golos++; break;
        case 'assistencia':      s.assistencias++; break;
        case 'remate':           s.remates++; break;
        case 'defesa-gr':        s.defesas++; break;
        case 'falta-cometida':   s.faltasCometidas++; break;
        case 'falta-sofrida':    s.faltasSofridas++; break;
        case 'cartao-amarelo':   s.cartoesAmarelos++; break;
        case 'cartao-vermelho':  s.cartoesVermelhos++; break;
      }
    });
    convocados.forEach(id => {
      if (!stats[id]) return;
      stats[id].minutos += calcularMinutosPorJogo(jogo, id);
    });
  });

  let arrayStats = Object.values(stats);
  arrayStats.forEach(s => {
    switch (metrica) {
      case 'golos':        s._valor = s.golos; break;
      case 'assistencias': s._valor = s.assistencias; break;
      case 'golosAssist':  s._valor = s.golos + s.assistencias; break;
      case 'remates':      s._valor = s.remates; break;
      case 'defesas':      s._valor = s.defesas; break;
      case 'minutos':      s._valor = s.minutos; break;
      case 'jogos':        s._valor = s.jogos; break;
      case 'cartoes':      s._valor = s.cartoesAmarelos + s.cartoesVermelhos * 3; break;
    }
  });

  arrayStats = arrayStats.filter(s => s._valor > 0).sort((a, b) => {
    if (b._valor !== a._valor) return b._valor - a._valor;
    return a.jogador.numero - b.jogador.numero;
  });

  const container = document.getElementById('ranking-lista');
  container.innerHTML = '';

  if (arrayStats.length === 0) {
    container.innerHTML = '<div style="color:#6b7280;text-align:center;padding:20px">Sem dados para esta métrica ainda.</div>';
    return;
  }

  arrayStats.forEach((s, idx) => {
    const pos = idx + 1;
    const item = document.createElement('div');
    item.className = 'rank-item pos-' + (pos <= 3 ? pos : '');
    item.dataset.pos = s.jogador.posicao || 'ALA';

    let subInfo = '';
    if (metrica === 'minutos') subInfo = `${s.jogos} jogos`;
    else if (metrica === 'jogos') subInfo = `${s.minutos}'`;
    else if (metrica === 'golos') subInfo = `${s.assistencias} assist.`;
    else if (metrica === 'assistencias') subInfo = `${s.golos} golos`;
    else if (metrica === 'golosAssist') subInfo = `${s.golos}G · ${s.assistencias}A`;
    else if (metrica === 'cartoes') subInfo = `${s.cartoesAmarelos}🟨 · ${s.cartoesVermelhos}🟥`;

    item.innerHTML = `
      <span class="rank-pos">${pos}</span>
      <span class="num">${s.jogador.numero}</span>
      <span class="nome">${s.jogador.nome}</span>
      <span class="pos-tag pos-${s.jogador.posicao || 'ALA'}">${s.jogador.posicao || 'ALA'}</span>
      <div style="text-align:right">
        <div class="valor">${metrica === 'minutos' ? s._valor + "'" : s._valor}</div>
        <div class="rank-sub">${subInfo}</div>
      </div>
    `;

    const corPos = {
      GR: '#eab308', FIXO: '#3b82f6', ALA: '#22c55e',
      PIVOT: '#ef4444', UNIVERSAL: '#a855f7'
    };
    if (pos > 3) {
      item.style.borderLeftColor = corPos[s.jogador.posicao] || '#e5e7eb';
    }
    container.appendChild(item);
  });
}

// ==========================================
// DADOS / BACKUP
// ==========================================
document.getElementById('btn-ir-dados').onclick = async () => {
  await renderizarDadosInfo();
  mostrarEcra('ecra-dados');
};
document.getElementById('btn-voltar-home-5').onclick = () => mostrarEcra('ecra-home');

async function renderizarDadosInfo() {
  const jogos = await dbCarregarJogos();
  const plantel = await dbCarregarPlantel();
  const info = document.getElementById('dados-info');
  info.innerHTML = `
    <div class="linha"><span>Jogadores no plantel</span><strong>${plantel.length}</strong></div>
    <div class="linha"><span>Jogos registados</span><strong>${jogos.length}</strong></div>
    <div class="linha"><span>Total de eventos</span><strong>${jogos.reduce((acc, j) => acc + (j.eventos?.length || 0), 0)}</strong></div>
    <div class="linha"><span>Origem atual</span><strong style="font-size:12px">${window.location.origin}</strong></div>
  `;
}

// --------- EXPORTAR ---------
document.getElementById('btn-exportar-dados').onclick = async () => {
  const plantel = await dbCarregarPlantel();
  const jogos = await dbCarregarJogos();

  const backup = {
    versao: 1,
    app: 'MatchTrack',
    clube: 'GRCP Casal do Rato',
    dataExportacao: new Date().toISOString(),
    origem: window.location.origin,
    plantel,
    jogos
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const data = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `matchtrack_backup_${data}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// --------- IMPORTAR ---------
const inputImportar = document.getElementById('input-importar');

document.getElementById('btn-importar-dados').onclick = () => {
  inputImportar.click();
};

inputImportar.onchange = async (e) => {
  const ficheiro = e.target.files[0];
  if (!ficheiro) return;

  try {
    const texto = await ficheiro.text();
    const dados = JSON.parse(texto);

    if (!dados.plantel && !dados.jogos) {
      alert('Ficheiro inválido. Deve ser um backup exportado pelo MatchTrack.');
      return;
    }

    const confirmar = confirm(
      `Importar dados deste ficheiro?\n\n` +
      `Origem: ${dados.origem || 'desconhecida'}\n` +
      `Data do backup: ${dados.dataExportacao ? new Date(dados.dataExportacao).toLocaleString('pt-PT') : '—'}\n\n` +
      `📊 Plantel: ${(dados.plantel || []).length} jogadores\n` +
      `🏟️ Jogos: ${(dados.jogos || []).length} jogos\n\n` +
      `⚠️ Isto vai SUBSTITUIR todos os dados atuais.\n` +
      `Deseja continuar?`
    );
    if (!confirmar) return;

    await dbImportarTudo(dados.plantel || [], dados.jogos || []);
    estado.plantel = await dbCarregarPlantel();

    alert('✅ Dados importados com sucesso!');
    await renderizarDadosInfo();
    await renderizarListaJogos();
  } catch (err) {
    console.error(err);
    alert('Erro ao ler o ficheiro. Confirma que é um backup válido.');
  } finally {
    inputImportar.value = '';
  }
};

// --------- APAGAR TUDO ---------
document.getElementById('btn-apagar-tudo').onclick = async () => {
  const j1 = confirm('⚠️ Apagar TODOS os dados?\n\nIsto remove o plantel inteiro e todos os jogos.\n\nDeseja continuar?');
  if (!j1) return;
  const j2 = confirm('⚠️⚠️ CONFIRMAÇÃO FINAL\n\nEsta ação não pode ser desfeita.\n\nTens a certeza?');
  if (!j2) return;

  await dbApagarTudo();
  estado.plantel = [];
  alert('🗑️ Todos os dados foram apagados.');
  await renderizarDadosInfo();
  await renderizarListaJogos();
};

// ==========================================
// HANDLERS DE NAVEGAÇÃO
// ==========================================
document.getElementById('btn-ir-plantel').onclick = () => {
  renderizarPlantel();
  mostrarEcra('ecra-plantel');
};
document.getElementById('btn-voltar-home-1').onclick = () => mostrarEcra('ecra-home');
document.getElementById('btn-voltar-home-2').onclick = () => mostrarEcra('ecra-home');

// ==========================================
// ARRANQUE
// ==========================================
async function iniciar() {
  try {
    console.log('🔄 A ligar ao Supabase...');
    estado.plantel = await dbCarregarPlantel();
    await renderizarListaJogos();
    console.log('✅ Ligação OK · plantel:', estado.plantel.length, 'jogadores');
  } catch (err) {
    console.error('❌ Erro ao ligar:', err);
    alert('Erro a ligar à base de dados. Verifica a tua internet.');
  }
}
// ==========================================
// RELATÓRIO DO JOGADOR / EXPORTAÇÃO
// ==========================================
const painelRelatorioJogador = document.getElementById('painel-relatorio-jogador');

document.getElementById('btn-exportar-jogador').onclick = () => {
  const id = estado.jogadorAtualDetalheId;
  if (!id) return;
  renderizarRelatorioJogador(id);
  painelRelatorioJogador.classList.remove('escondido');
};
document.getElementById('btn-fechar-relatorio-jogador').onclick = () => {
  painelRelatorioJogador.classList.add('escondido');
};

document.getElementById('btn-guardar-imagem-jogador').onclick = async () => {
  const conteudo = document.getElementById('relatorio-jogador-conteudo');
  const btn = document.getElementById('btn-guardar-imagem-jogador');
  btn.textContent = '⏳ A gerar...';
  btn.disabled = true;
  try {
    const canvas = await html2canvas(conteudo, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const jogador = estado.plantel.find(j => j.id === estado.jogadorAtualDetalheId);
    const nome = jogador.nome.replace(/\s+/g, '_');
    const link = document.createElement('a');
    link.download = `jogador_${jogador.numero}_${nome}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error(err);
    alert('Erro ao gerar imagem. Vê o Console.');
  } finally {
    btn.textContent = '🖼️ Guardar imagem';
    btn.disabled = false;
  }
};
document.getElementById('btn-imprimir-jogador').onclick = () => window.print();

async function renderizarRelatorioJogador(jogadorId) {
  const jogador = estado.plantel.find(j => j.id === jogadorId);
  if (!jogador) return;

  const jogos = await dbCarregarJogos();

  const totais = {
    jogos: 0, golos: 0, assistencias: 0, remates: 0, defesas: 0,
    faltasCometidas: 0, faltasSofridas: 0,
    cartoesAmarelos: 0, cartoesVermelhos: 0, minutos: 0
  };
  const jogosDoJogador = [];

  jogos.forEach(jogo => {
    const eventos = (jogo.eventos || []).filter(ev => ev.jogadorId === jogadorId);
    const foiConvocado = jogo.convocados && jogo.convocados.includes(jogadorId);
    if (eventos.length === 0 && !foiConvocado) return;

    const s = {
      golos: 0, assistencias: 0, remates: 0, defesas: 0,
      faltasCometidas: 0, faltasSofridas: 0,
      cartoesAmarelos: 0, cartoesVermelhos: 0,
      minutos: calcularMinutosPorJogo(jogo, jogadorId)
    };
    eventos.forEach(ev => {
      switch (ev.tipo) {
        case 'golo-nosso':       s.golos++; break;
        case 'assistencia':      s.assistencias++; break;
        case 'remate':           s.remates++; break;
        case 'defesa-gr':        s.defesas++; break;
        case 'falta-cometida':   s.faltasCometidas++; break;
        case 'falta-sofrida':    s.faltasSofridas++; break;
        case 'cartao-amarelo':   s.cartoesAmarelos++; break;
        case 'cartao-vermelho':  s.cartoesVermelhos++; break;
      }
    });
    totais.jogos++;
    totais.golos += s.golos;
    totais.assistencias += s.assistencias;
    totais.remates += s.remates;
    totais.defesas += s.defesas;
    totais.faltasCometidas += s.faltasCometidas;
    totais.faltasSofridas += s.faltasSofridas;
    totais.cartoesAmarelos += s.cartoesAmarelos;
    totais.cartoesVermelhos += s.cartoesVermelhos;
    totais.minutos += s.minutos;
    jogosDoJogador.push({ jogo, stats: s });
  });

  jogosDoJogador.sort((a, b) => new Date(b.jogo.data) - new Date(a.jogo.data));

  const jogosHtml = jogosDoJogador.length === 0
    ? '<div style="color:#94a3b8;font-size:12px">Sem jogos registados.</div>'
    : jogosDoJogador.map(({ jogo, stats }) => {
        const dataFmt = new Date(jogo.data).toLocaleDateString('pt-PT');
        return `
          <div class="rel-jogo-item">
            <div class="data">${dataFmt}</div>
            <div>
              <div class="adv">vs ${jogo.adversario}</div>
              <div class="adv-sub">${jogo.competicao || ''}</div>
            </div>
            <div class="res">${jogo.golosCasa} - ${jogo.golosFora}</div>
            <div class="stats-mini">
              <span>⏱️ <strong>${stats.minutos}'</strong></span>
              ${stats.golos > 0 ? `<span class="badge-golo-rel">⚽ ${stats.golos} golo${stats.golos > 1 ? 's' : ''}</span>` : ''}
              ${stats.assistencias > 0 ? `<span><strong>${stats.assistencias}</strong> assist.</span>` : ''}
              ${stats.remates > 0 ? `<span><strong>${stats.remates}</strong> remates</span>` : ''}
              ${stats.defesas > 0 ? `<span><strong>${stats.defesas}</strong> defesas</span>` : ''}
              ${stats.faltasCometidas > 0 ? `<span><strong>${stats.faltasCometidas}</strong> faltas com.</span>` : ''}
              ${stats.faltasSofridas > 0 ? `<span><strong>${stats.faltasSofridas}</strong> faltas sof.</span>` : ''}
              ${stats.cartoesAmarelos > 0 ? `<span>🟨 <strong>${stats.cartoesAmarelos}</strong></span>` : ''}
              ${stats.cartoesVermelhos > 0 ? `<span>🟥 <strong>${stats.cartoesVermelhos}</strong></span>` : ''}
            </div>
          </div>
        `;
      }).join('');

  document.getElementById('relatorio-jogador-conteudo').innerHTML = `
    <div class="rel-jog-header">
      <div class="num-grande">${jogador.numero}</div>
      <h1>${jogador.nome}</h1>
      <div><span class="pos pos-${jogador.posicao || 'ALA'}">${jogador.posicao || 'ALA'}</span></div>
      <div class="info-extra">GRCP Casal do Rato · Relatório Individual</div>
      <div class="info-extra">Gerado em ${new Date().toLocaleString('pt-PT')}</div>
    </div>

    <div class="rel-seccao">
      <h2>Totais da Época</h2>
      <div class="rel-resumo">
        <div class="rel-item"><div class="valor">${totais.jogos}</div><div class="label">Jogos</div></div>
        <div class="rel-item"><div class="valor">${totais.minutos}'</div><div class="label">Minutos</div></div>
        <div class="rel-item"><div class="valor">${totais.golos}</div><div class="label">Golos</div></div>
        <div class="rel-item"><div class="valor">${totais.assistencias}</div><div class="label">Assist.</div></div>
        <div class="rel-item"><div class="valor">${totais.remates}</div><div class="label">Remates</div></div>
        <div class="rel-item"><div class="valor">${totais.defesas}</div><div class="label">Defesas</div></div>
        <div class="rel-item"><div class="valor">${totais.faltasCometidas}</div><div class="label">Faltas Com.</div></div>
        <div class="rel-item"><div class="valor">${totais.faltasSofridas}</div><div class="label">Faltas Sof.</div></div>
        <div class="rel-item"><div class="valor">${totais.cartoesAmarelos}</div><div class="label">🟨</div></div>
        <div class="rel-item"><div class="valor">${totais.cartoesVermelhos}</div><div class="label">🟥</div></div>
      </div>
    </div>

    <div class="rel-seccao">
      <h2>Jogo a Jogo (${jogosDoJogador.length})</h2>
      <div class="rel-jogos-lista">${jogosHtml}</div>
    </div>

    <div class="rel-footer">Gerado por MatchTrack · GRCP Casal do Rato</div>
  `;
}
// ==========================================
// Suporte ao botão físico de voltar (Android/PWA)
// ==========================================
window.addEventListener('popstate', (e) => {
  const visivel = document.querySelector('.ecra:not(.escondido)');
  if (!visivel) return;
  const destino = VOLTAR_PARA[visivel.id];
  if (destino) {
    mostrarEcra(destino);
    // Mantém o estado para permitir voltar outra vez
    history.pushState({ ecra: destino }, '', '');
  }
});
iniciar();