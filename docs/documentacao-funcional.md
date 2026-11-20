# Manual funcional — LogiFlow / ERP CORE

> **Para quem é:** gerentes/proprietários e operadores de caixa. Este manual descreve o uso funcional que aparece na interface e as regras implementadas no repositório. Regras específicas podem variar na operação real; validar exceções e procedimentos internos com a equipe.

## 1. Para que serve

O LogiFlow apoia a rotina de pequenos negócios que vendem produtos prontos ou fabricam itens de alimentação. Reúne venda, caixa, estoque, clientes, orçamentos, contas e indicadores gerenciais em uma interface web.

Na primeira utilização, o gerente escolhe o perfil do negócio:

- **Varejo / Depósito:** catálogo, estoque e reposição, PDV, Pix, orçamentos e contas.
- **Alimentação / Confeitaria:** inclui ficha técnica e baixa automática dos ingredientes vendidos.

## 2. Perfis e acesso

### Gerente / Proprietário

Tem acesso às áreas gerenciais e operacionais: dashboard, análises, PDV, orçamentos, vendas, clientes, estoque, ficha técnica quando habilitada, contas a pagar, fluxo de caixa, cadastro de produto, usuários, auditoria e configurações/taxas.

Pode cadastrar e editar produtos/clientes, configurar taxas, cadastrar usuários, consultar relatórios e cancelar vendas dentro das condições do sistema.

### Operador de caixa

Acesso operacional restrito a **PDV** e **Fluxo de Caixa**. Pode consultar produtos e clientes para associá-los à venda, registrar vendas, consultar recibos e abrir/fechar o caixa. Não pode acessar histórico/cancelamento de vendas, custos dos produtos, cadastro/edição de produtos, despesas, orçamento, relatórios, usuários ou auditoria.

A restrição é aplicada no backend, além de a interface ocultar as demais telas.

## 3. Rotina de primeiro acesso

1. O sistema cria o usuário gerente inicial quando a tabela `Usuarios` ainda não tem usuários.
2. O gerente entra com a senha provisória configurada pelo administrador do ambiente.
3. Se a conta estiver marcada para troca obrigatória, a senha pessoal deve ser definida antes de seguir.
4. O gerente escolhe `VAREJO` ou `ALIMENTACAO` no onboarding.
5. O sistema carrega o catálogo e consulta se há caixa aberto.
6. O gerente pode cadastrar operadores e outros gerentes na tela **Usuários**.

Senhas têm mínimo de oito caracteres. Login é único e só admite letras minúsculas, números, ponto, hífen e sublinhado, com no mínimo três caracteres.

## 4. Processos por tela

### Dashboard

Mostra a situação gerencial do mês corrente:

- entradas/faturamento de vendas concluídas;
- saídas: custo de produtos, despesas pagas e taxas;
- saldo/lucro líquido;
- produtos abaixo ou no estoque mínimo e sugestão de compra;
- contas atrasadas, que vencem hoje e próximas a vencer;
- DRE dos seis meses mais recentes;
- últimas movimentações, incluindo vendas concluídas e despesas pagas.

Vendas canceladas não entram no faturamento da DRE. Despesas entram na DRE quando pagas, no mês do pagamento.

### Produtos e estoque

**Cadastrar produto:** o gerente informa nome, categoria, saldo inicial, estoque mínimo, custo e preço de venda. Código de barras e marca podem ser fornecidos pela API, embora o formulário principal de cadastro apresente nome, categoria, estoque e preços. Se não houver código de barras, o banco gera código interno.

**Consultar/editar estoque:** a tela Estoque permite buscar por nome/categoria, ver saldo/mínimo/custo/preço e:

- **Repor:** registrar entrada inteira positiva, com motivo opcional (por exemplo, fornecedor/nota fiscal);
- **Editar:** nome, categoria, custo, preço e estoque mínimo;
- **Inativar:** retira o produto do catálogo operacional/PDV, sem apagar vendas passadas.

Edição não altera quantidade atual. Para alterar saldo use reposição, venda ou estorno. O alerta de reposição aparece quando saldo é menor ou igual ao mínimo; o cálculo de compra é `mínimo - saldo + 1`.

### Ficha Técnica — somente negócio de Alimentação

No menu habilitado para o perfil `ALIMENTACAO`, o gerente define a receita por unidade de produto fabricado:

1. Escolhe um produto fabricado.
2. Adiciona ingredientes cadastrados como produtos e a quantidade inteira usada em uma unidade.
3. Confere o custo calculado da receita e a margem estimada (preço de venda menos custo dos ingredientes).
4. Salva a ficha; a gravação substitui a composição anterior. Salvar sem ingredientes remove a ficha.

Produto com ficha não mantém estoque próprio para a venda. Ao vender, o sistema baixa os ingredientes. Ingredientes precisam ser produtos ativos, não podem ter outra ficha e a receita não pode ser circular/encadeada conforme as validações do banco.

### PDV — Frente de Caixa

1. Abra o caixa pelo **Fluxo de Caixa**; sem caixa aberto, o PDV impede iniciar venda e oferece navegação para essa tela.
2. Busque produto por nome/código ou use leitor de código de barras e Enter.
3. Adicione itens, ajuste quantidades ou remova linhas. Produto acabado com ficha é identificado como “feito sob encomenda”; os demais respeitam saldo disponível.
4. Se desejar, associe cliente ou inicie a venda a partir de orçamento.
5. Informe desconto em reais; o valor é limitado no cálculo da tela ao subtotal.
6. Informe recebimento em dinheiro, Pix, débito ou crédito. É possível dividir entre formas de pagamento.
7. Finalize quando o carrinho tiver item, total for positivo e recebimentos cobrirem exatamente o total. Se o recebimento exceder a venda, o troco só pode ser devolvido a partir da parcela em dinheiro.
8. A API grava a venda e o banco valida novamente caixa, itens, estoque, desconto e pagamentos em transação.
9. O recibo apresenta itens, desconto, total e pagamentos. Pode gerar QR/Copia e Cola para a parte paga em Pix e abrir resumo no WhatsApp.

O QR Pix não atesta que o cliente pagou: conferir a liquidação no aplicativo bancário antes de liberar o produto.

**Pagamentos disponíveis:** a interface do PDV mostra dinheiro, Pix, débito e crédito. O banco também reconhece boleto e outros, mas essas opções não estão expostas no formulário de PDV atual.

### Caixa / Fluxo de Caixa

**Abrir turno:** informe troco inicial não negativo e use Abrir Caixa. Só pode haver um caixa aberto por vez.

**Durante o turno:** as vendas são feitas no PDV. O gerente também pode lançar nesta tela uma despesa paga imediatamente, com descrição e valor positivo; contas com vencimento futuro devem ser lançadas em Contas a Pagar. Operador não tem acesso ao lançamento de despesa.

**Fechar turno:** confirme o fechamento. O sistema não permite fechar novamente o mesmo caixa. O resumo apresenta faturamento de vendas concluídas, troco inicial, valor esperado em dinheiro e conciliação por forma de pagamento (bruto, taxa e líquido). Após sucesso, a tela perde o ID do caixa aberto e permite iniciar novo turno.

A gaveta esperada é o troco inicial mais os pagamentos em dinheiro efetivamente registrados (após o troco devolvido pelo PDV). Pagamentos eletrônicos não devem ser considerados dinheiro físico.

### Vendas / histórico — gerente

A tela lista as últimas 100 vendas, com número, data, cliente, turno, itens, valor líquido e status. O gerente pode abrir o recibo e solicitar cancelamento de venda concluída.

- Motivo de cancelamento é opcional.
- O estoque correspondente é devolvido e o histórico registra o estorno.
- Venda cancelada deixa de contar em relatórios financeiros e caixa.
- **Limite operacional:** só se cancela enquanto o caixa original da venda permanece aberto. Venda de turno fechado precisa de processo fora da aplicação/decisão administrativa; não se deve alterar dados diretamente sem avaliar conciliação e trilha de auditoria.

### Clientes

O gerente pode cadastrar, editar, localizar por nome/WhatsApp/documento e inativar clientes. Nome é obrigatório; WhatsApp e CPF/CNPJ são normalizados para dígitos e, se informados, precisam respeitar formato/tamanho aceito no banco. Documento ativo não pode duplicar.

A inativação não apaga o histórico. A tela mostra compras concluídas, total gasto e última compra; o histórico detalhado traz até 30 vendas recentes, inclusive indicação de canceladas. Cliente é opcional no PDV e em orçamento.

### Orçamentos

1. Crie proposta com itens, quantidade, cliente opcional, validade, desconto e observações.
2. O preço usado é o vigente na criação e fica registrado nos itens.
3. Consulte detalhe e envie resumo por WhatsApp; sem número, o WhatsApp permite escolher contato.
4. Quando o cliente aprovar, use **Levar para o PDV**; a aplicação carrega itens, cliente, desconto e referência do orçamento.
5. Revise estoque e preços atuais no carrinho e finalize a venda normalmente.

Orçamento não reserva nem baixa estoque. Ao levar para o PDV, o código usa catálogo/preço de hoje e pode alertar/remover quantidade que não está disponível. O banco impede converter orçamento cancelado, já convertido ou vencido; ao concluir a venda válida, marca-o como convertido e o associa à venda. Somente orçamento em aberto pode ser cancelado.

### Contas a Pagar

O gerente pode lançar conta com descrição, vencimento e valor positivo, marcando se já está paga. Conta pendente pode receber baixa posteriormente, que registra data de pagamento atual. Filtros: pendentes, atrasadas, pagas e todas. O sistema categoriza pendente como atrasada, vence hoje ou a vencer conforme data.

### Taxas da maquininha

Em Configurações, o gerente define percentuais de 0 a 100 para dinheiro, Pix, débito e crédito. A taxa passa a valer para vendas futuras e fica congelada em cada pagamento; alterar configuração não reescreve vendas antigas. Fechamento e DRE usam valor da taxa registrada.

### Análises

O gerente seleciona períodos e consulta:

- **Curva ABC por lucro:** A representa a faixa acumulada inicial de até 80% do lucro, B segue até 95%, C é o restante; mostra venda, receita, custo, lucro e margem.
- **Estoque parado:** produtos ativos com saldo positivo sem saída no período e sem ficha técnica; mostra dias parados e capital estimado pelo custo atual.
- **Dias/horários de pico:** contagem de vendas e faturamento por dia da semana e hora, somente vendas concluídas.

Os períodos pré-configurados variam por indicador (por exemplo, 30/90/365 dias; estoque parado inclui 15/30/60/90). Vendas canceladas não contam.

### Usuários e auditoria

**Usuários:** gerente cria/edita contas e escolhe perfil. Senha atribuída pelo gerente é provisória e deve ser alterada no primeiro acesso. A tela impede alterar o próprio perfil/desativar o próprio usuário ou redefinir a própria senha por essa tela; há opção Alterar senha no menu. O banco também impede que o sistema fique sem pelo menos um gerente ativo.

**Auditoria:** gerente pode consultar até 500 movimentos recentes no período, filtrar entrada/saída e pesquisar produto, usuário ou motivo. Também pode ver os últimos 100 erros de procedures. Cada movimento pós-etapa 4 deve indicar usuário responsável; histórico anterior pode aparecer como `Sistema`.

## 5. Regras de negócio consolidadas

1. **Integridade do estoque:** saldo nunca pode ficar negativo; o banco valida e bloqueia concorrência durante baixa de venda.
2. **Integridade do preço:** venda/ orçamento usa preço do SQL Server, não um valor enviado pelo navegador.
3. **Histórico congelado:** item de venda guarda preço e custo daquele momento; pagamentos guardam a taxa de então.
4. **Transação de venda:** venda, itens, baixa, pagamentos, auditoria e conversão de orçamento são tudo-ou-nada.
5. **Status:** vendas `CONCLUIDA` ou `CANCELADA`; caixa `ABERTO` ou `FECHADO`; orçamento `ABERTO`, `CONVERTIDO` ou `CANCELADO`, podendo a view calcular `EXPIRADO`; despesa `PENDENTE` ou `PAGO`.
6. **Dados preservados:** produto e cliente são inativados, não removidos fisicamente; vendas e movimentos permanecem para consulta histórica.
7. **Permissões:** autorização do backend prevalece; interface não é mecanismo de segurança por si só.
8. **Relatórios:** DRE usa competência da venda para vendas/custo/taxa e data de pagamento para despesa paga; canceladas são excluídas.
9. **Moeda no PDV:** frontend faz contas em centavos inteiros para evitar erro de ponto flutuante; banco valida total e pagamento.
10. **Limitações de integração:** link WhatsApp apenas abre conversa preparada; o sistema não envia automaticamente nem integra com serviço fiscal/bancário.

## 6. Dúvidas e validações com a operação

Antes de considerar o manual aprovado, confirmar:

- Se o cadastro inicial realmente deve permitir estoque mínimo zero; a UI do formulário exige preenchimento e o SQL aceita zero.
- Qual unidade operacional usar para ingredientes (o banco armazena quantidades inteiras; a equipe define grama/ml/unidade na prática).
- Política de cancelamento depois do fechamento do caixa — bloqueada atualmente.
- Se orçamento deve preservar preço original também na venda, pois a tela de PDV atual usa preços atuais ao carregar orçamento.
- Se formas de pagamento `BOLETO`/`OUTROS` devem ser habilitadas na interface do PDV.
- Procedimento de conferência e comprovação do Pix e de conciliação real da maquininha.
- Se deve haver mais perfis além de gerente e operador e se a tela de operador deve permitir consultas adicionais.

## 7. Glossário

- **PDV:** ponto de venda/frente de caixa.
- **Turno/caixa:** sessão operacional entre abertura e fechamento; uma venda referencia o ID do caixa.
- **Ficha técnica:** receita que define ingredientes consumidos por unidade fabricada.
- **CMV/custo dos produtos:** custo de mercadoria vendida; para receita é calculado pelos ingredientes.
- **DRE:** demonstração gerencial mensal do faturamento, custos, despesas, taxas e lucro líquido.
- **Inativar:** retirar entidade do uso corrente sem apagar registros históricos.
- **Pix Copia e Cola/BR Code:** payload que pode ser exibido em QR, sem confirmação automática de pagamento.
