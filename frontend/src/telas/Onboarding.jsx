import { useState } from "react";
import { C, botao, cartao } from "../comum.jsx";

const PERFIS = [
  {
    id: "VAREJO",
    emoji: "🏪",
    titulo: "Varejo / Depósito",
    texto: "Vende produtos prontos: material de construção, mercadinho, loja, papelaria.",
    itens: ["Estoque e reposição", "PDV com troco e Pix", "Orçamentos por WhatsApp", "Contas a pagar"],
  },
  {
    id: "ALIMENTACAO",
    emoji: "🎂",
    titulo: "Alimentação / Confeitaria",
    texto: "Produz o que vende: bolos, doces, salgados, marmitas.",
    itens: ["Tudo do Varejo, mais:", "Ficha Técnica (receitas)", "Cada venda baixa os ingredientes sozinha", "Custo real da receita no lucro"],
  },
];

// Usada no primeiro acesso (tela cheia) e depois em "Configurações" (comoTela)
export default function Onboarding({ nichoAtual, onSalvar, comoTela = false }) {
  const [escolhido, setEscolhido] = useState(nichoAtual || "VAREJO");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);

  const confirmar = async () => {
    setSalvando(true);
    setErro("");
    const mensagem = await onSalvar(escolhido); // devolve "" se deu certo, ou o texto do erro
    setSalvando(false);
    if (mensagem) { setErro(mensagem); return; }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  const conteudo = (
    <div style={{ width: "100%", maxWidth: 760 }}>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: comoTela ? 22 : 28, marginBottom: 6 }}>
        {comoTela ? "Configurações" : "Bem-vindo ao Logi Flow 👋"}
      </h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>
        {comoTela ? "Perfil do seu negócio. Você pode mudar quando quiser." : "Para começar, conte como é o seu negócio. O sistema liga só o que você precisa."}
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {PERFIS.map(p => {
          const ativo = escolhido === p.id;
          return (
            <button key={p.id} onClick={() => setEscolhido(p.id)} style={{
              ...cartao, flex: "1 1 300px", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              padding: 24, border: `2px solid ${ativo ? C.navyDark : "transparent"}`,
              boxShadow: ativo ? "0 4px 16px rgba(26,43,74,0.18)" : cartao.boxShadow,
            }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>{p.emoji}</div>
              <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{p.titulo}</div>
              <div style={{ color: C.grayMid, fontSize: 13, marginBottom: 12 }}>{p.texto}</div>
              {p.itens.map(i => (
                <div key={i} style={{ color: C.navyDark, fontSize: 13, padding: "2px 0" }}>✓ {i}</div>
              ))}
            </button>
          );
        })}
      </div>

      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 16 }}>{erro}</div>}
      {salvo && <div style={{ color: C.green, background: C.greenBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 16 }}>✓ Perfil salvo!</div>}

      <button onClick={confirmar} disabled={salvando} style={{ ...botao, marginTop: 20, padding: "12px 28px", opacity: salvando ? 0.7 : 1 }}>
        {salvando ? "Salvando..." : comoTela ? "Salvar perfil" : "Começar a usar"}
      </button>
    </div>
  );

  if (comoTela) return <div>{conteudo}</div>;
  return (
    <div style={{ minHeight: "100vh", background: C.bgPage, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {conteudo}
    </div>
  );
}