# Documentação técnica — LogiFlow / ERP CORE

> **Escopo e fonte:** leitura do código versionado na branch `main` do repositório `marcoA204/PROJETO-ERP-CORE-PRD`. Este documento descreve comportamento observado no código e nos scripts SQL; não substitui validação dos processos operacionais com a equipe. Não foram publicados valores de credenciais ou segredos.

## 1. Identificação e visão técnica

O LogiFlow é uma aplicação web para operação de pequenos estabelecimentos: cadastro de produtos, estoque, venda em PDV, caixa, clientes, orçamentos, contas, taxas e indicadores. A interface chama uma API Node/Express; a API consulta o Microsoft SQL Server, que concentra a persistência e parte importante das regras de negócio em stored procedures e views.

O repositório também usa o nome **ERP CORE** nos scripts SQL. O frontend apresenta o produto como **LogiFlow**. Os dois nomes referem-se ao mesmo sistema neste projeto.

### Stack observada

- **Frontend:** JavaScript ES modules, React 19, React DOM, Vite 8, CSS; `qrcode.react` gera QR Codes Pix.
- **Backend:** Node.js, CommonJS, Express 5, `mssql`, `dotenv`, `cors`; Nodemon para desenvolvimento.
- **Persistência:** Microsoft SQL Server; scripts T-SQL com tabelas, índices, constraints, procedures e views.
- **Integrações:** geração local do payload Pix BR Code/CRC16 e links `wa.me` para WhatsApp. Não se identificou integração bancária que confirme o pagamento, nem gateway de pagamentos.

## 2. Organização do repositório

```text
analytics/       Funções SQL de indicadores de análise (somente leitura)
backend/
  src/config/    Pool/conexão com SQL Server
  src/controllers/ Regras de orquestração HTTP, consultas e chamadas a procedures
  src/middleware/ Autenticação de sessão e autorização por perfil
  src/routes/   Rotas HTTP da API
  src/utils/    Senhas/tokens, erros HTTP, Pix e criação do gerente inicial
database/       Estrutura base v4.0 e migrações v4.1–v4.4
_docs/          Documentação do repositório (este arquivo e manual funcional)_
frontend/
  src/telas/    Telas por processo/área
  src/App.jsx   Navegação, estado de sessão e montagem das telas
  src/comum.jsx Componentes, formatação, cliente HTTP e recibo
```

> A pasta de documentação existente no repositório é `docs/` (não `_docs/`). O frontend também contém `public/` para arquivos estáticos, como logo e ícones. `backend/node_modules/` está versionado no repositório; não é código próprio da aplicação e não deve ser tratado como fonte de regras funcionais.

### Componentes de aplicação

- `backend/src/server.js`: inicializa Express, configura CORS e JSON, monta as rotas e inicia a conexão SQL Server e a criação do administrador inicial.
- `backend/src/config/db.js`: configura e reutiliza um único pool SQL (`max: 10`, `min: 0`, `idleTimeoutMillis: 30000`). Se a conexão falha, limpa o pool para permitir nova tentativa.
- `backend/src/middleware/auth.js`: exige `Authorization: Bearer <token>` na API protegida, verifica o hash do token e carrega o perfil atual do usuário no banco.
- `backend/src/middleware/permissoes.js`: matriz central de autorização; se não houver regra que libere uma rota ao operador, apenas gerente pode usá-la.
- `backend/src/controllers/`: controllers por domínio. Muitos comandos de escrita chamam procedures SQL parametrizadas; consultas usam views ou SQL parametrizado.
- `frontend/src/main.jsx`: monta `App.jsx`. `frontend/src/App.jsx` controla sessão, perfil de negócio, navegação e dados compartilhados.
- `frontend/src/comum.jsx`: endereço da API (`http://localhost:3000/api`), inclusão do token, componentes comuns, formatação monetária, recibo, Pix/WhatsApp e seletor de clientes.
- `database/`: scripts versionados em sequência; o SQL é parte essencial do comportamento, não apenas estrutura de armazenamento.

## 3. Inicialização e configuração

### Pré-requisitos

- Node.js/npm compatíveis com as dependências do projeto;
- SQL Server acessível a partir do backend;
- Banco `ERP_PDV_Master` preparado com os scripts abaixo;
- Variáveis de ambiente de banco e, se for usar Pix, configuração Pix.

### Instalação do banco

A sequência declarada nos cabeçalhos dos scripts é:

1. `database/estrutura.banco.ERP_v4.0.sql`;
2. `database/ERP_CORE_etapa1_v4.1.sql`;
3. `database/ERP_CORE_etapa2_v4.2.sql`;
4. `database/ERP_CORE_etapa3_v4.3.sql`;
5. `analytics/01_funcoes_analiticas.sql` (após a etapa 3);
6. `database/ERP_CORE_etapa4_v4.4.sql` (após v4.0–v4.3 e analytics, conforme o cabeçalho v4.4).

Os scripts se descrevem como migrações não destrutivas/reexecutáveis (`CREATE OR ALTER`, verificações de existência). A estrutura base cria `ERP_PDV_Master` caso ainda não exista. Não foi encontrado script de reset entre os arquivos próprios listados; as instruções de reset no comentário da estrutura referem-se a um arquivo que não está no inventário atual.

### Variáveis de ambiente identificadas

| Variável | Uso |
|---|---|
| `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SERVER` | Conexão SQL Server (`db.js`) |
| `PORT` | Porta HTTP; padrão `3000` |
| `ADMIN_SENHA_INICIAL` | Senha provisória para criar o primeiro gerente; fallback no código: `admin123` |
| `PIX_CHAVE` | Chave Pix utilizada para montar payload no recibo |
| `PIX_NOME` | Nome do recebedor; se ausente, o código usa `LOJA_NOME` |
| `PIX_CIDADE` | Cidade do recebedor |
| `LOJA_NOME` | Nome exibido em recibos/orçamentos; usado também como fallback para nome Pix |

O arquivo `backend/.env` existe no repositório. Seu conteúdo não foi lido nem reproduzido aqui. **Recomendação:** não versionar `.env` nem segredos; revisar permissões/valores e rotacionar qualquer segredo que já tenha sido publicado.

### Executar em desenvolvimento

```bash
# Terminal 1 — API
cd backend
npm install
npm run dev

# Terminal 2 — interface
cd frontend
npm install
npm run dev
```

A API usa a porta 3000 por padrão e o cliente do frontend aponta para `http://localhost:3000/api`. Os comandos de build/lint/preview disponíveis no frontend são `npm run build`, `npm run lint` e `npm run preview`. Não há script de teste próprio declarado nos manifests consultados.

## 4. Autenticação e segurança

### Fluxo de sessão

1. `POST /api/auth/login` procura usuário ativo no SQL Server.
2. A senha é verificada por `scrypt`; o banco guarda o formato `scrypt$sal$hash`, não a senha em texto.
3. O backend cria token aleatório de 256 bits; armazena no banco somente seu SHA-256, ligado a usuário e expiração de 12 horas.
4. Nas chamadas protegidas, o frontend envia `Bearer <token>`; o middleware verifica hash, validade da sessão e usuário ativo.
5. `POST /api/auth/logout` apaga a sessão no banco. Token inválido/expirado gera 401; o frontend escuta o evento `sessao-expirada` e limpa o estado local.
6. Cinco falhas de login consecutivas para a combinação IP/login bloqueiam novas tentativas por 15 minutos. O contador está em memória do processo, portanto não é uma trava distribuída/persistente.

O administrador inicial `admin` é criado pelo backend somente se a tabela `Usuarios` estiver vazia. A senha é `ADMIN_SENHA_INICIAL` ou, se não configurada, `admin123`; a troca é obrigatória no primeiro acesso. Senhas novas têm mínimo de 8 caracteres. `sp_AlterarSenha` mantém a sessão que está sendo usada e remove as demais sessões daquele usuário.

### Matriz de permissões implementada

| Área/ação | Operador | Gerente |
|---|---:|---:|
| Ler catálogo de produtos | Sim | Sim |
| Criar/editar/inativar produto, entrada de estoque e ficha | Não | Sim |
| Ler clientes para seleção no PDV | Sim | Sim |
| Criar/editar/inativar cliente e ver histórico | Não | Sim |
| Registrar venda e consultar recibo | Sim | Sim |
| Histórico e cancelamento de vendas | Não | Sim |
| Consultar/abrir/fechar caixa | Sim | Sim |
| Dashboard, análises, despesas, orçamentos, taxas, usuários e auditoria | Não | Sim |
| Ler configurações do negócio | Sim | Sim |
| Alterar configurações do negócio | Não | Sim |

A UI também filtra o menu e bloqueia telas de gerente para operador, mas a regra efetiva é aplicada na API. Operador não recebe `preco_custo` na listagem de produtos.

## 5. Referência da API

Todas as rotas abaixo são montadas sob `/api`. Exceto login, a API aplica autenticação e autorização conforme `server.js`, `authRoutes.js` e `permissoes.js`.

| Método e caminho | Ação | Perfil conforme matriz |
|---|---|---|
| `POST /auth/login` | Inicia sessão | Público |
| `GET /auth/me` | Retorna usuário da sessão | Sessão válida; também permite verificar senha provisória |
| `POST /auth/logout` | Revoga sessão atual | Sessão válida |
| `POST /auth/trocar-senha` | Troca senha própria | Sessão válida; rota permitida antes de cumprir troca obrigatória |
| `GET /produtos` | Catálogo ativo | Qualquer usuário autenticado |
| `POST /produtos` | Cadastra produto | Gerente |
| `PUT /produtos/:id` | Atualiza nome/preços/mínimo/categoria | Gerente |
| `POST /produtos/:id/entrada` | Reposição de estoque | Gerente |
| `DELETE /produtos/:id` | Inativa produto (não apaga) | Gerente |
| `GET /produtos/:id/ficha`, `PUT /produtos/:id/ficha` | Lê/substitui ficha técnica | Gerente |
| `GET /caixa/atual` | Consulta caixa aberto | Qualquer usuário autenticado |
| `POST /caixa/abrir`, `POST /caixa/fechar` | Abre/fecha turno | Qualquer usuário autenticado |
| `POST /vendas` | Registra venda | Qualquer usuário autenticado |
| `GET /vendas/:id/recibo` | Retorna recibo, pagamentos e dados Pix | Qualquer usuário autenticado |
| `GET /vendas` | Histórico de vendas | Gerente |
| `POST /vendas/:id/cancelar` | Cancela venda | Gerente |
| `GET /clientes` | Lista clientes ativos | Qualquer usuário autenticado |
| `POST /clientes`, `PUT /clientes/:id`, `DELETE /clientes/:id`, `GET /clientes/:id/historico` | Gestão/histórico de clientes | Gerente |
| `GET /orcamentos`, `GET /orcamentos/:id`, `POST /orcamentos`, `POST /orcamentos/:id/cancelar` | Gestão de orçamento | Gerente |
| `GET /despesas`, `POST /despesas`, `POST /despesas/:id/pagar` | Contas e despesas | Gerente |
| `GET /dashboard` | Indicadores e contas próximas | Gerente |
| `GET /configuracoes`, `PUT /configuracoes` | Perfil do negócio/onboarding | Leitura: todos; escrita: gerente |
| `GET /taxas`, `PUT /taxas` | Consulta/atualiza taxas | Gerente |
| `GET /analytics/curva-abc?dias=N` | Curva ABC por lucro | Gerente |
| `GET /analytics/estoque-parado?dias=N` | Estoque sem saída | Gerente |
| `GET /analytics/picos?dias=N` | Vendas por dia e hora | Gerente |
| `GET /usuarios`, `POST /usuarios`, `PUT /usuarios/:id` | Administração de usuários | Gerente |
| `GET /auditoria/estoque?dias=N&tipo=ENTRADA\|SAIDA`, `GET /auditoria/erros` | Auditoria de estoque e log de erros | Gerente |

A raiz `GET /` fora do prefixo `/api` retorna uma resposta simples de estado da API. Os controllers validam alguns parâmetros e usam parâmetros SQL tipados; validações definitivas de integridade e processo são feitas também no banco.

## 6. Regras transacionais e dados

### Venda (`sp_RegistrarVenda`)

- A procedure deve ser chamada sem transação SQL externa; ela controla sua própria transação.
- Requer caixa aberto, ao menos um item e um pagamento, JSON válido e quantidades/valores positivos.
- Código de barras precisa apontar para produto ativo; duplicatas de produto nos itens são agregadas.
- Preço de venda vem do banco, nunca do navegador. O custo do item é congelado em `preco_custo_momento`.
- Desconto não pode ser negativo nem maior que o total; soma dos pagamentos deve ser exatamente igual ao total menos desconto.
- A procedure bloqueia/verifica as linhas de estoque com `UPDLOCK, HOLDLOCK`; se faltar saldo, não grava venda parcial.
- Venda, itens, pagamentos, baixa de estoque, histórico e conversão de orçamento são gravados em uma única transação; falha provoca rollback e registro em `Log_Erros`.
- Formas reconhecidas pela constraint SQL: `DINHEIRO`, `PIX`, `CARTAO_DEBITO`, `CARTAO_CREDITO`, `BOLETO`, `OUTROS`. A UI do PDV expõe diretamente apenas as quatro primeiras.

### Produtos e estoque

- Nome é obrigatório; custo, preço de venda, estoque inicial e estoque mínimo não podem ser negativos. Código de barras de produtos ativos é único.
- Sem código de barras informado, a procedure gera código interno de 13 dígitos iniciado por `200` e completado com o ID.
- Cadastro com estoque inicial positivo cria movimento `ENTRADA`; cadastro com saldo zero não grava esse movimento.
- Reposição exige inteiro positivo e produto ativo; motivo padrão do controller: `Reposicao de estoque`.
- Edição atualiza nome, custo, venda, mínimo e categoria, não o saldo. Ajuste de saldo deve ser feito por entrada/venda/estorno.
- Inativação preserva histórico comercial.
- `vw_SugestaoCompra` e a tela de estoque não tratam como item de estoque próprio o produto que tem ficha técnica. A sugestão calcula `estoque_minimo - estoque_atual + 1` quando saldo está no mínimo ou abaixo.

### Ficha técnica

- Ingredientes são produtos ativos; quantidade por ingrediente deve ser inteiro positivo.
- Um produto não pode ser ingrediente de si próprio; o script v4.2 impede receita encadeada (ingrediente com ficha) e impede que ingrediente de outra receita também receba ficha.
- `PUT /produtos/:id/ficha` substitui a receita completa; lista vazia remove a ficha.
- Venda de produto sem ficha baixa o próprio estoque. Venda de produto com ficha baixa as quantidades dos ingredientes conforme unidades da receita multiplicadas pela quantidade vendida, sem baixar o produto fabricado.
- O custo congelado na venda de produto com ficha é a soma da quantidade de ingredientes vezes o custo unitário atual desses ingredientes no momento da venda.

### Caixa, cancelamento e despesas

- Índice filtrado no SQL limita a um caixa aberto por vez; troco inicial não pode ser negativo.
- Fechamento só aceita caixa existente e ainda aberto. Resumo conta pagamentos apenas de vendas concluídas; gaveta esperada = troco inicial + pagamentos em dinheiro registrados. A conciliação apresenta bruto, taxa e líquido por forma de pagamento.
- Cancelamento não se repete, exige venda existente e caixa original ainda aberto. Usa histórico de saídas associado à venda para devolver o estoque exato (incluindo ingredientes da ficha); se não houver histórico, usa os itens da venda como fallback. Registra motivo/status/data e mantém a venda para auditoria.
- Despesa exige descrição e valor maior que zero. Se o parâmetro `pago` for omitido no backend, nasce paga; a tela de Contas a Pagar envia o estado da caixa de seleção. Contas pendentes têm `data_pagamento = NULL`; pagas têm data preenchida. Dar baixa em conta já paga é rejeitado.
- Situações da view de contas: `PAGA`, `ATRASADA`, `VENCE HOJE`, `A VENCER`.

### Orçamentos, taxas e Pix

- Orçamento requer itens de produtos ativos; validade não pode estar no passado e desconto não pode superar o subtotal. Criar orçamento não baixa estoque; preço unitário é congelado na criação.
- A view calcula situação `EXPIRADO` quando orçamento aberto passou da validade. Converter exige status aberto e validade não vencida; conversão salva referência à venda e muda status para `CONVERTIDO`.
- Ao levar um orçamento ao PDV, a tela reconsulta produtos atuais e monta carrinho usando preço e disponibilidade atuais; pode avisar/remover quantidades indisponíveis. O desconto e o ID do orçamento são transportados. Portanto, o preço do orçamento persistido e o valor da venda final podem divergir caso preço ou disponibilidade mudem após a criação.
- Taxas aceitam percentuais de 0 a 100. A taxa vigente é copiada para cada pagamento na criação da venda, preservando histórico; vendas anteriores à implementação mantêm taxa zero. A DRE líquida desconta custo, despesas pagas e taxas dos pagamentos.
- Pix é montado localmente, com valor positivo, moeda BRL, TXID `VENDA{id}`, campos EMV e CRC16-CCITT. A aplicação exibe QR Code/“Copia e Cola” somente para valores pagos em Pix e venda concluída. A UI informa que o QR não confirma recebimento; deve-se conferir o banco.

### Indicadores

- Dashboard lê mês corrente, seis meses de DRE, sugestão de compra, dez movimentos mais recentes e contas atrasadas/que vencem hoje/próximas cinco. Entradas/saídas mostradas no componente Fluxo de Caixa incluem apenas transações mantidas no estado da tela; o fechamento oficial vem da API/SQL.
- DRE agrupa vendas concluídas pelo mês da venda e despesas pagas pelo mês do pagamento. Fórmula atual: faturamento bruto menos descontos, custo congelado dos itens, despesas pagas e taxas congeladas.
- Curva ABC (`fn_CurvaABC`): ordena por lucro observado em itens de vendas concluídas, classe A até a faixa acumulada de 80%, B até 95%, C restante; margem percentual é lucro/receita.
- Estoque parado (`fn_EstoqueParado`): produtos ativos com saldo positivo, sem ficha e sem saída válida na janela; considera data de cadastro se não houver saída; capital parado = saldo × custo atual.
- Picos (`fn_PicoVendas`): quantidade e faturamento por dia da semana/hora, somente vendas concluídas; dia 0 = segunda-feira.
- Janela analítica aceita 1–730 dias; valor inválido cai no padrão (90 para ABC/picos, 30 para estoque parado). Vendas canceladas são excluídas dos indicadores financeiros.

## 7. Modelo de dados resumido

| Tabela / conjunto | Papel |
|---|---|
| `Produtos`, `Categorias`, `Marcas` | Catálogo, classificação, preço, saldo e ativo/inativo |
| `Vendas`, `ItensVenda`, `PagamentosVenda` | Venda, itens, preço/custo congelados e formas de recebimento |
| `Controle_Caixa` | Turnos, troco inicial, datas e status aberto/fechado |
| `Historico_Movimentacao_Estoque` | Entradas/saídas, saldo resultante, motivo, usuário e venda de origem |
| `Clientes` | Dados de contato/documento e ativo; histórico de compras é derivado das vendas |
| `Orcamentos`, `ItensOrcamento` | Propostas, preços da criação, validade, status e venda convertida |
| `FichaTecnica` | Relação produto fabricado/ingrediente e consumo inteiro por unidade |
| `Despesas` | Contas pendentes/pagas, vencimento, pagamento e valor |
| `TaxasPagamento` | Taxa vigente por forma; pagamentos preservam a taxa aplicada |
| `Configuracoes` | Perfil `VAREJO`/`ALIMENTACAO` e conclusão do onboarding |
| `Usuarios`, `Sessoes` | Contas, hash de senha, perfil, sessão por hash de token e expiração |
| `Log_Erros` | Erros das procedures, códigos, origem, mensagem e dados de contexto |

Views centrais incluem `vw_CatalogoProdutos`, `vw_SugestaoCompra`, `vw_FechamentoCaixa`, `vw_ConciliacaoCaixa`, `vw_RelatorioMensal_DRE`, `vw_ContasPagar`, `vw_HistoricoVendas`, `vw_Orcamentos`, `vw_AuditoriaEstoque` e `vw_ErrosRecentes`.

## 8. Tratamento de erros

`backend/src/utils/erroHttp.js` converte erros SQL com número `50000–50999` em HTTP 400, retornando texto amigável e código. Outros erros tratados por `responderErro` viram HTTP 500 com mensagem genérica; detalhes técnicos ficam no console. Nem todos os controllers usam a mesma função de tratamento, portanto mensagens/status podem variar por rota. Procedures base usam `THROW`, rollback quando a transação é própria e tentam gravar contexto em `Log_Erros`.

## 9. Pontos de atenção e divergências observadas

1. `docs/documentacao-tecnica.md` e `docs/manual_sql.md` têm trechos da versão antiga: a documentação técnica afirma que login é local/fixo, mas o código atual usa `/api/auth/login`, SQL `Usuarios/Sessoes`, token Bearer e permissões. Atualizar esses textos para evitar orientação errada.
2. A raiz e scripts têm várias versões; aplicar etapas na ordem indicada é necessário para que controllers que usam objetos das versões posteriores funcionem.
3. `backend/.env` está presente no inventário do repositório; segredos devem ser removidos do versionamento e rotacionados quando necessário. Configuração SQL usa `encrypt: false` e `trustServerCertificate: true`, adequada apenas a ambiente controlado/local, não como recomendação automática de produção.
4. Frontend aponta diretamente a `localhost:3000/api`; não há configuração de URL por ambiente no código consultado. `cors()` está configurado sem allowlist explícita.
5. O cancelamento v4.4 corrige o estorno para usar os movimentos ligados à venda (inclui ingredientes); procedimentos mais antigos v4.0/v4.1 não tinham a mesma semântica para ficha técnica. Usar migração v4.4.
6. Payload Pix é gerado, mas não há confirmação de liquidação via banco. O próprio recibo instrui conferir o pagamento no aplicativo bancário.
7. O frontend tem telas concentradas em arquivos JSX e manifestos sem suíte de testes declarada; mudanças em regras transacionais devem ser verificadas também no SQL Server e com testes de integração.
8. Scripts SQL têm validação de domínio, mas alguns campos/parâmetros são verificados em camadas diferentes; em implantação, validar requests tanto no backend quanto nas procedures.
9. Não foi possível confirmar por leitura de código se todas as validações documentadas em `docs/documentacao-tecnica.md` correspondem exatamente às procedures vigentes; para regras acima, a fonte usada foram os scripts versionados e controllers lidos.

## 10. Arquivos de referência

- Backend: `backend/src/server.js`, `backend/src/routes/`, `backend/src/controllers/`, `backend/src/middleware/`, `backend/src/utils/`.
- Frontend: `frontend/src/App.jsx`, `frontend/src/comum.jsx`, `frontend/src/telas/`.
- Banco: `database/estrutura.banco.ERP_v4.0.sql`, `database/ERP_CORE_etapa1_v4.1.sql` até `ERP_CORE_etapa4_v4.4.sql`.
- Analytics: `analytics/01_funcoes_analiticas.sql` e `analytics/readme.md`.
- Processos descritos para usuários: `docs/documentacao-funcional.md`.
