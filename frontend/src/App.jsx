import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

// ── Paleta de cores ──────────────────────────────────────────
const C = {
  navyDark: "#1A2B4A",
  navyMid: "#2E4D80",
  navyLight: "#3D6199",
  white: "#FFFFFF",
  bgPage: "#F0F3F8",
  bgCard: "#FFFFFF",
  grayMid: "#6B7A99",
  grayLight: "#D1D9E8",
  green: "#22A869",
  greenBg: "#E6F7F0",
  red: "#E04444",
  redBg: "#FDEAEA",
  yellow: "#F5A623",
  yellowBg: "#FEF6E7",
};

// ── Ícones SVG inline ────────────────────────────────────────
const Icon = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  stock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    </svg>
  ),
  cashflow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  register: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  arrowUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  ),
  arrowDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
    </svg>
  ),
  alert: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  ),
};

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Componente: Sidebar ──────────────────────────────────────
function Sidebar({ active, onNav, onLogout }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: Icon.dashboard },
    { id: "estoque", label: "Estoque", icon: Icon.stock },
    { id: "fluxo", label: "Fluxo de Caixa", icon: Icon.cashflow },
    { id: "cadastro", label: "Cadastrar Produto", icon: Icon.register },
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

// ── Componente: Card de Stat ─────────────────────────────────
function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: C.bgCard, borderRadius: 12, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(26,43,74,0.08)", flex: 1, minWidth: 160,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: C.grayMid, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{label}</div>
          <div style={{ color: C.navyDark, fontSize: 26, fontWeight: 700 }}>{value}</div>
          {sub && <div style={{ color, fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>{icon}{sub}</div>}
        </div>
      </div>
    </div>
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
  const mesLabel = (m) => m.split("-").reverse().join("/");
  const entradas = resumo.faturamento;
  const saidas = resumo.custo + resumo.despesas;
  const saldo = resumo.lucro;
  const th = { padding: "10px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 };
  const td = { padding: "12px 16px", fontSize: 13, color: C.navyDark };
  const painel = { background: C.bgCard, borderRadius: 12, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", overflow: "hidden", marginBottom: 28 };
  const painelTitulo = { padding: "18px 24px", borderBottom: `1px solid ${C.grayLight}`, color: C.navyDark, fontWeight: 600, fontSize: 15 };

  return (
    <div>
      {titulo}

      {/* Cards (mês atual) */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Total Entradas" value={fmt(entradas)} sub={`vendas em ${mesLabel(resumo.mes)}`} color={C.green} icon={Icon.arrowUp} />
        <StatCard label="Total Saídas" value={fmt(saidas)} sub="custo dos produtos + despesas" color={C.red} icon={Icon.arrowDown} />
        <StatCard label="Saldo" value={fmt(saldo)} sub={saldo >= 0 ? "lucro líquido do mês" : "prejuízo no mês"} color={saldo >= 0 ? C.green : C.red} />
        <StatCard label="Alertas Estoque" value={alertas.length} sub={alertas.length > 0 ? "produtos para repor" : "tudo em ordem"} color={alertas.length > 0 ? C.yellow : C.green} icon={alertas.length > 0 ? Icon.alert : null} />
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
                {["Mês", "Faturamento", "Custo dos produtos", "Despesas", "Lucro líquido"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {dre.map(d => (
                <tr key={d.Mes} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>{mesLabel(d.Mes)}</td>
                  <td style={td}>{fmt(d.Faturamento_Real_Recebido)}</td>
                  <td style={td}>{fmt(d.Custo_Produtos)}</td>
                  <td style={td}>{fmt(d.Despesas_Operacionais)}</td>
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

// ── Tela: Estoque ────────────────────────────────────────────
function Estoque({ products }) {
  const [busca, setBusca] = useState("");
  const filtrados = products.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Estoque</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>{products.length} produtos cadastrados</p>

      {/* Busca */}
      <input
        placeholder="Buscar produto ou categoria..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        style={{
          width: "100%", maxWidth: 360, padding: "10px 14px", borderRadius: 8,
          border: `1.5px solid ${C.grayLight}`, fontSize: 14, marginBottom: 20,
          outline: "none", fontFamily: "inherit", boxSizing: "border-box",
          color: C.navyDark,
        }}
      />

      <div style={{ background: C.bgCard, borderRadius: 12, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Produto", "Categoria", "Estoque", "Mínimo", "Preço Unitário", "Status"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const baixo = p.estoque < p.minimo;
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: C.navyDark, fontSize: 14 }}>{p.nome}</td>
                  <td style={{ padding: "14px 16px", color: C.grayMid, fontSize: 13 }}>{p.categoria}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: baixo ? C.red : C.navyDark }}>{p.estoque}</span>
                  </td>
                  <td style={{ padding: "14px 16px", color: C.grayMid, fontSize: 13 }}>{p.minimo}</td>
                  <td style={{ padding: "14px 16px", color: C.navyDark, fontSize: 13, fontWeight: 500 }}>{fmt(p.preco)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      background: baixo ? C.yellowBg : C.greenBg,
                      color: baixo ? C.yellow : C.green,
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      {baixo ? <>{Icon.alert} Estoque baixo</> : "OK"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhum produto encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Recibo da venda: QR Code Pix + WhatsApp ──────────────────
function ReciboVenda({ recibo, onClose }) {
  const [telefone, setTelefone] = useState("");
  const [aviso, setAviso] = useState("");
  const [copiado, setCopiado] = useState(false);
  const { loja, venda, itens, pix, pix_configurado } = recibo;

  // Texto que será enviado ao cliente
  const montarMensagem = () => {
    const linhas = [`*${loja}* - Resumo da compra`, `Venda #${venda.id_venda} - ${venda.data_venda}`, ""];
    itens.forEach(i => linhas.push(`${i.quantidade}x ${i.produto} - ${fmt(i.subtotal)}`));
    linhas.push("");
    if (venda.valor_desconto > 0) linhas.push(`Desconto: ${fmt(venda.valor_desconto)}`);
    linhas.push(`*Total: ${fmt(venda.valor_a_receber)}*`);
    if (pix) linhas.push("", "Pague com Pix (copia e cola):", pix.payload);
    linhas.push("", "Obrigado pela preferência!");
    return linhas.join("\n");
  };

  const abrirWhatsApp = () => {
    const digitos = telefone.replace(/\D/g, "");
    let numero = "";
    if (digitos) {
      numero = digitos.length <= 11 ? "55" + digitos : digitos; // acrescenta o código do Brasil
      if (numero.length < 12 || numero.length > 13) {
        setAviso("Digite o DDD + número. Ex.: 11 91234-5678");
        return;
      }
    }
    setAviso("");
    // Sem número, o WhatsApp deixa você escolher o contato
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(montarMensagem())}`, "_blank", "noopener,noreferrer");
  };

  const copiarPix = async () => {
    try {
      await navigator.clipboard.writeText(pix.payload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {
      setAviso("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  };

  const secao = { borderTop: `1px solid ${C.grayLight}`, paddingTop: 18, marginTop: 18 };
  const botao = { background: C.navyDark, color: C.white, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,43,74,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: C.bgCard, borderRadius: 14, padding: 28, width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(26,43,74,0.3)" }}>
        <div style={{ color: C.green, fontWeight: 700, fontSize: 18 }}>✅ Venda #{venda.id_venda} registrada</div>
        <div style={{ color: C.grayMid, fontSize: 13, marginTop: 4, marginBottom: 16 }}>{venda.data_venda}</div>

        {itens.map((i, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.navyDark, padding: "4px 0" }}>
            <span>{i.quantidade}x {i.produto}</span>
            <span>{fmt(i.subtotal)}</span>
          </div>
        ))}
        {venda.valor_desconto > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.grayMid, padding: "4px 0" }}>
            <span>Desconto</span><span>- {fmt(venda.valor_desconto)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 700, color: C.navyDark, marginTop: 10 }}>
          <span>Total</span><span>{fmt(venda.valor_a_receber)}</span>
        </div>

        {/* Pix */}
        <div style={secao}>
          <div style={{ fontWeight: 600, color: C.navyDark, marginBottom: 10 }}>Pagamento via Pix</div>
          {pix ? (
            <>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: `1px solid ${C.grayLight}` }}>
                  <QRCodeSVG value={pix.payload} size={190} level="M" />
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.grayMid, textAlign: "center", margin: "8px 0 10px" }}>
                O cliente escaneia com o app do banco. Valor: {fmt(venda.valor_a_receber)}
              </div>
              <textarea readOnly value={pix.payload} rows={3}
                style={{ width: "100%", boxSizing: "border-box", fontSize: 11, padding: 8, borderRadius: 7, border: `1.5px solid ${C.grayLight}`, color: C.navyDark, fontFamily: "monospace", resize: "none" }} />
              <button onClick={copiarPix} style={{ ...botao, width: "100%", marginTop: 8 }}>
                {copiado ? "✔ Copiado!" : "Copiar Pix Copia e Cola"}
              </button>
              <div style={{ fontSize: 11, color: C.grayMid, marginTop: 6 }}>
                Este Pix não confirma o pagamento sozinho: confira no app do seu banco antes de liberar o produto.
              </div>
            </>
          ) : (
            <div style={{ background: C.yellowBg, color: C.grayMid, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
              {pix_configurado
                ? "Esta venda não tem valor a receber."
                : "Pix ainda não configurado. Adicione PIX_CHAVE, PIX_NOME e PIX_CIDADE no arquivo .env do backend."}
            </div>
          )}
        </div>

        {/* WhatsApp */}
        <div style={secao}>
          <div style={{ fontWeight: 600, color: C.navyDark, marginBottom: 10 }}>Enviar resumo pelo WhatsApp</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="DDD + número (opcional)" value={telefone} onChange={e => setTelefone(e.target.value)}
              style={{ flex: 1, padding: "9px 12px", borderRadius: 7, border: `1.5px solid ${C.grayLight}`, fontSize: 13, fontFamily: "inherit", color: C.navyDark, outline: "none" }} />
            <button onClick={abrirWhatsApp} style={{ ...botao, background: "#25D366" }}>Enviar</button>
          </div>
          {aviso && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{aviso}</div>}
        </div>

        <button onClick={onClose} style={{ ...botao, width: "100%", marginTop: 22, background: C.white, color: C.navyDark, border: `1.5px solid ${C.grayLight}` }}>Fechar</button>
      </div>
    </div>
  );
}

// ── Tela: Fluxo de Caixa ─────────────────────────────────────
function FluxoCaixa({ transactions, setTransactions, products, atualizarLista, idCaixa, setIdCaixa }) {
  const hoje = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD no fuso local
  const formVazio = () => ({ data: hoje(), tipo: "entrada", produto: "", qtd: "", valor: "", obs: "" });

  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState(formVazio);
  const [erro, setErro] = useState("");
  const [trocoInicial, setTrocoInicial] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [recibo, setRecibo] = useState(null); // recibo da última venda (Pix + WhatsApp)

  const arredondar = (n) => Math.round(n * 100) / 100;
  const lerResposta = async (response) => { try { return await response.json(); } catch { return {}; } };

  // Valor da venda = preço do produto x quantidade (calculado, para bater com o total no banco)
  const calcularValor = (nomeProduto, qtd) => {
    const prod = products.find(p => p.nome === nomeProduto);
    if (!prod) return "";
    return arredondar(prod.preco * (Number(qtd) || 1));
  };

  const filtrados = transactions
    .filter(t => filtro === "todos" || t.tipo === filtro)
    .sort((a, b) => b.data.localeCompare(a.data));

  const totalEntradas = transactions.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
  const totalSaidas = transactions.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);

  const handleAbrirCaixa = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/caixa/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ troco_inicial: Number(trocoInicial) || 0 })
      });
      const data = await lerResposta(response);
      if (response.ok) { setIdCaixa(data.id_caixa); setErro(""); }
      else setErro(data.erro || "Erro ao abrir o caixa.");
    } catch (e) { setErro("Falha na comunicação com o backend."); }
  };

  const handleFecharCaixa = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/caixa/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_caixa: idCaixa })
      });
      const data = await lerResposta(response);
      if (!response.ok) { setErro(data.erro || "Erro ao fechar o caixa."); return; }
      setIdCaixa(null);
      setTransactions([]); // Limpa as movimentações da tela no fim do turno
      setTrocoInicial("");
      setErro("");
      alert("Caixa fechado com sucesso!");
    } catch (e) { setErro("Falha na comunicação com o backend."); }
  };

  const handleAdd = async () => {
    if (salvando) return;
    if (!form.data || !form.valor || Number(form.valor) <= 0) {
      setErro("Preencha a data e um valor maior que zero.");
      return;
    }

    setSalvando(true);
    try {
      if (form.tipo === "entrada") {
        // ENTRADA = VENDA: vai para o Node.js, que chama sp_RegistrarVenda e baixa o estoque
        if (!idCaixa) { setErro("Abra o caixa antes de registrar uma venda."); return; }
        if (!form.produto || !form.qtd || Number(form.qtd) < 1) {
          setErro("Selecione o produto e a quantidade.");
          return;
        }
        const produtoSelecionado = products.find(p => p.nome === form.produto);
        if (!produtoSelecionado) { setErro("Produto não encontrado. Recarregue a página."); return; }

        const response = await fetch("http://localhost:3000/api/vendas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_caixa: idCaixa,
            valor_desconto: 0,
            itens: [{ codigo_barras: produtoSelecionado.codigo_barras, quantidade: Number(form.qtd) }],
            pagamentos: [{ forma_pagamento: "PIX", valor_pago: arredondar(Number(form.valor)) }]
          })
        });
        const data = await lerResposta(response);
        if (!response.ok) { setErro(data.erro || "Erro no servidor ao registrar a venda."); return; }

        const nova = { id: Date.now(), ...form, qtd: Number(form.qtd), valor: Number(form.valor) };
        setTransactions(prev => [...prev, nova]);
        atualizarLista(); // Atualiza o estoque na tela na hora

        // Busca o recibo da venda (itens, total e Pix) para mostrar o QR Code e o botão do WhatsApp
        try {
          const rr = await fetch(`http://localhost:3000/api/vendas/${data.id_venda}/recibo`);
          if (rr.ok) setRecibo(await rr.json());
        } catch (e) { /* a venda já foi salva; o recibo é um extra */ }
      } else {
        // SAÍDA = DESPESA: grava na tabela Despesas
        const response = await fetch("http://localhost:3000/api/despesas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descricao: form.obs, valor_total: Number(form.valor) })
        });
        const data = await lerResposta(response);
        if (!response.ok) { setErro(data.erro || "Erro ao registrar a despesa."); return; }

        const nova = { id: Date.now(), ...form, produto: "Despesa", qtd: "-", valor: Number(form.valor) };
        setTransactions(prev => [...prev, nova]);
      }
      setForm(formVazio());
      setErro("");
    } catch (error) {
      setErro("Falha na comunicação com o backend.");
    } finally {
      setSalvando(false);
    }
  };

  const inputStyle = {
    padding: "9px 12px", borderRadius: 7, border: `1.5px solid ${C.grayLight}`,
    fontSize: 13, fontFamily: "inherit", color: C.navyDark, outline: "none",
    background: C.white,
  };

  return (
    <div>
      {recibo && <ReciboVenda recibo={recibo} onClose={() => setRecibo(null)} />}
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Fluxo de Caixa</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>Registre entradas (vendas) e saídas (despesas)</p>

      {/* Painel do caixa */}
      <div style={{ background: C.bgCard, borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, boxShadow: "0 1px 4px rgba(26,43,74,0.08)" }}>
        {idCaixa ? (
          <>
            <div><span style={{ color: C.green, fontWeight: "bold" }}>✅ Caixa Aberto</span> (Turno #{idCaixa})</div>
            <button onClick={handleFecharCaixa} style={{ background: C.red, color: C.white, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: "bold", fontFamily: "inherit" }}>Fechar Caixa</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: C.grayMid, fontWeight: "bold" }}>🔒 Caixa Fechado</span>
              <input type="number" placeholder="Troco Inicial (R$)" value={trocoInicial} onChange={e => setTrocoInicial(e.target.value)} style={inputStyle} min="0" />
            </div>
            <button onClick={handleAbrirCaixa} style={{ background: C.navyDark, color: C.white, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: "bold", fontFamily: "inherit" }}>Abrir Caixa</button>
          </>
        )}
      </div>

      {/* Resumo */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <StatCard label="Entradas" value={fmt(totalEntradas)} color={C.green} sub="neste turno" icon={Icon.arrowUp} />
        <StatCard label="Saídas" value={fmt(totalSaidas)} color={C.red} sub="neste turno" icon={Icon.arrowDown} />
        <StatCard label="Saldo" value={fmt(totalEntradas - totalSaidas)} color={totalEntradas - totalSaidas >= 0 ? C.green : C.red} sub="neste turno" />
      </div>

      {/* Formulário de nova movimentação */}
      <div style={{ background: C.bgCard, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", marginBottom: 28 }}>
        <div style={{ fontWeight: 600, color: C.navyDark, marginBottom: 16, fontSize: 15 }}>Nova Movimentação</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}
            style={{ ...inputStyle, flex: "1 1 140px" }} />

          {/* Tipo: entrada (venda) ou saída (despesa) */}
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, produto: "", qtd: "", valor: "" })}
            style={{ ...inputStyle, flex: "1 1 140px" }}>
            <option value="entrada">Entrada (Venda)</option>
            <option value="saida">Saída (Despesa)</option>
          </select>

          {/* Produto e quantidade só aparecem para vendas */}
          {form.tipo === "entrada" && (
            <>
              <select value={form.produto}
                onChange={e => setForm({ ...form, produto: e.target.value, valor: calcularValor(e.target.value, form.qtd) })}
                style={{ ...inputStyle, flex: "1 1 160px" }}>
                <option value="">Selecione o produto</option>
                {products.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
              </select>
              <input type="number" placeholder="Qtd *" value={form.qtd}
                onChange={e => setForm({ ...form, qtd: e.target.value, valor: form.produto ? calcularValor(form.produto, e.target.value) : form.valor })}
                style={{ ...inputStyle, flex: "1 1 80px" }} min="1" />
            </>
          )}

          <input type="number" placeholder="Valor R$ *" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
            style={{ ...inputStyle, flex: "1 1 120px" }} min="0" step="0.01" />
          <input placeholder={form.tipo === "saida" ? "Descrição da despesa *" : "Observação"} value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })}
            style={{ ...inputStyle, flex: "2 1 200px" }} />
          <button onClick={handleAdd} disabled={salvando} style={{
            background: C.navyDark, color: C.white, border: "none", borderRadius: 8,
            padding: "9px 22px", fontSize: 14, fontWeight: 600, cursor: salvando ? "wait" : "pointer",
            fontFamily: "inherit", flex: "0 0 auto", opacity: salvando ? 0.7 : 1,
          }}>{salvando ? "Salvando..." : "Registrar"}</button>
        </div>
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

      <div style={{ background: C.bgCard, borderRadius: 12, boxShadow: "0 1px 4px rgba(26,43,74,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Data", "Tipo", "Produto", "Qtd", "Valor", "Observação"].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((t) => (
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
  const [form, setForm] = useState({ nome: "", categoria: "", estoque: "", minimo: "", preco: "" });
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const handleSalvar = async () => {
    if (!form.nome || !form.categoria || !form.estoque || !form.minimo || !form.preco) {
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
          preco_custo: Number(form.preco) * 0.5 // Custo de mentirinha só pra preencher o banco
        })
      });

      if (response.ok) {
        setForm({ nome: "", categoria: "", estoque: "", minimo: "", preco: "" });
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
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Preço Unitário (R$) *</label>
            <input type="number" placeholder="0.00" min="0" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} style={inputStyle} />
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

// ── Hook LocalStorage ────────────────────────────────────────
function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch { return initial; }
  });
  const set = (v) => {
    const next = typeof v === "function" ? v(value) : v;
    setValue(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  return [value, set];
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

  useEffect(() => {
    if (logado) {
      buscarProdutos();
      buscarCaixaAberto();
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
      })));
    } catch (erro) {
      console.error("Erro ao buscar produtos do backend:", erro);
    }
  };

  const renderTela = () => {
    switch (tela) {
      case "dashboard": return <Dashboard products={products} transactions={transactions} />;
      case "estoque": return <Estoque products={products} />;
      case "fluxo": return <FluxoCaixa transactions={transactions} setTransactions={setTransactions} products={products} atualizarLista={buscarProdutos} idCaixa={idCaixa} setIdCaixa={setIdCaixa} />;
      // Passamos a função buscarProdutos para o Cadastro atualizar a lista na hora
      case "cadastro": return <CadastroProduto products={products} atualizarLista={buscarProdutos} />;
      default: return null;
    }
  };

  if (!logado) return <Login onLogin={() => { localStorage.setItem("lf_logado", "true"); setLogado(true); }} />;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', sans-serif", background: C.bgPage }}>
      <Sidebar active={tela} onNav={setTela} onLogout={() => { localStorage.removeItem("lf_logado"); setLogado(false); }} />
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

