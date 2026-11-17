import { useState, useEffect } from "react";
import { C, fmt, api, inputStyle, botao, botaoClaro, cartao, Modal, centavos, reais } from "../comum.jsx";

// ── Editor da receita de UM produto ──────────────────────────
function EditorFicha({ produto, products, onFechar, onSalvo }) {
  const [linhas, setLinhas] = useState([]); // { id_ingrediente, nome, custo, quantidade }
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState("");
  const [qtdAdd, setQtdAdd] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api(`/produtos/${produto.id}/ficha`).then(r => {
      if (!ativo) return;
      if (r.ok) {
        setLinhas(r.data.map(f => ({ id_ingrediente: f.id_ingrediente, nome: f.nome, custo: f.preco_custo, quantidade: f.quantidade })));
      } else {
        setErro(r.erro);
      }
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [produto.id]);

  // Só entra como ingrediente quem não é o próprio produto, não tem receita e ainda não está na lista
  const disponiveis = products.filter(p =>
    p.id !== produto.id && !p.temFicha && !linhas.some(l => l.id_ingrediente === p.id)
  );

  const adicionar = () => {
    const p = products.find(x => String(x.id) === selecionado);
    const qtd = Number(qtdAdd);
    if (!p) { setErro("Escolha um ingrediente."); return; }
    if (!Number.isInteger(qtd) || qtd <= 0) { setErro("A quantidade deve ser um número inteiro maior que zero."); return; }
    setErro("");
    setLinhas([...linhas, { id_ingrediente: p.id, nome: p.nome, custo: p.custo, quantidade: qtd }]);
    setSelecionado("");
    setQtdAdd("");
  };

  const mudarQtd = (id, valor) => setLinhas(linhas.map(l => l.id_ingrediente === id ? { ...l, quantidade: valor } : l));
  const remover = (id) => setLinhas(linhas.filter(l => l.id_ingrediente !== id));

  const custoC = linhas.reduce((s, l) => s + centavos(l.custo) * (Number(l.quantidade) || 0), 0);
  const margemC = centavos(produto.preco) - custoC;

  const salvar = async () => {
    if (linhas.some(l => !Number.isInteger(Number(l.quantidade)) || Number(l.quantidade) <= 0)) {
      setErro("Todas as quantidades devem ser números inteiros maiores que zero.");
      return;
    }
    setSalvando(true);
    const r = await api(`/produtos/${produto.id}/ficha`, {
      method: "PUT",
      corpo: { ingredientes: linhas.map(l => ({ id_ingrediente: l.id_ingrediente, quantidade: Number(l.quantidade) })) },
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onSalvo(r.data.mensagem);
  };

  return (
    <Modal titulo={`Receita — ${produto.nome}`} largura={560}>
      <p style={{ color: C.grayMid, fontSize: 13, marginTop: 0 }}>
        Quanto de cada ingrediente vai em <b>1 unidade</b> vendida. A cada venda o sistema baixa esses ingredientes do estoque.
      </p>

      {carregando ? (
        <div style={{ color: C.grayMid, fontSize: 13 }}>Carregando...</div>
      ) : (
        <>
          {linhas.length === 0 ? (
            <div style={{ color: C.grayMid, fontSize: 13, padding: "10px 0" }}>Nenhum ingrediente ainda.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
              <thead>
                <tr style={{ background: C.bgPage }}>
                  {["Ingrediente", "Quantidade", "Custo", ""].map((h, i) => (
                    <th key={i} style={{ padding: "8px 10px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.id_ingrediente} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                    <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600, color: C.navyDark }}>{l.nome}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input type="number" min="1" step="1" value={l.quantidade} onChange={e => mudarQtd(l.id_ingrediente, e.target.value)}
                        style={{ ...inputStyle, width: 90 }} />
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 13, color: C.grayMid }}>{fmt(reais(centavos(l.custo) * (Number(l.quantidade) || 0)))}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => remover(l.id_ingrediente)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 13 }}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Adicionar ingrediente */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <select value={selecionado} onChange={e => setSelecionado(e.target.value)} style={{ ...inputStyle, flex: "2 1 180px" }}>
              <option value="">Escolha o ingrediente...</option>
              {disponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <input type="number" min="1" step="1" placeholder="Qtd" value={qtdAdd} onChange={e => setQtdAdd(e.target.value)}
              style={{ ...inputStyle, flex: "1 1 80px" }} />
            <button onClick={adicionar} style={botaoClaro}>Adicionar</button>
          </div>

          <div style={{ background: C.bgPage, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.navyDark }}>
            Custo da receita: <b>{fmt(reais(custoC))}</b> · Preço de venda: <b>{fmt(produto.preco)}</b> ·{" "}
            Margem: <b style={{ color: margemC >= 0 ? C.green : C.red }}>{fmt(reais(margemC))}</b>
          </div>
          <div style={{ fontSize: 12, color: C.grayMid, marginTop: 8 }}>
            Dica: cadastre cada ingrediente numa unidade que dê números inteiros na receita e custo de pelo menos R$ 0,01 por unidade
            (ex.: farinha em porções de 100 g, ovo em unidades).
          </div>
        </>
      )}

      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onFechar} style={botaoClaro}>Cancelar</button>
        <button onClick={salvar} disabled={salvando || carregando} style={{ ...botao, flex: 1 }}>
          {salvando ? "Salvando..." : linhas.length === 0 ? "Salvar (sem ficha)" : "Salvar receita"}
        </button>
      </div>
    </Modal>
  );
}

// ── Tela: lista de produtos e acesso ao editor ───────────────
export default function FichaTecnica({ products, atualizarLista }) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null);
  const [aviso, setAviso] = useState("");

  const filtrados = products.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));

  const aoSalvar = (mensagem) => {
    setEditando(null);
    setAviso(mensagem);
    setTimeout(() => setAviso(""), 3500);
    atualizarLista();
  };

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Ficha Técnica</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>
        Monte a receita dos produtos que você fabrica. Ao vender, o sistema baixa os ingredientes automaticamente.
        Produtos com receita não têm estoque próprio (cadastre-os com estoque 0).
      </p>

      <input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)}
        style={{ ...inputStyle, width: "100%", maxWidth: 360, padding: "10px 14px", fontSize: 14, marginBottom: 16 }} />

      {aviso && <div style={{ color: C.green, background: C.greenBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>✓ {aviso}</div>}

      <div style={{ ...cartao, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Produto", "Preço", "Receita", "Ação"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(p => (
              <tr key={p.id} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                <td style={{ padding: "13px 16px", fontWeight: 600, color: C.navyDark, fontSize: 14 }}>{p.nome}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.navyDark }}>{fmt(p.preco)}</td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{
                    background: p.temFicha ? C.greenBg : C.bgPage, color: p.temFicha ? C.green : C.grayMid,
                    padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  }}>{p.temFicha ? "Com ficha técnica" : "Sem receita"}</span>
                </td>
                <td style={{ padding: "13px 16px" }}>
                  <button onClick={() => setEditando(p)} style={{ ...botaoClaro, padding: "5px 12px", fontSize: 12 }}>
                    {p.temFicha ? "Editar receita" : "Criar receita"}
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhum produto encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditorFicha produto={editando} products={products} onFechar={() => setEditando(null)} onSalvo={aoSalvar} />
      )}
    </div>
  );
}