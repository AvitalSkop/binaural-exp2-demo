import { MODEL_KEYS, chip, fmt, fmtDeg, h, info, initThemeToggle, initTips, legendHTML, segmented } from "./common.js";
import { geometrySVG } from "./geometry.js";
import { ExamplePlayer } from "./player.js";
import { LineChart } from "./charts.js";

const getJSON = async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };

const TIPS = {
  si_sdr: "Scale-invariant signal-to-distortion ratio of the estimate against the near-anechoic image of the requested speaker, both ears jointly (one common scale), in dB.",
  si_sdri: "SI-SDR improvement: SI-SDR of the estimate minus SI-SDR of the unprocessed mixture, against the same reference.",
  si_sir: "Least-squares decomposition of the estimate onto the near-anechoic images of the requested and the interfering speaker: energy of the target part over energy of the interferer part, in dB.",
  si_sar: "Same decomposition: energy of the target and interferer parts over the remaining error, in dB. Residual reverberation and processing artefacts count as error.",
  W: "Share of mixtures for which both requests (s1 and s2) meet the target-selected criterion.",
  ild_error_db: "Absolute difference between the broadband interaural level difference (ILD) of the estimate and of the near-anechoic target, in dB. Lower is better.",
  itd_error_us: "Absolute difference between the broadband interaural time difference (ITD, GCC-PHAT within ±1 ms) of the estimate and of the near-anechoic target, in microseconds. Lower is better.",
  success: "Target selected: the estimate is closer (in SI-SDR) to the requested speaker than to the interfering speaker, improves on the mixture (SI-SDRi > 0), and that closeness margin is larger than in the unprocessed mixture. It is a numerical criterion and does not guarantee a perceptually clean extraction.",
};

function metricsTable(ex, target, models, activeRole) {
  const t = ex.targets[target];
  const cols = ["si_sdr", "si_sdri", "si_sir", "si_sar"];
  const shown = (v) => (v === null ? null : Number(v.toFixed(1)));
  const best = Object.fromEntries(cols.map((c) => [c, Math.max(...models.map((m) => shown(t.models[m.key][c])).filter((v) => v !== null))]));
  const cell = (c, v) => {
    const txt = fmt(v, 1, c === "si_sdri");
    return shown(v) === best[c] ? `<td class="best"><b>${txt}</b><span class="sr"> (highest)</span></td>` : `<td>${txt}</td>`;
  };
  const rows = [`<tr class="mix${activeRole === "mixture" ? " active" : ""}"><td><span class="long">Mixture</span><span class="short">Mix.</span></td><td>${fmt(t.mixture_si_sdr, 1)}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`];
  for (const m of models) {
    const r = t.models[m.key];
    rows.push(`<tr class="${activeRole === m.key ? "active" : ""}"><td><span class="model">${chip(m.key)}<b>${m.key}</b><span class="mname">&nbsp;${m.name}</span></span></td>
      ${cols.map((c) => cell(c, r[c])).join("")}<td>${r.success ? '✓<span class="yn"> yes</span>' : '<span class="no">✗<span class="yn"> no</span></span>'}</td></tr>`);
  }
  const th = (label, key, short) => `<th scope="col"><span class="th">${short ? `<span class="long">${label}</span><span class="short">${short}</span>` : label.replace("-", "\u2011")}${info(label, TIPS[key])}</span></th>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th scope="col"><span class="long">Requested </span>${target} (${fmtDeg(t.azimuth)})</th>${th("SI-SDR", "si_sdr")}${th("SI-SDRi", "si_sdri")}${th("SI-SIR", "si_sir")}${th("SI-SAR", "si_sar")}${th("Target selected", "success", "Sel.")}</tr></thead>
    <tbody>${rows.join("")}</tbody>
    <caption>dB against the near-anechoic target, so values near or below 0 dB are expected (mixture ${fmt(t.mixture_si_sdr, 1)} dB).
      <b>Bold</b>: highest value in each column, not a perceptual ranking.</caption></table></div>`;
}

function overallTable(ov, models) {
  const cols = [["si_sdr", "SI-SDR", 2, 1], ["si_sdri", "SI-SDRi", 2, 1], ["si_sir", "SI-SIR", 2, 1], ["si_sar", "SI-SAR", 2, 1],
    ["success", "Target selected", "%", 1], ["W", "Both targets", "%", 1], ["ild_error_db", "ILD error", 2, -1], ["itd_error_us", "ITD error", 1, -1]];
  const show = (v, d) => (d === "%" ? Number((100 * v).toFixed(1)) : Number(v.toFixed(d)));
  const txt = (v, d, k) => (d === "%" ? `${(100 * v).toFixed(1)}%` : fmt(v, d, k === "si_sdri"));
  const best = Object.fromEntries(cols.map(([k, , d, dir]) => [k, (dir > 0 ? Math.max : Math.min)(...models.map((m) => show(ov.values[m.key][k], d)))]));
  const head = cols.map(([k, label]) => `<th scope="col"><span class="th">${label.replace("-", "\u2011")}${info(label, TIPS[k])}</span></th>`).join("");
  const rows = models.map((m) => {
    const r = ov.values[m.key];
    return `<tr><td><span class="model">${chip(m.key)}<b>${m.key}</b><span class="mname">&nbsp;${m.name}</span></span></td>${cols.map(([k, , d]) =>
      show(r[k], d) === best[k] ? `<td class="best"><b>${txt(r[k], d, k)}</b><span class="sr"> (best)</span></td>` : `<td>${txt(r[k], d, k)}</td>`).join("")}</tr>`;
  }).join("");
  const c = ov.values[models[0].key];
  return `<h3 class="sub-h">Overall</h3><p class="scroll-hint">Swipe the table sideways for all metrics →</p><div class="table-wrap"><table class="overall-table">
    <thead><tr><th scope="col">Model</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="caption ov-cap">valgrid, ${c.n_mixtures} mixtures / ${c.n_requests} target requests, 160,000 training steps; means over mixtures (each mixture's two requests averaged first).
      SI metrics in dB against the near-anechoic target; ILD error in dB, ITD error in µs (lower is better). <b>Bold</b>: best value in each column;
      many differences are within the uncertainty given in the evaluation protocol.</p>`;
}

function renderExample(ex, models, open) {
  const d = h("details", { class: "example", id: `example-${ex.id}`, open });
  const hl = ex.highlighted_targets;
  d.innerHTML = `<summary><span class="ex-id">${ex.id}</span><span class="ex-title">${ex.title}</span>
    <span class="ex-tags">Δθ = ${ex.separation_deg}° · ${hl.length === 2 ? "s1 and s2" : `focus on ${hl[0]}`}</span></summary>`;
  const body = h("div", { class: "ex-body" });
  body.append(h("p", { class: "ex-desc" }, ex.description));
  const grid = h("div", { class: "ex-grid" });
  const left = h("div", { class: "ex-controls" });
  const trow = h("div", { class: "target-row" });
  trow.append(h("span", { class: "label" }, "Requested speaker"));
  const segBox = h("div");
  trow.append(segBox);
  left.append(trow);
  const playerBox = h("div");
  left.append(playerBox);
  const right = h("div", { class: "ex-side" });
  const geo = h("figure", { class: "geometry" });
  const facts = h("dl", { class: "facts" });
  right.append(geo, facts);
  grid.append(left, right);
  const tableBox = h("div");
  body.append(grid, tableBox);
  d.append(body);

  const state = { target: ex.default_target, role: "mixture" };
  const player = new ExamplePlayer(ex, models, {
    onChange: ({ role, target }) => {
      const changed = role !== state.role || target !== state.target;
      state.role = role; state.target = target;
      if (changed) draw();
    },
  });
  const seg = segmented(segBox, ["s1", "s2"].map((t) => [t, `${t} · ${fmtDeg(ex.targets[t].azimuth)}`]),
    state.target, (t) => player.setTarget(t), "Requested speaker");


  const draw = () => {
    const t = ex.targets[state.target], o = state.target === "s1" ? "s2" : "s1";
    geo.innerHTML = geometrySVG(t.azimuth, t.interferer_azimuth, state.target, o);
    facts.innerHTML = `<div><dt>Separation</dt><dd>${ex.separation_deg}°</dd></div>
      <div><dt>Initial SIR of ${state.target}</dt><dd>${fmt(t.input_sir_db, 1, true)} dB</dd></div>`;
    tableBox.innerHTML = metricsTable(ex, state.target, models, state.role);
    seg.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-checked", String(["s1", "s2"][i] === state.target)));
  };
  player.render(playerBox);
  draw();
  d.addEventListener("toggle", () => { if (d.open) player.load().catch(() => {}); else player.pause(); });
  if (open) player.load().catch(() => {});
  return d;
}

function metricOptions(metrics) { return Object.entries(metrics).map(([k, v]) => [k, v.replace(" (dB)", "")]); }

async function main() {
  initTips();
  initThemeToggle(document.getElementById("theme-toggle"));
  const [meta, examples, results, training] = await Promise.all(
    ["meta", "examples", "results", "training"].map((n) => getJSON(`data/${n}.json`)));
  if ([...meta.models.map((m) => m.key)].sort().join() !== [...MODEL_KEYS].sort().join()) throw new Error("unexpected model list");
  const models = MODEL_KEYS.map((k) => meta.models.find((m) => m.key === k));      // display order B C D E1 F
  document.querySelectorAll("[data-legend]").forEach((el) => (el.innerHTML = legendHTML(models)));

  const exBox = document.getElementById("examples");
  exBox.innerHTML = "";
  examples.forEach((ex) => exBox.append(renderExample(ex, models, ex.id === "041")));

  // ---- evaluation results (valgrid, 160k)
  const vg = meta.sets.valgrid, vs = meta.sets.valsep64;
  document.querySelector("[data-results-intro]").innerHTML =
    `<b>valgrid</b> development set: ${vg.n_mixtures} mixtures, ${vg.n_requests} target requests (s1 and s2 of each mixture), 160,000 training steps.
     Points are measured bin means.`;
  document.getElementById("overall").innerHTML = overallTable(results.overall, models);
  const mlabel = (k) => results.metrics[k];
  const sep = results.separation, sir = results.input_sir;
  const sepChart = new LineChart(document.getElementById("chart-separation"), {
    title: "Performance vs angular separation", xTitle: sep.x_label, xLabels: sep.bins, models, values: sep.values,
    metric: "si_sdri", metricLabel: mlabel("si_sdri"),
    nLabel: (i) => `n=${sep.values.C[i].n_requests}`,
    tipN: (i, m) => `${sep.values.C[i][m === "si_sdri" ? "n_requests" : "n_decomp_requests"]} target requests · ${sep.values.C[i].n_mixtures} mixtures`,
    tableN: (i) => `${sep.values.C[i].n_requests} (${sep.values.C[i].n_mixtures})`,
    tableNText: "target requests (mixtures)",
    caption: "n = target requests per bin (two per mixture).",
  });
  const sirLabels = sir.bins.map((b) => b.replace(" to ", "…"));
  const sirChart = new LineChart(document.getElementById("chart-sir"), {
    title: "Performance vs initial target SIR", xTitle: sir.x_label, xLabels: sirLabels, models, values: sir.values,
    metric: "si_sdri", metricLabel: mlabel("si_sdri"),
    nLabel: (i) => `n=${sir.values.C[i].n_requests}`,
    tipTitle: (i) => `Initial target SIR ${sirLabels[i]} dB`,
    tipN: (i) => `${sir.values.C[i].n_requests} target requests from ${sir.values.C[i].n_mixtures} mixtures`,
    tableN: (i) => `${sir.values.C[i].n_requests} (${sir.values.C[i].n_mixtures})`,
    tableNText: "target requests (mixtures)",
    caption: `Negative: the requested speaker is the quieter one. n = ${[...new Set(sir.values.C.map((s) => s.n_requests))].join(" / ")} requests per bin (one per mixture). ` +
      info("initial target SIR", "Energy ratio of the requested speaker's reverberant image to the interferer's in the mixture, both ears. Each mixture contributes one request to a negative bin and one to the positive bin of the same magnitude."),
  });
  segmented(document.querySelector('[data-metric-group="results"]'), metricOptions(results.metrics), "si_sdri",
    (k) => { sepChart.setMetric(k, mlabel(k)); sirChart.setMetric(k, mlabel(k)); }, "Metric for evaluation results");

  // ---- training progression (valsep64)
  document.querySelector("[data-training-intro]").innerHTML =
    `<b>valsep64</b> development set: ${vs.n_mixtures} mixtures, ${vs.n_requests} target requests, disjoint from valgrid. Only the checkpoints shown were evaluated.`;
  const steps = training.steps;
  const trChart = new LineChart(document.getElementById("chart-training"), {
    title: "Performance during training", xTitle: "Training step", xLabels: steps.map((s) => `${s / 1000}k`), xValues: steps,
    models, values: training.values, metric: "si_sdri", metricLabel: mlabel("si_sdri"),
    tipTitle: (i) => `${steps[i].toLocaleString("en-US")} steps`,
    tipN: (i) => `${training.values.C[i].n_requests} target requests · ${training.values.C[i].n_mixtures} mixtures`,
    tableN: (i) => `${training.values.C[i].n_requests} (${training.values.C[i].n_mixtures})`,
    tableNText: "target requests (mixtures)",
    caption: `Markers at the measured checkpoints (${steps.map((s) => `${s / 1000}k`).join(", ")}); lines connect them.`,
  });
  segmented(document.querySelector('[data-metric-group="training"]'), metricOptions(results.metrics), "si_sdri",
    (k) => trChart.setMetric(k, mlabel(k)), "Metric for training progression");

  // ---- protocol
  const ci = meta.ci95_halfwidth_si_sdri_db, r = (v) => v.toFixed(2);
  document.querySelector("[data-protocol]").innerHTML = `
    <ul class="proto-list">
      <li><b>Development (cross-validation) split:</b> the speakers also appear in training; the utterances and the room
        (nominal reverberation time 0.5 s) are unseen.</li>
      <li><b>valgrid:</b> ${vg.n_mixtures} mixtures, ${vg.n_requests} target requests (evaluation results).
        <b>valsep64:</b> ${vs.n_mixtures} mixtures, ${vs.n_requests} target requests (training progression, listening examples).</li>
      <li><b>No held-out test-set results</b> are shown. One training run per model; one sampling run per request.</li>
      <li>95% bootstrap intervals of mean SI-SDRi: ±${r(ci.valgrid[0])}–${r(ci.valgrid[1])} dB (valgrid), ±${r(ci.valsep64[0])}–${r(ci.valsep64[1])} dB (valsep64);
        no statistically significant superiority between methods is claimed.</li>
    </ul>
    <details class="defs"><summary>Metric definitions and aggregation</summary><dl>
      <dt>Models</dt><dd>${models.map((m) => `${m.key} ${m.name}`).join(", ")}: same diffusion model, training data, 160,000 training
        steps and sampler; only the way the HRTF enters the network differs.</dd>
      <dt>Reference</dt><dd>The near-anechoic image of the requested speaker: the same speech rendered from the same direction
        with an almost reflection-free binaural response. The task includes reducing reverberation.</dd>
      <dt>SI-SDR, SI-SDRi</dt><dd>${TIPS.si_sdr} ${TIPS.si_sdri}</dd>
      <dt>SI-SIR, SI-SAR</dt><dd>${TIPS.si_sir} ${TIPS.si_sar}</dd>
      <dt>Target selected</dt><dd>${TIPS.success.replace("Target selected: ", "")}</dd>
      <dt>Both targets</dt><dd>${TIPS.W}</dd>
      <dt>ILD and ITD error</dt><dd>${TIPS.ild_error_db} ${TIPS.itd_error_us}</dd>
      <dt>Aggregation</dt><dd>Within a bin, a mixture's requests are averaged first, then the mixtures. SI-SIR and SI-SAR use
        requests with a positive target coefficient (all requests in the results shown).</dd>
      <dt>Listening examples</dt><dd>Selected by listening to illustrate specific behaviours (valsep64, 160,000 steps); they are
        not representative of average performance. 16 kHz stereo; all signals of an example share one gain.</dd>
    </dl></details>`;
}

main().catch((err) => {
  console.error(err);
  document.getElementById("examples").innerHTML = '<p class="loading">The demo data could not be loaded. Please reload the page.</p>';
});
