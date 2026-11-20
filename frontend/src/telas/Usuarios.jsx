import { useState, useEffect } from "react";
import { C, api, inputStyle, botao, botaoClaro, cartao, Modal } from "../comum.jsx";

const NOME_PERFIL = { GERENTE: "Gerente / Proprietário", OPERADOR: "Operador de caixa" };
const FORM_VAZIO = { nome: "", login: "", perfil: "OPERADOR", senha: "", ativo: true };

export default function Usuarios({ usuarioAtual }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [modal, setModal] = useState(null); // { usuario } -> usuario null = novo
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroModal, setErroModal] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const r = await api("/usuarios");
    if (r.ok) { setLista(r.data); setErro(""); } else { setErro(r.erro); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setForm(FORM_VAZIO); setErroModal(""); setModal({ usuario: null }); };
  const abrirEdicao = (u) => {
    setForm({ nome: u.nome, login: u.login, perfil: u.perfil, senha: "", ativo: Boolean(u.ativo) });
    setErroModal("");
    setModal({ usuario: u });
  };

  const salvar = async () => {
    const editando = modal.usuario;
    if (!form.nome.trim() || !form.login.trim()) { setErroModal("Preencha o nome e o login."); return; }
    if (!editando && form.senha.length < 8) { setErroModal("A senha provisória precisa ter pelo menos 8 caracteres."); return; }
    setSalvando(true);
    const r = await api(editando ? `/usuarios/${editando.id_usuario}` : "/usuarios", {
      method: editando ? "PUT" : "POST",
      corpo: { nome: form.nome, login: form.login, perfil: form.perfil, senha: form.senha || undefined, ativo: form.ativo },
    });
    setSalvando(false);
    if (!r.ok) { setErroModal(r.erro); return; }
    setModal(null);
    setAviso(r.data.mensagem);
    setTimeout(() => setAviso(""), 5000);
    carregar();
  };

  const rotulo = { fontSize: 13, fontWeight: 600, color: C.navyDark, display: "block", marginBottom: 5 };
  const campo = { ...inputStyle, width: "100%", padding: "10px 14px", fontSize: 14 };
  const souEu = modal && modal.usuario && modal.usuario.id_usuario === usuarioAtual.id_usuario;

  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Usuários</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>
        Quem pode entrar no sistema. O <b>operador de caixa</b> só enxerga o PDV e a abertura/fechamento do caixa;
        o <b>gerente</b> enxerga tudo (DRE, custos, despesas e auditoria).
      </p>

      <button onClick={abrirNovo} style={{ ...botao, marginBottom: 16 }}>+ Novo usuário</button>

      {aviso && <div style={{ color: C.green, background: C.greenBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>✓ {aviso}</div>}
      {erro && <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{erro}</div>}

      <div style={{ ...cartao, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Nome", "Login", "Perfil", "Situação", "Último acesso", ""].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(u => (
              <tr key={u.id_usuario} style={{ borderTop: `1px solid ${C.grayLight}`, opacity: u.ativo ? 1 : 0.55 }}>
                <td style={{ padding: "13px 16px", fontWeight: 600, color: C.navyDark, fontSize: 14 }}>
                  {u.nome}{u.id_usuario === usuarioAtual.id_usuario ? " (você)" : ""}
                </td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>{u.login}</td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{
                    background: u.perfil === "GERENTE" ? C.greenBg : C.bgPage, color: u.perfil === "GERENTE" ? C.green : C.navyMid,
                    padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  }}>{NOME_PERFIL[u.perfil] || u.perfil}</span>
                </td>
                <td style={{ padding: "13px 16px", fontSize: 12 }}>
                  {u.ativo ? <span style={{ color: C.green, fontWeight: 600 }}>Ativo</span> : <span style={{ color: C.red, fontWeight: 600 }}>Desativado</span>}
                  {u.ativo && u.deve_trocar_senha ? <span style={{ color: C.yellow, marginLeft: 8 }}>senha provisória</span> : null}
                </td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: C.grayMid }}>{u.ultimo_acesso || "nunca entrou"}</td>
                <td style={{ padding: "13px 16px" }}>
                  <button onClick={() => abrirEdicao(u)} style={{ ...botaoClaro, padding: "5px 12px", fontSize: 12 }}>Editar</button>
                </td>
              </tr>
            ))}
            {carregando && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.grayMid }}>Carregando...</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal titulo={modal.usuario ? `Editar — ${modal.usuario.nome}` : "Novo usuário"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={rotulo}>Nome *</label>
              <input autoFocus value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={campo} />
            </div>
            <div>
              <label style={rotulo}>Login * (minúsculas, números, ponto, hífen ou _)</label>
              <input value={form.login} onChange={e => setForm({ ...form, login: e.target.value.toLowerCase() })} style={campo} />
            </div>
            <div>
              <label style={rotulo}>Perfil *</label>
              <select value={form.perfil} disabled={souEu} onChange={e => setForm({ ...form, perfil: e.target.value })} style={campo}>
                <option value="OPERADOR">Operador de caixa (só PDV e caixa)</option>
                <option value="GERENTE">Gerente / Proprietário (tudo)</option>
              </select>
            </div>
            {!souEu && (
              <div>
                <label style={rotulo}>{modal.usuario ? "Nova senha provisória (deixe vazio para manter a atual)" : "Senha provisória * (mín. 8 caracteres)"}</label>
                <input type="password" autoComplete="new-password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} style={campo} />
                <div style={{ fontSize: 12, color: C.grayMid, marginTop: 4 }}>A pessoa será obrigada a trocá-la no primeiro acesso.</div>
              </div>
            )}
            {modal.usuario && !souEu && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.navyDark }}>
                <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
                Usuário ativo (desmarque para bloquear o acesso)
              </label>
            )}
            {souEu && <div style={{ fontSize: 12, color: C.grayMid }}>Este é o seu usuário. Para trocar a sua senha use "Alterar senha" no menu.</div>}
          </div>
          {erroModal && <div style={{ color: C.red, background: C.redBg, borderRadius: 7, padding: "8px 12px", fontSize: 13, marginTop: 14 }}>{erroModal}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setModal(null)} style={botaoClaro}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ ...botao, flex: 1 }}>{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}