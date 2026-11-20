# Relatório de testes – ERP-CORE (20/11/2026)

Roteiro executado: `docs/ROTEIRO_DE_TESTES_CLAUDE_CODE.md`, na ordem, das 09h50 às 11h40.
Ambiente: Node v24.14.0, SQL Server local, backend em `localhost:3000`, frontend em `localhost:5173`, navegador Chrome (extensão Claude in Chrome).

## Resumo

- **Banco:** OK. 81 de 81 verificações (2 avisos explicados abaixo). Na **primeira** execução houve 7 falhas porque as migrações tinham sido rodadas fora de ordem. O usuário reaplicou as etapas na ordem correta e o banco ficou OK (ver falha #3).
- **API:** 131 de 131 testes passaram (código de saída 0). Na primeira tentativa o teste nem começou porque o `TESTE_ADMIN_SENHA` do `.env` estava desatualizado (ver falha #4).
- **Telas:** 26 de 30 itens OK. Além desses: 1 falha (celular), 2 parciais (taxa no fechamento; rótulos por nicho) e 1 não testado (abrir caixa).
- **Cenários das personas:** OK nos dois, com problemas de usabilidade no do depósito (quantidade, código de barras, carrinho que se perde).

### Avisos do `verifica_banco.js`
- *Vendas com pagamentos diferentes do total: 1.* É uma venda antiga, anterior à v4.0. É por causa dela que o faturamento do turno #1 (R$ 4.809,70) fica R$ 2.000,00 abaixo da DRE do mês (R$ 6.809,70). Não é efeito dos testes.
- *Sessões vencidas acumuladas: 0.* Aviso só informativo.

### Detalhe das telas (30 itens)
| Bloco | OK | Observação |
|---|---|---|
| 4.1 Login e sessão | 4/4 | Senha errada com mensagem genérica; sair apaga o token; o "voltar" do navegador não reabre o sistema; apagar o token e recarregar volta ao login. |
| 4.2 Operador | 4/4 | Troca de senha obrigatória; menu só com PDV e Fluxo de Caixa; endereço digitado cai no PDV; a API devolve 403 nas rotas do gerente e `/produtos` vem sem `preco_custo`. |
| 4.3 PDV | 6/7 | Abrir caixa **não testado** (havia caixa real aberto; o segundo caixa foi testado pela API). Código de barras, bloqueio de produto sem estoque (lista e leitor), receita não bloqueada, centavos (30,10 + 0,20 = 30,30), troco, Pix com CRC válido e WhatsApp: OK. |
| 4.4 Telas do gerente | 9/11 | Taxas: a taxa de 3,5% foi gravada na venda (R$ 1,05) e aparece na DRE e na conciliação, mas o fechamento do caixa não foi feito (**parcial**). Perfil do negócio: troca o menu, mas não os rótulos (**parcial**). |
| 4.5 Qualidade visual | 3/4 | 1366×768 OK; **celular (390 px) falhou**; nenhum "undefined", "NaN" ou "null"; R$ e datas no formato certo; erros da API aparecem na tela. |

## Falhas (da mais grave para a menos grave)

| # | Onde | O que aconteceu | Esperado | Causa provável (sistema/teste) | Arquivo e linha | Correção sugerida |
|---|---|---|---|---|---|---|
| 1 | Todas as telas no celular (390 px) | O menu lateral fixo ocupa 220 px; sobram ~155 px para o PDV, com 5 botões cortados ou minúsculos | Usável no celular, sem rolagem horizontal | **Sistema.** Não há CSS responsivo (o `App.css`, que tem `@media`, é sobra do modelo do Vite e não é importado) | `frontend/src/App.jsx:41` (aside `width: 220`) | Abaixo de ~768 px, recolher o menu (botão "☰" ou barra inferior) e empilhar as colunas do PDV |
| 2 | Limpeza dos testes | `node tests/limpar_testes.js` falhava sempre com `Invalid object name '#tp'`; nada era apagado | Listar e apagar só os dados ZZTESTE | **Teste.** `request.query()` roda em `sp_executesql` e as tabelas `#temp` somem ao fim de cada chamada (confirmado com um experimento) | `backend/tests/limpar_testes.js:24` | **Já corrigido com aprovação:** `req.query` trocado por `req.batch` |
| 3 | Banco (passo 2) | 7 objetos na versão 4.0: `sp_RegistrarVenda`, `sp_EntradaEstoque`, `sp_SalvarProduto`, `vw_RelatorioMensal_DRE`, `vw_CatalogoProdutos` (detectados) e `vw_SugestaoCompra`, `vw_FechamentoCaixa` (não detectados) | Todos na última versão | **Ambiente.** Às 09:31 o `estrutura.banco.ERP_v4.0.sql` rodou **depois** da etapa 4 e o `CREATE OR ALTER` sobrescreveu as versões novas | `database/estrutura.banco.ERP_v4.0.sql` (linhas 248, 398, 447, 651, 691) | **Resolvido:** etapas 1→2→3→analytics→4 reaplicadas. Sugestão: no topo do script v4.0, avisar ou abortar se a tabela `Usuarios` já existir |
| 4 | Teste de API (passo 3) | Login do gerente devolveu 401 e o teste parou com código 2 | Login OK | **Teste/configuração.** `TESTE_ADMIN_SENHA` do `.env` não era a senha atual do `admin` | `backend/.env` | **Resolvido pelo usuário.** Sugestão: incluir no roteiro "atualize o `.env` sempre que trocar a senha do gerente" |
| 5 | PDV: quantidade | A quantidade só muda pelos botões − e +; vender 100 tijolos exige 99 cliques | Poder digitar a quantidade | **Sistema** (usabilidade) | `frontend/src/telas/PDV.jsx:254-256` | Trocar o `<b>` por um `<input type="number">` que respeite o estoque |
| 6 | Cadastrar Produto | Não existe campo de código de barras; o sistema gera um interno (`200`+id), que nem aparece na tela de Estoque | Informar o EAN do fabricante e ver o código | **Sistema** (a procedure aceita `@codigo_barras`, só o formulário não envia) | `frontend/src/App.jsx:492` (estado do formulário); `backend/src/controllers/produtoController.js:30` já aceita | Adicionar o campo opcional "Código de barras" no cadastro e na edição e mostrar a coluna no Estoque |
| 7 | Fluxo de Caixa | Os cartões Entradas, Saídas e Saldo mostram "vendas desde que a página abriu" e zeram ao recarregar, mesmo com o turno #1 cheio de vendas | Totais reais do turno | **Sistema** (os totais vêm do estado do React, não do banco) | `frontend/src/App.jsx:417` (`FluxoCaixa`, linha 294) | Buscar os totais em `vw_FechamentoCaixa` pelo turno aberto |
| 8 | PDV: aviso de pagamento | Depois de "Faltam R$ 0,10…", corrigir o pagamento não apaga o aviso vermelho (ele fica junto com "Troco: R$ 0,80") | O aviso some quando o valor fecha | **Sistema** (o erro só é limpo ao finalizar ou ao mexer no carrinho) | `frontend/src/telas/PDV.jsx:114` | Chamar `setErro("")` ao alterar `recebido` ou `desconto` |
| 9 | Estoque: produtos com receita | Bolo e Torta aparecem com custo R$ 0,00; a receita custa R$ 7,00 (a venda grava o custo certo) | Mostrar o custo da receita | **Sistema** (exibição: a view devolve `preco_custo` do produto, que é 0) | `frontend/src/telas/Estoque.jsx:103`; `vw_CatalogoProdutos` (etapa2, linha 137) | Expor `custo_receita` na view (soma da ficha) e exibir quando `tem_ficha = 1` |
| 10 | Perfil do negócio | Trocar para Alimentação só acrescenta "Ficha Técnica" no menu; nenhum rótulo muda | O roteiro pede menu **e** rótulos por nicho | **Sistema** (só o menu considera o nicho) | `frontend/src/App.jsx:28` | Definir rótulos por nicho (ex.: "Produto" → "Item do cardápio", "Cadastrar Produto" → "Cadastrar item/receita") |
| 11 | Troca obrigatória de senha | Tela com fonte serifada (Times), diferente do resto do sistema | Fonte Inter, como no resto | **Sistema** (o contêiner não define `fontFamily`) | `frontend/src/App.jsx:737` | Pôr `fontFamily: "'Inter', 'Segoe UI', sans-serif"` no `div` |
| 12 | Mensagens de erro vindas do banco | Textos sem acento na tela e na Auditoria: "Descricao da conta e obrigatoria", "Orcamento vencido", "nao" | Português correto | **Sistema** | ex.: `database/ERP_CORE_etapa1_v4.1.sql:194` e demais `THROW` | Reescrever as mensagens com acento (já são `N'...'`, então o Unicode funciona) |
| 13 | Análises | Percentuais com ponto: "50.0%", "68.6%" | Vírgula: "50,0%" | **Sistema** | `frontend/src/telas/Analises.jsx:119-120` | Usar `toLocaleString('pt-BR', { maximumFractionDigits: 1 })` |
| 14 | Verificação do banco | Não detecta `vw_SugestaoCompra` e `vw_FechamentoCaixa` antigas (aconteceu neste teste) | Detectar qualquer objeto antigo | **Teste** (lacuna de cobertura) | `backend/tests/verifica_banco.js:69-77` | Incluir checagens: `vw_SugestaoCompra` contém `FichaTecnica`; `vw_FechamentoCaixa` contém `valor_taxa` |

## Pontos de melhoria (não são bugs)

- **O carrinho do PDV se perde ao trocar de tela.** Se o operador olhar o Fluxo de Caixa no meio de uma venda, perde o que já tinha passado. Sugestão: guardar o carrinho no `App` ou no `sessionStorage`.
- **Fechar o caixa usa `window.confirm`** (assim como Inativar, Dar baixa, Remover cliente e Cancelar orçamento). Funciona, mas destoa do resto, que usa janelas próprias.
- **O operador recebe a lista completa de clientes** (`GET /api/clientes` = 200), com CPF e total gasto. Para o PDV bastariam nome e WhatsApp.
- **Duas marcas na tela:** o menu e a aba dizem "LogiFlow"; o recibo, o WhatsApp e o onboarding dizem "ERP-CORE".
- **Mensagem do leitor para produto sem estoque:** "Só há 0 un. de …" poderia ser "Produto sem estoque".
- **O motivo do cancelamento de venda é opcional.** Para auditoria, convém exigir.
- **O WhatsApp do recibo de venda já paga em Pix diz "Pague R$ … com Pix".** Pode confundir o cliente que já pagou.
- **As taxas `BOLETO` e `OUTROS` existem no banco**, mas não aparecem em Configurações nem no PDV.
- **Sobra a chave `lf_logado` no `localStorage`**, de uma versão antiga. Não é usada.
- **O nome e o perfil do usuário aparecem no rodapé do menu, não no topo.** Funciona, mas é menos visível.

## O que NÃO foi testado e por quê

- **Abrir caixa com troco e fechar caixa com resumo (4.3, 4.4 Taxas, cenário do Seu Auricélio).** Havia um caixa real aberto (turno #1) e a regra 6 do roteiro proíbe fechá-lo. O resumo do fechamento foi conferido pelas views `vw_FechamentoCaixa` e `vw_ConciliacaoCaixa`, só com leitura: crédito 867,60 + dinheiro 789,10 + Pix 3.153,00 = R$ 4.809,70; taxas R$ 1,85; dinheiro físico R$ 889,10. A recusa de um segundo caixa foi testada pela API.
- **Layout no celular dentro do navegador real.** A janela do Chrome não aceitou o redimensionamento. Os 390 px foram medidos com o sistema dentro de um iframe dessa largura (há captura).
- **Envio real pelo WhatsApp.** Por segurança, nenhuma mensagem foi enviada. Os links `wa.me` e o texto foram conferidos interceptando a abertura da janela.
- **Copiar o Pix para a área de transferência.** O botão mostrou "✔ Copiado!", mas o conteúdo da área de transferência não foi lido. O código Pix foi validado (CRC16 correto, valor e txid certos).
- **O login do gerente pela tela** foi feito pelo próprio usuário, que digitou a senha, como pede o roteiro.

## Limpeza feita (sim/não) e estado final do banco

**Sim.** A simulação listou 102 linhas. Antes de apagar, confirmei que nenhuma venda ou orçamento misturava produto real com produto de teste. Com o ok do usuário rodei `node tests/limpar_testes.js --confirmar --limpar-log`: **148 linhas apagadas** (9 vendas, 5 orçamentos, 11 produtos, 1 categoria, 2 clientes, 5 despesas, 2 usuários, 31 movimentos de estoque, 46 registros de log e os itens ligados a eles).

Estado final, pelo `node tests/verifica_banco.js`: **81 de 81 ok, 0 falhas, sem sobras de ZZTESTE**, perfil do negócio em VAREJO, as 6 taxas com os valores originais (0%), caixa #1 ainda aberto (intocado) e gerente ativo.

Única alteração em arquivo do projeto: `backend/tests/limpar_testes.js:24` (correção da falha #2, aprovada pelo usuário).

---

**Está pronto para a banca?** Sim, desde que a demonstração seja feita no computador. As contas fecham: o PDV calcula centavos e troco sem erro, o Pix gera um código válido, a ficha técnica baixa os ingredientes certos e a DRE e o caixa batem com cada venda feita nos testes. As permissões do operador estão protegidas também no servidor. Os pontos fracos aparecem no uso do dia a dia de um comércio, e as 3 correções mais prioritárias são:

1. Deixar as telas utilizáveis no celular.
2. Permitir digitar a quantidade no PDV e informar o código de barras no cadastro.
3. Fazer o Fluxo de Caixa mostrar os totais reais do turno, em vez de zerar a cada recarga.
