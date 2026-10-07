# Laço

Protótipo de plataforma para conectar doadores e instituições. A aplicação não processa pagamentos: o interesse em uma demanda é registrado e a combinação da doação acontece diretamente com a instituição.

## Requisitos

- Node.js 22 ou superior
- Uma chave da Google Maps JavaScript API para usar o mapa

## Configuração local

1. Copie `.env.example` para `.env` e preencha `MAPS_API_KEY` e `SESSION_SECRET`.
2. Instale as dependências:

```powershell
npm install
npm --prefix client install
npm --prefix server install
```

3. Em dois terminais, inicie cliente e servidor:

```powershell
npm run dev:server
npm run dev:client
```

O cliente abre em `http://localhost:5173` e a API em `http://localhost:5000`.

## Dados de demonstração

O banco local é criado em `server/database/database.db`. Para inserir as instituições demonstrativas de Montes Claros:

```powershell
npm --prefix server run init-db
npm --prefix server run seed
```

## Deploy em Railway

O projeto pode ser publicado como um único serviço, com o Express servindo o build do React em produção.

1. Envie este repositório ao GitHub sem incluir `.env` ou arquivos `.db`.
2. No Railway, crie um serviço a partir do repositório.
3. Configure o comando de build:

```text
npm --prefix client ci && npm --prefix client run build && npm --prefix server ci
```

4. Configure o comando de início:

```text
npm start
```

5. Adicione um volume persistente montado em `/data`.
6. Cadastre as variáveis de produção:

```text
NODE_ENV=production
SESSION_SECRET=<segredo-longo-e-aleatorio>
MAPS_API_KEY=<chave-do-google-maps>
DATABASE_PATH=/data/laco.db
DEMO_MODE=true
CLIENT_ORIGIN=https://<dominio-gerado-pelo-railway>
```

7. Gere o domínio público do serviço em **Networking** e atualize `CLIENT_ORIGIN` com a URL final, incluindo `https://`.

O script de início inicializa o schema e os dados demonstrativos de forma idempotente. O volume preserva o SQLite entre deploys.

## Segurança de configuração

- Nunca envie `.env`, SQLite local ou chaves de API ao GitHub.
- Restrinja a chave do Google Maps ao domínio publicado.
- Use um `SESSION_SECRET` exclusivo e aleatório em produção.
- Use `DEMO_MODE=false` somente se quiser habilitar novos cadastros na demonstração.
