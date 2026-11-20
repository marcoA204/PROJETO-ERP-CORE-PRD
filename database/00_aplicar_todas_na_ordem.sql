/* ============================================================================
   ERP-CORE  -  APLICA TODAS AS MIGRACOES NA ORDEM CERTA
   v4.0 -> etapa 4.1 -> etapa 4.2 -> etapa 4.3 -> analytics -> etapa 4.4

   POR QUE EXISTE
   Rodar os arquivos a mao, fora de ordem, ja desfez as etapas uma vez:
   o v4.0 usa CREATE OR ALTER e, rodado depois da 4.4, voltava sp_RegistrarVenda,
   vw_CatalogoProdutos etc. para a versao antiga. Este arquivo roda sempre na ordem.
   (O v4.0 agora tambem se pula sozinho se o banco ja estiver na 4.4.)

   COMO USAR
   1. Troque o caminho da linha  :setvar PASTA  abaixo pela pasta do projeto
      (a que contem as pastas "database" e "analytics").
   2. No SSMS: menu Consulta (Query) > Modo SQLCMD (SQLCMD Mode) ligado, e execute (F5).
      Ou no terminal:  sqlcmd -S localhost -E -i 00_aplicar_todas_na_ordem.sql
      (use -U usuario -P senha no lugar de -E se nao usar login do Windows)
   Se algum arquivo der erro, a execucao PARA ali (:on error exit).

   E seguro rodar varias vezes: nenhum arquivo apaga dados.
   NAO inclui o reset de desenvolvimento (ERP_CORE_00_reset_dev.sql).
   Arquivo ASCII puro (sem acentos) de proposito, como os demais.
   ============================================================================ */

:on error exit
:setvar PASTA "C:\caminho\do\projeto\PROJETO-ERP-CORE-PRD"

PRINT '1/6  estrutura v4.0 (pulada automaticamente se o banco ja estiver na 4.4)';
:r $(PASTA)\database\estrutura.banco.ERP_v4.0.sql
GO
PRINT '2/6  etapa 4.1';
:r $(PASTA)\database\ERP_CORE_etapa1_v4.1.sql
GO
PRINT '3/6  etapa 4.2';
:r $(PASTA)\database\ERP_CORE_etapa2_v4.2.sql
GO
PRINT '4/6  etapa 4.3';
:r $(PASTA)\database\ERP_CORE_etapa3_v4.3.sql
GO
PRINT '5/6  analytics';
:r $(PASTA)\analytics\01_funcoes_analiticas.sql
GO
PRINT '6/6  etapa 4.4';
:r $(PASTA)\database\ERP_CORE_etapa4_v4.4.sql
GO
PRINT 'Pronto. Confira com:  cd backend  &&  node tests/verifica_banco.js';
GO
