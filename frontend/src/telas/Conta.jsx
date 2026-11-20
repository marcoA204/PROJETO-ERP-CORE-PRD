import { useState } from "react";
import { C, api, inputStyle, botao, botaoClaro, Modal } from "../comum.jsx";

const SENHA_MINIMA = 8;

// Troca de senha. Em modo "forcado" (senha provisória) não dá para fechar sem trocar.
export function AlterarSenha({ forcado = false, onConcluido, onCancelar }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro("");
    if (!atual) { setErro("Informe a senha atual."); return; }
    if (nova.length < SENHA_MINIMA) { setErro(`A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`); return; }
    if (nova !== confirma) { setErro("A confirmação não é igual à nova senha."); return; }
    if (nova === atual) { setErro("A nova senha deve ser diferente da atual."); return; }

    setSalvando(true);
    const r = await api("/auth/trocar-senha", { method: "POST", corpo: { senha_atual: atual, nova_senha: nova } });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onConcluido();
  };

  const campo = { ...inputStyle, width: "100%", padding: "10px 14px", fontSize: 14 };
  const rotulo = { fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 };

  return (
    <Modal titulo={forcado ? "Defina a sua senha" : "Alterar senha"}>
      {forcado && (
        <p style={{ color: C.grayMid, fontSize: 13, marginTop: 0 }}>
          Você entrou com uma <b>senha provisória</b>. Por segurança, escolha uma senha só sua para continuar.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={rotulo}>{forcado ? "Senha provisória" : "Senha atual"}</label>
          <input type="password" autoFocus autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} style={campo} />
        </div>
        <div>
          <label style={rotulo}>Nova senha (mínimo {SENHA_MINIMA} caracteres)</label>
          <input type="password" autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} style={campo} />
        </div>
        <div>
          <label style={rotulo}>Repita a nova senha</label>
          <input type="password" autoComplete="new-password" value={confirma} onChange={e => setConfirma(e.target.value)}
            onKeyDown={e => e.key === "Enter" && salvar()} style={campo} />
        </div>
      </div>
      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 14 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {!forcado && <button onClick={onCancelar} style={botaoClaro}>Cancelar</button>}
        <button onClick={salvar} disabled={salvando} style={{ ...botao, flex: 1, opacity: salvando ? 0.7 : 1 }}>
          {salvando ? "Salvando..." : "Salvar nova senha"}
        </button>
      </div>
    </Modal>
  );
}