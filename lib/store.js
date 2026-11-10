// Armazenamento: Redis REST (Upstash, na Vercel) ou memória + arquivo (local).
const fs = require('fs');
const path = require('path');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(URL_ && TOKEN);
const FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'state.json');
const P = 'debate:'; // prefixo das chaves

const parse = (v) => { try { return JSON.parse(v); } catch (_) { return v; } };
const pairs = (arr) => {
  const o = {};
  for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
};

async function redis(cmds) {
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('Redis: ' + JSON.stringify(j));
  return j.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}

// ---- memória local ----
let mem = { meta: {}, players: {}, votes: {} };
if (!USE_REDIS) { try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) {} }
const persist = () => { if (!USE_REDIS) { try { fs.writeFileSync(FILE, JSON.stringify(mem)); } catch (_) {} } };

// ---- cache curto do snapshot (poupa comandos do Redis) ----
let cache = { t: 0, data: null };
const TTL = 2000; // 2 segundos de cache por instância lambda
const invalidate = () => { cache = { t: 0, data: null }; };

async function load(fresh) {
  if (!fresh && cache.data && Date.now() - cache.t < TTL) return cache.data;
  let data;
  if (USE_REDIS) {
    const [meta, players, votes] = await redis([['HGETALL', P + 'meta'], ['HGETALL', P + 'players'], ['HGETALL', P + 'votes']]);
    const m = pairs(meta), pl = pairs(players), v = pairs(votes);
    for (const k in pl) pl[k] = parse(pl[k]);
    for (const k in v) v[k] = parse(v[k]);
    data = { meta: m, players: pl, votes: v };
  } else {
    data = JSON.parse(JSON.stringify(mem));
  }
  cache = { t: Date.now(), data };
  return data;
}

async function setMeta(field, value) {
  if (USE_REDIS) await redis([value === null ? ['HDEL', P + 'meta', field] : ['HSET', P + 'meta', field, String(value)]]);
  else { if (value === null) delete mem.meta[field]; else mem.meta[field] = String(value); persist(); }
  invalidate();
}
async function setPlayer(token, obj) {
  if (USE_REDIS) await redis([['HSET', P + 'players', token, JSON.stringify(obj)]]);
  else { mem.players[token] = obj; persist(); }
  invalidate();
}
async function delPlayer(token) {
  if (USE_REDIS) await redis([['HDEL', P + 'players', token]]);
  else { delete mem.players[token]; persist(); }
  invalidate();
}
async function setVote(key, obj) {
  if (USE_REDIS) await redis([['HSET', P + 'votes', key, JSON.stringify(obj)]]);
  else { mem.votes[key] = obj; persist(); }
  invalidate();
}
async function getVote(key) {
  if (USE_REDIS) { const [v] = await redis([['HGET', P + 'votes', key]]); return v ? parse(v) : {}; }
  return mem.votes[key] || {};
}
async function reset() {
  if (USE_REDIS) await redis([['DEL', P + 'meta'], ['DEL', P + 'players'], ['DEL', P + 'votes']]);
  else { mem = { meta: {}, players: {}, votes: {} }; persist(); }
  invalidate();
}

module.exports = { USE_REDIS, load, setMeta, setPlayer, delPlayer, setVote, getVote, reset };
