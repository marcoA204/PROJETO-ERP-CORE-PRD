import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

// Endereço do backend. Em produção vem da variável VITE_API_URL (configurada no Vercel);
// no seu PC, sem a variável, usa o backend local.
export const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Onde o navegador guarda o token de login (vale 12 horas; o logout apaga)
export const TOKEN_KEY = "erp_token";

// ── Paleta de cores ──────────────────────────────────────────
export const C = {
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
export const Icon = {
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
  pdv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  bills: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  history: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  clipboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  book: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
};


// ── Helpers ──────────────────────────────────────────────────
export const fmt = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Percentual no formato brasileiro: 68.6 -> "68,6%"
export const pct = (n, casas = 1) =>
  `${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

// Contas em CENTAVOS (inteiros) para não ter erro de arredondamento
export const centavos = (v) => Math.round((Number(v) || 0) * 100);
export const reais = (c) => c / 100;

// Rótulos que mudam conforme o perfil do negócio (Configurações → perfil)
const ROTULOS = {
  VAREJO: {
    estoque: "Estoque", cadastrar: "Cadastrar Produto", orcamentos: "Orçamentos",
    item: "Produto", itens: "produtos",
    subtituloCadastro: "Adicione novos produtos ao sistema",
    exemploNome: "Ex.: Cimento CP II 50kg", exemploCategoria: "Ex.: Material básico",
  },
  ALIMENTACAO: {
    estoque: "Estoque e Insumos", cadastrar: "Cadastrar Item", orcamentos: "Encomendas",
    item: "Item (produto ou insumo)", itens: "itens",
    subtituloCadastro: "Cadastre o que você vende (bolos, doces) e os insumos das receitas",
    exemploNome: "Ex.: Bolo de cenoura ou Farinha de trigo 1kg", exemploCategoria: "Ex.: Bolos, Insumos",
  },
};
export const rotulos = (nicho) => ROTULOS[nicho] || ROTULOS.VAREJO;

// Estilos reaproveitados pelas telas
export const inputStyle = {
  padding: "9px 12px", borderRadius: 7, border: `1.5px solid ${C.grayLight}`,
  fontSize: 13, fontFamily: "inherit", color: C.navyDark, outline: "none",
  background: C.white, boxSizing: "border-box",
};
export const botao = {
  background: C.navyDark, color: C.white, border: "none", borderRadius: 8,
  padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
export const botaoClaro = { ...botao, background: C.white, color: C.navyDark, border: `1.5px solid ${C.grayLight}` };
export const cartao = { background: C.bgCard, borderRadius: 12, boxShadow: "0 1px 4px rgba(26,43,74,0.08)" };

// Cores das situações das contas a pagar: [texto, fundo]
export const COR_SITUACAO = {
  "PAGA": [C.green, C.greenBg],
  "ATRASADA": [C.red, C.redBg],
  "VENCE HOJE": [C.yellow, C.yellowBg],
  "A VENCER": [C.navyMid, C.bgPage],
};

// Chamada ao backend: sempre devolve { ok, data, erro } e nunca lança exceção
export async function api(caminho, { method = "GET", corpo } = {}) {
  try {
    const cabecalhos = {};
    if (corpo) cabecalhos["Content-Type"] = "application/json";
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) cabecalhos.Authorization = `Bearer ${token}`;
    const resposta = await fetch(`${API}${caminho}`, {
      method,
      headers: cabecalhos,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    let data = {};
    try { data = await resposta.json(); } catch { /* resposta sem corpo */ }
    // Sessão vencida ou token inválido: o App escuta este aviso e volta para o login
    if (resposta.status === 401 && caminho !== "/auth/login") window.dispatchEvent(new Event("sessao-expirada"));
    return { ok: resposta.ok, data, erro: resposta.ok ? "" : (data.erro || "Erro no servidor.") };
  } catch {
    return { ok: false, data: {}, erro: "Falha na comunicação com o backend." };
  }
}

// ── Componente: Card de Stat ─────────────────────────────────
export function StatCard({ label, value, sub, color, icon }) {
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

// ── Janela (modal) ───────────────────────────────────────────
export function Modal({ titulo, children, largura = 460 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,43,74,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: C.bgCard, borderRadius: 14, padding: 28, width: "100%", maxWidth: largura, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(26,43,74,0.3)" }}>
        {titulo && <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 18, marginBottom: 16 }}>{titulo}</div>}
        {children}
      </div>
    </div>
  );
}

// ── Recibo da venda: pagamentos, QR Code Pix e WhatsApp ──────
export const NOMES_FORMA = {
  DINHEIRO: "Dinheiro", PIX: "Pix", CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito", BOLETO: "Boleto", OUTROS: "Outros",
};

export function ReciboVenda({ recibo, troco = 0, onClose }) {
  const [telefone, setTelefone] = useState(recibo.cliente ? (recibo.cliente.whatsapp || "") : "");
  const [aviso, setAviso] = useState("");
  const [copiado, setCopiado] = useState(false);
  const { loja, cliente, venda, itens, pagamentos = [], tem_pix, valor_pix, pix, pix_configurado } = recibo;
  const cancelada = venda.status_venda === "CANCELADA";

  // Texto que será enviado ao cliente
  const montarMensagem = () => {
    const linhas = [`*${loja}* - Resumo da compra`, `Venda #${venda.id_venda} - ${venda.data_venda}`];
    if (cliente) linhas.push(`Cliente: ${cliente.nome}`);
    linhas.push("");
    itens.forEach(i => linhas.push(`${i.quantidade}x ${i.produto} - ${fmt(i.subtotal)}`));
    linhas.push("");
    if (venda.valor_desconto > 0) linhas.push(`Desconto: ${fmt(venda.valor_desconto)}`);
    linhas.push(`*Total: ${fmt(venda.valor_a_receber)}*`);
    if (pix) linhas.push("", `Pague ${fmt(valor_pix)} com Pix (copia e cola):`, pix.payload);
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
    } catch {
      setAviso("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  };

  const secao = { borderTop: `1px solid ${C.grayLight}`, paddingTop: 18, marginTop: 18 };
  const linha = { display: "flex", justifyContent: "space-between", fontSize: 14, color: C.navyDark, padding: "4px 0" };

  return (
    <Modal>
      <div style={{ color: cancelada ? C.red : C.green, fontWeight: 700, fontSize: 18 }}>
        {cancelada ? `⛔ Venda #${venda.id_venda} cancelada` : `✅ Venda #${venda.id_venda}`}
      </div>
      <div style={{ color: C.grayMid, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
        {venda.data_venda}{cliente ? ` · ${cliente.nome}` : ""}{cancelada && venda.motivo_cancelamento ? ` · Motivo: ${venda.motivo_cancelamento}` : ""}
      </div>

      {itens.map((i, idx) => (
        <div key={idx} style={linha}><span>{i.quantidade}x {i.produto}</span><span>{fmt(i.subtotal)}</span></div>
      ))}
      {venda.valor_desconto > 0 && (
        <div style={{ ...linha, color: C.grayMid, fontSize: 13 }}><span>Desconto</span><span>- {fmt(venda.valor_desconto)}</span></div>
      )}
      <div style={{ ...linha, fontSize: 17, fontWeight: 700, marginTop: 10 }}>
        <span>Total</span><span>{fmt(venda.valor_a_receber)}</span>
      </div>

      {pagamentos.length > 0 && (
        <div style={secao}>
          <div style={{ fontWeight: 600, color: C.navyDark, marginBottom: 6, fontSize: 14 }}>Pagamento</div>
          {pagamentos.map((p, idx) => (
            <div key={idx} style={{ ...linha, fontSize: 13 }}><span>{NOMES_FORMA[p.forma_pagamento] || p.forma_pagamento}</span><span>{fmt(p.valor_pago)}</span></div>
          ))}
          {troco > 0 && (
            <div style={{ ...linha, color: C.green, fontWeight: 700, fontSize: 15 }}><span>Troco a devolver</span><span>{fmt(troco)}</span></div>
          )}
        </div>
      )}

      {/* Pix: só aparece se parte da venda foi paga em Pix */}
      {tem_pix && !cancelada && (
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
                O cliente escaneia com o app do banco. Valor do Pix: {fmt(valor_pix)}
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
                ? "Não foi possível gerar o Pix desta venda."
                : "Pix ainda não configurado. Adicione PIX_CHAVE, PIX_NOME e PIX_CIDADE no arquivo .env do backend."}
            </div>
          )}
        </div>
      )}

      {/* WhatsApp */}
      {!cancelada && (
        <div style={secao}>
          <div style={{ fontWeight: 600, color: C.navyDark, marginBottom: 10 }}>Enviar resumo pelo WhatsApp</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="DDD + número (opcional)" value={telefone} onChange={e => setTelefone(e.target.value)}
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={abrirWhatsApp} style={{ ...botao, background: "#25D366" }}>Enviar</button>
          </div>
          {aviso && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{aviso}</div>}
        </div>
      )}

      <button onClick={onClose} style={{ ...botaoClaro, width: "100%", marginTop: 22 }}>Fechar</button>
    </Modal>
  );
}

// ── WhatsApp: monta o link (devolve { erro, url }) ───────────
export function linkWhatsApp(telefone, mensagem) {
  const digitos = String(telefone || "").replace(/\D/g, "");
  let numero = "";
  if (digitos) {
    numero = digitos.length <= 11 ? "55" + digitos : digitos; // acrescenta o código do Brasil
    if (numero.length < 12 || numero.length > 13) {
      return { erro: "Digite o DDD + número. Ex.: 11 91234-5678", url: "" };
    }
  }
  // Sem número, o WhatsApp deixa você escolher o contato
  return { erro: "", url: `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` };
}

// ── Lista de clientes para escolher (PDV e Orçamentos) ───────
// valor = id_cliente selecionado | onChange recebe o cliente completo (ou null)
export function SeletorCliente({ valor, onChange, estilo }) {
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    let ativo = true;
    api("/clientes").then(r => { if (ativo && r.ok) setClientes(r.data); });
    return () => { ativo = false; };
  }, []);

  return (
    <select value={valor || ""} style={{ ...inputStyle, ...estilo }}
      onChange={e => {
        const id = e.target.value;
        onChange(id ? clientes.find(c => String(c.id_cliente) === id) || null : null);
      }}>
      <option value="">Sem cliente</option>
      {clientes.map(c => (
        <option key={c.id_cliente} value={c.id_cliente}>{c.nome}{c.whatsapp ? ` — ${c.whatsapp}` : ""}</option>
      ))}
    </select>
  );
}