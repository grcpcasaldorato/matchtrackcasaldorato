// ==========================================
// BASE DE DADOS — SUPABASE
// ==========================================

// ==========================================
// ⚠️ CONFIGURAÇÃO
// ==========================================
const SUPABASE_URL = 'https://vdnajlavovaiaxwdfmea.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_h88nUHcYGZxqhO8PpDhGQQ_Z8YhtlYv'; // ← cola aqui a tua chave COMPLETA

// Cria o cliente — usamos "sb" para não colidir com a variável global "supabase"
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// PLANTEL
// ==========================================
async function dbCarregarPlantel() {
  const { data, error } = await sb
    .from('plantel')
    .select('*')
    .order('numero', { ascending: true });

  if (error) {
    console.error('Erro a carregar plantel:', error);
    return [];
  }
  return data || [];
}

async function dbGuardarJogador(jogador) {
  const { data, error } = await sb
    .from('plantel')
    .upsert({
      id: jogador.id,
      numero: jogador.numero,
      nome: jogador.nome,
      posicao: jogador.posicao
    })
    .select()
    .single();

  if (error) {
    console.error('Erro a guardar jogador:', error);
    throw error;
  }
  return data;
}

async function dbRemoverJogador(id) {
  const { error } = await sb
    .from('plantel')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro a remover jogador:', error);
    throw error;
  }
}

// ==========================================
// JOGOS
// ==========================================
async function dbCarregarJogos() {
  const { data, error } = await sb
    .from('jogos')
    .select('*')
    .order('data', { ascending: false });

  if (error) {
    console.error('Erro a carregar jogos:', error);
    return [];
  }

  return (data || []).map(jogo => ({
    id: jogo.id,
    data: jogo.data,
    adversario: jogo.adversario,
    competicao: jogo.competicao,
    convocados: jogo.convocados || [],
    titulares: jogo.titulares || [],
    emCampo: jogo.emCampo || [],
    eventos: jogo.eventos || [],
    substituicoes: jogo.substituicoes || [],
    golosCasa: jogo.golosCasa || 0,
    golosFora: jogo.golosFora || 0,
    minuto: jogo.minuto || 0,
    segundo: jogo.segundo || 0,
    parte: jogo.parte || 1,
    terminado: jogo.terminado || false,
    pausado: jogo.pausado || false,
    criadoEm: jogo.criado_em ? new Date(jogo.criado_em).getTime() : Date.now()
  }));
}

async function dbGuardarJogo(jogo) {
  const { data, error } = await sb
    .from('jogos')
    .upsert({
      id: jogo.id,
      data: jogo.data,
      adversario: jogo.adversario,
      competicao: jogo.competicao || null,
      convocados: jogo.convocados || [],
      titulares: jogo.titulares || [],
      emCampo: jogo.emCampo || [],
      eventos: jogo.eventos || [],
      substituicoes: jogo.substituicoes || [],
      golosCasa: jogo.golosCasa || 0,
      golosFora: jogo.golosFora || 0,
      minuto: jogo.minuto || 0,
      segundo: jogo.segundo || 0,
      parte: jogo.parte || 1,
      terminado: jogo.terminado || false,
      pausado: jogo.pausado || false,
      atualizado_em: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Erro a guardar jogo:', error);
    throw error;
  }
  return data;
}

async function dbRemoverJogo(id) {
  const { error } = await sb
    .from('jogos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro a remover jogo:', error);
    throw error;
  }
}

// ==========================================
// BULK — import/export
// ==========================================
async function dbApagarTudo() {
  const { error: errJogos } = await sb
    .from('jogos')
    .delete()
    .neq('id', '');

  if (errJogos) {
    console.error('Erro a apagar jogos:', errJogos);
    throw errJogos;
  }

  const { error: errPlantel } = await sb
    .from('plantel')
    .delete()
    .neq('id', '');

  if (errPlantel) {
    console.error('Erro a apagar plantel:', errPlantel);
    throw errPlantel;
  }
}

async function dbImportarTudo(plantel, jogos) {
  await dbApagarTudo();

  if (plantel && plantel.length > 0) {
    const plantelLimpo = plantel.map(j => ({
      id: j.id,
      numero: j.numero,
      nome: j.nome,
      posicao: j.posicao || 'ALA'
    }));

    const { error } = await sb.from('plantel').insert(plantelLimpo);
    if (error) {
      console.error('Erro a importar plantel:', error);
      throw error;
    }
  }

  if (jogos && jogos.length > 0) {
    const jogosLimpos = jogos.map(j => ({
      id: j.id,
      data: j.data,
      adversario: j.adversario,
      competicao: j.competicao || null,
      convocados: j.convocados || [],
      titulares: j.titulares || [],
      emCampo: j.emCampo || [],
      eventos: j.eventos || [],
      substituicoes: j.substituicoes || [],
      golosCasa: j.golosCasa || 0,
      golosFora: j.golosFora || 0,
      minuto: j.minuto || 0,
      segundo: j.segundo || 0,
      parte: j.parte || 1,
      terminado: j.terminado || false,
      pausado: j.pausado || false
    }));

    const { error } = await sb.from('jogos').insert(jogosLimpos);
    if (error) {
      console.error('Erro a importar jogos:', error);
      throw error;
    }
  }
}