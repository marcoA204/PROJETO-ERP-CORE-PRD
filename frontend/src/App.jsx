import { useState, useEffect } from "react";
import { C, Icon, fmt, api, inputStyle, botao, cartao, StatCard, COR_SITUACAO, NOMES_FORMA, TOKEN_KEY, rotulos } from "./comum.jsx";
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
import Login from "./telas/Login.jsx";
import Usuarios from "./telas/Usuarios.jsx";
import Auditoria from "./telas/Auditoria.jsx";
import { AlterarSenha } from "./telas/Conta.jsx";

// ── Componente: Sidebar ──────────────────────────────────────
// No celular (≤ 768 px) vira uma gaveta: fica escondida e abre pelo botão ☰ da barra do topo
// (as regras de tela pequena estão em index.css: .erp-menu / .erp-topo / .erp-main).
function Sidebar({ active, onNav, onLogout, onSenha, nicho, usuario, aberto }) {
  const r = rotulos(nicho);
  const items = [
    { id: "dashboard", label: "Dashboard", icon: Icon.dashboard },
    { id: "analises", label: "Análises", icon: Icon.chart },
    { id: "pdv", label: "PDV", icon: Icon.pdv },
    { id: "orcamentos", label: r.orcamentos, icon: Icon.clipboard },
    { id: "vendas", label: "Vendas", icon: Icon.history },
    { id: "clientes", label: "Clientes", icon: Icon.users },
    { id: "estoque", label: r.estoque, icon: Icon.stock },
    ...(nicho === "ALIMENTACAO" ? [{ id: "ficha", label: "Ficha Técnica", icon: Icon.book }] : []),
    { id: "contas", label: "Contas a Pagar", icon: Icon.bills },
    { id: "fluxo", label: "Fluxo de Caixa", icon: Icon.cashflow },
    { id: "cadastro", label: r.cadastrar, icon: Icon.register },
    { id: "usuarios", label: "Usuários", icon: Icon.shield },
    { id: "auditoria", label: "Auditoria", icon: Icon.eye },
    { id: "config", label: "Configurações", icon: Icon.settings },
  ];
  // Operador de caixa só enxerga PDV e Fluxo de Caixa (o backend também bloqueia o resto)
  const visiveis = usuario.perfil === "GERENTE" ? items : items.filter(i => ["pdv", "fluxo"].includes(i.id));

  return (
    <aside className={`erp-menu${aberto ? " aberto" : ""}`} style={{
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
            <img src="/logo.png" alt="Logi Flow" style={{ width: 125, height: 125, objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 17, letterSpacing: 0.5 }}>Logi Flow</div>
            <div style={{ color: C.grayMid, fontSize: 11 }}>Gestão de Estoque</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "16px 12px", flex: 1 }}>
        <div style={{ color: C.grayMid, fontSize: 10, fontWeight: 600, letterSpacing: 1, padding: "0 12px 8px", textTransform: "uppercase" }}>Menu</div>
        {visiveis.map((item) => {
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
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{usuario.nome}</div>
          <div style={{ color: C.grayMid, fontSize: 11 }}>{usuario.perfil === "GERENTE" ? "Gerente / Proprietário" : "Operador de caixa"}</div>
          <button onClick={onSenha} style={{ background: "none", border: "none", color: C.grayMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0, marginTop: 4, textDecoration: "underline" }}>Alterar senha</button>
        </div>
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
    api("/dashboard").then(r => {
      if (!ativo) return;
      if (r.ok) setDados(r.data); else setErro(r.erro);
    });
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
function FluxoCaixa({ transactions, setTransactions, idCaixa, setIdCaixa, podeDespesa }) {
  const hoje = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD no fuso local

  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState({ descricao: "", valor: "" });
  const [trocoInicial, setTrocoInicial] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [fechamento, setFechamento] = useState(null); // resumo do último turno fechado
  const [turno, setTurno] = useState(null); // totais reais do turno aberto (vêm do banco)

  const filtrados = transactions.filter(t => filtro === "todos" || t.tipo === filtro);

  // Os totais vêm do banco: não zeram com F5 nem ao trocar de tela
  const carregarTurno = async () => {
    const r = await api("/caixa/atual");
    if (r.ok) setTurno(r.data.id_caixa ? r.data : null);
  };
  useEffect(() => {
    let ativo = true;
    api("/caixa/atual").then(r => { if (ativo && r.ok) setTurno(r.data.id_caixa ? r.data : null); });
    return () => { ativo = false; };
  }, [idCaixa]);

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
    carregarTurno();
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

      {/* Operador não vê o painel de despesas: o erro do caixa aparece aqui */}
      {!podeDespesa && erro && (
        <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{erro}</div>
      )}

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

      {/* Resumo do turno aberto (totais do banco) */}
      {turno && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <StatCard label="Vendas do turno" value={fmt(turno.vendas_turno)} color={C.green}
            sub={`${turno.qtd_vendas} venda(s) no turno #${turno.id_caixa}`} icon={Icon.arrowUp} />
          <StatCard label="Dinheiro na gaveta" value={fmt(turno.dinheiro_gaveta)} color={C.grayMid}
            sub={`troco inicial ${fmt(turno.troco_inicial)} + dinheiro recebido`} />
          {podeDespesa && (
            <StatCard label="Despesas pagas" value={fmt(turno.despesas_pagas)} color={C.red}
              sub="desde o dia da abertura" icon={Icon.arrowDown} />
          )}
        </div>
      )}

      {/* Despesa paga na hora (somente gerente) */}
      {podeDespesa && (
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
      )}

      {/* Filtro e tabela (o que foi lançado nesta sessão; o histórico completo fica em Vendas e Contas a Pagar) */}
      <div style={{ fontWeight: 600, color: C.navyDark, fontSize: 15, marginBottom: 10 }}>Lançamentos desta sessão</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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
const FORM_PRODUTO_VAZIO = { nome: "", codigo: "", categoria: "", estoque: "", minimo: "", custo: "", preco: "" };

function CadastroProduto({ products, atualizarLista, nicho }) {
  const r = rotulos(nicho);
  const [form, setForm] = useState(FORM_PRODUTO_VAZIO);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const handleSalvar = async () => {
    if (!form.nome || !form.categoria || !form.estoque || !form.minimo || form.custo === "" || !form.preco) {
      setErro("Preencha todos os campos obrigatórios (*)."); setOk(false); return;
    }
    // Código de barras é opcional; sem ele o sistema gera um código interno
    const codigo = form.codigo.trim();
    if (codigo && !/^\d{8,13}$/.test(codigo)) {
      setErro("O código de barras deve ter de 8 a 13 números (EAN/UPC), sem letras nem espaços."); setOk(false); return;
    }

    const resp = await api("/produtos", {
      method: "POST",
      corpo: {
        nome: form.nome,
        codigo_barras: codigo || null,
        nome_categoria: form.categoria,
        estoque_inicial: Number(form.estoque),
        estoque_minimo: Number(form.minimo),
        preco_venda: Number(form.preco),
        preco_custo: Number(form.custo),
      },
    });
    if (!resp.ok) { setErro(resp.erro); return; }

    setForm(FORM_PRODUTO_VAZIO);
    setErro("");
    setOk(true);
    setTimeout(() => setOk(false), 3000);
    atualizarLista(); // pede para o App buscar a lista nova do banco
  };


  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: `1.5px solid ${C.grayLight}`, fontSize: 14,
    fontFamily: "inherit", color: C.navyDark, outline: "none",
    boxSizing: "border-box", background: C.white,
  };

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>{r.cadastrar}</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>{r.subtituloCadastro}</p>

      {/* Formulário */}
      <div style={{ background: C.bgCard, borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", maxWidth: "100%", marginBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Nome do {r.item} *</label>
            <input placeholder={r.exemploNome} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Código de barras (opcional)</label>
            <input placeholder="Passe o leitor ou digite o EAN da embalagem" inputMode="numeric" maxLength={13}
              value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.replace(/\D/g, "") })} style={inputStyle} />
            <div style={{ color: C.grayMid, fontSize: 12, marginTop: 4 }}>Deixe em branco para o sistema gerar um código interno.</div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Categoria *</label>
            <input placeholder={r.exemploCategoria} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Estoque Inicial *</label>
              <input type="number" placeholder="0" min="0" value={form.estoque} onChange={e => setForm({ ...form, estoque: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Estoque Mínimo *</label>
              <input type="number" placeholder="0" min="0" value={form.minimo} onChange={e => setForm({ ...form, minimo: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Preço de Custo (R$) *</label>
              <input type="number" placeholder="0.00" min="0" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: "1 1 140px" }}>
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
        <div style={{ fontWeight: 600, color: C.navyDark, fontSize: 15, marginBottom: 12 }}>Cadastrados ({products.length} {r.itens})</div>
        <div style={{ background: C.bgCard, borderRadius: 12, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bgPage }}>
                {[r.item, "Código", "Categoria", "Estoque", "Mínimo", "Preço"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: C.navyDark, fontSize: 13 }}>{p.nome}</td>
                  <td style={{ padding: "12px 16px", color: C.grayMid, fontSize: 12, fontFamily: "monospace" }}>{p.codigo_barras}</td>
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
  // Quem está logado (null = ninguém). O token fica no localStorage e vale 12 horas.
  const [usuario, setUsuario] = useState(null);
  const [verificando, setVerificando] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [tela, setTela] = useState("dashboard");
  const [menuAberto, setMenuAberto] = useState(false); // gaveta do menu no celular

  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [idCaixa, setIdCaixa] = useState(null); // caixa aberto agora (vem do banco)

  // Perfil do negócio (Varejo / Alimentação) e orçamento que está indo para o PDV
  const [config, setConfig] = useState(null);
  const [orcamentoPdv, setOrcamentoPdv] = useState(null);

  const entrar = (u) => { setUsuario(u); setTela(u.perfil === "GERENTE" ? "dashboard" : "pdv"); };

  // Esquece tudo da sessão anterior (para o próximo usuário não ver dados do anterior)
  const limparSessao = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUsuario(null); setConfig(null); setIdCaixa(null); setProducts([]);
    setTransactions([]); setOrcamentoPdv(null); setTrocandoSenha(false);
  };
  const sair = async () => { await api("/auth/logout", { method: "POST" }); limparSessao(); };
  const aoLogar = ({ token, usuario: u }) => { localStorage.setItem(TOKEN_KEY, token); entrar(u); };

  // Ao abrir a página: se há token guardado, confere se ainda vale
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    let ativo = true;
    api("/auth/me").then(r => {
      if (!ativo) return;
      if (r.ok) entrar(r.data.usuario); else localStorage.removeItem(TOKEN_KEY);
      setVerificando(false);
    });
    return () => { ativo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // O backend respondeu "sessão expirada" em alguma chamada: volta para o login
  useEffect(() => {
    window.addEventListener("sessao-expirada", limparSessao);
    return () => window.removeEventListener("sessao-expirada", limparSessao);
  }, []);

  // Depois de logar (e de ter trocado a senha provisória), carrega os dados
  useEffect(() => {
    if (usuario && !usuario.deve_trocar_senha) {
      buscarProdutos();
      buscarCaixaAberto();
      buscarConfig();
    }
  }, [usuario]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const buscarCaixaAberto = async () => {
    const r = await api("/caixa/atual");
    if (r.ok) setIdCaixa(r.data.id_caixa || null);
  };

  const buscarProdutos = async () => {
    const r = await api("/produtos");
    if (!r.ok) { console.error("Erro ao buscar produtos:", r.erro); return; }
    // Traduz os nomes das colunas do SQL para o formato que as telas usam
    setProducts(r.data.map(p => ({
      id: p.id_produto,
      codigo_barras: p.codigo_barras,
      nome: p.Produto,
      categoria: p.Categoria,
      estoque: p.estoque_atual,
      minimo: p.estoque_minimo,
      preco: p.preco_venda,
      custo: p.preco_custo, // o operador não recebe o custo (o backend remove)
      custoReceita: p.custo_receita, // soma dos ingredientes (só produtos com ficha; também só para o gerente)
      temFicha: Boolean(p.tem_ficha),
    })));
  };

  const renderTela = () => {
    const ehGerente = usuario.perfil === "GERENTE";
    // Rede de segurança: operador nunca renderiza telas de gerente (o backend também nega)
    const telaAtual = ehGerente || ["pdv", "fluxo"].includes(tela) ? tela : "pdv";
    switch (telaAtual) {
      case "dashboard": return <Dashboard />;
      case "analises": return <Analises />;
      case "pdv": return <PDV products={products} idCaixa={idCaixa} atualizarLista={buscarProdutos} setTransactions={setTransactions} irPara={setTela} orcamentoPdv={orcamentoPdv} limparOrcamentoPdv={() => setOrcamentoPdv(null)} />;
      case "orcamentos": return <Orcamentos products={products} abrirNoPdv={abrirNoPdv} nicho={config.nicho} />;
      case "vendas": return <Vendas atualizarLista={buscarProdutos} />;
      case "clientes": return <Clientes />;
      case "estoque": return <Estoque products={products} atualizarLista={buscarProdutos} nicho={config.nicho} />;
      case "ficha": return <FichaTecnica products={products} atualizarLista={buscarProdutos} />;
      case "contas": return <ContasPagar />;
      case "fluxo": return <FluxoCaixa transactions={transactions} setTransactions={setTransactions} idCaixa={idCaixa} setIdCaixa={setIdCaixa} podeDespesa={ehGerente} />;
      case "cadastro": return <CadastroProduto products={products} atualizarLista={buscarProdutos} nicho={config.nicho} />;
      case "usuarios": return <Usuarios usuarioAtual={usuario} />;
      case "auditoria": return <Auditoria />;
      case "config": return (
        <div>
          <Onboarding comoTela nichoAtual={config.nicho} onSalvar={salvarNicho} />
          <Taxas />
        </div>
      );
      default: return null;
    }
  };

  const telaCheia = (conteudo) => (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bgPage, color: C.grayMid, fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: 24, textAlign: "center" }}>{conteudo}</div>
  );

  if (verificando) return telaCheia("Carregando...");
  if (!usuario) return <Login onLogin={aoLogar} />;

  // Senha provisória: não passa daqui sem trocar
  if (usuario.deve_trocar_senha) {
    return (
      <div style={{ minHeight: "100vh", background: C.navyDark, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
        <AlterarSenha forcado onConcluido={() => setUsuario({ ...usuario, deve_trocar_senha: false })} />
      </div>
    );
  }

  if (config === null) return telaCheia("Carregando...");
  if (!config.onboarding_concluido) {
    return usuario.perfil === "GERENTE"
      ? <Onboarding nichoAtual={config.nicho} onSalvar={salvarNicho} />
      : telaCheia("A configuração inicial ainda não foi concluída. Peça ao gerente para entrar no sistema primeiro.");
  }

  return (
    <div className="erp-app" style={{ display: "flex", minHeight: "100vh", background: C.bgPage, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Barra do topo: só aparece no celular (index.css), com o botão que abre o menu */}
      <header className="erp-topo" style={{ background: C.navyDark, color: C.white, padding: "10px 16px", alignItems: "center", gap: 12 }}>
        <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu"
          style={{ background: "none", border: "none", color: C.white, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4 }}>☰</button>
        <span style={{ fontWeight: 700 }}>Logi Flow</span>
      </header>
      <div className={`erp-fundo${menuAberto ? " aberto" : ""}`} onClick={() => setMenuAberto(false)} />
      <Sidebar active={tela} onNav={(id) => { setTela(id); setMenuAberto(false); }} aberto={menuAberto}
        nicho={config.nicho} usuario={usuario}
        onSenha={() => { setTrocandoSenha(true); setMenuAberto(false); }} onLogout={sair} />
      <main className="erp-main" style={{ flex: 1, padding: "36px 40px", overflowY: "auto", minWidth: 0 }}>
        {renderTela()}
      </main>
      {trocandoSenha && <AlterarSenha onConcluido={() => setTrocandoSenha(false)} onCancelar={() => setTrocandoSenha(false)} />}
    </div>
  );
}