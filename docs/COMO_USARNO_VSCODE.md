# Como rodar o roteiro com o Claude Code no VS Code

## Onde colocar os arquivos (na raiz do seu projeto)

```
PROJETO-ERP-CORE-PRD/
├── backend/
│   └── tests/                      <-- crie esta pasta
│       ├── verifica_banco.js
│       ├── teste_integracao.js
│       └── limpar_testes.js
└── docs/
    ├── ROTEIRO_DE_TESTES_CLAUDE_CODE.md
    └── COMO_USAR_NO_VSCODE.md
```

Não precisa instalar nada: os scripts usam o `mssql` e o `dotenv` que o backend já tem.

## Passo a passo

1. Abra o projeto no VS Code e, no `backend/.env`, acrescente uma linha com a senha atual do gerente:
   `TESTE_ADMIN_SENHA=sua_senha_do_admin`
   (se o gerente não for `admin`, acrescente também `TESTE_ADMIN_LOGIN=...`).
   Entre uma vez no sistema e troque a senha provisória, se ainda não trocou.
2. Terminal 1: `cd backend` → `npm run dev`
3. Terminal 2: `cd frontend` → `npm run dev`
4. Terminal 3, na **raiz do projeto**: `claude`
5. Cole este pedido:

```
Leia docs/ROTEIRO_DE_TESTES_CLAUDE_CODE.md e execute o roteiro inteiro, na ordem.
Respeite as regras de segurança da seção 0. Pare e me avise se faltar algum pré-requisito.
Para cada falha, diga se o erro é do sistema ou do teste e me mostre a evidência antes de
mexer em qualquer arquivo. No final, gere o relatório da seção 7 em docs/.
```

6. Se quiser só uma parte, peça: "execute só as seções 2 e 3".
7. Para a parte de telas (seção 4), deixe o Chrome com a extensão Claude aberto, ou use o navegador embutido do app.

## Rodando os scripts sozinho (sem o Claude)

```
cd backend
node tests/verifica_banco.js
node tests/teste_integracao.js
node tests/limpar_testes.js                      # simula
node tests/limpar_testes.js --confirmar --limpar-log
```

## Cuidados

- Rode em **banco de desenvolvimento**. O teste cria produtos `ZZTESTE...`, vendas e um operador `zzteste_oper`, e só a limpeza remove isso.
- O teste mexe temporariamente nas taxas e no perfil do negócio e restaura ao final.
- Se houver um caixa aberto de verdade, ele é usado e **não é fechado**; o fechamento só é testado quando o próprio teste abriu o caixa.
- Para tornar o roteiro permanente, peça ao Claude Code: "crie um CLAUDE.md na raiz apontando para docs/ROTEIRO_DE_TESTES_CLAUDE_CODE.md".