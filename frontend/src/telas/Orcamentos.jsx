import { useState, useEffect } from "react";
import { C, fmt, api, inputStyle, botao, botaoClaro, cartao, Modal, SeletorCliente, centavos, reais, linkWhatsApp } from "../comum.jsx";

const COR = {
  ABERTO: [C.navyMid, C.bgPage],
  CONVERTIDO: [C.green, C.greenBg],
  CANCELADO: [C.red, C.redBg],
  EXPIRADO: [C.yellow, C.yellowBg],
};
const NOME_SITUACAO = { ABERTO: "Em aberto", CONVERTIDO: "Virou venda", CANCELADO: "Cancelado", EXPIRADO: "Vencido" };

const daquiADias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("en-CA"); // AAAA-MM-DD no fuso local
};

// ── Montar um orçamento novo ─────────────────────────────────
function NovoOrcamento({ products, onFechar, onSalvo }) {
  const [cliente, setCliente] = useState(null);
  const [validade, setValidade] = useState(daquiADias(7));
  const [desconto, setDesconto] = useState("");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState([]); // { codigo_barras, nome, preco, qtd }
  const [selecionado, setSelecionado] = useState("");
  const [qtdAdd, setQtdAdd] = useState("1");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const subtotalC = itens.reduce((s, i) => s + centavos(i.preco) * i.qtd, 0);
  const descontoC = Math.min(Math.max(centavos(desconto), 0), subtotalC);
  const totalC = subtotalC - descontoC;

  const adicionar = () => {
    const p = products.find(x => x.codigo_barras === selecionado);
    const qtd = Number(qtdAdd);
    if (!p) { setErro("Escolha um produto."); return; }
    if (!Number.isInteger(qtd) || qtd <= 0) { setErro("A quantidade deve ser um número inteiro maior que zero."); return; }
    setErro("");
    const existente = itens.find(i => i.codigo_barras === p.codigo_barras);
    if (existente) {
      setItens(itens.map(i => i.codigo_barras === p.codigo_barras ? { ...i, qtd: i.qtd + qtd } : i));
    } else {
      setItens([...itens, { codigo_barras: p.codigo_barras, nome: p.nome, preco: p.preco, qtd }]);
    }
    setSelecionado("");
    setQtdAdd("1");
  };

  const salvar = async () => {
    if (itens.length === 0) { setErro("Adicione pelo menos um produto."); return; }
    setSalvando(true);
    const r = await api("/orcamentos", {
      method: "POST",
      corpo: {
        id_cliente: cliente ? cliente.id_cliente : null,
        validade: validade || null,
        valor_desconto: reais(descontoC),
        observacoes: obs,
        itens: itens.map(i => ({ codigo_barras: i.codigo_barras, quantidade: i.qtd })),
      },
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onSalvo(r.data.id_orcamento);
  };

  const rotulo = { fontSize: 12, fontWeight: 600, color: C.grayMid, display: "block", marginBottom: 4 };

  return (
    <Modal titulo="Novo orçamento" largura={600}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: "2 1 220px" }}>
          <label style={rotulo}>Cliente (opcional)</label>
          <SeletorCliente valor={cliente ? cliente.id_cliente : ""} onChange={setCliente} estilo={{ width: "100%" }} />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={rotulo}>Válido até</label>
          <input type="date" value={validade} onChange={e => setValidade(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select value={selecionado} onChange={e => setSelecionado(e.target.value)} style={{ ...inputStyle, flex: "3 1 220px" }}>
          <option value="">Escolha o produto...</option>
          {products.map(p => <option key={p.id} value={p.codigo_barras}>{p.nome} — {fmt(p.preco)}</option>)}
        </select>
        <input type="number" min="1" step="1" value={qtdAdd} onChange={e => setQtdAdd(e.target.value)} style={{ ...inputStyle, flex: "1 1 70px" }} />
        <button onClick={adicionar} style={botaoClaro}>Adicionar</button>
      </div>

      {itens.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Produto", "Qtd", "Unit.", "Subtotal", ""].map((h, i) => (
                <th key={i} style={{ padding: "8px 10px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map(i => (
              <tr key={i.codigo_barras} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600, color: C.navyDark }}>{i.nome}</td>
                <td style={{ padding: "8px 10px" }}>
                  <input type="number" min="1" step="1" value={i.qtd}
                    onChange={e => setItens(itens.map(x => x.codigo_barras === i.codigo_barras ? { ...x, qtd: Math.max(1, Number.parseInt(e.target.value, 10) || 1) } : x))}
                    style={{ ...inputStyle, width: 70 }} />
                </td>
                <td style={{ padding: "8px 10px", fontSize: 13, color: C.grayMid }}>{fmt(i.preco)}</td>
                <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600 }}>{fmt(reais(centavos(i.preco) * i.qtd))}</td>
                <td style={{ padding: "8px 10px" }}>
                  <button onClick={() => setItens(itens.filter(x => x.codigo_barras !== i.codigo_barras))}
                    style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 13 }}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 200px" }}>
          <label style={rotulo}>Observações</label>
          <input placeholder="Ex.: entrega inclusa, prazo 3 dias" value={obs} onChange={e => setObs(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div style={{ flex: "1 1 110px" }}>
          <label style={rotulo}>Desconto (R$)</label>
          <input type="number" min="0" step="0.01" placeholder="0,00" value={desconto} onChange={e => setDesconto(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 700, color: C.navyDark, marginTop: 16 }}>
        <span>Total</span><span>{fmt(reais(totalC))}</span>
      </div>
      <div style={{ fontSize: 12, color: C.grayMid, marginTop: 4 }}>
        Os preços são os de hoje. O orçamento <b>não</b> baixa estoque.
      </div>

      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button onClick={onFechar} style={botaoClaro}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ ...botao, flex: 1 }}>{salvando ? "Salvando..." : "Salvar orçamento"}</button>
      </div>
    </Modal>
  );
}

// ── Ver um orçamento: WhatsApp, levar ao PDV, cancelar ───────
function DetalheOrcamento({ dados, onFechar, onMudou, abrirNoPdv }) {
  const { loja, orcamento: o, itens } = dados;
  const [telefone, setTelefone] = useState(o.cliente_whatsapp || "");
  const [aviso, setAviso] = useState("");
  const aberto = o.situacao === "ABERTO";
  const [cor, fundo] = COR[o.situacao] || [C.grayMid, C.bgPage];

  const montarMensagem = () => {
    const linhas = [`*${loja}* - Orçamento #${o.id_orcamento}`];
    if (o.cliente_nome) linhas.push(`Olá, ${o.cliente_nome}!`);
    linhas.push("");
    itens.forEach(i => linhas.push(`${i.quantidade}x ${i.produto} - ${fmt(i.subtotal)}`));
    linhas.push("");
    if (o.valor_desconto > 0) linhas.push(`Desconto: ${fmt(o.valor_desconto)}`);
    linhas.push(`*Total: ${fmt(o.valor_a_receber)}*`);
    if (o.validade) linhas.push(`Válido até ${o.validade}`);
    if (o.observacoes) linhas.push("", o.observacoes);
    linhas.push("", "Qualquer dúvida é só chamar!");
    return linhas.join("\n");
  };

  const enviar = () => {
    const r = linkWhatsApp(telefone, montarMensagem());
    if (r.erro) { setAviso(r.erro); return; }
    setAviso("");
    window.open(r.url, "_blank", "noopener,noreferrer");
  };

  const levarAoPdv = () => {
    abrirNoPdv({
      id_orcamento: o.id_orcamento,
      cliente: o.id_cliente ? { id_cliente: o.id_cliente, nome: o.cliente_nome, whatsapp: o.cliente_whatsapp } : null,
      valor_desconto: o.valor_desconto,
      itens: itens.map(i => ({ codigo_barras: i.codigo_barras, produto: i.produto, quantidade: i.quantidade })),
    });
  };

  const cancelar = async () => {
    if (!window.confirm(`Cancelar o orçamento #${o.id_orcamento}?`)) return;
    const r = await api(`/orcamentos/${o.id_orcamento}/cancelar`, { method: "POST" });
    if (!r.ok) { setAviso(r.erro); return; }
    onMudou();
    onFechar();
  };

  const linha = { display: "flex", justifyContent: "space-between", fontSize: 14, color: C.navyDark, padding: "4px 0" };

  return (
    <Modal>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 18 }}>Orçamento #{o.id_orcamento}</div>
        <span style={{ background: fundo, color: cor, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
          {NOME_SITUACAO[o.situacao] || o.situacao}
        </span>
      </div>
      <div style={{ color: C.grayMid, fontSize: 13, marginTop: 4, marginBottom: 14 }}>
        {o.data}{o.validade ? ` · válido até ${o.validade}` : ""}{o.cliente_nome ? ` · ${o.cliente_nome}` : ""}
      </div>

      {itens.map((i, idx) => (
        <div key={idx} style={linha}><span>{i.quantidade}x {i.produto}</span><span>{fmt(i.subtotal)}</span></div>
      ))}
      {o.valor_desconto > 0 && <div style={{ ...linha, color: C.grayMid, fontSize: 13 }}><span>Desconto</span><span>- {fmt(o.valor_desconto)}</span></div>}
      <div style={{ ...linha, fontSize: 17, fontWeight: 700, marginTop: 8 }}><span>Total</span><span>{fmt(o.valor_a_receber)}</span></div>
      {o.observacoes && <div style={{ color: C.grayMid, fontSize: 13, marginTop: 8 }}>Obs.: {o.observacoes}</div>}
      {o.id_venda && <div style={{ color: C.green, fontSize: 13, marginTop: 8 }}>Convertido na venda #{o.id_venda}.</div>}

      {o.situacao !== "CANCELADO" && (
        <div style={{ borderTop: `1px solid ${C.grayLight}`, paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontWeight: 600, color: C.navyDark, marginBottom: 8, fontSize: 14 }}>Enviar pelo WhatsApp</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="DDD + número (opcional)" value={telefone} onChange={e => setTelefone(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={enviar} style={{ ...botao, background: "#25D366" }}>Enviar</button>
          </div>
        </div>
      )}
      {aviso && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{aviso}</div>}
      {o.situacao === "EXPIRADO" && (
        <div style={{ background: C.yellowBg, color: C.grayMid, borderRadius: 8, padding: "8px 12px", fontSize: 12, marginTop: 12 }}>
          Este orçamento venceu e não pode virar venda. Crie um novo com os preços de hoje.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        <button onClick={onFechar} style={botaoClaro}>Fechar</button>
        {aberto && <button onClick={cancelar} style={{ ...botaoClaro, color: C.red }}>Cancelar orçamento</button>}
        {aberto && <button onClick={levarAoPdv} style={{ ...botao, flex: 1 }}>Levar para o PDV</button>}
      </div>
    </Modal>
  );
}

// ── Tela ─────────────────────────────────────────────────────
export default function Orcamentos({ products, abrirNoPdv }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("abertos");
  const [novo, setNovo] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  const carregar = async () => {
    const r = await api("/orcamentos");
    if (r.ok) { setLista(r.data); setErro(""); } else { setErro(r.erro); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const abrirDetalhe = async (id) => {
    const r = await api(`/orcamentos/${id}`);
    if (r.ok) { setDetalhe(r.data); setErro(""); } else { setErro(r.erro); }
  };

  const aoSalvarNovo = (id) => {
    setNovo(false);
    carregar();
    abrirDetalhe(id); // já abre para enviar no WhatsApp
  };

  const visiveis = filtro === "abertos" ? lista.filter(o => o.situacao === "ABERTO") : lista;

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Orçamentos</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>Monte, envie pelo WhatsApp e, quando o cliente aprovar, leve para o PDV com um clique. Orçamento não baixa estoque.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setNovo(true)} style={botao}>+ Novo orçamento</button>
        {[["abertos", "Em aberto"], ["todos", "Todos"]].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{
            padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${filtro === val ? C.navyDark : C.grayLight}`,
            background: filtro === val ? C.navyDark : C.white, color: filtro === val ? C.white : C.grayMid,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>

      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{erro}</div>}

      <div style={{ ...cartao, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Nº", "Data", "Cliente", "Validade", "Total", "Situação", ""].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map(o => {
              const [cor, fundo] = COR[o.situacao] || [C.grayMid, C.bgPage];
              return (
                <tr key={o.id_orcamento} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={{ padding: "13px 16px", fontWeight: 700, color: C.navyDark, fontSize: 14 }}>#{o.id_orcamento}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>{o.data}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.navyDark }}>{o.cliente_nome || "—"}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>{o.validade || "—"}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: C.navyDark }}>{fmt(o.valor_a_receber)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ background: fundo, color: cor, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {NOME_SITUACAO[o.situacao] || o.situacao}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <button onClick={() => abrirDetalhe(o.id_orcamento)} style={{ ...botaoClaro, padding: "5px 12px", fontSize: 12 }}>Abrir</button>
                  </td>
                </tr>
              );
            })}
            {!carregando && visiveis.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Nenhum orçamento nesta lista.</td></tr>
            )}
            {carregando && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Carregando...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {novo && <NovoOrcamento products={products} onFechar={() => setNovo(false)} onSalvo={aoSalvarNovo} />}
      {detalhe && <DetalheOrcamento dados={detalhe} onFechar={() => setDetalhe(null)} onMudou={carregar} abrirNoPdv={abrirNoPdv} />}
    </div>
  );
}