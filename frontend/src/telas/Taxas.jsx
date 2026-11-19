import { useState, useEffect } from "react";
import { C, fmt, api, inputStyle, botao, cartao } from "../comum.jsx";

const FORMAS = [
  { id: "DINHEIRO", label: "Dinheiro" },
  { id: "PIX", label: "Pix" },
  { id: "CARTAO_DEBITO", label: "Cartão de débito" },
  { id: "CARTAO_CREDITO", label: "Cartão de crédito" },
];

// Taxa (%) que a maquininha/banco cobra de cada forma de pagamento.
// Entra no fechamento de caixa e na DRE para mostrar o lucro líquido real.
export default function Taxas() {
  const [valores, setValores] = useState({}); // forma -> texto digitado
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api("/taxas").then(r => {
      if (!ativo) return;
      if (r.ok) {
        const mapa = {};
        r.data.forEach(t => { mapa[t.forma_pagamento] = String(t.taxa_percentual); });
        setValores(mapa);
      } else {
        setErro(r.erro);
      }
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, []);

  const salvar = async () => {
    setErro(""); setOk("");
    const taxas = [];
    for (const f of FORMAS) {
      const n = Number(String(valores[f.id] ?? "0").replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setErro(`Taxa inválida em "${f.label}". Use um número entre 0 e 100.`);
        return;
      }
      taxas.push({ forma_pagamento: f.id, taxa_percentual: n });
    }
    setSalvando(true);
    const r = await api("/taxas", { method: "PUT", corpo: { taxas } });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setOk(r.data.mensagem || "Taxas salvas!");
    setTimeout(() => setOk(""), 4000);
  };

  return (
    <div style={{ ...cartao, padding: 24, maxWidth: 760, marginTop: 28 }}>
      <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Taxas da maquininha</div>
      <p style={{ color: C.grayMid, fontSize: 13, marginTop: 0, marginBottom: 18 }}>
        Informe o percentual que cada forma de pagamento custa. O fechamento de caixa e a DRE passam a mostrar o lucro líquido
        real, já descontando as taxas. Vale para as vendas feitas <b>daqui para frente</b>; as antigas continuam sem taxa.
      </p>

      {carregando ? (
        <div style={{ color: C.grayMid, fontSize: 13 }}>Carregando...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
          {FORMAS.map(f => {
            const pct = Number(String(valores[f.id] ?? "0").replace(",", ".")) || 0;
            return (
              <div key={f.id}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>{f.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min="0" max="100" step="0.01" value={valores[f.id] ?? ""}
                    onChange={e => setValores({ ...valores, [f.id]: e.target.value })}
                    style={{ ...inputStyle, width: "100%" }} />
                  <span style={{ color: C.grayMid, fontSize: 14 }}>%</span>
                </div>
                <div style={{ fontSize: 12, color: C.grayMid, marginTop: 4 }}>
                  Em {fmt(100)} → taxa de <b>{fmt(pct)}</b>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 16 }}>{erro}</div>}
      {ok && <div style={{ color: C.green, background: C.greenBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 16 }}>✓ {ok}</div>}

      <button onClick={salvar} disabled={salvando || carregando} style={{ ...botao, marginTop: 18, opacity: salvando ? 0.7 : 1 }}>
        {salvando ? "Salvando..." : "Salvar taxas"}
      </button>
    </div>
  );
}