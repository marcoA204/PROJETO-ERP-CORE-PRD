import { useState, useEffect } from "react";
import { C, Icon, fmt, api, inputStyle, botao, cartao, StatCard, COR_SITUACAO, NOMES_FORMA } from "./comum.jsx";
import PDV from "./telas/PDV.jsx";
import Vendas from "./telas/Vendas.jsx";
import Estoque from "./telas/Estoque.jsx";
import ContasPagar from "./telas/ContasPagar.jsx";
import Clientes from "./telas/Clientes.jsx";
import Orcamentos from "./telas/Orcamentos.jsx";
import FichaTecnica from "./telas/FichaTecnica.jsx";
import Onboarding from "./telas/Onboarding.jsx";
import Analises from "./telas/Analises.jsx";
import Taxas from "./telas/Taxas.jsx";

// ── Componente: Sidebar ──────────────────────────────────────
function Sidebar({ active, onNav, onLogout, nicho }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: Icon.dashboard },
    { id: "analises", label: "Análises", icon: Icon.chart },
    { id: "pdv", label: "PDV", icon: Icon.pdv },
    { id: "orcamentos", label: "Orçamentos", icon: Icon.clipboard },
    { id: "vendas", label: "Vendas", icon: Icon.history },
    { id: "clientes", label: "Clientes", icon: Icon.users },
    { id: "estoque", label: "Estoque", icon: Icon.stock },
    ...(nicho === "ALIMENTACAO" ? [{ id: "ficha", label: "Ficha Técnica", icon: Icon.book }] : []),
    { id: "contas", label: "Contas a Pagar", icon: Icon.bills },
    { id: "fluxo", label: "Fluxo de Caixa", icon: Icon.cashflow },
    { id: "cadastro", label: "Cadastrar Produto", icon: Icon.register },
    { id: "config", label: "Configurações", icon: Icon.settings },
  ];

  return (
    <aside style={{
      width: 220, minHeight: "100vh", background: C.navyDark,
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "28px 24px 20px", borderBottom: `1px solid ${C.navyMid}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: C.navyDark, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 18, fontWeight: 800, color: C.white,
          }}>
            <img src="/logo.png" alt="LogiFlow" style={{ width: 125, height: 125, objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 17, letterSpacing: 0.5 }}>LogiFlow</div>
            <div style={{ color: C.grayMid, fontSize: 11 }}>Gestão de Estoque</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "16px 12px", flex: 1 }}>
        <div style={{ color: C.grayMid, fontSize: 10, fontWeight: 600, letterSpacing: 1, padding: "0 12px 8px", textTransform: "uppercase" }}>Menu</div>
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => onNav(item.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: isActive ? C.navyMid : "transparent",
              color: isActive ? C.white : C.grayMid,
              fontFamily: "inherit", fontSize: 14, fontWeight: isActive ? 600 : 400,
              marginBottom: 2, transition: "all 0.15s",
              textAlign: "left",
            }}>
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "16px 12px", borderTop: `1px solid ${C.navyMid}` }}>
        <button onClick={onLogout} style={{
          width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
          background: "transparent", color: C.grayMid, cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 500, textAlign: "left",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sair
        </button>
        <div style={{ color: C.grayMid, fontSize: 11, paddingLeft: 12, marginTop: 4 }}>v1.0.0</div>
      </div>
    </aside>
  );
}

// ── Tela: Dashboard (dados reais do banco) ──────────────────
function Dashboard() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  // Busca os números no backend sempre que a tela abre
  useEffect(() => {
    let ativo = true;
    fetch("http://localhost:3000/api/dashboard")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("Falha ao carregar o dashboard."))))
      .then(d => { if (ativo) setDados(d); })
      .catch(e => { if (ativo) setErro(e.message || "Falha na comunicação com o backend."); });
    return () => { ativo = false; };
  }, []);

  const titulo = (
    <>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 28 }}>Visão geral do seu negócio</p>
    </>
  );

  if (erro) return (
    <div>{titulo}
      <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>{erro}</div>
    </div>
  );
  if (!dados) return <div>{titulo}<div style={{ color: C.grayMid, fontSize: 14 }}>Carregando...</div></div>;

  const { resumo, dre, alertas, movimentacoes } = dados;
  const contas = dados.contas || { resumo: [], proximas: [] };
  const contasAtrasadas = contas.resumo.find(c => c.situacao === "ATRASADA");
  const contasHoje = contas.resumo.find(c => c.situacao === "VENCE HOJE");
  const mesLabel = (m) => m.split("-").reverse().join("/");
  const entradas = resumo.faturamento;
  const saidas = resumo.custo + resumo.despesas + (resumo.taxas || 0);
  const saldo = resumo.lucro;
  const th = { padding: "10px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 };
  const td = { padding: "12px 16px", fontSize: 13, color: C.navyDark };
  const painel = { background: C.bgCard, borderRadius: 12, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", overflow: "hidden", marginBottom: 28 };
  const painelTitulo = { padding: "18px 24px", borderBottom: `1px solid ${C.grayLight}`, color: C.navyDark, fontWeight: 600, fontSize: 15 };

  return (
    <div>
      {titulo}

      {/* Aviso de contas atrasadas / que vencem hoje */}
      {(contasAtrasadas || contasHoje) && (
        <div style={{ background: C.yellowBg, color: C.navyDark, border: `1px solid ${C.yellow}`, borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {Icon.alert}
          {contasAtrasadas && <span><b style={{ color: C.red }}>{contasAtrasadas.qtd} conta(s) atrasada(s)</b> ({fmt(contasAtrasadas.valor)})</span>}
          {contasHoje && <span><b>{contasHoje.qtd} conta(s) vence(m) hoje</b> ({fmt(contasHoje.valor)})</span>}
        </div>
      )}

      {/* Cards (mês atual) */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Total Entradas" value={fmt(entradas)} sub={`vendas em ${mesLabel(resumo.mes)}`} color={C.green} icon={Icon.arrowUp} />
        <StatCard label="Total Saídas" value={fmt(saidas)} sub="custo + despesas + taxas" color={C.red} icon={Icon.arrowDown} />
        <StatCard label="Saldo" value={fmt(saldo)} sub={saldo >= 0 ? "lucro líquido do mês" : "prejuízo no mês"} color={saldo >= 0 ? C.green : C.red} />
        <StatCard label="Alertas Estoque" value={alertas.length} sub={alertas.length > 0 ? "produtos para repor" : "tudo em ordem"} color={alertas.length > 0 ? C.yellow : C.green} icon={alertas.length > 0 ? Icon.alert : null} />
      </div>

      {/* Próximas contas a pagar (vw_ContasPagar) */}
      <div style={painel}>
        <div style={painelTitulo}>Contas a pagar — próximos vencimentos</div>
        {contas.proximas.length === 0 ? (
          <div style={{ padding: 24, color: C.grayMid, fontSize: 13 }}>Nenhuma conta pendente.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bgPage }}>
                {["Conta", "Vencimento", "Valor", "Situação"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {contas.proximas.map(c => {
                const [cor, fundo] = COR_SITUACAO[c.situacao] || [C.grayMid, C.bgPage];
                return (
                  <tr key={c.id_despesa} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{c.descricao}</td>
                    <td style={{ ...td, color: C.grayMid }}>{c.vencimento}</td>
                    <td style={td}>{fmt(c.valor_total)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: fundo, color: cor, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{c.situacao}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Estoque baixo (vw_SugestaoCompra) */}
      <div style={painel}>
        <div style={painelTitulo}>Produtos para repor</div>
        {alertas.length === 0 ? (
          <div style={{ padding: 24, color: C.grayMid, fontSize: 13 }}>Nenhum produto abaixo do estoque mínimo.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bgPage }}>
                {["Produto", "Estoque", "Mínimo", "Sugestão de compra"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {alertas.map((a, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>{a.Produto}</td>
                  <td style={{ ...td, color: C.red, fontWeight: 600 }}>{a.estoque_atual}</td>
                  <td style={{ ...td, color: C.grayMid }}>{a.estoque_minimo}</td>
                  <td style={td}>{a.Qtd_Comprar} un.</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* DRE dos últimos meses (vw_RelatorioMensal_DRE) */}
      <div style={painel}>
        <div style={painelTitulo}>Resultado por mês (DRE)</div>
        {dre.length === 0 ? (
          <div style={{ padding: 24, color: C.grayMid, fontSize: 13 }}>Ainda não há vendas nem despesas registradas.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bgPage }}>
                {["Mês", "Faturamento", "Custo dos produtos", "Despesas", "Taxas", "Lucro líquido"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {dre.map(d => (
                <tr key={d.Mes} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>{mesLabel(d.Mes)}</td>
                  <td style={td}>{fmt(d.Faturamento_Real_Recebido)}</td>
                  <td style={td}>{fmt(d.Custo_Produtos)}</td>
                  <td style={td}>{fmt(d.Despesas_Operacionais)}</td>
                  <td style={td}>{fmt(d.Taxas_Pagamento)}</td>
                  <td style={{ ...td, fontWeight: 700, color: d.Lucro_Liquido >= 0 ? C.green : C.red }}>{fmt(d.Lucro_Liquido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Últimas movimentações */}
      <div style={painel}>
        <div style={painelTitulo}>Últimas Movimentações</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Data", "Tipo", "Produto / Descrição", "Qtd", "Valor"].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map((t, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                <td style={{ ...td, color: C.grayMid }}>{t.data}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    background: t.tipo === "entrada" ? C.greenBg : C.redBg,
                    color: t.tipo === "entrada" ? C.green : C.red,
                    padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    {t.tipo === "entrada" ? Icon.arrowUp : Icon.arrowDown}
                    {t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1)}
                  </span>
                </td>
                <td style={{ ...td, fontWeight: 500 }}>{t.produto}</td>
                <td style={td}>{t.qtd ?? "-"}</td>
                <td style={{ ...td, fontWeight: 600, color: t.tipo === "entrada" ? C.green : C.red }}>{fmt(t.valor)}</td>
              </tr>
            ))}
            {movimentacoes.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhuma movimentação ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tela: Fluxo de Caixa (abrir/fechar turno e registrar despesas pagas) ──
function FluxoCaixa({ transactions, setTransactions, idCaixa, setIdCaixa }) {
  const hoje = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD no fuso local

  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState({ descricao: "", valor: "" });
  const [trocoInicial, setTrocoInicial] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [fechamento, setFechamento] = useState(null); // resumo do último turno fechado

  const filtrados = transactions.filter(t => filtro === "todos" || t.tipo === filtro);
  const totalEntradas = transactions.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
  const totalSaidas = transactions.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);

  const handleAbrirCaixa = async () => {
    const r = await api("/caixa/abrir", { method: "POST", corpo: { troco_inicial: Number(trocoInicial) || 0 } });
    if (!r.ok) { setErro(r.erro); return; }
    setIdCaixa(r.data.id_caixa);
    setFechamento(null);
    setErro("");
  };

  const handleFecharCaixa = async () => {
    if (!window.confirm("Fechar o caixa agora?")) return;
    const r = await api("/caixa/fechar", { method: "POST", corpo: { id_caixa: idCaixa } });
    if (!r.ok) { setErro(r.erro); return; }
    const resumo = (r.data.resumo || [])[0];
    setFechamento(resumo ? { ...resumo, formas: r.data.formas || [] } : null);
    setIdCaixa(null);
    setTransactions([]); // limpa as movimentações da tela no fim do turno
    setTrocoInicial("");
    setErro("");
  };

  const handleDespesa = async () => {
    if (salvando) return;
    if (!form.descricao.trim() || !form.valor || Number(form.valor) <= 0) {
      setErro("Informe a descrição e um valor maior que zero.");
      return;
    }
    setSalvando(true);
    const r = await api("/despesas", {
      method: "POST",
      corpo: { descricao: form.descricao, valor_total: Number(form.valor), pago: true },
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setTransactions(prev => [...prev, {
      id: Date.now(), data: hoje(), tipo: "saida", produto: form.descricao.trim(),
      qtd: "-", valor: Number(form.valor), obs: "Despesa paga",
    }]);
    setForm({ descricao: "", valor: "" });
    setErro("");
  };

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Fluxo de Caixa</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>Abra e feche o turno e registre despesas pagas na hora. Vendas são feitas no PDV.</p>

      {/* Painel do caixa */}
      <div style={{ ...cartao, padding: "16px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        {idCaixa ? (
          <>
            <div><span style={{ color: C.green, fontWeight: "bold" }}>✅ Caixa Aberto</span> (Turno #{idCaixa})</div>
            <button onClick={handleFecharCaixa} style={{ ...botao, background: C.red }}>Fechar Caixa</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: C.grayMid, fontWeight: "bold" }}>🔒 Caixa Fechado</span>
              <input type="number" placeholder="Troco Inicial (R$)" value={trocoInicial} onChange={e => setTrocoInicial(e.target.value)} style={inputStyle} min="0" />
            </div>
            <button onClick={handleAbrirCaixa} style={botao}>Abrir Caixa</button>
          </>
        )}
      </div>

      {/* Resumo do turno que acabou de fechar */}
      {fechamento && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontSize: 14, color: C.navyDark }}>
          <div style={{ fontWeight: 700, color: C.green, marginBottom: 6 }}>Turno #{fechamento.Turno} fechado</div>
          <div>Faturamento do turno: <b>{fmt(fechamento.Faturamento_Total)}</b></div>
          <div>Troco inicial: <b>{fmt(fechamento.troco_inicial)}</b></div>
          <div>Dinheiro que deve estar na gaveta: <b>{fmt(fechamento.Dinheiro_Em_Caixa_Fisico)}</b></div>
          {Number(fechamento.Taxas_Total) > 0 && (
            <>
              <div>Taxas da maquininha: <b style={{ color: C.red }}>- {fmt(fechamento.Taxas_Total)}</b></div>
              <div>Faturamento líquido (o que realmente entra): <b>{fmt(fechamento.Faturamento_Liquido)}</b></div>
            </>
          )}
          {fechamento.formas && fechamento.formas.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, background: C.white, borderRadius: 8, overflow: "hidden" }}>
              <thead>
                <tr style={{ background: C.bgPage }}>
                  {["Forma de pagamento", "Vendas", "Bruto", "Taxa", "Líquido"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fechamento.formas.map(f => (
                  <tr key={f.forma_pagamento} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                    <td style={{ padding: "8px 10px", fontSize: 13 }}>{NOMES_FORMA[f.forma_pagamento] || f.forma_pagamento}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13 }}>{f.qtd_pagamentos}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13 }}>{fmt(f.valor_bruto)}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13, color: Number(f.valor_taxa) > 0 ? C.red : C.grayMid }}>{fmt(f.valor_taxa)}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600 }}>{fmt(f.valor_liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Resumo */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <StatCard label="Entradas" value={fmt(totalEntradas)} color={C.green} sub="vendas desde que a página abriu" icon={Icon.arrowUp} />
        <StatCard label="Saídas" value={fmt(totalSaidas)} color={C.red} sub="despesas pagas" icon={Icon.arrowDown} />
        <StatCard label="Saldo" value={fmt(totalEntradas - totalSaidas)} color={totalEntradas - totalSaidas >= 0 ? C.green : C.red} sub="neste turno" />
      </div>

      {/* Despesa paga na hora */}
      <div style={{ ...cartao, padding: 24, marginBottom: 28 }}>
        <div style={{ fontWeight: 600, color: C.navyDark, marginBottom: 16, fontSize: 15 }}>Registrar despesa paga</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <input placeholder="Descrição da despesa *" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
            style={{ ...inputStyle, flex: "2 1 220px" }} />
          <input type="number" placeholder="Valor R$ *" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
            style={{ ...inputStyle, flex: "1 1 120px" }} min="0" step="0.01" />
          <button onClick={handleDespesa} disabled={salvando} style={{ ...botao, opacity: salvando ? 0.7 : 1 }}>{salvando ? "Salvando..." : "Registrar"}</button>
        </div>
        <div style={{ color: C.grayMid, fontSize: 12, marginTop: 8 }}>Para contas com vencimento futuro, use <b>Contas a Pagar</b>.</div>
        {erro && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{erro}</div>}
      </div>

      {/* Filtro e tabela */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["todos", "Todos"], ["entrada", "Entradas"], ["saida", "Saídas"]].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{
            padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${filtro === val ? C.navyDark : C.grayLight}`,
            background: filtro === val ? C.navyDark : C.white,
            color: filtro === val ? C.white : C.grayMid,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ ...cartao, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Data", "Tipo", "Produto / Descrição", "Qtd", "Valor", "Observação"].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.slice().reverse().map((t) => (
              <tr key={t.id} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                <td style={{ padding: "12px 16px", fontSize: 13, color: C.grayMid }}>{t.data.split("-").reverse().join("/")}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    background: t.tipo === "entrada" ? C.greenBg : C.redBg,
                    color: t.tipo === "entrada" ? C.green : C.red,
                    padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    {t.tipo === "entrada" ? Icon.arrowUp : Icon.arrowDown}
                    {t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1)}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: C.navyDark }}>{t.produto}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: C.navyDark }}>{t.qtd}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: t.tipo === "entrada" ? C.green : C.red }}>{fmt(t.valor)}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: C.grayMid }}>{t.obs}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhuma movimentação encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tela: Cadastro de Produto ────────────────────────────────
function CadastroProduto({ products, atualizarLista }) {
  const [form, setForm] = useState({ nome: "", categoria: "", estoque: "", minimo: "", custo: "", preco: "" });
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const handleSalvar = async () => {
    if (!form.nome || !form.categoria || !form.estoque || !form.minimo || form.custo === "" || !form.preco) {
      setErro("Preencha todos os campos."); setOk(false); return;
    }

    try {
      // Dispara o POST para o nosso servidor Node.js
      const response = await fetch("http://localhost:3000/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          nome_categoria: form.categoria,
          estoque_inicial: Number(form.estoque),
          estoque_minimo: Number(form.minimo),
          preco_venda: Number(form.preco),
          preco_custo: Number(form.custo)
        })
      });

      if (response.ok) {
        setForm({ nome: "", categoria: "", estoque: "", minimo: "", custo: "", preco: "" });
        setErro("");
        setOk(true);
        setTimeout(() => setOk(false), 3000);

        // Pede para o App buscar a lista nova do banco!
        atualizarLista();
      } else {
        const data = await response.json().catch(() => ({}));
        setErro(data.erro || "Erro no servidor ao salvar produto.");
      }
    } catch (error) {
      setErro("Falha na comunicação com o backend.");
    }
  };


  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: `1.5px solid ${C.grayLight}`, fontSize: 14,
    fontFamily: "inherit", color: C.navyDark, outline: "none",
    boxSizing: "border-box", background: C.white,
  };

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Cadastrar Produto</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>Adicione novos produtos ao sistema</p>

      {/* Formulário */}
      <div style={{ background: C.bgCard, borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", maxWidth: "100%", marginBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Nome do Produto *</label>
            <input placeholder="Ex: Notebook Dell" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Categoria *</label>
            <input placeholder="Ex: Eletrônicos" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Estoque Inicial *</label>
              <input type="number" placeholder="0" min="0" value={form.estoque} onChange={e => setForm({ ...form, estoque: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Estoque Mínimo *</label>
              <input type="number" placeholder="0" min="0" value={form.minimo} onChange={e => setForm({ ...form, minimo: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Preço de Custo (R$) *</label>
              <input type="number" placeholder="0.00" min="0" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Preço de Venda (R$) *</label>
              <input type="number" placeholder="0.00" min="0" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} style={inputStyle} />
            </div>
          </div>

          {erro && <div style={{ color: C.red, fontSize: 13, background: C.redBg, borderRadius: 7, padding: "8px 12px" }}>{erro}</div>}
          {ok && <div style={{ color: C.green, fontSize: 13, background: C.greenBg, borderRadius: 7, padding: "8px 12px" }}>✓ Produto cadastrado com sucesso!</div>}

          <button onClick={handleSalvar} style={{
            background: C.navyDark, color: C.white, border: "none", borderRadius: 8,
            padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
          }}>Cadastrar Produto</button>
        </div>
      </div>

      {/* Lista de produtos */}
      <div>
        <div style={{ fontWeight: 600, color: C.navyDark, fontSize: 15, marginBottom: 12 }}>Produtos Cadastrados ({products.length})</div>
        <div style={{ background: C.bgCard, borderRadius: 12, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bgPage }}>
                {["Produto", "Categoria", "Estoque", "Mínimo", "Preço"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: C.navyDark, fontSize: 13 }}>{p.nome}</td>
                  <td style={{ padding: "12px 16px", color: C.grayMid, fontSize: 13 }}>{p.categoria}</td>
                  <td style={{ padding: "12px 16px", color: p.estoque < p.minimo ? C.red : C.navyDark, fontWeight: 600, fontSize: 13 }}>{p.estoque}</td>
                  <td style={{ padding: "12px 16px", color: C.grayMid, fontSize: 13 }}>{p.minimo}</td>
                  <td style={{ padding: "12px 16px", color: C.navyDark, fontSize: 13 }}>{fmt(p.preco)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── App principal ────────────────────────────────────────────
export default function App() {
  const [logado, setLogado] = useState(() => localStorage.getItem("lf_logado") === "true");
  const [tela, setTela] = useState("dashboard");

  // Agora usamos estados normais do React, começando vazios
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Toda vez que logar, busca os produtos reais do banco!
  // Caixa aberto no momento (vem do banco, então não se perde ao trocar de tela ou apertar F5)
  const [idCaixa, setIdCaixa] = useState(null);

  // Perfil do negócio (Varejo / Alimentação) e orçamento que está indo para o PDV
  const [config, setConfig] = useState(null);
  const [orcamentoPdv, setOrcamentoPdv] = useState(null);

  const buscarConfig = async () => {
    const r = await api("/configuracoes");
    // se o backend estiver fora do ar, não trava o app na tela de carregamento
    setConfig(r.ok ? r.data : { nicho: "VAREJO", onboarding_concluido: true });
  };

  // Chamada pela tela de perfil: devolve "" se deu certo ou o texto do erro
  const salvarNicho = async (nicho) => {
    const r = await api("/configuracoes", { method: "PUT", corpo: { nicho } });
    if (!r.ok) return r.erro;
    setConfig({ nicho: r.data.nicho, onboarding_concluido: true });
    return "";
  };

  const abrirNoPdv = (orcamento) => { setOrcamentoPdv(orcamento); setTela("pdv"); };

  useEffect(() => {
    if (logado) {
      buscarProdutos();
      buscarCaixaAberto();
      buscarConfig();
    }
  }, [logado]);

  const buscarCaixaAberto = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/caixa/atual");
      const dados = await response.json();
      setIdCaixa(dados.id_caixa || null);
    } catch (erro) {
      console.error("Erro ao buscar o caixa aberto:", erro);
    }
  };

  const buscarProdutos = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/produtos");
      const dados = await response.json();
      setProducts(dados.map(p => ({
        id: p.id_produto,
        codigo_barras: p.codigo_barras,
        nome: p.Produto,
        categoria: p.Categoria,
        estoque: p.estoque_atual,
        minimo: p.estoque_minimo,
        preco: p.preco_venda,
        custo: p.preco_custo,
        temFicha: Boolean(p.tem_ficha),
      })));
    } catch (erro) {
      console.error("Erro ao buscar produtos do backend:", erro);
    }
  };

  const renderTela = () => {
    switch (tela) {
      case "dashboard": return <Dashboard />;
      case "analises": return <Analises />;
      case "pdv": return <PDV products={products} idCaixa={idCaixa} atualizarLista={buscarProdutos} setTransactions={setTransactions} irPara={setTela} orcamentoPdv={orcamentoPdv} limparOrcamentoPdv={() => setOrcamentoPdv(null)} />;
      case "orcamentos": return <Orcamentos products={products} abrirNoPdv={abrirNoPdv} />;
      case "vendas": return <Vendas atualizarLista={buscarProdutos} />;
      case "clientes": return <Clientes />;
      case "estoque": return <Estoque products={products} atualizarLista={buscarProdutos} />;
      case "ficha": return <FichaTecnica products={products} atualizarLista={buscarProdutos} />;
      case "contas": return <ContasPagar />;
      case "fluxo": return <FluxoCaixa transactions={transactions} setTransactions={setTransactions} idCaixa={idCaixa} setIdCaixa={setIdCaixa} />;
      case "cadastro": return <CadastroProduto products={products} atualizarLista={buscarProdutos} />;
      case "config": return (
        <div>
          <Onboarding comoTela nichoAtual={config.nicho} onSalvar={salvarNicho} />
          <Taxas />
        </div>
      );
      default: return null;
    }
  };

  if (!logado) return <Login onLogin={() => { localStorage.setItem("lf_logado", "true"); setLogado(true); }} />;

  // Primeiro acesso: escolher o perfil do negócio
  if (config === null) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bgPage, color: C.grayMid, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Carregando...</div>;
  }
  if (!config.onboarding_concluido) {
    return <Onboarding nichoAtual={config.nicho} onSalvar={salvarNicho} />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', sans-serif", background: C.bgPage }}>
      <Sidebar active={tela} onNav={setTela} nicho={config.nicho} onLogout={() => { localStorage.removeItem("lf_logado"); setConfig(null); setLogado(false); }} />
      <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto", width: "100%" }}>
        {renderTela()}
      </main>
    </div>
  );
}
// ── Tela: Login ──────────────────────────────────────────────
function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [erro, setErro] = useState("");

  const handleLogin = () => {
    if (user === "admin" && pass === "admin123") {
      onLogin();
    } else {
      setErro("Usuário ou senha incorretos.");
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 8,
    border: `1.5px solid ${C.grayLight}`, fontSize: 14,
    fontFamily: "inherit", color: C.navyDark, outline: "none",
    boxSizing: "border-box", background: C.white,
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: C.navyDark, fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: C.grayLight, borderRadius: 16, padding: "48px 40px",
        width: "100%", maxWidth: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <img src="/logo.png" alt="LogiFlow" style={{ width: 150, height: 150, objectFit: "contain" }} />
          <div>
            <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 22 }}>LogiFlow</div>
            <div style={{ color: C.grayMid, fontSize: 13 }}>Gestão de Estoque</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Bem-vindo!</div>
          <div style={{ color: C.grayMid, fontSize: 14 }}>Entre com suas credenciais para continuar</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Usuário</label>
            <input placeholder="Digite seu usuário" value={user} onChange={e => setUser(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Senha</label>
            <input type="password" placeholder="Digite sua senha" value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} style={inputStyle} />
          </div>

          {erro && <div style={{ color: C.red, fontSize: 13, background: C.redBg, borderRadius: 7, padding: "8px 12px" }}>{erro}</div>}

          <button onClick={handleLogin} style={{
            background: C.navyDark, color: C.white, border: "none", borderRadius: 8,
            padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", marginTop: 4,
          }}>Entrar</button>
        </div>

        <div style={{ marginTop: 20, padding: "12px", background: C.bgPage, borderRadius: 8, fontSize: 12, color: C.grayMid }}>
          👤 Usuário: <strong>admin</strong> &nbsp;|&nbsp; 🔑 Senha: <strong>admin123</strong>
        </div>
      </div>
    </div>
  );
}