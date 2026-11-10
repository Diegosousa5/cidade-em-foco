# Implantação no Render

Este projeto usa um Web Service Docker para o backend Java 21, um Static Site para o frontend e o PostgreSQL/PostGIS existente no Supabase. O Blueprint opcional está em [`render.yaml`](./render.yaml). Ele não cria nem altera recursos no Supabase.

## Pré-requisitos

- Código em um repositório Git conectado ao Render.
- Projeto Supabase acessível, com PostGIS e o esquema/tabelas usados pela aplicação já instalados.
- URL pública do backend e URL pública do frontend fornecidas pelo Render após criar os serviços.

Não coloque credenciais no repositório ou no frontend. Configure os valores de banco diretamente nas variáveis do serviço backend no Render.

## Backend como Web Service

### Via Blueprint

1. No Render, escolha **New > Blueprint** e conecte o repositório.
2. Revise os dois serviços declarados em `render.yaml`.
3. Configure as variáveis solicitadas para o backend e o frontend, conforme as seções abaixo.
4. Crie os serviços somente após conferir nomes, plano e variáveis no painel.

### Via Dashboard

1. Escolha **New > Web Service**, conecte o repositório e selecione runtime **Docker**.
2. Defina o Dockerfile como `backend/Dockerfile` e o contexto como `backend`.
3. O Dockerfile compila com Maven e inicia o JAR. Não é necessário definir um Start Command separado.
4. Configure as variáveis abaixo e o health check em `/api/health`.

O Maven usa `-DskipTests package` na imagem de produção. Para validar antes do deploy, execute localmente:

```powershell
Set-Location backend
.\mvnw.cmd -DskipTests clean compile
```

O serviço lê a porta atribuída pelo Render por meio de `PORT`, com `8080` como padrão local.

### Variáveis do backend

| Variável | Valor |
|---|---|
| `DB_URL` | URL JDBC do Supabase, por exemplo `jdbc:postgresql://<host>:<porta>/<banco>?sslmode=require` |
| `DB_USERNAME` | Usuário indicado pela conexão selecionada no painel Supabase |
| `DB_PASSWORD` | Senha correspondente, configurada apenas no painel Render |
| `CORS_ALLOWED_ORIGINS` | Origem HTTPS exata do frontend, sem caminho final; múltiplas origens podem ser separadas por vírgula |
| `PORT` | Fornecida automaticamente pelo Render; normalmente não precisa ser definida manualmente |

Use os parâmetros de conexão exibidos em **Supabase > Connect**. Se a conexão direta não for acessível pela rede/plano do serviço, use o pooler Supavisor recomendado pelo Supabase para a conectividade disponível e monte o `DB_URL` JDBC com o host, porta e banco dessa conexão. Mantenha `sslmode=require`. Configure usuário e senha nos campos separados; evite embuti-los na URL.

O backend usa `ddl-auto: validate`: não cria nem atualiza a estrutura do banco. A implantação pressupõe que tabela, restrições, extensão PostGIS e índice espacial necessários já existam. Nenhuma migração é executada por este guia.

## Frontend como Static Site

1. Escolha **New > Static Site** e conecte o mesmo repositório.
2. Use `frontend` como Root Directory, `node build.mjs` como Build Command e `dist` como Publish Directory.
3. Defina `API_BASE_URL` como a origem pública HTTPS do backend, por exemplo `https://<nome-do-backend>.onrender.com`, sem `/api`.
4. Após salvar a URL pública do frontend, configure `CORS_ALLOWED_ORIGINS` no backend com essa origem HTTPS exata. Salve e faça novo deploy/restart do backend.

O build gera `js/runtime-config.js` dentro da pasta publicada usando `API_BASE_URL`. O arquivo gerado não contém credenciais. O arquivo-fonte local mantém a URL vazia e [config.js](./frontend/js/config.js) continua usando `http://localhost:8080` em `localhost` e `127.0.0.1`.

Se a origem do frontend ou a URL do backend mudar, atualize as variáveis correspondentes e faça novo deploy. Para domínio próprio, inclua sua origem exata em `CORS_ALLOWED_ORIGINS`.

## Validar após implantação

1. Abra `https://<backend>/api/health` e confirme resposta HTTP 200.
2. Abra o frontend HTTPS e verifique no navegador se as chamadas à API não são bloqueadas por CORS.
3. Teste cadastro, listagem, edição e exclusão; confira o mapa, a busca por raio e o carregamento por área visível.
4. Confirme a persistência de uma ocorrência por consulta à aplicação/Supabase antes de considerar a implantação concluída.

O frontend usa Leaflet/OpenStreetMap e consulta Nominatim no navegador. A busca deve permanecer acionada pelo usuário, respeitar a política de uso do Nominatim e não deve ser convertida em autocomplete ou requisições excessivas.

## Git e autorização

Nenhum deploy, commit ou push é realizado por este procedimento. Antes da publicação, conecte um repositório Git válido ao Render, revise as alterações pendentes e autorize explicitamente o commit/push ou a implantação.
