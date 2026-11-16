import { useState, useEffect } from "react";
import { C, fmt, api, inputStyle, botao, botaoClaro, cartao, Modal, ReciboVenda } from "../comum.jsx";

export default function Vendas({ atualizarLista }) {
  const [vendas, setVendas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [recibo, setRecibo] = useState(null);
  const [cancelando, setCancelando] = useState(null); // venda escolhida para cancelar
  const [motivo, setMotivo] = useState("");
  const [erroCancelar, setErroCancelar] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const r = await api("/vendas?limite=100");
    if (r.ok) { setVendas(r.data); setErro(""); } else { setErro(r.erro); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const verRecibo = async (v) => {
    const r = await api(`/vendas/${v.id_venda}/recibo`);
    if (r.ok) { setRecibo(r.data); setErro(""); } else { setErro(r.erro); }
  };

  const abrirCancelamento = (v) => { setCancelando(v); setMotivo(""); setErroCancelar(""); };

  const confirmarCancelamento = async () => {
    setSalvando(true);
    const r = await api(`/vendas/${cancelando.id_venda}/cancelar`, { method: "POST", corpo: { motivo } });
    setSalvando(false);
    if (!r.ok) { setErroCancelar(r.erro); return; }
    setCancelando(null);
    carregar();
    atualizarLista(); // o estoque voltou
  };

  const chip = (status) => {
    const cancelada = status === "CANCELADA";
    return (
      <span style={{
        background: cancelada ? C.redBg : C.greenBg, color: cancelada ? C.red : C.green,
        padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      }}>{cancelada ? "Cancelada" : "Concluída"}</span>
    );
  };

  const btn = { ...botaoClaro, padding: "5px 12px", fontSize: 12 };

  return (
    <div>
      {recibo && <ReciboVenda recibo={recibo} onClose={() => setRecibo(null)} />}

      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Histórico de Vendas</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>Últimas 100 vendas. Reimprima o recibo ou cancele (os itens voltam ao estoque).</p>

      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{erro}</div>}

      <div style={{ ...cartao, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Venda", "Data", "Turno", "Itens", "Total", "Status", "Ações"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendas.map(v => (
              <tr key={v.id_venda} style={{ borderTop: `1px solid ${C.grayLight}`, opacity: v.status_venda === "CANCELADA" ? 0.65 : 1 }}>
                <td style={{ padding: "13px 16px", fontWeight: 700, color: C.navyDark, fontSize: 14 }}>#{v.id_venda}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>{v.data_venda}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>#{v.turno}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.navyDark }}>{v.qtd_itens}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: C.navyDark }}>{fmt(v.valor_a_receber)}</td>
                <td style={{ padding: "13px 16px" }}>{chip(v.status_venda)}</td>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => verRecibo(v)} style={btn}>Recibo</button>
                    {v.status_venda === "CONCLUIDA" && (
                      <button onClick={() => abrirCancelamento(v)} style={{ ...btn, color: C.red }}>Cancelar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!carregando && vendas.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhuma venda registrada ainda.</td></tr>
            )}
            {carregando && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Carregando...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {cancelando && (
        <Modal titulo={`Cancelar a venda #${cancelando.id_venda}?`}>
          <p style={{ color: C.grayMid, fontSize: 14, marginTop: 0 }}>
            Total de <b>{fmt(cancelando.valor_a_receber)}</b>. Os {cancelando.qtd_itens} item(ns) voltam ao estoque e a venda
            deixa de contar no caixa e na DRE. Só é possível com o caixa do turno ainda aberto.
          </p>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 }}>Motivo (opcional)</label>
          <input placeholder="Ex.: cliente desistiu" value={motivo} onChange={e => setMotivo(e.target.value)}
            style={{ ...inputStyle, width: "100%", padding: "10px 14px", fontSize: 14 }} />
          {erroCancelar && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>{erroCancelar}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setCancelando(null)} style={botaoClaro}>Voltar</button>
            <button onClick={confirmarCancelamento} disabled={salvando} style={{ ...botao, flex: 1, background: C.red }}>
              {salvando ? "Cancelando..." : "Cancelar venda"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
