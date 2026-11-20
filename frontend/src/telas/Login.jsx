import { useState } from "react";
import { C, api } from "../comum.jsx";

// Login real: confere usuário e senha no backend (a senha nunca fica guardada no navegador).
export default function Login({ onLogin }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    if (entrando) return;
    setErro("");
    if (!login.trim() || !senha) { setErro("Informe o usuário e a senha."); return; }
    setEntrando(true);
    const r = await api("/auth/login", { method: "POST", corpo: { login: login.trim(), senha } });
    setEntrando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onLogin(r.data); // { token, usuario }
  };

  const campo = {
    width: "100%", padding: "12px 14px", borderRadius: 8,
    border: `1.5px solid ${C.grayLight}`, fontSize: 14,
    fontFamily: "inherit", color: C.navyDark, outline: "none",
    boxSizing: "border-box", background: C.white,
  };
  const rotulo = { fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: C.navyDark, fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: C.grayLight, borderRadius: 16, padding: "48px 40px",
        width: "100%", maxWidth: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <img src="/logo.png" alt="Logi Flow" style={{ width: 150, height: 150, objectFit: "contain" }} />
          <div>
            <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 22 }}>Logi Flow</div>
            <div style={{ color: C.grayMid, fontSize: 13 }}>Gestão de Estoque</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Bem-vindo!</div>
          <div style={{ color: C.grayMid, fontSize: 14 }}>Entre com suas credenciais para continuar</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={rotulo}>Usuário</label>
            <input autoFocus autoComplete="username" placeholder="Digite seu usuário" value={login}
              onChange={e => setLogin(e.target.value)} style={campo} />
          </div>
          <div>
            <label style={rotulo}>Senha</label>
            <input type="password" autoComplete="current-password" placeholder="Digite sua senha" value={senha}
              onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} style={campo} />
          </div>

          {erro && <div style={{ color: C.red, fontSize: 13, background: C.redBg, borderRadius: 7, padding: "8px 12px" }}>{erro}</div>}

          <button onClick={entrar} disabled={entrando} style={{
            background: C.navyDark, color: C.white, border: "none", borderRadius: 8,
            padding: "13px", fontSize: 15, fontWeight: 600, cursor: entrando ? "wait" : "pointer",
            fontFamily: "inherit", marginTop: 4, opacity: entrando ? 0.7 : 1,
          }}>{entrando ? "Entrando..." : "Entrar"}</button>
        </div>
      </div>
    </div>
  );
}