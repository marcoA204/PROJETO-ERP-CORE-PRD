# Documentação Técnica — ERP CORE / LogiFlow

## Índice

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Tecnologias e Dependências](#2-tecnologias-e-dependências)
3. [Arquitetura e Estrutura de Diretórios](#3-arquitetura-e-estrutura-de-diretórios)
4. [Fluxo de Execução e Regras de Negócio](#4-fluxo-de-execução-e-regras-de-negócio)
5. [Detalhamento dos Componentes Principais](#5-detalhamento-dos-componentes-principais)
6. [Modelagem de Dados / Banco de Dados](#6-modelagem-de-dados--banco-de-dados)
7. [Endpoints, Rotas e Interfaces](#7-endpoints-rotas-e-interfaces)
8. [Guia de Instalação e Configuração](#8-guia-de-instalação-e-configuração)
9. [Pontos de Atenção Arquiteturais](#9-pontos-de-atenção-arquiteturais)

---

## 1. Visão Geral do Projeto

### 1.1 Propósito

O **ERP CORE / LogiFlow** é uma aplicação web voltada à gestão operacional de pequenos estabelecimentos comerciais. O repositório combina:

- Backend em Node.js;
- Interface web em React;
- Banco de dados Microsoft SQL Server;
- Rotinas SQL baseadas em stored procedures, views e transações;
- Funcionalidades voltadas a varejo e alimentação.

O sistema recebe o nome **LogiFlow** na interface e nas mensagens da API. Os scripts do banco e os nomes internos utilizam **ERP CORE**.

### 1.2 Funcionalidades principais

- PDV — ponto de venda;
- Controle de caixa;
- Cadastro e consulta de produtos;
- Entrada e baixa de estoque;
- Ficha técnica;
- Cadastro de clientes;
- Histórico de compras;
- Orçamentos;
- Histórico e cancelamento de vendas;
- Contas a pagar;
- Despesas pagas;
- Dashboard gerencial;
- DRE mensal;
- Alertas de estoque mínimo;
- QR Code e código Pix;
- Onboarding e seleção do perfil do negócio.

### 1.3 Público-alvo

O sistema é direcionado a:

- Pequenos varejistas;
- Lojas de produtos em geral;
- Mercados e minimercados;
- Restaurantes, lanchonetes e estabelecimentos de alimentação;
- Operadores de caixa;
- Proprietários que acompanham vendas, estoque e despesas;
- Equipes administrativas responsáveis por clientes e contas a pagar.

### 1.4 Perfis de negócio

O frontend possui dois perfis:

- **VAREJO**;
- **ALIMENTACAO**.

No perfil **ALIMENTACAO**, o menu apresenta adicionalmente a tela **Ficha Técnica**.

### 1.5 Estado atual

A implementação é um MVP funcional ou protótipo local, com algumas características importantes:

- Login implementado exclusivamente no frontend;
- Credenciais fixas no código;
- Ausência de JWT ou sistema completo de sessões;
- Comunicação HTTP direta com `localhost:3000`;
- Estado persistido parcialmente no banco;
- SQL Server executado localmente;
- Componentes React concentrados em arquivos grandes;
- Sem suíte de testes identificada;
- Sem autenticação no backend;
- Sem CI/CD identificado.

---

## 2. Tecnologias e Dependências

### 2.1 Backend

| Tecnologia | Uso |
|---|---|
| Node.js | Ambiente de execução |
| CommonJS | Sistema de módulos |
| Express 5 | Servidor HTTP e roteamento |
| `mssql` | Driver para SQL Server |
| `dotenv` | Variáveis de ambiente |
| `cors` | Permissão de requisições CORS |
| Nodemon | Reinicialização durante desenvolvimento |

Principais arquivos:

- `backend/package.json`
- `backend/src/server.js`
- `backend/src/config/db.js`

Dependências:

```json
{
  "cors": "^2.8.6",
  "dotenv": "^18.0.10",
  "express": "^5.3.0",
  "mssql": "^12.7.14"
}
```

Dependência de desenvolvimento:

```json
{
  "nodemon": "^3.1.14"
}
```

Scripts:

```json
{
  "dev": "nodemon src/server.js",
  "start": "node src/server.js"
}
```

### 2.2 Frontend

| Tecnologia | Uso |
|---|---|
| React 19 | Componentes da interface |
| React DOM 19 | Montagem no navegador |
| Vite 8 | Desenvolvimento e build |
| `@vitejs/plugin-react` | Suporte a JSX |
| ESLint | Análise estática |
| `qrcode.react` | QR Code |
| JSX | Estrutura dos componentes |
| CSS | Estilização |

Dependências:

```json
{
  "qrcode.react": "^4.2.0",
  "react": "^19.2.6",
  "react-dom": "^19.2.6"
}
```

Scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

### 2.3 Banco de dados

- Microsoft SQL Server;
- Pool de conexões gerenciado pelo `mssql`;
- Banco padrão `ERP_PDV_Master`;
- Stored procedures;
- Views;
- JSON enviado às procedures;
- Transações;
- Validação com `THROW`;
- Auditoria de movimentos;
- Registro de erros.

Scripts identificados:

- `database/estrutura.banco.ERP_v4.0.sql`
- `database/ERP_CORE_etapa1_v4.1.sql`
- `database/ERP_CORE_etapa2_v4.2.sql`

### 2.4 Integrações externas

A única integração identificada é o **Pix**:

- Geração local do payload EMV;
- Chave Pix configurada por variável de ambiente;
- Nome e cidade configuráveis;
- Cálculo local de CRC16-CCITT;
- QR Code gerado por `qrcode.react`;
- Nenhuma API bancária externa utilizada.

Não foram identificadas integrações com:

- Gateway de pagamento;
- Nota fiscal;
- SEFAZ;
- NFe/NFC-e;
- WhatsApp API;
- Correios;
- Autenticação externa;
- ERP externo.

---

## 3. Arquitetura e Estrutura de Diretórios

### 3.1 Estrutura geral

```text
PROJETO-ERP-CORE-PRD/
├── analytics/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── utils/
│   ├── node_modules/
│   ├── .env
│   ├── package.json
│   └── package-lock.json
├── database/
│   ├── ERP_CORE_etapa1_v4.1.sql
│   ├── ERP_CORE_etapa2_v4.2.sql
│   └── estrutura.banco.ERP_v4.0.sql
├── docs/
│   └── manual_sql.md
├── frontend/
│   ├── src/
│   │   ├── telas/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── comum.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── package.json
├── .gitignore
└── README.md
```

### 3.2 Backend

#### `backend/src/server.js`

Arquivo de inicialização da API. Responsabilidades:

- Criar o aplicativo Express;
- Configurar CORS;
- Permitir JSON no corpo das requisições;
- Registrar os módulos de rota;
- Inicializar o servidor HTTP;
- Disponibilizar rota de status;
- Testar a conexão com o banco.

Porta padrão:

```text
3000
```

#### `backend/src/config/db.js`

Centraliza a conexão com SQL Server.

Características:

- Conecta uma única vez;
- Mantém o pool em `poolPromise`;
- Permite até dez conexões simultâneas;
- Permite zero conexões ociosas mínimas;
- Reinicia o pool após falha;
- Utiliza `trustServerCertificate` para ambiente local;
- Exporta `sql`, `connectToDatabase` e `dbConfig`.

Configuração:

```javascript
{
  user,
  password,
  database,
  server,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
}
```

### 3.3 Controllers

Os controllers concentram:

- Consultas SQL;
- Parametrização;
- Execução de procedures;
- Respostas HTTP;
- Tratamento de exceções;
- Conversão de dados recebidos pelo frontend.

| Arquivo | Responsabilidade |
|---|---|
| `produtoController.js` | Catálogo, cadastro, atualização, estoque e ficha técnica |
| `caixaController.js` | Abrir, fechar e consultar caixa |
| `vendaController.js` | Registrar, consultar, cancelar e emitir recibo |
| `despesaController.js` | Contas a pagar e despesas |
| `dashboardController.js` | Dados consolidados da tela inicial |
| `clienteController.js` | Cadastro e histórico de clientes |
| `orcamentoController.js` | Criar, consultar e cancelar orçamentos |
| `configController.js` | Nicho e onboarding |

### 3.4 Rotas

| Prefixo | Arquivo |
|---|---|
| `/api/produtos` | `produtoRoutes.js` |
| `/api/caixa` | `caixaRoutes.js` |
| `/api/vendas` | `vendaRoutes.js` |
| `/api/despesas` | `despesaRoutes.js` |
| `/api/dashboard` | `dashboardRoutes.js` |
| `/api/clientes` | `clienteRoutes.js` |
| `/api/orcamentos` | `orcamentoRoutes.js` |
| `/api/configuracoes` | `configRoutes.js` |

### 3.5 Utilitários

#### `erroHttp.js`

Converte exceções do SQL Server em respostas HTTP.

Comportamento:

- Erros entre `50000` e `50999` representam regras de negócio;
- Status `400`;
- Corpo contém `erro` e `codigo`;
- Outros erros recebem status `500`;
- Detalhes técnicos são mantidos no console.

#### `pix.js`

Implementa:

- Remoção de acentos;
- Limitação de tamanho dos campos;
- Montagem dos campos EMV;
- Payload `br.gov.bcb.pix`;
- Valor fixo;
- TXID;
- Código CRC16-CCITT;
- Texto Copia e Cola.

### 3.6 Frontend

#### `frontend/src/main.jsx`

Ponto de entrada React. Importa:

- `StrictMode`;
- `createRoot`;
- `App.jsx`;
- `index.css`.

#### `frontend/src/App.jsx`

Núcleo da interface.

Responsabilidades:

- Login;
- Sidebar;
- Dashboard;
- Fluxo de caixa;
- Cadastro de produto;
- Estado global da aplicação;
- Troca entre telas;
- Persistência de login;
- Onboarding;
- Configuração do nicho;
- Busca inicial de produtos e caixa.

Estados principais:

- `logado`;
- `tela`;
- `products`;
- `transactions`;
- `idCaixa`;
- `config`;
- `orcamentoPdv`.

#### `frontend/src/comum.jsx`

Centraliza:

- Paleta de cores;
- Ícones;
- Formatação monetária;
- Estilos comuns;
- `StatCard`;
- Cliente HTTP `api`;
- Cores por situação.

#### `frontend/src/telas/`

| Arquivo | Função |
|---|---|
| `PDV.jsx` | Venda no balcão |
| `Vendas.jsx` | Histórico e cancelamento |
| `Estoque.jsx` | Consulta e entrada de estoque |
| `Clientes.jsx` | Cadastro e histórico |
| `Orcamentos.jsx` | Gestão de propostas |
| `ContasPagar.jsx` | Contas pendentes e pagamentos |
| `FichaTecnica.jsx` | Composição de produtos |
| `Onboarding.jsx` | Seleção do nicho |

### 3.7 Diretórios auxiliares

- `database/`: scripts SQL;
- `docs/`: manual SQL;
- `analytics/`: reservado para futuras análises;
- `frontend/public/`: arquivos públicos da aplicação;
- `backend/node_modules/`: dependências JavaScript versionadas.

---

## 4. Fluxo de Execução e Regras de Negócio

### 4.1 Inicialização

1. `main.jsx` monta `App.jsx`;
2. O React verifica `lf_logado` no `localStorage`;
3. Sem login, exibe `Login`;
4. Com login, busca configurações, produtos e caixa aberto;
5. Se o onboarding não foi concluído, exibe `Onboarding`;
6. Em seguida, exibe o dashboard e o menu lateral.

No backend:

1. `server.js` inicia o Express;
2. Carrega as variáveis de ambiente;
3. Registra os módulos de rota;
4. Mantém o pool do SQL Server;
5. Testa a conexão com o banco.

### 4.2 Login

O login é implementado somente no frontend.

Credenciais:

```text
Usuário: admin
Senha: admin123
```

Após autenticar:

- Salva `lf_logado=true` no `localStorage`;
- Remove o valor ao sair;
- Não envia token ao backend;
- Não protege as rotas da API.

Em produção, a autenticação deverá ser implementada no backend.

### 4.3 Produtos

Fluxo:

```text
Frontend
→ POST /api/produtos
→ sp_SalvarProduto
→ tabela Produtos
```

Regras:

- Nome obrigatório;
- Preços não podem ser negativos;
- Estoque inicial não pode ser negativo;
- Estoque mínimo não pode ser negativo;
- Código de barras não pode duplicar em produtos ativos;
- Sem código informado, o banco gera código interno iniciado por `200`;
- Estoque inicial gera histórico de movimentação.

A inativação não exclui o produto, preservando o histórico comercial.

### 4.4 Estoque

O estoque pode ser alterado por:

- Cadastro inicial;
- Entrada de reposição;
- Venda concluída;
- Cancelamento de venda;
- Ficha técnica.

Endpoint:

```text
POST /api/produtos/:id/entrada
```

Regras:

- Produto deve existir e estar ativo;
- Quantidade deve ser inteira e positiva;
- O histórico recebe o saldo resultante;
- Motivo padrão: `Reposicao de estoque`.

### 4.5 Caixa

Somente um caixa pode estar aberto por vez.

Fluxo:

```text
Abrir caixa
→ sp_AbrirCaixa
→ id_caixa
→ vendas utilizam o id_caixa
→ fechar caixa
→ sp_FecharCaixa
��� resumo do turno
```

Ao abrir:

- Troco inicial precisa ser válido;
- Não pode existir caixa aberto;
- Um novo turno é criado.

Ao fechar:

- Caixa precisa existir;
- Caixa não pode estar fechado anteriormente;
- Faturamento é calculado;
- Dinheiro físico esperado é calculado;
- Resumo é retornado ao frontend.

### 4.6 Venda no PDV

Uma venda contém:

- Itens;
- Quantidades;
- Pagamentos;
- Desconto;
- Caixa;
- Cliente opcional;
- Orçamento opcional.

Fluxo:

```text
Frontend
→ POST /api/vendas
→ sp_RegistrarVenda
→ baixa de estoque
→ registros de pagamento
→ venda concluída
→ id_venda
```

Regras:

- Caixa precisa estar aberto;
- Produtos precisam estar ativos;
- Quantidades precisam ser positivas;
- Estoque não pode ficar negativo;
- Preço é obtido do banco;
- Desconto não pode tornar o valor negativo;
- Pagamentos precisam somar o valor líquido;
- Tudo ocorre em uma única transação;
- Falhas realizam rollback;
- Erros são registrados em `Log_Erros`.

Formas de pagamento:

- `DINHEIRO`;
- `PIX`;
- `CARTAO_DEBITO`;
- `CARTAO_CREDITO`;
- `BOLETO`;
- `OUTROS`.

### 4.7 Cancelamento de venda

Endpoint:

```text
POST /api/vendas/:id/cancelar
```

Regras:

- Motivo limitado a 200 caracteres;
- Venda precisa existir;
- Itens são devolvidos ao estoque;
- Status passa para `CANCELADA`;
- Histórico é preservado;
- Canceladas são excluídas das consultas financeiras relevantes.

### 4.8 Orçamentos

Um orçamento pode conter:

- Cliente opcional;
- Validade;
- Desconto;
- Observações;
- Itens.

Regras:

- Validade deve estar no formato `AAAA-MM-DD`;
- Observações são limitadas a 300 caracteres;
- A criação executa `sp_CriarOrcamento`;
- O orçamento pode ser enviado ao PDV;
- O orçamento pode ser cancelado;
- Uma venda pode referenciar o orçamento por `id_orcamento`.

### 4.9 Contas a pagar

Uma despesa possui:

- Descrição;
- Valor;
- Data de vencimento;
- Status;
- Data de pagamento.

Situações:

- `ATRASADA`;
- `VENCE HOJE`;
- `PENDENTE`;
- `PAGO`.

Regras:

- Pendente não possui data de pagamento;
- Pago exige data de pagamento;
- Contas vencidas aparecem no dashboard;
- Despesas pagas entram no fluxo de caixa;
- Despesas pagas entram na DRE.

### 4.10 Dashboard

Endpoint:

```text
GET /api/dashboard
```

Dados consolidados:

- Resumo mensal;
- DRE dos últimos seis meses;
- Produtos abaixo do mínimo;
- Últimas movimentações;
- Contas atrasadas;
- Contas que vencem hoje;
- Próximos vencimentos.

Cálculo:

```text
Lucro líquido =
Faturamento recebido
- custo dos produtos
- despesas operacionais
```

### 4.11 Pix

No recebimento do recibo:

- Soma-se o valor pago em Pix;
- Monta-se o payload;
- Define-se o TXID como `VENDA{id_venda}`;
- Retorna-se o texto Copia e Cola;
- O frontend gera o QR Code.

---

## 5. Detalhamento dos Componentes Principais

### 5.1 `server.js`

Funções:

- Configuração do Express;
- Middleware CORS;
- Middleware JSON;
- Registro das rotas;
- Inicialização da API;
- Rota de status.

Rota base:

```text
GET /
```

Retorno:

```json
{
  "status": "Online",
  "mensagem": "API do LogiFlow está rodando 100% no Node.js!",
  "ambiente": "Desenvolvimento"
}
```

### 5.2 `App.jsx`

Estados principais:

- `logado`;
- `tela`;
- `products`;
- `transactions`;
- `idCaixa`;
- `config`;
- `orcamentoPdv`.

Funções:

| Função | Responsabilidade |
|---|---|
| `buscarConfig` | Obtém perfil e onboarding |
| `salvarNicho` | Atualiza perfil |
| `abrirNoPdv` | Envia orçamento ao PDV |
| `buscarCaixaAberto` | Recupera caixa aberto |
| `buscarProdutos` | Atualiza catálogo |
| `renderTela` | Seleciona componente |
| `Login` | Realiza autenticação local |
| `Sidebar` | Navegação lateral |
| `Dashboard` | Indicadores |
| `FluxoCaixa` | Turno e despesas |
| `CadastroProduto` | Cadastro e listagem |

### 5.3 `comum.jsx`

Provavelmente disponibiliza:

- `C`: paleta de cores;
- `Icon`: componentes SVG;
- `fmt`: formatação monetária;
- `api`: wrapper de requisições;
- `inputStyle`;
- `botao`;
- `cartao`;
- `StatCard`;
- `COR_SITUACAO`.

### 5.4 `produtoController.js`

Funções:

- `listarProdutos`;
- `cadastrarProduto`;
- `atualizarProduto`;
- `entradaEstoque`;
- `inativarProduto`;
- `obterFicha`;
- `salvarFicha`.

Destaques:

- Usa parâmetros tipados;
- Executa procedures;
- Valida IDs;
- Valida quantidade de entrada;
- Converte fichas técnicas em JSON;
- Utiliza `responderErro`.

### 5.5 `vendaController.js`

Funções:

- `registrarVenda`;
- `listarVendas`;
- `cancelarVenda`;
- `obterRecibo`.

Destaques:

- Executa `sp_RegistrarVenda`;
- Limita histórico entre 1 e 300 registros;
- Monta recibos completos;
- Soma pagamentos em Pix;
- Gera payload Pix;
- Consulta itens e pagamentos.

### 5.6 `clienteController.js`

Permite:

- Listar clientes ativos;
- Criar e editar;
- Inativar;
- Consultar histórico;
- Normalizar telefone e documento;
- Mostrar total gasto;
- Contar compras.

### 5.7 `orcamentoController.js`

Permite:

- Listar 200 orçamentos;
- Consultar cabeçalho e itens;
- Criar orçamento;
- Cancelar orçamento;
- Enviar orçamento ao PDV.

### 5.8 `pix.js`

Função principal:

```javascript
gerarPixCopiaECola({
  chave,
  nome,
  cidade,
  valor,
  txid
})
```

Também expõe:

```javascript
crc16()
```

---

## 6. Modelagem de Dados / Banco de Dados

### 6.1 Banco configurado

Nome padrão:

```text
ERP_PDV_Master
```

Servidor padrão:

```text
localhost
```

Usuário padrão:

```text
sa
```

### 6.2 Entidades principais

| Entidade | Finalidade |
|---|---|
| `Produtos` | Catálogo |
| `Categorias` | Classificação |
| `Marcas` | Marcas de produtos |
| `Clientes` | Cadastro de clientes |
| `Vendas` | Cabeçalho das vendas |
| `ItensVenda` | Itens vendidos |
| `PagamentosVenda` | Formas de pagamento |
| `Orcamentos` | Cabeçalho de propostas |
| `ItensOrcamento` | Itens de propostas |
| `Despesas` | Contas e despesas |
| `Controle_Caixa` | Turnos |
| `Historico_Movimentacao_Estoque` | Auditoria |
| `FichaTecnica` | Composição de produtos |
| `Configuracoes` | Nicho e onboarding |
| `Log_Erros` | Auditoria de falhas |

### 6.3 Produtos

Campos inferidos:

- `id_produto`;
- `nome`;
- `codigo_barras`;
- `preco_custo`;
- `preco_venda`;
- `estoque_atual`;
- `estoque_minimo`;
- `ativo`;
- `id_categoria`;
- `id_marca`.

Regras:

- Preços não negativos;
- Estoque não negativo;
- Código de barras único em produtos ativos;
- Produto inativo preserva histórico.

### 6.4 Clientes

Campos inferidos:

- `id_cliente`;
- `nome`;
- `whatsapp`;
- `documento`;
- `observacoes`;
- `ativo`.

### 6.5 Vendas

Campos inferidos:

- `id_venda`;
- `id_caixa`;
- `id_cliente`;
- `id_orcamento`;
- `data_venda`;
- `valor_total`;
- `valor_desconto`;
- `valor_a_receber`;
- `status_venda`;
- `motivo_cancelamento`;
- `turno`.

Status:

- `CONCLUIDA`;
- `CANCELADA`.

### 6.6 Itens da venda

Campos inferidos:

- `id_item`;
- `id_venda`;
- `id_produto`;
- `quantidade`;
- `preco_unitario_praticado`;
- `subtotal`.

### 6.7 Pagamentos

Campos inferidos:

- `id_pagamento`;
- `id_venda`;
- `forma_pagamento`;
- `valor_pago`.

### 6.8 Caixa

Campos inferidos:

- `id_caixa`;
- `troco_inicial`;
- `data_abertura`;
- `data_fechamento`;
- `status_caixa`.

Status:

- `ABERTO`;
- `FECHADO`.

### 6.9 Despesas

Campos inferidos:

- `id_despesa`;
- `descricao`;
- `valor_total`;
- `data_vencimento`;
- `data_pagamento`;
- `status_pagamento`.

Status:

- `PENDENTE`;
- `PAGO`.

### 6.10 Ficha técnica

Relacionamento:

```text
Produto final 1 ─── N FichaTecnica N ─── 1 Ingrediente
```

Campos inferidos:

- `id_produto`;
- `id_ingrediente`;
- `quantidade`.

### 6.11 Views relevantes

| View | Função |
|---|---|
| `vw_CatalogoProdutos` | Catálogo ativo |
| `vw_SugestaoCompra` | Produtos abaixo do mínimo |
| `vw_FechamentoCaixa` | Resumo de turno |
| `vw_RelatorioMensal_DRE` | Resultado mensal |
| `vw_ContasPagar` | Situação das despesas |
| `vw_HistoricoVendas` | Histórico comercial |
| `vw_Orcamentos` | Dados consolidados |
| `vw_ErrosRecentes` | Últimos erros SQL |

### 6.12 Procedures relevantes

| Procedure | Responsabilidade |
|---|---|
| `sp_SalvarProduto` | Cadastrar produto |
| `sp_AtualizarProduto` | Atualizar produto |
| `sp_InativarProduto` | Inativar produto |
| `sp_EntradaEstoque` | Repor estoque |
| `sp_AbrirCaixa` | Abrir turno |
| `sp_FecharCaixa` | Fechar turno |
| `sp_RegistrarVenda` | Registrar venda |
| `sp_CancelarVenda` | Cancelar venda |
| `sp_SalvarCliente` | Cadastrar ou editar cliente |
| `sp_InativarCliente` | Remover da lista ativa |
| `sp_CriarOrcamento` | Criar proposta |
| `sp_CancelarOrcamento` | Cancelar proposta |
| `sp_SalvarFichaTecnica` | Atualizar composição |

---

## 7. Endpoints, Rotas e Interfaces

### 7.1 Rota geral

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/` | Status da API |

### 7.2 Produtos

| Método | Rota | Controller |
|---|---|---|
| `GET` | `/api/produtos` | `listarProdutos` |
| `POST` | `/api/produtos` | `cadastrarProduto` |
| `PUT` | `/api/produtos/:id` | `atualizarProduto` |
| `POST` | `/api/produtos/:id/entrada` | `entradaEstoque` |
| `DELETE` | `/api/produtos/:id` | `inativarProduto` |
| `GET` | `/api/produtos/:id/ficha` | `obterFicha` |
| `PUT` | `/api/produtos/:id/ficha` | `salvarFicha` |

Exemplo de cadastro:

```json
{
  "nome": "Notebook",
  "preco_custo": 2000,
  "preco_venda": 2800,
  "estoque_inicial": 10,
  "estoque_minimo": 2,
  "codigo_barras": "7891234567890",
  "nome_categoria": "Eletrônicos",
  "nome_marca": "Dell"
}
```

Exemplo de entrada:

```json
{
  "quantidade": 5,
  "motivo": "Compra fornecedor NF 123"
}
```

Exemplo de ficha:

```json
{
  "ingredientes": [
    {
      "id_ingrediente": 10,
      "quantidade": 2
    }
  ]
}
```

### 7.3 Caixa

| Método | Rota | Controller |
|---|---|---|
| `GET` | `/api/caixa/atual` | `caixaAtual` |
| `POST` | `/api/caixa/abrir` | `abrirCaixa` |
| `POST` | `/api/caixa/fechar` | `fecharCaixa` |

Exemplo de abertura:

```json
{
  "troco_inicial": 100
}
```

Exemplo de fechamento:

```json
{
  "id_caixa": 1
}
```

### 7.4 Vendas

| Método | Rota | Controller |
|---|---|---|
| `GET` | `/api/vendas?limite=100` | `listarVendas` |
| `POST` | `/api/vendas` | `registrarVenda` |
| `POST` | `/api/vendas/:id/cancelar` | `cancelarVenda` |
| `GET` | `/api/vendas/:id/recibo` | `obterRecibo` |

Exemplo:

```json
{
  "id_caixa": 1,
  "valor_desconto": 5,
  "itens": [
    {
      "codigo_barras": "7891234567890",
      "quantidade": 2
    }
  ],
  "pagamentos": [
    {
      "forma_pagamento": "PIX",
      "valor_pago": 50
    },
    {
      "forma_pagamento": "DINHEIRO",
      "valor_pago": 25
    }
  ],
  "id_cliente": null,
  "id_orcamento": null
}
```

Exemplo de cancelamento:

```json
{
  "motivo": "Cliente desistiu da compra"
}
```

### 7.5 Despesas

| Método | Rota | Controller |
|---|---|---|
| `GET` | `/api/despesas` | `listarDespesas` |
| `POST` | `/api/despesas` | `registrarDespesa` |
| `POST` | `/api/despesas/:id/pagar` | `pagarDespesa` |

### 7.6 Dashboard

| Método | Rota | Controller |
|---|---|---|
| `GET` | `/api/dashboard` | `obterDashboard` |

### 7.7 Clientes

| Método | Rota | Controller |
|---|---|---|
| `GET` | `/api/clientes` | `listarClientes` |
| `POST` | `/api/clientes` | `salvarCliente` |
| `PUT` | `/api/clientes/:id` | `salvarCliente` |
| `DELETE` | `/api/clientes/:id` | `inativarCliente` |
| `GET` | `/api/clientes/:id/historico` | `historicoCliente` |

Exemplo:

```json
{
  "nome": "João Silva",
  "whatsapp": "11999999999",
  "documento": "12345678900",
  "observacoes": "Preferência por entrega"
}
```

### 7.8 Orçamentos

| Método | Rota | Controller |
|---|---|---|
| `GET` | `/api/orcamentos` | `listarOrcamentos` |
| `POST` | `/api/orcamentos` | `criarOrcamento` |
| `GET` | `/api/orcamentos/:id` | `obterOrcamento` |
| `POST` | `/api/orcamentos/:id/cancelar` | `cancelarOrcamento` |

Exemplo:

```json
{
  "id_cliente": 1,
  "validade": "2026-12-01",
  "valor_desconto": 10,
  "observacoes": "Entrega no endereço do cliente",
  "itens": [
    {
      "codigo_barras": "7891234567890",
      "quantidade": 3
    }
  ]
}
```

### 7.9 Configurações

| Método | Rota | Controller |
|---|---|---|
| `GET` | `/api/configuracoes` | `obterConfiguracoes` |
| `PUT` | `/api/configuracoes` | `salvarConfiguracoes` |

Corpo:

```json
{
  "nicho": "ALIMENTACAO"
}
```

Valores suportados:

- `VAREJO`;
- `ALIMENTACAO`.

### 7.10 Telas

| Tela | Origem |
|---|---|
| Dashboard | `Dashboard` em `App.jsx` |
| PDV | `PDV.jsx` |
| Orçamentos | `Orcamentos.jsx` |
| Vendas | `Vendas.jsx` |
| Clientes | `Clientes.jsx` |
| Estoque | `Estoque.jsx` |
| Ficha Técnica | `FichaTecnica.jsx` |
| Contas a Pagar | `ContasPagar.jsx` |
| Fluxo de Caixa | `FluxoCaixa` em `App.jsx` |
| Cadastrar Produto | `CadastroProduto` em `App.jsx` |
| Configurações | `Onboarding.jsx` |
| Login | `Login` em `App.jsx` |

---

## 8. Guia de Instalação e Configuração

### 8.1 Pré-requisitos

- Windows recomendado;
- Node.js moderno;
- npm;
- Microsoft SQL Server;
- SQL Server Management Studio opcional;
- Porta `3000` disponível;
- Porta padrão do Vite disponível.

### 8.2 Clonar

```bash
git clone https://github.com/marcoA204/PROJETO-ERP-CORE-PRD.git
cd PROJETO-ERP-CORE-PRD
```

### 8.3 Backend

```bash
cd backend
npm install
```

### 8.4 Banco de dados

Execute, nesta ordem, para uma instalação limpa:

```text
database/estrutura.banco.ERP_v4.0.sql
database/ERP_CORE_etapa1_v4.1.sql
database/ERP_CORE_etapa2_v4.2.sql
```

Crie ou identifique:

- Servidor SQL;
- Banco `ERP_PDV_Master`;
- Usuário com permissões adequadas;
- Permissão para criar e executar procedures;
- Permissão para consultar views e tabelas.

### 8.5 Variáveis de ambiente

Arquivo:

```text
backend/.env
```

Exemplo:

```dotenv
PORT=3000
DB_SERVER=localhost
DB_DATABASE=ERP_PDV_Master
DB_USER=sa
DB_PASSWORD=SuaSenhaSegura123!
LOJA_NOME=ERP-CORE
PIX_CHAVE=23132112300
PIX_NOME=Sistema ERP-CORE
PIX_CIDADE=São Paulo
```

Variáveis:

| Variável | Obrigatória | Finalidade |
|---|---|---|
| `PORT` | Não | Porta HTTP da API |
| `DB_SERVER` | Sim | Servidor SQL |
| `DB_DATABASE` | Sim | Banco |
| `DB_USER` | Sim | Usuário SQL |
| `DB_PASSWORD` | Sim | Senha SQL |
| `LOJA_NOME` | Não | Nome em recibos |
| `PIX_CHAVE` | Não | Chave Pix |
| `PIX_NOME` | Não | Nome do beneficiário |
| `PIX_CIDADE` | Não | Cidade do beneficiário |

A chave e a senha devem ser substituídas em ambientes reais.

### 8.6 Executar backend

Desenvolvimento:

```bash
cd backend
npm run dev
```

Execução normal:

```bash
cd backend
npm start
```

API:

```text
http://localhost:3000
```

Verificação:

```text
http://localhost:3000/
```

### 8.7 Frontend

Instalar:

```bash
cd frontend
npm install
```

Executar:

```bash
cd frontend
npm run dev
```

Endereço comum:

```text
http://localhost:5173
```

### 8.8 Build do frontend

```bash
cd frontend
npm run build
```

Pré-visualizar:

```bash
cd frontend
npm run preview
```

### 8.9 Login

```text
Usuário: admin
Senha: admin123
```

### 8.10 Primeira utilização

1. Faça login;
2. Selecione o nicho;
3. Confirme o perfil;
4. Cadastre ou confira produtos;
5. Abra o caixa;
6. Realize uma venda;
7. Consulte o dashboard;
8. Feche o caixa.

### 8.11 Diagnóstico

Em caso de falha:

- Confirme `DB_SERVER`;
- Confirme `DB_DATABASE`;
- Confirme usuário e senha;
- Confirme que o servidor SQL está ativo;
- Confirme autenticação habilitada;
- Confirme porta e firewall;
- Consulte o console do Node;
- Consulte `dbo.Log_Erros`;
- Consulte `dbo.vw_ErrosRecentes`.

---

## 9. Pontos de Atenção Arquiteturais

### 9.1 Segurança

- Senha armazenada no repositório;
- Login fixo no frontend;
- API sem autenticação;
- API sem autorização;
- CORS liberado;
- Ausência de HTTPS local;
- Dados de clientes sem proteção adicional.

### 9.2 Configuração

- URLs fixas para `http://localhost:3000`;
- Não existe variável central da API no frontend;
- Não existe proxy configurado no Vite;
- O frontend depende da execução local do backend.

### 9.3 Organização

- `App.jsx` concentra muitos componentes;
- As consultas SQL ficam diretamente nos controllers;
- Não existe camada de serviço;
- Não existe camada de repositório;
- Não foram identificados testes;
- Não foram identificadas migrations;
- Não foi identificado pipeline CI/CD;
- `node_modules` está presente no repositório.

### 9.4 Dados

- Regras críticas ficam no banco;
- Isso melhora integridade;
- Exige testes completos das procedures;
- IDs são recebidos do frontend;
- Devem ser validados no backend e no banco;
- Erros são registrados em `Log_Erros`.

### 9.5 Evolução recomendada

- Implementar JWT;
- Criar usuários e perfis;
- Proteger todas as rotas;
- Trocar login fixo por tabela de usuários;
- Externalizar URL da API;
- Criar migrations;
- Introduzir camada de repositório;
- Separar componentes de `App.jsx`;
- Criar módulos de domínio;
- Adicionar testes;
- Remover `node_modules` do repositório;
- Proteger arquivos `.env`;
- Criar Docker Compose;
- Criar logs estruturados;
- Criar auditoria de usuário;
- Configurar ambientes;
- Adicionar validação central;
- Cancelar orçamentos expirados;
- Criar documentação OpenAPI/Swagger.
