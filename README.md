<p align="center">
  <img src="frontend/public/logo.png" alt="Logi Flow" width="140" />
</p>

<h1 align="center">Logi Flow</h1>

<p align="center">
  Sistema de gestão (ERP) e frente de caixa (PDV) para pequenos negócios.
</p>

---

## O que é

O **Logi Flow** junta em um só lugar o que um pequeno comércio precisa no dia a dia: vender no caixa, controlar o estoque, acompanhar as contas e entender quais produtos realmente dão lucro.

Ao entrar pela primeira vez, o dono escolhe o tipo de negócio, e o sistema adapta os menus e os nomes das telas:

- **Varejo / Depósito**: produtos com estoque por unidade.
- **Alimentação / Confeitaria**: além disso, ganha a **Ficha Técnica** (receitas). Ao vender um bolo, por exemplo, os ingredientes saem do estoque automaticamente.

## Como funciona

| Módulo | O que faz |
|---|---|
| **PDV (caixa)** | Abre o turno, registra vendas (dinheiro, cartão ou PIX com QR Code), emite recibo e fecha o caixa conferindo o dinheiro da gaveta. |
| **Orçamentos** | Monta um orçamento para o cliente e o transforma em venda depois. |
| **Vendas** | Mostra o histórico de vendas e permite cancelar uma venda enquanto o caixa está aberto. |
| **Clientes** | Cadastro com WhatsApp e CPF/CNPJ. |
| **Estoque** | Cadastra os produtos e mostra alertas de estoque mínimo e o histórico de movimentações. |
| **Contas a Pagar e Fluxo de Caixa** | Despesas, vencimentos e o saldo entre entradas e saídas do mês. |
| **Dashboard** | Resumo do mês: entradas, saídas, lucro e alertas. |
| **Análises** | Curva ABC por lucro, estoque parado (dinheiro preso na prateleira) e dias e horários de pico de venda. |
| **Usuários e Auditoria** | Controle de acesso e registro de quem fez o quê no sistema. |

### Perfis de acesso

- **Gerente**: acesso completo.
- **Operador**: só usa o caixa (vender, abrir e fechar o turno). Ele não vê relatórios nem altera preços.

O backend confere essas permissões em toda requisição. Não basta esconder o botão na tela.

## Tecnologias

```
Navegador ──► Frontend (React + Vite) ──► API (Node.js + Express) ──► SQL Server
```

- **Frontend**: React 19, Vite
- **Backend**: Node.js, Express 5, login com sessão por token e senhas criptografadas
- **Banco**: SQL Server. As regras de negócio ficam em *stored procedures*, e as análises em funções SQL.

## Como rodar no computador

**Pré-requisitos:** Node.js 18 ou mais recente e SQL Server.

1. **Banco**: crie o banco e rode os scripts da pasta `database/` na ordem (v4.0 → v4.4, com `analytics/` antes da v4.4), ou use o `database/00_aplicar_todas_na_ordem.sql`.
2. **Backend**:
   ```bash
   cd backend
   cp .env.example .env      # preencha os dados do seu banco
   npm install
   npm run dev               # API em http://localhost:3000
   ```
3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev               # app em http://localhost:5173
   ```

No primeiro acesso, entre com o usuário **`admin`**. O sistema pede para trocar a senha provisória na mesma hora.

## Estrutura

```
backend/     API (rotas, controllers, permissões, testes)
frontend/    Telas do sistema
database/    Scripts do banco por versão (+ script único para a nuvem)
analytics/   Funções de análise (Curva ABC, estoque parado, picos)
docs/        Manuais e relatórios de teste
```
