// Regras do jogo e rotas (usadas tanto pelo server.js local quanto pelas funções da Vercel).
const crypto = require('crypto');
const store = require('./store');

const HOST_KEY = process.env.HOST_KEY || 'bitcoin';
const PRIZE = 0.1; // BTC fictício por pergunta (100%)
const FALLBACK_PRICE = 442229; // R$ por BTC, usado se a cotação online falhar

const QUESTIONS = [
  {
    title: 'Uma moeda que exige smartphone, internet e educação financeira pode ser mais inclusiva que o sistema bancário?',
    favor: 'Qualquer pessoa com celular abre uma carteira sem precisar de banco, comprovante de renda ou CPF. Isso é útil para pessoas desbancarizadas e para quem vive em países com bancos instáveis.',
    contra: 'A posse de Bitcoin é muito concentrada (poucos endereços detêm boa parte das moedas), e os primeiros a entrar lucraram muito mais. A exigência de tecnologia exclui justamente os mais pobres.',
  },
  {
    title: 'Para o brasileiro comum, o Bitcoin é mais eficiente que o Pix?',
    favor: 'Transferências internacionais sem intermediários, funcionando 24h, sem fronteiras. Também há soluções de segunda camada (como a Lightning Network) que deixam os pagamentos rápidos e baratos.',
    contra: 'A rede principal processa poucas transações por segundo e cobra taxas variáveis. Já o Pix é instantâneo e gratuito para pessoa física. Esse é um contra-argumento forte para o contexto brasileiro.',
  },
  {
    title: 'A liberdade financeira das criptos beneficia mais o cidadão comum ou o criminoso?',
    favor: 'Protege contra censura financeira, como o bloqueio de contas de dissidentes em regimes autoritários. Além disso, a blockchain é pública, então é mais rastreável que dinheiro vivo.',
    contra: 'Cripto é usada em ransomware, lavagem de dinheiro e pirâmides financeiras. O Brasil teve vários casos de esquemas que prometiam rendimentos com cripto e lesaram milhares de pessoas.',
  },
  {
    title: 'A segurança do Bitcoin justifica o consumo de energia de um país inteiro?',
    favor: 'A segurança e o modelo justificam: boa parte da mineração usa energia renovável ou excedente que seria desperdiçada, e o gasto de energia é justamente o que torna a rede segura e inviolável. Além disso, outras criptos usam Proof of Stake, que consome 99,9% menos (o Ethereum migrou em 2022).',
    contra: 'O custo ambiental é desproporcional: segundo o índice de Cambridge, o Bitcoin consome mais de 140 TWh por ano, mais do que a Noruega inteira. Queimar energia fóssil e recursos escassos do planeta para sustentar cálculos matemáticos de especulação financeira é insustentável.',
  },
  {
    title: 'Se o primeiro país a adotar o Bitcoin como moeda oficial voltou atrás, o experimento deu certo ou fracassou?',
    favor: 'Deu certo e fortaleceu o país: o país segue acumulando e possui mais de 7.600 bitcoins em sua reserva estratégica, hoje avaliada em centenas de milhões de dólares de lucro. Com a valorização, El Salvador atraiu investimento estrangeiro, visibilidade global e turismo tecnológico sem precedentes.',
    contra: 'Fracassou como moeda real da população: em janeiro de 2025, o governo teve que retirar o status de moeda obrigatória para receber um empréstimo de US$ 1,4 bi do FMI. A população não adotou no dia a dia: transferências em cripto representaram míseros 0,71% das remessas do país no início de 2026.',
  },
];

const STEPS = ['v1', 'r1', 'v2', 'r2'];
const LAST = 1 + QUESTIONS.length * 4; // fase final
const parse = (v) => { try { return JSON.parse(v); } catch (_) { return v; } };
const info = (p) => p === 0 || p >= LAST
  ? { kind: p === 0 ? 'lobby' : 'final', q: null, step: null }
  : { kind: 'q', q: Math.floor((p - 1) / 4), step: STEPS[(p - 1) % 4] };

// ---- cotação do BTC em reais ----
let priceCache = { t: 0, value: null };
async function livePrice() {
  if (priceCache.value && Date.now() - priceCache.t < 5 * 60 * 1000) return priceCache.value;
  try {
    const r = await fetch('https://api.coinbase.com/v2/prices/BTC-BRL/spot', { signal: AbortSignal.timeout(2500) });
    const v = parseFloat((await r.json()).data.amount);
    if (v > 0) { priceCache = { t: Date.now(), value: v }; return v; }
  } catch (_) {}
  return priceCache.value || null;
}
async function getPrice(meta) {
  if (meta.price) return { brl: parseFloat(meta.price), source: 'manual' };
  const v = await livePrice();
  return v ? { brl: v, source: 'online' } : { brl: FALLBACK_PRICE, source: 'padrão' };
}

// ---- cálculo ----
const voteOf = (D, q, token) => D.votes[q + ':' + token] || {};
function counts(D, q, key) {
  const c = { favor: 0, contra: 0 };
  for (const k in D.votes) if (k.startsWith(q + ':') && D.votes[k][key]) c[D.votes[k][key]]++;
  return c;
}
// Maioria do 2º voto: manteve = 100%, mudou = 50%, minoria/sem voto = 0.
function reward(D, q, token) {
  const v = voteOf(D, q, token);
  if (!v.v1 || !v.v2) return 0;
  const c = counts(D, q, 'v2');
  const other = v.v2 === 'favor' ? 'contra' : 'favor';
  if (c[v.v2] < c[other]) return 0;
  return v.v1 === v.v2 ? PRIZE : PRIZE / 2;
}
const settled = (D, q) => Number(D.meta.phase || 0) >= 1 + q * 4 + 3;
function balance(D, token) {
  let b = 0;
  for (let q = 0; q < QUESTIONS.length; q++) if (settled(D, q)) b += reward(D, q, token);
  return Math.round(b * 1000) / 1000;
}

function publicState(D, token, isHost, price) {
  const phase = Number(D.meta.phase || 0);
  const i = info(phase);
  const brl = (btc) => Math.round(btc * price.brl);
  const ranking = () => Object.entries(D.players)
    .map(([t, p]) => ({ nick: p.nick, btc: balance(D, t), brl: brl(balance(D, t)), late: !!p.joinedAt }))
    .sort((a, b) => b.btc - a.btc || a.nick.localeCompare(b.nick));
  const speaker = D.meta.speaker ? parse(D.meta.speaker) : null;
  const out = {
    phase, last: LAST, kind: i.kind, step: i.step, q: i.q, total: QUESTIONS.length,
    players: Object.keys(D.players).length, prize: PRIZE, price, speaker,
  };
  if (i.kind === 'q') {
    const Q = QUESTIONS[i.q];
    out.question = { title: Q.title, favor: Q.favor, contra: Q.contra };
    const mine = voteOf(D, i.q, token);
    out.myV1 = mine.v1 || null;
    out.myV2 = mine.v2 || null;
    const voting = i.step === 'v1' || i.step === 'v2';
    const key = i.step === 'v1' || i.step === 'r1' ? 'v1' : 'v2';
    out.voted = Object.keys(D.votes).filter((k) => k.startsWith(i.q + ':') && D.votes[k][key]).length;
    if (!voting) out.results = counts(D, i.q, key);
    if (i.step === 'r1') out.resultsV1 = counts(D, i.q, 'v1');
    if (i.step === 'r2') {
      out.resultsV1 = counts(D, i.q, 'v1');
      out.resultsV2 = counts(D, i.q, 'v2');
      out.myReward = reward(D, i.q, token);
      out.myRewardBrl = brl(out.myReward);
      out.changed = !!(out.myV1 && out.myV2 && out.myV1 !== out.myV2);
      out.changedCount = Object.keys(D.votes).filter((k) => {
        const v = D.votes[k];
        return k.startsWith(i.q + ':') && v.v1 && v.v2 && v.v1 !== v.v2;
      }).length;
    }
  }
  if (token && D.players[token]) {
    const b = balance(D, token);
    out.me = { nick: D.players[token].nick, btc: b, brl: brl(b), late: !!D.players[token].joinedAt };
  }
  if (i.kind === 'final' || (i.kind === 'q' && i.step === 'r2') || isHost) {
    const r = ranking();
    out.ranking = i.kind === 'final' || isHost ? r : r.slice(0, 5);
  }
  return out;
}

const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});
const isHostReq = (req) => req.headers['x-host-key'] === HOST_KEY;

// ---- rotas ----
const routes = {
  async state(req) {
    const url = new URL(req.url, 'http://x');
    const host = isHostReq(req);
    const D = await store.load(host);
    return [200, publicState(D, url.searchParams.get('token'), host, await getPrice(D.meta))];
  },

  async join(req) {
    const b = body(req);
    const nick = String(b.nick || '').trim().slice(0, 20);
    if (!nick) return [400, { error: 'Digite um apelido.' }];
    const D = await store.load(true);
    const ex = Object.entries(D.players).find(([, p]) => p.nick.toLowerCase() === nick.toLowerCase());
    if (ex) {
      if (b.token === ex[0]) return [200, { token: ex[0] }];
      return [409, { error: 'Esse apelido já está em uso. Escolha outro.' }];
    }
    const token = crypto.randomBytes(8).toString('hex');
    // Quem entra depois do início fica com joinedAt > 0: perde só as rodadas já encerradas.
    await store.setPlayer(token, { nick, joinedAt: Number(D.meta.phase || 0) });
    return [200, { token }];
  },

  async vote(req) {
    const b = body(req);
    const D = await store.load(true);
    const i = info(Number(D.meta.phase || 0));
    if (!D.players[b.token]) return [401, { error: 'Entre com um apelido primeiro.' }];
    if (i.kind !== 'q' || (i.step !== 'v1' && i.step !== 'v2')) return [403, { error: 'Votação fechada.' }];
    if (b.choice !== 'favor' && b.choice !== 'contra') return [400, { error: 'Voto inválido.' }];
    const key = i.q + ':' + b.token;
    const cur = await store.getVote(key);
    cur[i.step] = b.choice;
    await store.setVote(key, cur);
    return [200, { ok: true }];
  },

  async host(req) {
    if (!isHostReq(req)) return [401, { error: 'Chave do apresentador inválida.' }];
    const b = body(req);
    const D = await store.load(true);
    const phase = Number(D.meta.phase || 0);
    if (b.action === 'next') {
      await store.setMeta('phase', Math.min(LAST, phase + 1));
      await store.setMeta('speaker', null);
    } else if (b.action === 'back') {
      await store.setMeta('phase', Math.max(0, phase - 1));
      await store.setMeta('speaker', null);
    } else if (b.action === 'reset') {
      await store.reset();
    } else if (b.action === 'price') {
      const v = parseFloat(String(b.value).replace(',', '.'));
      await store.setMeta('price', v > 0 ? v : null); // vazio/inválido volta ao automático
    } else if (b.action === 'draw_speaker') {
      const i = info(phase);
      const playersList = Object.entries(D.players);
      let eligible = [];
      if (i.kind === 'q' && (b.filter === 'favor' || b.filter === 'contra')) {
        eligible = playersList.filter(([t]) => {
          const v = (D.votes[i.q + ':' + t] || {}).v1;
          return v === b.filter;
        });
      } else {
        eligible = playersList;
      }
      if (eligible.length > 0) {
        const chosen = eligible[Math.floor(Math.random() * eligible.length)];
        const vote = i.kind === 'q' ? (D.votes[i.q + ':' + chosen[0]] || {}).v1 : null;
        await store.setMeta('speaker', JSON.stringify({
          nick: chosen[1].nick,
          vote: vote || null,
          filter: b.filter || 'all',
          t: Date.now()
        }));
      } else {
        return [400, { error: 'Nenhum participante encontrado com esse voto.' }];
      }
    } else if (b.action === 'clear_speaker') {
      await store.setMeta('speaker', null);
    } else if (b.action === 'kick' && D.players[b.token]) {
      await store.delPlayer(b.token);
    } else {
      return [400, { error: 'Ação inválida.' }];
    }
    return [200, { ok: true }];
  },
};

async function handle(name, req, res) {
  try {
    if (process.env.VERCEL && !store.USE_REDIS) {
      throw new Error('Banco não configurado: conecte o Upstash Redis ao projeto na Vercel.');
    }
    const [code, obj] = await routes[name](req);
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: e.message }));
  }
}

module.exports = { handle, routes, HOST_KEY };

