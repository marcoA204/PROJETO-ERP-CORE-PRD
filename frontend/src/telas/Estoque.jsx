import { useState } from "react";
import { C, Icon, fmt, api, inputStyle, botao, botaoClaro, cartao, Modal, rotulos } from "../comum.jsx";

export default function Estoque({ products, atualizarLista, nicho }) {
  const r = rotulos(nicho);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null); // { tipo: "entrada" | "editar", produto }
  const [form, setForm] = useState({});
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);

  const termo = busca.trim().toLowerCase();
  const filtrados = products.filter(p =>
    p.nome.toLowerCase().includes(termo) ||
    p.categoria.toLowerCase().includes(termo) ||
    (p.codigo_barras || "").includes(termo)
  );

  const mostrarAviso = (texto) => { setAviso(texto); setTimeout(() => setAviso(""), 3500); };

  const abrirEntrada = (p) => { setForm({ quantidade: "", motivo: "" }); setErro(""); setModal({ tipo: "entrada", produto: p }); };
  const abrirEdicao = (p) => {
    setForm({ nome: p.nome, categoria: p.categoria, custo: p.custo, preco: p.preco, minimo: p.minimo });
    setErro("");
    setModal({ tipo: "editar", produto: p });
  };

  const confirmarEntrada = async () => {
    const quantidade = Number(form.quantidade);
    if (!Number.isInteger(quantidade) || quantidade <= 0) { setErro("Informe uma quantidade inteira maior que zero."); return; }
    setSalvando(true);
    const r = await api(`/produtos/${modal.produto.id}/entrada`, { method: "POST", corpo: { quantidade, motivo: form.motivo } });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    mostrarAviso(`+${quantidade} un. de "${modal.produto.nome}". Novo estoque: ${r.data.estoque_atual}.`);
    setModal(null);
    atualizarLista();
  };

  const confirmarEdicao = async () => {
    if (!form.nome || form.custo === "" || form.preco === "" || form.minimo === "") { setErro("Preencha todos os campos."); return; }
    setSalvando(true);
    const r = await api(`/produtos/${modal.produto.id}`, {
      method: "PUT",
      corpo: {
        nome: form.nome,
        // "Geral" é só o nome que a tela mostra quando não há categoria
        nome_categoria: form.categoria === "Geral" ? "" : form.categoria,
        preco_custo: Number(form.custo),
        preco_venda: Number(form.preco),
        estoque_minimo: Number(form.minimo),
      },
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    mostrarAviso(`"${form.nome}" atualizado.`);
    setModal(null);
    atualizarLista();
  };

  const inativar = async (p) => {
    if (!window.confirm(`Inativar "${p.nome}"?\n\nEle sai do estoque e do PDV, mas o histórico de vendas é mantido.`)) return;
    const r = await api(`/produtos/${p.id}`, { method: "DELETE" });
    if (!r.ok) { setAviso(""); setErro(r.erro); return; }
    setErro("");
    mostrarAviso(`"${p.nome}" inativado.`);
    atualizarLista();
  };

  const rotulo = { fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 };
  const campoCheio = { ...inputStyle, width: "100%", padding: "10px 14px", fontSize: 14 };
  const btnAcao = { ...botaoClaro, padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 };

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>{r.estoque}</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>{products.length} {r.itens} ativos</p>

      <input placeholder="Buscar por nome, categoria ou código de barras..." value={busca} onChange={e => setBusca(e.target.value)}
        style={{ ...campoCheio, maxWidth: 360, marginBottom: 16 }} />

      {aviso && <div style={{ color: C.green, background: C.greenBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>✓ {aviso}</div>}
      {erro && !modal && <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{erro}</div>}

      <div style={{ ...cartao, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {[r.item, "Código", "Categoria", "Estoque", "Mínimo", "Custo", "Preço", "Status", "Ações"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(p => {
              const baixo = !p.temFicha && p.estoque <= p.minimo;
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: C.navyDark, fontSize: 14 }}>{p.nome}</td>
                  <td style={{ padding: "14px 16px", color: C.grayMid, fontSize: 12, fontFamily: "monospace" }}>{p.codigo_barras}</td>
                  <td style={{ padding: "14px 16px", color: C.grayMid, fontSize: 13 }}>{p.categoria}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: baixo ? C.red : C.navyDark }}>{p.temFicha ? "—" : p.estoque}</span>
                  </td>
                  <td style={{ padding: "14px 16px", color: C.grayMid, fontSize: 13 }}>{p.minimo}</td>
                  {/* Produto com receita: o custo real é a soma dos ingredientes, não o preço de custo gravado */}
                  <td style={{ padding: "14px 16px", color: C.grayMid, fontSize: 13 }}
                    title={p.temFicha ? "Custo da receita (soma dos ingredientes)" : undefined}>
                    {fmt((p.temFicha ? p.custoReceita : p.custo) || 0)}{p.temFicha && <span style={{ fontSize: 11 }}> (receita)</span>}
                  </td>
                  <td style={{ padding: "14px 16px", color: C.navyDark, fontSize: 13, fontWeight: 500 }}>{fmt(p.preco)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      background: baixo ? C.yellowBg : C.greenBg, color: baixo ? C.yellow : C.green,
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      {p.temFicha ? "Receita" : baixo ? <>{Icon.alert} Repor</> : "OK"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {!p.temFicha && <button onClick={() => abrirEntrada(p)} style={btnAcao}>{Icon.plus} Repor</button>}
                      <button onClick={() => abrirEdicao(p)} style={btnAcao}>{Icon.edit} Editar</button>
                      <button onClick={() => inativar(p)} style={{ ...btnAcao, color: C.red }}>{Icon.trash} Inativar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nada encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reposição */}
      {modal && modal.tipo === "entrada" && (
        <Modal titulo={`Repor estoque — ${modal.produto.nome}`}>
          <p style={{ color: C.grayMid, fontSize: 13, marginTop: 0 }}>Estoque atual: <b>{modal.produto.estoque}</b></p>
          <label style={rotulo}>Quantidade que chegou *</label>
          <input type="number" min="1" step="1" autoFocus value={form.quantidade}
            onChange={e => setForm({ ...form, quantidade: e.target.value })} style={{ ...campoCheio, marginBottom: 14 }} />
          <label style={rotulo}>Motivo / nota fiscal (opcional)</label>
          <input placeholder="Ex.: Compra fornecedor NF 1234" value={form.motivo}
            onChange={e => setForm({ ...form, motivo: e.target.value })} style={campoCheio} />
          {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>{erro}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setModal(null)} style={botaoClaro}>Cancelar</button>
            <button onClick={confirmarEntrada} disabled={salvando} style={{ ...botao, flex: 1 }}>{salvando ? "Salvando..." : "Confirmar entrada"}</button>
          </div>
        </Modal>
      )}

      {/* Edição */}
      {modal && modal.tipo === "editar" && (
        <Modal titulo={`Editar — ${modal.produto.nome}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, color: C.grayMid }}>
              Código de barras: <b style={{ fontFamily: "monospace", color: C.navyDark }}>{modal.produto.codigo_barras}</b>
            </div>
            <div>
              <label style={rotulo}>Nome *</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={campoCheio} />
            </div>
            <div>
              <label style={rotulo}>Categoria</label>
              <input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={campoCheio} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 140px" }}>
                <label style={rotulo}>Preço de custo (R$) *</label>
                <input type="number" min="0" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: e.target.value })} style={campoCheio} />
                {modal.produto.temFicha && (
                  <div style={{ fontSize: 11, color: C.grayMid, marginTop: 4 }}>Na venda vale o custo da receita: {fmt(modal.produto.custoReceita)}</div>
                )}
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={rotulo}>Preço de venda (R$) *</label>
                <input type="number" min="0" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} style={campoCheio} />
              </div>
            </div>
            <div>
              <label style={rotulo}>Estoque mínimo *</label>
              <input type="number" min="0" step="1" value={form.minimo} onChange={e => setForm({ ...form, minimo: e.target.value })} style={campoCheio} />
            </div>
            <div style={{ fontSize: 12, color: C.grayMid }}>
              Para mudar a quantidade em estoque use <b>Repor</b>. Vendas antigas mantêm o preço da época.
            </div>
          </div>
          {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>{erro}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setModal(null)} style={botaoClaro}>Cancelar</button>
            <button onClick={confirmarEdicao} disabled={salvando} style={{ ...botao, flex: 1 }}>{salvando ? "Salvando..." : "Salvar alterações"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}