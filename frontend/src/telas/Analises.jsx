import { useState, useEffect } from "react";
import { C, fmt, pct, api, inputStyle, cartao } from "../comum.jsx";

const COR_CLASSE = { A: [C.green, C.greenBg], B: [C.yellow, C.yellowBg], C: [C.grayMid, C.bgPage] };
const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DIAS_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Busca um indicador no backend e refaz a busca quando o período muda
function useDados(caminho, dias) {
  const [estado, setEstado] = useState({ dados: null, erro: "" });
  useEffect(() => {
    let ativo = true;
    api(`${caminho}?dias=${dias}`).then(r => {
      if (ativo) setEstado(r.ok ? { dados: r.data, erro: "" } : { dados: null, erro: r.erro });
    });
    return () => { ativo = false; };
  }, [caminho, dias]);
  return estado;
}

const Erro = ({ texto }) => (
  <div style={{ color: C.red, background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{texto}</div>
);
const Aviso = ({ texto }) => <div style={{ color: C.grayMid, fontSize: 13, padding: "8px 0" }}>{texto}</div>;

function Secao({ titulo, descricao, dias, setDias, opcoes, children }) {
  return (
    <div style={{ ...cartao, marginBottom: 28, overflow: "hidden" }}>
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.grayLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 16 }}>{titulo}</div>
          <div style={{ color: C.grayMid, fontSize: 13, marginTop: 2 }}>{descricao}</div>
        </div>
        <select value={dias} onChange={e => setDias(Number(e.target.value))} style={inputStyle}>
          {opcoes.map(o => <option key={o} value={o}>Últimos {o} dias</option>)}
        </select>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

const th = { padding: "9px 12px", textAlign: "left", color: C.grayMid, fontSize: 12, fontWeight: 600 };
const td = { padding: "10px 12px", fontSize: 13, color: C.navyDark };

// ── 1. Curva ABC por lucro ───────────────────────────────────
function ConteudoABC({ dados }) {
  const classes = ["A", "B", "C"].map(k => {
    const itens = dados.filter(d => d.classe === k);
    return {
      k,
      qtd: itens.length,
      lucro: itens.reduce((s, d) => s + Number(d.lucro), 0),
      pct: itens.reduce((s, d) => s + Number(d.pct_lucro), 0),
    };
  });
  const top = dados.slice(0, 10);
  const maior = Math.max(...top.map(d => Number(d.lucro)), 1);

  // Alerta útil: o produto mais vendido em unidades, se for classe C (vende muito, lucra pouco)
  const maisVendido = [...dados].sort((a, b) => b.qtd_vendida - a.qtd_vendida)[0];
  const alertaVolume = maisVendido && maisVendido.classe === "C" && dados.length > 3;

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        {classes.map(c => {
          const [cor, fundo] = COR_CLASSE[c.k];
          return (
            <div key={c.k} style={{ flex: "1 1 180px", background: fundo, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ color: cor, fontWeight: 700, fontSize: 13 }}>Classe {c.k}</div>
              <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 20 }}>{c.qtd} produto(s)</div>
              <div style={{ color: C.grayMid, fontSize: 12 }}>{c.pct.toFixed(0)}% do lucro · {fmt(c.lucro)}</div>
            </div>
          );
        })}
      </div>

      {alertaVolume && (
        <div style={{ background: C.yellowBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.navyDark, marginBottom: 18 }}>
          💡 <b>{maisVendido.produto}</b> é o que mais sai ({maisVendido.qtd_vendida} un.), mas é classe C: margem de só {Number(maisVendido.margem_pct).toFixed(0)}%.
          Vale revisar o preço ou o custo.
        </div>
      )}

      <div style={{ fontWeight: 600, color: C.navyDark, fontSize: 14, marginBottom: 10 }}>Top 10 por lucro</div>
      {top.map(d => {
        const [cor] = COR_CLASSE[d.classe];
        const largura = Number(d.lucro) > 0 ? Math.max(2, (100 * Number(d.lucro)) / maior) : 0;
        return (
          <div key={d.id_produto} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div title={d.produto} style={{ width: 150, fontSize: 13, color: C.navyDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.produto}</div>
            <div style={{ flex: 1, background: C.bgPage, borderRadius: 6, height: 20 }}>
              <div style={{ width: `${largura}%`, background: cor, height: "100%", borderRadius: 6 }} />
            </div>
            <div style={{ width: 160, fontSize: 12, color: C.grayMid, textAlign: "right" }}>{fmt(d.lucro)} · {d.qtd_vendida} un.</div>
          </div>
        );
      })}

      <div style={{ fontWeight: 600, color: C.navyDark, fontSize: 14, margin: "22px 0 10px" }}>Todos os produtos</div>
      <div style={{ maxHeight: 320, overflow: "auto", border: `1px solid ${C.grayLight}`, borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bgPage }}>
              {["Classe", "Produto", "Qtd", "Receita", "Lucro", "Margem", "% do lucro", "% acumulado"].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {dados.map(d => {
              const [cor, fundo] = COR_CLASSE[d.classe];
              return (
                <tr key={d.id_produto} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                  <td style={td}><span style={{ background: fundo, color: cor, padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{d.classe}</span></td>
                  <td style={{ ...td, fontWeight: 600 }}>{d.produto}</td>
                  <td style={td}>{d.qtd_vendida}</td>
                  <td style={td}>{fmt(d.receita)}</td>
                  <td style={{ ...td, fontWeight: 600, color: Number(d.lucro) >= 0 ? C.green : C.red }}>{fmt(d.lucro)}</td>
                  <td style={td}>{pct(d.margem_pct)}</td>
                  <td style={td}>{pct(d.pct_lucro)}</td>
                  <td style={{ ...td, color: C.grayMid }}>{pct(d.pct_acumulado)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CurvaABC() {
  const [dias, setDias] = useState(90);
  const { dados, erro } = useDados("/analytics/curva-abc", dias);
  return (
    <Secao titulo="Curva ABC — quem paga as contas" dias={dias} setDias={setDias} opcoes={[30, 90, 365]}
      descricao="Produtos ordenados pelo lucro. A = primeiros 80% do lucro, B = até 95%, C = o restante.">
      {erro && <Erro texto={erro} />}
      {!erro && !dados && <Aviso texto="Carregando..." />}
      {dados && dados.length === 0 && <Aviso texto="Ainda não há vendas neste período." />}
      {dados && dados.length > 0 && <ConteudoABC dados={dados} />}
    </Secao>
  );
}

// ── 2. Estoque parado ────────────────────────────────────────
function EstoqueParado() {
  const [dias, setDias] = useState(30);
  const { dados, erro } = useDados("/analytics/estoque-parado", dias);
  const capital = dados ? dados.reduce((s, d) => s + Number(d.capital_parado), 0) : 0;

  return (
    <Secao titulo="Estoque parado — dinheiro dormindo" dias={dias} setDias={setDias} opcoes={[15, 30, 60, 90]}
      descricao="Produtos com saldo que não tiveram nenhuma saída no período.">
      {erro && <Erro texto={erro} />}
      {!erro && !dados && <Aviso texto="Carregando..." />}
      {dados && dados.length === 0 && <Aviso texto="🎉 Nenhum produto parado neste período." />}
      {dados && dados.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ flex: "1 1 180px", background: C.yellowBg, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ color: C.grayMid, fontSize: 12 }}>Produtos parados</div>
              <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 22 }}>{dados.length}</div>
            </div>
            <div style={{ flex: "1 1 180px", background: C.redBg, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ color: C.grayMid, fontSize: 12 }}>Capital parado (custo)</div>
              <div style={{ color: C.red, fontWeight: 700, fontSize: 22 }}>{fmt(capital)}</div>
            </div>
          </div>
          <div style={{ maxHeight: 340, overflow: "auto", border: `1px solid ${C.grayLight}`, borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bgPage }}>
                  {["Produto", "Em estoque", "Última saída", "Dias parado", "Capital parado"].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {dados.map(d => (
                  <tr key={d.id_produto} style={{ borderTop: `1px solid ${C.grayLight}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{d.produto}</td>
                    <td style={td}>{d.estoque_atual}</td>
                    <td style={{ ...td, color: C.grayMid }}>{d.ultima_saida || "Nunca saiu"}</td>
                    <td style={td}>{d.dias_parado} dias</td>
                    <td style={{ ...td, fontWeight: 600, color: C.red }}>{fmt(d.capital_parado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Secao>
  );
}

// ── 3. Dias e horários de pico ───────────────────────────────
function MapaPicos({ dados }) {
  const mapa = {};
  dados.forEach(d => { mapa[`${d.dia_semana_num}-${d.hora}`] = d; });

  const horas = dados.map(d => d.hora);
  const hIni = Math.min(...horas);
  const hFim = Math.max(...horas);
  const colunas = Array.from({ length: hFim - hIni + 1 }, (_, i) => hIni + i);
  const maxQtd = Math.max(...dados.map(d => d.qtd_vendas), 1);

  const porDia = DIAS_SEMANA.map((nome, i) => ({
    nome,
    fat: dados.filter(d => d.dia_semana_num === i).reduce((s, d) => s + Number(d.faturamento), 0),
  }));
  const porHora = colunas.map(h => ({
    h,
    qtd: dados.filter(d => d.hora === h).reduce((s, d) => s + d.qtd_vendas, 0),
  }));
  const melhorDia = [...porDia].sort((a, b) => b.fat - a.fat)[0];
  const melhorHora = [...porHora].sort((a, b) => b.qtd - a.qtd)[0];

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: "1 1 200px", background: C.greenBg, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ color: C.grayMid, fontSize: 12 }}>Dia que mais fatura</div>
          <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 20 }}>{melhorDia.nome}</div>
          <div style={{ color: C.grayMid, fontSize: 12 }}>{fmt(melhorDia.fat)} no período</div>
        </div>
        <div style={{ flex: "1 1 200px", background: C.greenBg, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ color: C.grayMid, fontSize: 12 }}>Horário de maior movimento</div>
          <div style={{ color: C.navyDark, fontWeight: 700, fontSize: 20 }}>{melhorHora.h}h às {melhorHora.h + 1}h</div>
          <div style={{ color: C.grayMid, fontSize: 12 }}>{melhorHora.qtd} venda(s) no período</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${colunas.length}, minmax(34px, 1fr))`, gap: 3, minWidth: 52 + colunas.length * 37 }}>
          <div />
          {colunas.map(h => (
            <div key={h} style={{ textAlign: "center", fontSize: 11, color: C.grayMid }}>{h}h</div>
          ))}
          {DIAS_CURTO.map((nome, i) => (
            <div key={nome} style={{ display: "contents" }}>
              <div style={{ fontSize: 12, color: C.navyDark, fontWeight: 600, display: "flex", alignItems: "center" }}>{nome}</div>
              {colunas.map(h => {
                const celula = mapa[`${i}-${h}`];
                const qtd = celula ? celula.qtd_vendas : 0;
                const alfa = qtd > 0 ? 0.15 + 0.85 * (qtd / maxQtd) : 0;
                return (
                  <div key={h}
                    title={`${DIAS_SEMANA[i]}, ${h}h: ${qtd} venda(s)${celula ? ` · ${fmt(celula.faturamento)}` : ""}`}
                    style={{
                      height: 30, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 600,
                      background: qtd > 0 ? `rgba(34,168,105,${alfa})` : C.bgPage,
                      color: alfa > 0.55 ? C.white : C.navyDark,
                    }}>
                    {qtd > 0 ? qtd : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.grayMid, marginTop: 10 }}>
        Quanto mais escuro, mais vendas. Passe o mouse sobre um quadrado para ver o faturamento.
      </div>
    </>
  );
}

function Picos() {
  const [dias, setDias] = useState(90);
  const { dados, erro } = useDados("/analytics/picos", dias);
  return (
    <Secao titulo="Dias e horários de pico" dias={dias} setDias={setDias} opcoes={[30, 90, 365]}
      descricao="Quando a loja mais vende: dia da semana × hora.">
      {erro && <Erro texto={erro} />}
      {!erro && !dados && <Aviso texto="Carregando..." />}
      {dados && dados.length === 0 && <Aviso texto="Ainda não há vendas neste período." />}
      {dados && dados.length > 0 && <MapaPicos dados={dados} />}
    </Secao>
  );
}

// ── Tela ─────────────────────────────────────────────────────
export default function Analises() {
  return (
    <div>
      <h1 style={{ color: C.navyDark, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Análises</h1>
      <p style={{ color: C.grayMid, fontSize: 14, marginBottom: 24 }}>
        Indicadores para decidir o que comprar, o que promover e quando reforçar o atendimento. Vendas canceladas não contam.
      </p>
      <CurvaABC />
      <EstoqueParado />
      <Picos />
    </div>
  );
}