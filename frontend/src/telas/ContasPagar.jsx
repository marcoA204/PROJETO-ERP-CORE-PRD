import { useState, useEffect } from "react";
import { C, Icon, fmt, api, inputStyle, botao, botaoClaro, cartao, StatCard, COR_SITUACAO } from "../comum.jsx";

const hoje = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD no fuso local

export default function ContasPagar() {
  const [contas, setContas] = useState([]);
  const [filtro, setFiltro] = useState("pendentes");
  const [form, setForm] = useState({ descricao: "", vencimento: hoje(), valor: "", jaPaga: false });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const r = await api("/despesas");
    if (r.ok) { setContas(r.data); setErro(""); } else { setErro(r.erro); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const lancar = async () => {
    if (!form.descricao.trim() || !form.vencimento || !form.valor || Number(form.valor) <= 0) {
      setErro("Preencha a descrição, o vencimento e um valor maior que zero.");
      return;
    }
    setSalvando(true);
    const r = await api("/despesas", {
      method: "POST",
      corpo: { descricao: form.descricao, valor_total: Number(form.valor), data_vencimento: form.vencimento, pago: form.jaPaga },
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setForm({ descricao: "", vencimento: hoje(), valor: "", jaPaga: false });
    setErro("");
    carregar();
  };

  const darBaixa = async (c) => {
    if (!window.confirm(`Dar baixa em "${c.descricao}" (${fmt(c.valor_total)})?\nA conta será marcada como paga hoje.`)) return;
    const r = await api(`/despesas/${c.id_despesa}/pagar`, { method: "POST" });
    if (!r.ok) { setErro(r.erro); return; }
    setErro("");
    carregar();
  };

  const pendentes = contas.filter(c => c.status_pagamento === "PENDENTE");
  const atrasadas = pendentes.filter(c => c.situacao === "ATRASADA");
  const vencemHoje = pendentes.filter(c => c.situacao === "VENCE HOJE");
  const soma = (lista) => lista.reduce((s, c) => s + Number(c.valor_total), 0);

  const lista = {
    pendentes,
    atrasadas,
    pagas: contas.filter(c => c.status_pagamento === "PAGO"),
    todas: contas,
  }[filtro];

  const rotulo = { fontSize: 12, fontWeight: 600, color: C.grayMid, display: "block", marginBottom: 4 };

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Contas a Pagar</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>Lance contas futuras e dê baixa quando pagar</p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <StatCard label="A pagar (pendentes)" value={fmt(soma(pendentes))} sub={`${pendentes.length} conta(s)`} color={C.grayMid} />
        <StatCard label="Atrasadas" value={fmt(soma(atrasadas))} sub={`${atrasadas.length} conta(s)`} color={C.red} icon={atrasadas.length > 0 ? Icon.alert : null} />
        <StatCard label="Vencem hoje" value={fmt(soma(vencemHoje))} sub={`${vencemHoje.length} conta(s)`} color={C.yellow} />
      </div>

      {/* Lançar conta */}
      <div style={{ ...cartao, padding: 24, marginBottom: 28 }}>
        <div style={{ fontWeight: 600, color: C.navyDark, marginBottom: 14, fontSize: 15 }}>Lançar conta</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 220px" }}>
            <label style={rotulo}>Descrição *</label>
            <input placeholder="Ex.: Boleto fornecedor Tigre" value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={rotulo}>Vencimento *</label>
            <input type="date" value={form.vencimento}
              onChange={e => setForm({ ...form, vencimento: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={rotulo}>Valor (R$) *</label>
            <input type="number" min="0" step="0.01" placeholder="0,00" value={form.valor}
              onChange={e => setForm({ ...form, valor: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.navyDark, padding: "9px 0" }}>
            <input type="checkbox" checked={form.jaPaga} onChange={e => setForm({ ...form, jaPaga: e.target.checked })} />
            Já está paga
          </label>
          <button onClick={lancar} disabled={salvando} style={{ ...botao, opacity: salvando ? 0.7 : 1 }}>{salvando ? "Salvando..." : "Lançar"}</button>
        </div>
        {erro && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{erro}</div>}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["pendentes", "Pendentes"], ["atrasadas", "Atrasadas"], ["pagas", "Pagas"], ["todas", "Todas"]].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{
            padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${filtro === val ? C.navyDark : C.grayLight}`,
            background: filtro === val ? C.navyDark : C.white, color: filtro === val ? C.white : C.grayMid,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ ...cartao, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Descrição", "Vencimento", "Valor", "Situação", "Pago em", ""].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(c => {
              const [cor, fundo] = COR_SITUACAO[c.situacao] || [C.grayMid, C.bgPage];
              return (
                <tr key={c.id_despesa} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 600, color: C.navyDark }}>{c.descricao}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>{c.vencimento}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: C.navyDark }}>{fmt(c.valor_total)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ background: fundo, color: cor, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {c.situacao}
                      {c.status_pagamento === "PENDENTE" && c.situacao === "ATRASADA" ? ` (${Math.abs(c.dias_para_vencer)}d)` : ""}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>{c.pagamento || "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    {c.status_pagamento === "PENDENTE" && (
                      <button onClick={() => darBaixa(c)} style={{ ...botaoClaro, padding: "5px 12px", fontSize: 12 }}>Dar baixa</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!carregando && lista.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhuma conta nesta lista.</td></tr>
            )}
            {carregando && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Carregando...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
