// ==========================================
// BASE DE DADOS (IndexedDB via Dexie)
// ==========================================
const db = new Dexie('MatchTrackDB');

db.version(1).stores({
  plantel: 'id, numero, nome',
  jogos: 'id, data, adversario'
});

// PLANTEL
async function dbCarregarPlantel() {
  return await db.plantel.toArray();
}
async function dbGuardarJogador(jogador) {
  return await db.plantel.put(jogador);
}
async function dbRemoverJogador(id) {
  return await db.plantel.delete(id);
}

// JOGOS
async function dbCarregarJogos() {
  return await db.jogos.orderBy('data').reverse().toArray();
}
async function dbGuardarJogo(jogo) {
  return await db.jogos.put(jogo);
}
async function dbRemoverJogo(id) {
  return await db.jogos.delete(id);
}

// BULK (usado no import)
async function dbApagarTudo() {
  await db.plantel.clear();
  await db.jogos.clear();
}
async function dbImportarTudo(plantel, jogos) {
  await db.transaction('rw', db.plantel, db.jogos, async () => {
    await db.plantel.clear();
    await db.jogos.clear();
    await db.plantel.bulkPut(plantel);
    await db.jogos.bulkPut(jogos);
  });
}