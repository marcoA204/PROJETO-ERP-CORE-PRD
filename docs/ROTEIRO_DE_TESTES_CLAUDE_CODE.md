# Roteiro de testes do ERP-CORE (para o Claude Code executar no VS Code)

Você é o testador do ERP-CORE. Execute este roteiro **na ordem**, registre o resultado de cada passo e, no fim, entregue o relatório no formato da seção 7. Responda sempre em português.

## 0. Regras de segurança (valem o tempo todo)

1. **Só mexa em dados de teste**: tudo que você criar deve começar com `ZZTESTE` (produtos, categorias, clientes, despesas) ou `zzteste_` (logins). Nunca altere nem apague dados reais.
2. **Nunca troque a senha do gerente real** e nunca imprima o conteúdo do `.env`, senhas, tokens ou hashes no relatório.
3. **Não rode** `ERP_CORE_00_reset_dev.sql`, `DROP`, `TRUNCATE` nem `DELETE` fora do `limpar_testes.js`.
4. **Pergunte antes** de qualquer ação destrutiva ou que não esteja neste roteiro.
5. **Não corrija o código sem pedir.** Se um teste falhar, primeiro diga se o erro está no **sistema** ou no **próprio teste** (ex.: nome de campo diferente), mostre a evidência e proponha a correção. Só altere arquivos depois que o usuário aprovar.
6. Se já houver um caixa real aberto, o teste usa esse caixa e **não o fecha**.

## 1. Pré-requisitos (verifique, não assuma)

- [ ] Node 18 ou mais novo: `node -v`
- [ ] Banco com as migrações aplicadas na ordem: estrutura v4.0 → etapa1 v4.1 → etapa2 v4.2 → etapa3 v4.3 → `analytics/01_funcoes_analiticas.sql` → etapa4 v4.4. (O passo 2 confirma isso.) Para reaplicar, use `database/00_aplicar_todas_na_ordem.sql` (Modo SQLCMD), que roda tudo na ordem; **nunca rode o v4.0 sozinho depois das etapas** (ele agora se pula sozinho se o banco já estiver na 4.4).
- [ ] `backend/.env` com as variáveis do banco e, para os testes, `TESTE_ADMIN_SENHA=<senha atual do gerente>` (e `TESTE_ADMIN_LOGIN` se não for `admin`). **Se faltar `TESTE_ADMIN_SENHA`, peça ao usuário para adicionar** — não invente nem procure a senha. **Sempre que a senha do gerente for trocada (inclusive a provisória do primeiro acesso), atualize `TESTE_ADMIN_SENHA`**; se ela estiver errada o passo 3 para com código 2 ("Usuário ou senha incorretos").
- [ ] Backend rodando em outro terminal: `cd backend && npm run dev` (porta 3000)
- [ ] Frontend rodando: `cd frontend && npm run dev` (porta 5173, para a parte de telas)
- [ ] O gerente já trocou a senha provisória (se não, peça ao usuário para entrar no sistema e trocar).

Se algum item faltar, **pare e avise o usuário** com o que falta.

## 2. Verificação do banco (somente leitura)

```
cd backend
node tests/verifica_banco.js
```

Confere tabelas, views, procedures, funções, colunas e a coerência dos dados (sem estoque negativo, no máximo 1 caixa aberto, gerente ativo, 6 taxas, hashes scrypt, sobras de teste).

- **Esperado:** nenhum `✗`. Avisos `!` devem ser explicados no relatório.
- Se faltar objeto, diga qual script de migração falta rodar. **Não rode SQL sozinho.**

## 3. Testes de integração da API

```
cd backend
node tests/teste_integracao.js
```

São ~140 verificações em 15 grupos: login e bloqueio, usuários e troca de senha, matriz de permissões do operador, produtos e estoque, caixa, vendas (Pix, misto, taxas, erros), cancelamento, ficha técnica, clientes, orçamentos, contas a pagar, dashboard/DRE/análises, fechamento de caixa e conciliação, e sessões.

- **Esperado:** `N testes: N passaram, 0 falharam`, código de saída 0.
- O relatório fica em `backend/tests/relatorio_ultimo_teste.json`.
- Taxas e perfil do negócio são restaurados ao final automaticamente.
- Código de saída `2` = o teste nem começou (backend fora do ar ou falta `TESTE_ADMIN_SENHA`).

**Para cada falha:** leia o controller/procedure relacionado, classifique como `BUG DO SISTEMA` ou `AJUSTE NO TESTE` e mostre a evidência (linha do código, resposta da API). Reexecute só depois de aprovado.

## 4. Testes de tela (navegador em http://localhost:5173)

Use o navegador disponível (Claude in Chrome ou o navegador embutido). Antes, crie os dados com o passo 3 **e não limpe ainda** (ou cadastre pela própria tela). Entre com o gerente; se a tela de login pedir a senha, **peça ao usuário** (não use a do `.env` em campo de texto visível sem necessidade).

Para cada item: execute, tire uma captura quando houver erro e leia o console (`read_console_messages`) procurando erros em vermelho.

### 4.1 Login e sessão
- [ ] Senha errada mostra mensagem clara, sem travar a tela
- [ ] Login do gerente entra e mostra o nome e o perfil no topo
- [ ] Sair volta para o login; voltar no navegador não reabre o sistema
- [ ] Apagar o token (`localStorage`) e recarregar volta ao login

### 4.2 Operador (crie `zzteste_oper` pela tela Usuários, entre com ele)
- [ ] Obriga a trocar a senha provisória antes de qualquer coisa
- [ ] Menu mostra só PDV (e o que a matriz permite); Dashboard, Usuários, Auditoria, Taxas **não aparecem**
- [ ] Digitar a URL/estado de uma tela restrita não abre dados (mostra aviso ou volta)
- [ ] Nenhuma tela do operador exibe **preço de custo** nem lucro

### 4.3 PDV (como operador)
- [ ] Abrir caixa com troco; segundo caixa é recusado
- [ ] Leitor/busca por código de barras de `ZZTESTE Produto A` adiciona ao carrinho
- [ ] Produto sem estoque aparece bloqueado; produto com receita (bolo) **não** aparece bloqueado
- [ ] Desconto, pagamento misto (dinheiro + crédito) e troco calculados em centavos, sem erro de arredondamento (ex.: R$ 0,10 + R$ 0,20)
- [ ] Finalizar com PIX mostra o recibo com QR Code e o "copia e cola"; botão copiar funciona
- [ ] Botão WhatsApp abre `wa.me/55...` com o texto do recibo (cliente com WhatsApp)
- [ ] Venda com soma de pagamentos diferente do total é bloqueada na tela, com mensagem

### 4.4 Telas do gerente
- [ ] **Estoque:** cadastrar, editar, repor, inativar; busca; alerta de estoque mínimo
- [ ] **Ficha técnica:** montar receita; custo calculado confere com a soma dos ingredientes
- [ ] **Clientes:** cadastrar, editar, histórico de compras e total gasto
- [ ] **Orçamentos:** criar, converter em venda no PDV, cancelar; vencido aparece como expirado
- [ ] **Contas a pagar:** atrasada em vermelho, vence hoje, a vencer; dar baixa
- [ ] **Vendas:** histórico, ver recibo, cancelar com motivo (estoque volta)
- [ ] **Dashboard:** cartões, DRE, alertas, contas; valores batem com o que o teste da API criou
- [ ] **Análises:** curva ABC, estoque parado, picos; trocar a janela de dias atualiza
- [ ] **Taxas:** editar % de crédito; vender no cartão e conferir a taxa no fechamento
- [ ] **Usuários / Auditoria:** criar, desativar, redefinir senha; filtros de estoque e log de erros
- [ ] **Perfil do negócio (Onboarding):** troca o menu e os rótulos conforme o nicho (depósito x confeitaria)

### 4.5 Qualidade visual e usabilidade
- [ ] Tela de 1366×768 e de celular (≈390 px): sem rolagem horizontal, botões clicáveis
- [ ] Estados vazios com texto amigável (sem "undefined", "NaN" ou "null" na tela)
- [ ] Valores em R$ com vírgula e 2 casas; datas em dd/mm/aaaa
- [ ] Erros da API aparecem como mensagem na tela, não só no console

## 5. Cenários das personas (fluxo ponta a ponta)

**Seu Auricélio (depósito):** cadastrar 3 produtos com código de barras → repor estoque → vender em PIX + dinheiro com desconto → cancelar uma venda → conferir que o estoque, o caixa e a DRE batem → fechar o caixa e ver o resumo.

**Tatiana (confeitaria):** perfil ALIMENTACAO → cadastrar ingredientes → montar a receita de um bolo → criar orçamento para uma cliente → converter em venda → conferir que baixou **ingredientes** e o custo da venda é o custo da receita → mandar o recibo por WhatsApp.

Registre se cada cenário funcionou sem o usuário precisar de nenhum conhecimento técnico, e onde ele ficaria confuso.

## 6. Limpeza

1. Simule primeiro: `node tests/limpar_testes.js` (lista o que seria apagado, não apaga nada)
2. Mostre a lista ao usuário e **só com o ok dele** rode: `node tests/limpar_testes.js --confirmar --limpar-log`
3. Rode de novo `node tests/verifica_banco.js` e confirme que não sobrou `ZZTESTE`.

## 7. Relatório final (entregue assim)

Salve em `docs/RELATORIO_DE_TESTES_<data>.md`:

```
# Relatório de testes – ERP-CORE (data)
## Resumo
- Banco: OK / n problemas
- API: X de Y testes passaram
- Telas: X de Y itens OK
- Cenários das personas: OK / problemas
## Falhas (da mais grave para a menos grave)
| # | Onde | O que aconteceu | Esperado | Causa provável (sistema/teste) | Arquivo e linha | Correção sugerida |
## Pontos de melhoria (não são bugs)
## O que NÃO foi testado e por quê
## Limpeza feita (sim/não) e estado final do banco
```

Termine com um parágrafo curto, em linguagem simples, dizendo se o sistema está pronto para a banca/demonstração e quais 3 correções têm mais prioridade.