# App de Votação e Debate: Bitcoin

Aplicativo web interativo para condução de debates em sala de aula sobre Bitcoin e Tecnologia.

## 📋 Regras Oficiais de Premiação
- Cada uma das 5 perguntas vale **0,1 BTC fictício** (recompensa de 100%).
- **Resultado do 2º Voto (Após o Debate):**
  - **Ficou na Maioria e manteve o voto:** ganha **0,100 BTC** (100%).
  - **Ficou na Maioria e mudou de opinião:** ganha **0,050 BTC** (50%).
  - **Ficou na Minoria:** ganha **0 BTC**.
  - Em caso de empate na sala (50% x 50%), ambos os lados são considerados vencedores.
- **Entrada Tardia:** Alunos que entrarem com o debate em andamento perdem apenas as perguntas já encerradas, concorrendo normalmente nas rodadas seguintes.
- **Cotação em Reais:** O saldo final é convertido automaticamente em Reais (R$) com base na cotação spot do Bitcoin da Coinbase (com opção de ajuste manual pelo apresentador).

## 🏆 Critérios de Desempate (1º Lugar Incontestável)
Para garantir que haja **apenas um único vencedor** em 1º lugar sem reclamações, o sistema aplica 3 critérios ordenados:
1. **Saldo Total em Bitcoin (BTC):** Quem acumulou mais moeda no debate.
2. **Firmeza / Convencimento:** Quem mais vezes defendeu sua posição desde o 1º voto, manteve o voto e saiu vencedor no 2º voto.
3. **Agilidade de Votação:** Menor tempo acumulado de resposta (quem se posicionou mais rápido no milissegundo).

## 🎤 Sorteio de Orador (Painel do Host)
- Durante o tempo de debate (Resultado 1), o apresentador pode deixar a turma falar voluntariamente.
- Caso a sala fique tímida, o apresentador tem à disposição botões no painel `/host`:
  - `🎲 Sortear Qualquer Aluno`
  - `🟢 Quem votou A FAVOR`
  - `🔴 Quem votou CONTRA`
- Ao avançar para a próxima etapa, o orador é limpo automaticamente.

## 💻 Como Rodar Localmente
```bash
HOST_KEY=suachave node server.js
```
- **Alunos:** `http://localhost:3000/`
- **Apresentador (Projetor):** `http://localhost:3000/host`

## ☁️ Deploy na Vercel
1. Conecte o repositório GitHub à Vercel.
2. No menu **Storage**, adicione o **Upstash Redis** gratuito ao projeto.
3. Em **Settings > Environment Variables**, defina:
   - `HOST_KEY`: sua senha de apresentador.
4. Faça o deploy.
