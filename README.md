# App de votação do debate

## Regras
- Cada pergunta vale 0,1 BTC fictício.
- Na maioria do 2º voto: manteve o voto = 100%, mudou de opinião = 50%. Minoria = 0.
- Quem entra com o jogo em andamento perde as rodadas já encerradas.
- O saldo é convertido em reais pela cotação do BTC (automática, ou definida no painel).

## Rodar localmente
```
HOST_KEY=suachave node server.js
```
Alunos: `http://localhost:3000/`  |  Painel: `http://localhost:3000/host`
(o estado fica em `state.json`)

## Publicar na Vercel
1. `npm i -g vercel` e `vercel login`
2. Dentro desta pasta: `vercel` (aceite os padrões; não há build)
3. No painel da Vercel > Storage (ou Marketplace), crie um **Upstash Redis** e conecte ao projeto. Isso cria `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
4. Em Settings > Environment Variables, crie `HOST_KEY` com a sua chave do painel.
5. `vercel --prod` e use a URL gerada. Painel do apresentador: `SUA-URL/host`.

Sem o Redis, as rotas respondem erro (a Vercel não guarda memória entre requisições).
