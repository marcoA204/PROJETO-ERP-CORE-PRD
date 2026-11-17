import { useState, useEffect } from "react";
import { C, fmt, api, inputStyle, botao, botaoClaro, cartao, Modal } from "../comum.jsx";

// (11) 91234-5678
const formatarTelefone = (d) => {
  const n = String(d || "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
};
const formatarDocumento = (d) => {
  const n = String(d || "");
  if (n.length === 11) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
  if (n.length === 14) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
  return n;
};

const FORM_VAZIO = { nome: "", whatsapp: "", documento: "", observacoes: "" };

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const [modal, setModal] = useState(null); // { cliente } -> cliente null = novo
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroModal, setErroModal] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState(null); // { cliente, dados }

  const carregar = async () => {
    const r = await api("/clientes");
    if (r.ok) { setClientes(r.data); setErro(""); } else { setErro(r.erro); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const mostrarAviso = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3500); };

  const abrirNovo = () => { setForm(FORM_VAZIO); setErroModal(""); setModal({ cliente: null }); };
  const abrirEdicao = (c) => {
    setForm({ nome: c.nome, whatsapp: c.whatsapp || "", documento: c.documento || "", observacoes: c.observacoes || "" });
    setErroModal("");
    setModal({ cliente: c });
  };

  const salvar = async () => {
    if (!form.nome.trim()) { setErroModal("Informe o nome do cliente."); return; }
    setSalvando(true);
    const editando = modal.cliente;
    const r = await api(editando ? `/clientes/${editando.id_cliente}` : "/clientes", {
      method: editando ? "PUT" : "POST",
      corpo: form,
    });
    setSalvando(false);
    if (!r.ok) { setErroModal(r.erro); return; }
    setModal(null);
    mostrarAviso(editando ? "Cliente atualizado." : "Cliente cadastrado.");
    carregar();
  };

  const remover = async (c) => {
    if (!window.confirm(`Remover "${c.nome}" da lista de clientes?\n\nO histórico de compras dele é mantido.`)) return;
    const r = await api(`/clientes/${c.id_cliente}`, { method: "DELETE" });
    if (!r.ok) { setErro(r.erro); return; }
    setErro("");
    mostrarAviso("Cliente removido.");
    carregar();
  };

  const verCompras = async (c) => {
    const r = await api(`/clientes/${c.id_cliente}/historico`);
    if (!r.ok) { setErro(r.erro); return; }
    setHistorico({ cliente: c, dados: r.data });
  };

  const termo = busca.trim().toLowerCase();
  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(termo) || (c.whatsapp || "").includes(termo.replace(/\D/g, "") || "§") || (c.documento || "").includes(termo.replace(/\D/g, "") || "§")
  );

  const rotulo = { fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 };
  const campo = { ...inputStyle, width: "100%", padding: "10px 14px", fontSize: 14 };
  const btn = { ...botaoClaro, padding: "5px 10px", fontSize: 12 };

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Clientes</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>{clientes.length} cliente(s). Vincule vendas e orçamentos para ter o histórico e o WhatsApp à mão.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Buscar por nome, WhatsApp ou CPF/CNPJ..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...campo, maxWidth: 380 }} />
        <button onClick={abrirNovo} style={botao}>+ Novo cliente</button>
      </div>

      {aviso && <div style={{ color: C.green, background: C.greenBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>✓ {aviso}</div>}
      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{erro}</div>}

      <div style={{ ...cartao, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Cliente", "WhatsApp", "CPF/CNPJ", "Compras", "Total gasto", "Ações"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(c => (
              <tr key={c.id_cliente} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ fontWeight: 600, color: C.navyDark, fontSize: 14 }}>{c.nome}</div>
                  {c.observacoes && <div style={{ color: C.grayMid, fontSize: 12 }}>{c.observacoes}</div>}
                </td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.navyDark }}>{formatarTelefone(c.whatsapp) || "—"}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>{formatarDocumento(c.documento) || "—"}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.navyDark }}>{c.qtd_compras}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: C.navyDark }}>{fmt(c.total_gasto)}</td>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => verCompras(c)} style={btn}>Compras</button>
                    <button onClick={() => abrirEdicao(c)} style={btn}>Editar</button>
                    <button onClick={() => remover(c)} style={{ ...btn, color: C.red }}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
            {!carregando && filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhum cliente encontrado.</td></tr>
            )}
            {carregando && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Carregando...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Novo / editar */}
      {modal && (
        <Modal titulo={modal.cliente ? `Editar — ${modal.cliente.nome}` : "Novo cliente"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={rotulo}>Nome *</label>
              <input autoFocus value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={campo} />
            </div>
            <div>
              <label style={rotulo}>WhatsApp (com DDD)</label>
              <input placeholder="11 91234-5678" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={campo} />
            </div>
            <div>
              <label style={rotulo}>CPF ou CNPJ</label>
              <input placeholder="Somente números" value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} style={campo} />
            </div>
            <div>
              <label style={rotulo}>Observações</label>
              <input placeholder="Ex.: pedreiro, compra toda semana" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} style={campo} />
            </div>
          </div>
          {erroModal && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>{erroModal}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setModal(null)} style={botaoClaro}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ ...botao, flex: 1 }}>{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </Modal>
      )}

      {/* Histórico de compras */}
      {historico && (
        <Modal titulo={`Compras — ${historico.cliente.nome}`} largura={520}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
            <div><div style={{ color: C.grayMid, fontSize: 12 }}>Compras</div><div style={{ fontWeight: 700, fontSize: 18, color: C.navyDark }}>{historico.dados.resumo.qtd_compras}</div></div>
            <div><div style={{ color: C.grayMid, fontSize: 12 }}>Total gasto</div><div style={{ fontWeight: 700, fontSize: 18, color: C.navyDark }}>{fmt(historico.dados.resumo.total_gasto)}</div></div>
            <div><div style={{ color: C.grayMid, fontSize: 12 }}>Última compra</div><div style={{ fontWeight: 700, fontSize: 18, color: C.navyDark }}>{historico.dados.resumo.ultima_compra || "—"}</div></div>
          </div>
          {historico.dados.vendas.length === 0 ? (
            <div style={{ color: C.grayMid, fontSize: 13, padding: "12px 0" }}>Este cliente ainda não tem compras.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bgPage }}>
                  {["Venda", "Data", "Itens", "Total", "Status"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.dados.vendas.map(v => (
                  <tr key={v.id_venda} style={{ borderTop: `1px solid ${C.grayLight}`, opacity: v.status_venda === "CANCELADA" ? 0.6 : 1 }}>
                    <td style={{ padding: "9px 10px", fontSize: 13, fontWeight: 700, color: C.navyDark }}>#{v.id_venda}</td>
                    <td style={{ padding: "9px 10px", fontSize: 13, color: C.grayMid }}>{v.data_venda}</td>
                    <td style={{ padding: "9px 10px", fontSize: 13 }}>{v.qtd_itens}</td>
                    <td style={{ padding: "9px 10px", fontSize: 13, fontWeight: 600 }}>{fmt(v.valor_a_receber)}</td>
                    <td style={{ padding: "9px 10px", fontSize: 12, color: v.status_venda === "CANCELADA" ? C.red : C.green }}>
                      {v.status_venda === "CANCELADA" ? "Cancelada" : "Concluída"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button onClick={() => setHistorico(null)} style={{ ...botaoClaro, width: "100%", marginTop: 18 }}>Fechar</button>
        </Modal>
      )}
    </div>
  );
}