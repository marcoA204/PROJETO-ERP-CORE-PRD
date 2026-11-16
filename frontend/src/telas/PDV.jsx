import { useState } from "react";
import { C, Icon, fmt, api, inputStyle, botao, botaoClaro, cartao, ReciboVenda } from "../comum.jsx";

const FORMAS = [
  { id: "DINHEIRO", label: "Dinheiro" },
  { id: "PIX", label: "Pix" },
  { id: "CARTAO_DEBITO", label: "Cartão de débito" },
  { id: "CARTAO_CREDITO", label: "Cartão de crédito" },
];
const VAZIO = { DINHEIRO: "", PIX: "", CARTAO_DEBITO: "", CARTAO_CREDITO: "" };

// Todas as contas são feitas em CENTAVOS (números inteiros) para não ter erro de arredondamento
const centavos = (v) => Math.round((Number(v) || 0) * 100);
const reais = (c) => c / 100;

export default function PDV({ products, idCaixa, atualizarLista, setTransactions, irPara }) {
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState([]); // { codigo_barras, nome, preco, qtd, estoque }
  const [desconto, setDesconto] = useState("");
  const [recebido, setRecebido] = useState(VAZIO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [recibo, setRecibo] = useState(null);
  const [troco, setTroco] = useState(0);

  // ── Contas ──────────────────────────────────────────────────
  const subtotalC = carrinho.reduce((s, i) => s + centavos(i.preco) * i.qtd, 0);
  const descontoC = Math.min(Math.max(centavos(desconto), 0), subtotalC);
  const totalC = subtotalC - descontoC;
  const recebidoC = FORMAS.reduce((s, f) => s + centavos(recebido[f.id]), 0);
  const dinheiroC = centavos(recebido.DINHEIRO);
  const faltaC = Math.max(0, totalC - recebidoC);
  const trocoC = Math.max(0, recebidoC - totalC);

  // ── Busca de produtos ───────────────────────────────────────
  const termo = busca.trim().toLowerCase();
  const resultados = (termo
    ? products.filter(p => p.nome.toLowerCase().includes(termo) || (p.codigo_barras || "").includes(termo))
    : products
  ).slice(0, 30);

  const adicionar = (p) => {
    const noCarrinho = carrinho.find(i => i.codigo_barras === p.codigo_barras);
    const jaTem = noCarrinho ? noCarrinho.qtd : 0;
    if (p.estoque <= jaTem) {
      setErro(`Só há ${p.estoque} un. de "${p.nome}" em estoque.`);
      return;
    }
    setErro("");
    if (noCarrinho) {
      setCarrinho(carrinho.map(i => i.codigo_barras === p.codigo_barras ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setCarrinho([...carrinho, { codigo_barras: p.codigo_barras, nome: p.nome, preco: p.preco, qtd: 1, estoque: p.estoque }]);
    }
  };

  // Enter no campo de busca: com leitor de código de barras, adiciona o produto na hora
  const aoApertarTecla = (e) => {
    if (e.key !== "Enter") return;
    const exato = products.find(p => p.codigo_barras === busca.trim());
    const alvo = exato || (resultados.length === 1 ? resultados[0] : null);
    if (alvo) { adicionar(alvo); setBusca(""); }
  };

  const mudarQtd = (codigo, delta) => {
    setErro("");
    setCarrinho(carrinho.map(i => {
      if (i.codigo_barras !== codigo) return i;
      const nova = i.qtd + delta;
      if (nova < 1) return i;
      if (nova > i.estoque) { setErro(`Só há ${i.estoque} un. de "${i.nome}" em estoque.`); return i; }
      return { ...i, qtd: nova };
    }));
  };
  const remover = (codigo) => setCarrinho(carrinho.filter(i => i.codigo_barras !== codigo));

  const pagarTudoCom = (formaId) => setRecebido({ ...VAZIO, [formaId]: reais(totalC).toFixed(2) });

  const limpar = () => {
    setCarrinho([]); setDesconto(""); setRecebido(VAZIO); setErro("");
  };

  // ── Finalizar venda ─────────────────────────────────────────
  const finalizar = async () => {
    setErro("");
    if (carrinho.length === 0) { setErro("Adicione pelo menos um produto."); return; }
    if (totalC <= 0) { setErro("O total da venda precisa ser maior que zero."); return; }
    if (faltaC > 0) { setErro(`Faltam ${fmt(reais(faltaC))} para fechar a venda.`); return; }
    if (trocoC > dinheiroC) { setErro("O troco só pode sair do dinheiro recebido. Reduza os outros pagamentos."); return; }

    // O que é gravado no banco é o valor que ficou na loja (dinheiro recebido menos o troco)
    const pagamentos = FORMAS
      .map(f => ({ forma_pagamento: f.id, valor_pago: reais(centavos(recebido[f.id]) - (f.id === "DINHEIRO" ? trocoC : 0)) }))
      .filter(p => p.valor_pago > 0);

    setSalvando(true);
    const r = await api("/vendas", {
      method: "POST",
      corpo: {
        id_caixa: idCaixa,
        valor_desconto: reais(descontoC),
        itens: carrinho.map(i => ({ codigo_barras: i.codigo_barras, quantidade: i.qtd })),
        pagamentos,
      },
    });

    if (!r.ok) {
      setSalvando(false);
      setErro(r.erro);
      atualizarLista(); // o estoque pode ter mudado
      return;
    }

    const idVenda = r.data.id_venda;
    const rec = await api(`/vendas/${idVenda}/recibo`);

    setTransactions(prev => [...prev, {
      id: Date.now(),
      data: new Date().toLocaleDateString("en-CA"),
      tipo: "entrada",
      produto: carrinho.length === 1 ? carrinho[0].nome : `${carrinho.length} produtos`,
      qtd: carrinho.reduce((s, i) => s + i.qtd, 0),
      valor: reais(totalC),
      obs: `Venda #${idVenda}`,
    }]);

    setTroco(reais(trocoC));
    if (rec.ok) setRecibo(rec.data);
    limpar();
    atualizarLista();
    setSalvando(false);
  };

  // ── Caixa fechado ───────────────────────────────────────────
  if (!idCaixa) {
    return (
      <div>
        <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>PDV</h1>
        <div style={{ ...cartao, padding: 28, maxWidth: 520 }}>
          <div style={{ color: C.navyDark, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>🔒 O caixa está fechado</div>
          <p style={{ color: C.grayMid, fontSize: 14, marginTop: 0 }}>Abra o caixa (informando o troco inicial) para começar a vender.</p>
          <button onClick={() => irPara("fluxo")} style={botao}>Ir para o Fluxo de Caixa</button>
        </div>
      </div>
    );
  }

  const rotulo = { fontSize: 12, fontWeight: 600, color: C.grayMid, display: "block", marginBottom: 4 };
  const th = { padding: "8px 10px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 };
  const td = { padding: "10px", fontSize: 13, color: C.navyDark };
  const btnQtd = { width: 26, height: 26, borderRadius: 6, border: `1.5px solid ${C.grayLight}`, background: C.white, cursor: "pointer", fontSize: 15, fontFamily: "inherit", color: C.navyDark, lineHeight: 1 };

  return (
    <div>
      {recibo && <ReciboVenda recibo={recibo} troco={troco} onClose={() => setRecibo(null)} />}

      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>PDV — Frente de Caixa</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>Monte a venda, receba e entregue o recibo (Turno #{idCaixa})</p>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* ── Produtos ─────────────────────────────── */}
        <div style={{ ...cartao, flex: "1 1 340px", overflow: "hidden" }}>
          <div style={{ padding: 16 }}>
            <input autoFocus placeholder="Buscar por nome ou ler o código de barras..." value={busca}
              onChange={e => setBusca(e.target.value)} onKeyDown={aoApertarTecla}
              style={{ ...inputStyle, width: "100%", fontSize: 14, padding: "10px 14px" }} />
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {resultados.map(p => (
              <button key={p.id} onClick={() => adicionar(p)} disabled={p.estoque <= 0}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                  textAlign: "left", padding: "10px 16px", border: "none", borderTop: `1px solid ${C.grayLight}`,
                  background: C.white, cursor: p.estoque <= 0 ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: p.estoque <= 0 ? 0.5 : 1,
                }}>
                <span>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: C.navyDark }}>{p.nome}</span>
                  <span style={{ display: "block", fontSize: 12, color: p.estoque <= 0 ? C.red : C.grayMid }}>
                    {p.categoria} · {p.estoque <= 0 ? "sem estoque" : `${p.estoque} em estoque`}
                  </span>
                </span>
                <span style={{ fontWeight: 700, color: C.navyDark, fontSize: 14 }}>{fmt(p.preco)}</span>
              </button>
            ))}
            {resultados.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: C.grayMid, fontSize: 13 }}>Nenhum produto encontrado.</div>
            )}
          </div>
        </div>

        {/* ── Carrinho e pagamento ─────────────────── */}
        <div style={{ ...cartao, flex: "1 1 440px", padding: 20 }}>
          <div style={{ fontWeight: 600, color: C.navyDark, fontSize: 15, marginBottom: 10 }}>Carrinho ({carrinho.length})</div>

          {carrinho.length === 0 ? (
            <div style={{ padding: "18px 0", color: C.grayMid, fontSize: 13 }}>Clique em um produto ao lado para adicionar.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
              <thead>
                <tr style={{ background: C.bgPage }}>
                  {["Produto", "Qtd", "Unit.", "Subtotal", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {carrinho.map(i => (
                  <tr key={i.codigo_barras} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{i.nome}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => mudarQtd(i.codigo_barras, -1)} style={btnQtd}>−</button>
                        <b>{i.qtd}</b>
                        <button onClick={() => mudarQtd(i.codigo_barras, 1)} style={btnQtd}>+</button>
                      </span>
                    </td>
                    <td style={td}>{fmt(i.preco)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmt(reais(centavos(i.preco) * i.qtd))}</td>
                    <td style={td}>
                      <button onClick={() => remover(i.codigo_barras)} title="Remover"
                        style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}>{Icon.trash}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totais */}
          <div style={{ borderTop: `1px solid ${C.grayLight}`, paddingTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.grayMid, marginBottom: 8 }}>
              <span>Subtotal</span><span>{fmt(reais(subtotalC))}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, color: C.grayMid, marginBottom: 8 }}>
              <span>Desconto (R$)</span>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={desconto}
                onChange={e => setDesconto(e.target.value)} style={{ ...inputStyle, width: 110, textAlign: "right" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 700, color: C.navyDark }}>
              <span>Total</span><span>{fmt(reais(totalC))}</span>
            </div>
          </div>

          {/* Pagamento (pode misturar formas) */}
          <div style={{ borderTop: `1px solid ${C.grayLight}`, marginTop: 14, paddingTop: 14 }}>
            <div style={{ fontWeight: 600, color: C.navyDark, fontSize: 14, marginBottom: 10 }}>Pagamento</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              {FORMAS.map(f => (
                <div key={f.id}>
                  <label style={rotulo}>{f.label}</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="number" min="0" step="0.01" placeholder="0,00" value={recebido[f.id]}
                      onChange={e => setRecebido({ ...recebido, [f.id]: e.target.value })}
                      style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
                    <button onClick={() => pagarTudoCom(f.id)} disabled={totalC <= 0} title="Pagar o total nesta forma"
                      style={{ ...botaoClaro, padding: "6px 10px", fontSize: 12 }}>Total</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 14 }}>
              <span style={{ color: C.grayMid }}>Recebido: <b style={{ color: C.navyDark }}>{fmt(reais(recebidoC))}</b></span>
              {faltaC > 0 && totalC > 0 && <span style={{ color: C.red, fontWeight: 600 }}>Falta {fmt(reais(faltaC))}</span>}
              {trocoC > 0 && <span style={{ color: C.green, fontWeight: 700, fontSize: 16 }}>Troco: {fmt(reais(trocoC))}</span>}
            </div>
          </div>

          {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>{erro}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={limpar} disabled={salvando} style={botaoClaro}>Limpar</button>
            <button onClick={finalizar} disabled={salvando}
              style={{ ...botao, flex: 1, padding: "12px", opacity: salvando ? 0.7 : 1, cursor: salvando ? "wait" : "pointer" }}>
              {salvando ? "Salvando..." : "Finalizar venda"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
