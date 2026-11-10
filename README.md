# Cidade em Foco

Sistema web para registro, visualização e acompanhamento de ocorrências urbanas em um mapa interativo.

O Cidade em Foco permite que usuários registrem problemas identificados na cidade, consultem ocorrências existentes e visualizem informações geográficas para facilitar o acompanhamento dos problemas urbanos.

## Funcionalidades

- Cadastro de ocorrências com título, descrição, categoria e endereço.
- Registro da localização geográfica das ocorrências.
- Visualização das ocorrências em mapa interativo.
- Consulta de ocorrências por proximidade.
- Seleção do raio de busca: 250 m, 500 m, 1 km, 1,5 km e 2 km.
- Carregamento de ocorrências conforme a área visível do mapa.
- Edição e exclusão de ocorrências.
- Busca de localidades.
- Armazenamento de dados em PostgreSQL com extensão PostGIS.

## Tecnologias utilizadas

### Frontend
- HTML5
- CSS3
- JavaScript
- Leaflet
- OpenStreetMap
- Nominatim

### Backend
- Java 21
- Spring Boot 3.5.7
- Spring Web
- Spring Data JPA
- Bean Validation
- Hibernate Spatial
- Maven

### Banco de dados e infraestrutura
- PostgreSQL
- PostGIS
- Supabase
- Render
- Docker

## Estrutura do projeto

```text
cidade-em-foco/
├── .github/
├── .mvn/
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/br/edu/cidadeemfoco/
│   │   │   │   ├── config/
│   │   │   │   ├── controller/
│   │   │   │   ├── dto/
│   │   │   │   ├── model/
│   │   │   │   ├── repository/
│   │   │   │   └── service/
│   │   │   └── resources/
│   │   └── test/
│   ├── Dockerfile
│   ├── .mvn/
│   ├── mvnw
│   ├── mvnw.cmd
│   └── pom.xml
├── database/
├── frontend/
│   ├── css/
│   ├── js/
│   └── build.mjs
├── .env.example
├── .gitignore
├── DEPLOY.md
├── render.yaml
└── mvnw.cmd
```

## Como executar localmente

### Pré-requisitos

- Java 21.
- Git.
- Navegador atualizado.
- Acesso a um banco PostgreSQL configurado com PostGIS.

### 1. Clonar o repositório

```bash
git clone URL_DO_REPOSITORIO
cd cidade-em-foco
```

### 2. Configurar o backend

Configure as variáveis de ambiente necessárias:

| Variável | Descrição |
|---|---|
| `DB_URL` | URL JDBC de conexão com o PostgreSQL |
| `DB_USERNAME` | Usuário do banco de dados |
| `DB_PASSWORD` | Senha do banco de dados |
| `CORS_ALLOWED_ORIGINS` | Origem autorizada para acessar a API |

Não compartilhe credenciais nem as coloque diretamente no código-fonte.

### 3. Executar o backend

No PowerShell, a partir da raiz do repositório, entre na pasta `backend` e inicie o serviço:

```powershell
Set-Location .\backend
.\mvnw.cmd spring-boot:run
```

Por padrão, o backend fica disponível em:

```text
http://localhost:8080
```

Verifique a disponibilidade da API:

```text
http://localhost:8080/api/health
```

### 4. Executar o frontend

O frontend pode ser executado localmente utilizando a extensão Live Server do Visual Studio Code.

Abra a pasta `frontend` e inicie o Live Server pelo arquivo `index.html`.

A configuração local utiliza o backend em `http://localhost:8080`.

## API REST

O backend disponibiliza os seguintes endpoints:

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/health` | Verifica a disponibilidade da API |
| `GET` | `/api/ocorrencias` | Lista as ocorrências |
| `GET` | `/api/ocorrencias/proximas` | Busca ocorrências por proximidade |
| `GET` | `/api/ocorrencias/area` | Busca ocorrências em uma área geográfica |
| `POST` | `/api/ocorrencias` | Cadastra uma ocorrência |
| `PUT` | `/api/ocorrencias/{id}` | Atualiza uma ocorrência |
| `DELETE` | `/api/ocorrencias/{id}` | Exclui uma ocorrência |

### Parâmetros de busca por proximidade

- `latitude`: latitude da localização de referência.
- `longitude`: longitude da localização de referência.
- `raioMetros`: distância máxima da busca, em metros.

Exemplo:

```text
/api/ocorrencias/proximas?latitude=-23.5&longitude=-46.6&raioMetros=1000
```

### Busca por área

A consulta utiliza os limites geográficos da área visível do mapa:

- `minLatitude`
- `minLongitude`
- `maxLatitude`
- `maxLongitude`

## Testes automatizados

Os testes do backend utilizam JUnit 5, Mockito e AssertJ.

Para executar os testes, no PowerShell a partir da raiz do repositório:

```powershell
Set-Location .\backend
.\mvnw.cmd test
```

A suíte de testes do serviço de ocorrências possui 35 testes automatizados.

## Banco de dados

O projeto utiliza PostgreSQL com PostGIS para armazenar e consultar informações geográficas.

O backend utiliza Hibernate Spatial para trabalhar com coordenadas e geometrias espaciais.

A estrutura do banco deve estar previamente configurada. A aplicação utiliza validação do esquema existente, sem criar ou atualizar automaticamente as tabelas.

## Implantação

A aplicação utiliza:

- Render para hospedagem do backend e frontend.
- Supabase para PostgreSQL e PostGIS.

As instruções detalhadas de implantação e configuração estão disponíveis em [DEPLOY.md](./DEPLOY.md).

## Licença

Projeto desenvolvido para fins acadêmicos.