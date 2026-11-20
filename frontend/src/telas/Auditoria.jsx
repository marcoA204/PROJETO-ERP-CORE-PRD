import { useState, useEffect } from "react";
import { C, fmt, api, inputStyle, cartao } from "../comum.jsx";

const th = { padding: "11px 14px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 };
const td = { padding: "11px 14px", fontSize: 13, color: C.navyDark };

// ── Aba 1: quem mexeu no estoque, quanto, e qual o saldo que ficou ──
function MovimentosEstoque() {
  const [dias, setDias] = useState(30);
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState({ dados: null, erro: "" });

  useEffect(() => {
    let ativo = true;
    api(`/auditoria/estoque?dias=${dias}${tipo ? `&tipo=${tipo}` : ""}`).then(r => {
      if (ativo) setEstado(r.ok ? { dados: r.data, erro: "" } : { dados: null, erro: r.erro });
    });
    return () => { ativo = false; };
  }, [dias, tipo]);

  const termo = busca.trim().toLowerCase();
  const linhas = (estado.dados || []).filter(m =>
    !termo || m.produto.toLowerCase().includes(termo) || (m.usuario_responsavel || "").toLowerCase().includes(termo) || (m.motivo || "").toLowerCase().includes(termo)
  );

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <input placeholder="Buscar produto, usuário ou motivo..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 240px", padding: "10px 14px", fontSize: 14 }} />
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle}>
          <option value="">Entradas e saídas</option>
          <option value="ENTRADA">Só entradas</option>
          <option value="SAIDA">Só saídas</option>
        </select>
        <select value={dias} onChange={e => setDias(Number(e.target.value))} style={inputStyle}>
          {[7, 30, 90, 365].map(d => <option key={d} value={d}>Últimos {d} dias</option>)}
        </select>
      </div>

      {estado.erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{estado.erro}</div>}

      <div style={{ ...cartao, overflow: "hidden" }}>
        <div style={{ maxHeight: 560, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bgPage, position: "sticky", top: 0 }}>
                {["Data e hora", "Produto", "Movimento", "Qtd", "Saldo após", "Motivo", "Quem fez"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {linhas.map(m => {
                const entrada = m.tipo_movimento === "ENTRADA";
                return (
                  <tr key={m.id_movimento} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                    <td style={{ ...td, color: C.grayMid, whiteSpace: "nowrap" }}>{m.data}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{m.produto}</td>
                    <td style={td}>
                      <span style={{ background: entrada ? C.greenBg : C.redBg, color: entrada ? C.green : C.red, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {entrada ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 600, color: entrada ? C.green : C.red }}>{entrada ? "+" : "−"}{m.quantidade}</td>
                    <td style={td}>{m.estoque_resultante ?? "—"}</td>
                    <td style={{ ...td, color: C.grayMid }}>{m.motivo}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{m.usuario_responsavel}</td>
                  </tr>
                );
              })}
              {estado.dados && linhas.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhuma movimentação encontrada.</td></tr>
              )}
              {!estado.dados && !estado.erro && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Carregando...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.grayMid, marginTop: 8 }}>
        Mostra até as 500 movimentações mais recentes do período. Movimentos feitos antes da Etapa 4 aparecem como "Sistema".
      </div>
    </>
  );
}

// ── Aba 2: erros que as procedures do banco registraram ──
function ErrosDoSistema() {
  const [estado, setEstado] = useState({ dados: null, erro: "" });

  useEffect(() => {
    let ativo = true;
    api("/auditoria/erros").then(r => {
      if (ativo) setEstado(r.ok ? { dados: r.data, erro: "" } : { dados: null, erro: r.erro });
    });
    return () => { ativo = false; };
  }, []);

  return (
    <>
      {estado.erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{estado.erro}</div>}
      <div style={{ ...cartao, overflow: "hidden" }}>
        <div style={{ maxHeight: 560, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bgPage, position: "sticky", top: 0 }}>
                {["Data e hora", "Onde", "Código", "O que aconteceu", "Dados da chamada"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(estado.dados || []).map(e => (
                <tr key={e.id_erro} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ ...td, color: C.grayMid, whiteSpace: "nowrap" }}>{e.data}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{e.origem || "—"}</td>
                  <td style={td}>{e.numero_erro ?? "—"}</td>
                  <td style={{ ...td, color: C.red }}>{e.mensagem}</td>
                  <td style={{ ...td, color: C.grayMid, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.detalhes || ""}>{e.detalhes || "—"}</td>
                </tr>
              ))}
              {estado.dados && estado.dados.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>🎉 Nenhum erro registrado.</td></tr>
              )}
              {!estado.dados && !estado.erro && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Carregando...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.grayMid, marginTop: 8 }}>Últimos 100 erros. Passe o mouse sobre "Dados da chamada" para ver o texto completo.</div>
    </>
  );
}

// ── Tela ──
export default function Auditoria() {
  const [aba, setAba] = useState("estoque");
  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Auditoria</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>Rastro de tudo que mexeu no estoque (quem, quanto e qual o saldo que ficou) e dos erros do sistema.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["estoque", "Movimentação de estoque"], ["erros", "Erros do sistema"]].map(([id, nome]) => (
          <button key={id} onClick={() => setAba(id)} style={{
            padding: "8px 18px", borderRadius: 20, border: `1.5px solid ${aba === id ? C.navyDark : C.grayLight}`,
            background: aba === id ? C.navyDark : C.white, color: aba === id ? C.white : C.grayMid,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>{nome}</button>
        ))}
      </div>

      {aba === "estoque" ? <MovimentosEstoque /> : <ErrosDoSistema />}
    </div>
  );
}