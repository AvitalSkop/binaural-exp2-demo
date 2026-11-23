import { MODEL_KEYS, chip, fmt, fmtDeg, h, info, initThemeToggle, initTips, legendHTML, segmented } from "./common.js?v=20261123b";
import { geometrySVG } from "./geometry.js?v=20261123b";
import { ExamplePlayer } from "./player.js?v=20261123b";
import { LineChart } from "./charts.js?v=20261123b";

const getJSON = async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };

const TIPS = {
  si_sdr: "Scale-invariant signal-to-distortion ratio against the near-anechoic image of the requested speaker, both ears jointly, in dB.",
  si_sdri: "SI-SDR improvement over the unprocessed mixture, in dB.",
  si_sir: "Requested-speaker over interfering-speaker energy in a least-squares decomposition of the estimate, in dB.",
  si_sar: "Speaker energy over the remaining error (artefacts and residual reverberation) in the same decomposition, in dB.",
  pesq: "Wideband PESQ (ITU-T P.862.2) against the near-anechoic image of the requested speaker, mean of both ears; 1 to 4.64, higher is better. valsep64, 160,000 steps.",
};
const PLOT_METRICS = [["si_sdr", "SI-SDR"], ["si_sdri", "SI-SDRi"], ["si_sir", "SI-SIR"]];
const th = (label, key) => `<th scope="col"><span class="th">${label.replace("-", "‑")}${info(label, TIPS[key])}</span></th>`;


function metricsTable(ex, target, models) {
  const t = ex.targets[target], cols = ["si_sdr", "si_sdri", "si_sir", "si_sar", "pesq"], dg = (c) => (c === "pesq" ? 2 : 1);
  const rows = models.map((m) => {
    const r = t.models[m.key];
    return `<tr><td><span class="model">${chip(m.key)}<b>${m.key}</b><span class="mname">&nbsp;${m.name}</span></span></td>${cols.map((c) =>
      `<td>${fmt(r[c], dg(c), c === "si_sdri")}</td>`).join("")}</tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="ex-table">
    <thead><tr><th scope="col">${target}</th>${th("SI-SDR", "si_sdr")}${th("SI-SDRi", "si_sdri")}${th("SI-SIR", "si_sir")}${th("SI-SAR", "si_sar")}${th("PESQ", "pesq")}</tr></thead>
    <tbody><tr class="mix"><td>Mixture</td><td>${fmt(t.mixture_si_sdr, 1)}</td><td>—</td><td>—</td><td>—</td><td>${fmt(t.mixture_pesq, 2)}</td></tr>
    <tr class="mix"><td><span class="long">Reverberant target</span><span class="short">Rev. target</span></td><td>—</td><td>—</td><td>—</td><td>—</td><td>${fmt(t.reverberant_pesq, 2)}</td></tr>${rows}</tbody></table></div>`;
}

function renderExample(ex, allModels, open) {
  const models = MODEL_KEYS.filter((k) => ex.models.includes(k)).map((k) => allModels.find((m) => m.key === k));
  const d = h("details", { class: "example", id: `example-${ex.id}`, open });
  d.innerHTML = `<summary><span class="ex-id">${ex.id}</span><span class="ex-title">${ex.title}</span><span class="ex-tags">Δθ ${ex.separation_deg}°</span></summary>`;
  const body = h("div", { class: "ex-body" });
  const left = h("div", { class: "ex-controls" }), geo = h("figure", { class: "geometry" }), tableBox = h("div", { class: "ex-metrics" });
  left.append(h("p", { class: "ex-desc" }, ex.description));
  if (ex.listening) left.append(h("p", { class: "listen-note" },
    `<b>Listening:</b> ${Object.entries(ex.listening).map(([t, v]) => `${t} ${v}`).join(" · ")}`));
  const segBox = h("div", { class: "target-row" });
  const playerBox = h("div");
  left.append(segBox, playerBox);
  body.append(left, geo, tableBox);
  d.append(body);

  let target = ex.default_target;
  const player = new ExamplePlayer(ex, models);
  const draw = () => {
    const t = ex.targets[target];
    geo.innerHTML = geometrySVG(t.azimuth, t.interferer_azimuth, target, target === "s1" ? "s2" : "s1", t.input_sir_db);
    tableBox.innerHTML = metricsTable(ex, target, models);
  };
  segmented(segBox, ["s1", "s2"].map((x) => [x, `${x} · ${fmtDeg(ex.targets[x].azimuth)}`]), target,
    (x) => { target = x; player.setTarget(x); draw(); }, "Requested speaker");
  player.render(playerBox);
  draw();
  d.addEventListener("toggle", () => { if (d.open) player.load().catch(() => {}); else player.pause(); });
  if (open) player.load().catch(() => {});
  return d;
}

function overallTable(ov, models) {
  const cols = [["si_sdr", "SI-SDR"], ["si_sdri", "SI-SDRi"], ["si_sir", "SI-SIR"], ["si_sar", "SI-SAR"]];
  const disp = (k, v) => v;
  const best = Object.fromEntries(cols.map(([k]) => [k, Math.max(...models.map((m) => Number(disp(k, ov.values[m.key][k]).toFixed(1))))]));
  const txt = (k, v) => fmt(v, 2, k === "si_sdri");
  const rows = models.map((m) => `<tr><td><span class="model">${chip(m.key)}<b>${m.key}</b><span class="mname">&nbsp;${m.name}</span></span></td>${cols.map(([k]) => {
    const v = ov.values[m.key][k];
    return Number(disp(k, v).toFixed(1)) === best[k] ? `<td class="best"><b>${txt(k, v)}</b><span class="sr"> (highest)</span></td>` : `<td>${txt(k, v)}</td>`;
  }).join("")}</tr>`).join("");
  const c = ov.values[models[0].key];
  return `<h3 class="tbl-h">Overall results · valgrid (${c.n_mixtures} mixtures)</h3><div class="table-wrap"><table class="overall-table">
    <thead><tr><th scope="col">Model</th>${cols.map(([k, l]) => th(l, k)).join("")}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function pesqTable(pq, models) {
  const v = pq.values, best = Math.max(...models.map((m) => Number(v[m.key].pesq.toFixed(2))));
  const td = (x, isModel) => (isModel && Number(x.toFixed(2)) === best ? `<td class="best"><b>${x.toFixed(2)}</b><span class="sr"> (highest)</span></td>` : `<td>${x.toFixed(2)}</td>`);
  return `<h3 class="tbl-h">PESQ · valsep64 (${v.mixture.n_mixtures} mixtures)${info("PESQ", TIPS.pesq)}</h3><div class="table-wrap"><table class="overall-table pesq-row">
    <thead><tr><th scope="col"></th>${models.map((m) => `<th scope="col"><span class="model">${chip(m.key)}${m.key}</span></th>`).join("")}<th scope="col">Mixture</th><th scope="col"><span class="long">Reverberant target</span><span class="short">Rev.</span></th></tr></thead>
    <tbody><tr><td></td>${models.map((m) => td(v[m.key].pesq, true)).join("")}${td(v.mixture.pesq, false)}${td(v.reverberant_target.pesq, false)}</tr></tbody></table></div>`;
}

async function main() {
  initTips();
  initThemeToggle(document.getElementById("theme-toggle"));
  const [meta, examples, results, training] = await Promise.all(
    ["meta", "examples", "results", "training"].map((n) => getJSON(`data/${n}.json`)));
  if ([...meta.models.map((m) => m.key)].sort().join() !== [...MODEL_KEYS].sort().join()) throw new Error("unexpected model list");
  const models = MODEL_KEYS.map((k) => meta.models.find((m) => m.key === k));      // display order B C D E1 F

  const exBox = document.getElementById("examples");
  exBox.innerHTML = "";
  examples.forEach((ex, i) => exBox.append(renderExample(ex, models, i === 0)));

  // ---- results: overall table, then the two plots (all five models)
  document.getElementById("overall").innerHTML = overallTable(results.overall, models) + pesqTable(results.pesq, models);
  const legend = document.querySelector("[data-legend]");
  const mixLegend = '<span><svg class="mk" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="4" fill="none" stroke="var(--ink2)" stroke-width="1.5"/></svg>Mixture</span>';
  const state = { training: "si_sdr", sir: "si_sdr" };
  const setLegend = () => { legend.innerHTML = legendHTML(models) + (Object.values(state).includes("si_sdr") ? mixLegend : ""); };
  const mixBase = (vals) => (metric) => (metric === "si_sdr" ? { label: "Mixture", values: vals.C.map((s) => s.mixture_si_sdr) } : null);
  const label = (k) => results.metrics[k];
  const steps = training.steps;
  const trChart = new LineChart(document.getElementById("chart-training"), {
    title: "Training progression", xTitle: "Training step", xLabels: steps.map((s) => `${s / 1000}k`), xValues: steps,
    models, values: training.values, metric: "si_sdr", metricLabel: label("si_sdr"), baseline: mixBase(training.values),
    tipTitle: (i) => `${steps[i].toLocaleString("en-US")} steps`,
    tipN: (i) => `valsep64 · ${training.values.C[i].n_mixtures} mixtures · ${training.values.C[i].n_requests} requests`,
    tableN: (i) => `${training.values.C[i].n_requests}`, tableNText: "target requests",
  });
  const sir = results.input_sir, sirLabels = sir.bins.map((b) => b.replace(" to ", "…"));
  const sirChart = new LineChart(document.getElementById("chart-sir"), {
    title: "Performance vs initial target SIR", xTitle: "Initial target SIR (dB)", xLabels: sirLabels, models, values: sir.values,
    metric: "si_sdr", metricLabel: label("si_sdr"), baseline: mixBase(sir.values),
    tipTitle: (i) => `Initial target SIR ${sirLabels[i]} dB`,
    tipN: (i) => `valgrid · ${sir.values.C[i].n_requests} requests`,
    tableN: (i) => `${sir.values.C[i].n_requests}`, tableNText: "target requests",
  });
  segmented(document.querySelector('[data-metric-group="training"]'), PLOT_METRICS, "si_sdr",
    (k) => { state.training = k; trChart.setMetric(k, label(k)); setLegend(); }, "Metric for training progression");
  segmented(document.querySelector('[data-metric-group="sir"]'), PLOT_METRICS, "si_sdr",
    (k) => { state.sir = k; sirChart.setMetric(k, label(k)); setLegend(); }, "Metric for performance vs initial target SIR");
  setLegend();

  // ---- protocol (collapsed)
  const vg = meta.sets.valgrid, vs = meta.sets.valsep64;
  document.querySelector("[data-protocol]").innerHTML = `<ul class="proto-list">
    <li>Development (cross-validation) split.</li>
    <li>Speakers seen during training.</li>
    <li>Unseen utterances and room.</li>
    <li>valgrid: ${vg.n_mixtures} mixtures, ${vg.n_requests} target requests · valsep64: ${vs.n_mixtures} mixtures, ${vs.n_requests} target requests.</li>
    <li>No held-out test results.</li></ul>`;
}

main().catch((err) => {
  console.error(err);
  document.getElementById("examples").innerHTML = '<p class="loading">The demo data could not be loaded. Please reload the page.</p>';
});
