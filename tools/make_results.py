"""
Build the repository exports from the public site data only (site/data/*.json); no research data is read.

    python tools/make_results.py
      examples/README.md, examples/exNNN.txt   descriptions, geometry, metric tables, links to the WAVs in site/audio
      results/tables/{overall,training,initial_sir}.txt
      results/plots/{training,initial_sir}_{si_sdr,si_sdri,si_sir}.{png,svg}
Requires matplotlib for the plots.
"""
import json
import shutil
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "site" / "data"
ORDER = ["B", "C", "D", "E1", "F"]
COLORS = {"B": "#1baf7a", "C": "#2a78d6", "D": "#eda100", "E1": "#8e44ad", "F": "#eb6834"}
MARKERS = {"B": "D", "C": "o", "D": "^", "E1": "v", "F": "s"}
PLOT_METRICS = [("si_sdr", "SI-SDR (dB)"), ("si_sdri", "SI-SDRi (dB)"), ("si_sir", "SI-SIR (dB)")]
URL = "https://avitalskop.github.io/binaural-exp2-demo/"

meta, examples, results, training = (json.loads((DATA / f"{n}.json").read_text()) for n in ("meta", "examples", "results", "training"))
NAMES = {m["key"]: m["name"] for m in meta["models"]}
vg, vs = meta["sets"]["valgrid"], meta["sets"]["valsep64"]


def table(header, rows):
    cols = list(zip(*([header] + rows)))
    width = [max(len(str(c)) for c in col) for col in cols]
    line = lambda r: "  ".join(str(c).ljust(w) if i == 0 else str(c).rjust(w) for i, (c, w) in enumerate(zip(r, width)))
    return "\n".join([line(header), "  ".join("-" * w for w in width)] + [line(r) for r in rows])


num = lambda v, d=2: "-" if v is None else f"{v:.{d}f}"
sgn = lambda v, d=2: f"{v:+.{d}f}"
pct = lambda v: f"{100 * v:.1f}%"
NOTE = ("Metrics: binaural (both ears jointly), against the near-anechoic image of the requested speaker; SI metrics in dB.\n"
        "Development (cross-validation) split: speakers seen during training, unseen utterances and room. No held-out test results.\n")

for d in (ROOT / "examples", ROOT / "results"):
    shutil.rmtree(d, ignore_errors=True)
(ROOT / "results" / "tables").mkdir(parents=True)
(ROOT / "results" / "plots").mkdir()
(ROOT / "examples").mkdir()

# ------------------------------------------------------------------ results/tables
ov = results["overall"]["values"]
(ROOT / "results/tables/overall.txt").write_text(
    f"Overall results (valgrid, {vg['n_mixtures']} mixtures / {vg['n_requests']} target requests, 160,000 training steps)\n{NOTE}\n" +
    table(["Model", "SI-SDR", "SI-SDRi", "SI-SIR", "SI-SAR"],
          [[f"{k} {NAMES[k]}", num(ov[k]["si_sdr"]), sgn(ov[k]["si_sdri"]), num(ov[k]["si_sir"]), num(ov[k]["si_sar"])] for k in ORDER]) + "\n")
pq = results["pesq"]["values"]
(ROOT / "results/tables/pesq.txt").write_text(
    f"PESQ (valsep64, {vs['n_mixtures']} mixtures / {vs['n_requests']} target requests, 160,000 steps; {results['pesq']['mode']})\n{NOTE}\n" +
    table(["Signal", "PESQ"], [[f"{k} {NAMES[k]}", num(pq[k]["pesq"])] for k in ORDER] +
          [["Mixture", num(pq["mixture"]["pesq"])], ["Reverberant target", num(pq["reverberant_target"]["pesq"])]]) + "\n")


def block_tables(values, xs, xlabel):
    out = []
    for key, label in PLOT_METRICS:
        hdr = [xlabel] + [f"{k} {NAMES[k]}" for k in ORDER] + (["Mixture"] if key == "si_sdr" else [])
        rows = [[x] + [num(values[k][i][key]) for k in ORDER] + ([num(values["C"][i]["mixture_si_sdr"])] if key == "si_sdr" else [])
                for i, x in enumerate(xs)]
        out.append(f"{label}\n" + table(hdr, rows))
    return "\n\n".join(out)


(ROOT / "results/tables/training.txt").write_text(
    f"Training progression (valsep64, {vs['n_mixtures']} mixtures / {vs['n_requests']} target requests; measured checkpoints only)\n{NOTE}\n" +
    block_tables(training["values"], [f"{s:,}" for s in training["steps"]], "Step") + "\n")
sir = results["input_sir"]
(ROOT / "results/tables/initial_sir.txt").write_text(
    f"Performance vs initial target SIR (valgrid, 160,000 steps; {sir['values']['C'][0]['n_requests']} target requests per bin)\n{NOTE}\n" +
    block_tables(sir["values"], [f"{b} dB" for b in sir["bins"]], "Initial target SIR") + "\n")

# ------------------------------------------------------------------ results/plots (minimal: title, axis labels, lines, legend)
plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False, "svg.fonttype": "none",
                     "svg.hashsalt": "binaural-exp2-demo"})          # reproducible SVG element ids


def plot(xs, ticks, values, key, label, title, xlabel, name, rotate=0):
    fig, ax = plt.subplots(figsize=(6.2, 3.8))
    for k in ORDER:
        ax.plot(xs, [v[key] for v in values[k]], color=COLORS[k], marker=MARKERS[k], markersize=5, linewidth=1.6, label=f"{k} {NAMES[k]}")
    if key == "si_sdr":
        ax.plot(xs, [v["mixture_si_sdr"] for v in values["C"]], color="0.35", linestyle="--", marker="o", markerfacecolor="white",
                markersize=5, linewidth=1.3, label="Mixture")
    ax.set_xticks(xs, ticks, rotation=rotate)
    ax.set(title=title, xlabel=xlabel, ylabel=label)
    ax.legend(frameon=False, fontsize=8)
    fig.tight_layout()
    for ext in ("png", "svg"):
        fig.savefig(ROOT / "results/plots" / f"{name}.{ext}", dpi=150, metadata={"Date": None} if ext == "svg" else None)
    plt.close(fig)


for key, label in PLOT_METRICS:
    short = label.split(" (")[0]
    plot([s / 1000 for s in training["steps"]], [f"{s // 1000}k" for s in training["steps"]], training["values"], key, label,
         f"{short} during training", "Training step", f"training_{key}")
    plot(list(range(len(sir["bins"]))), [b.replace(" to ", "…") for b in sir["bins"]], sir["values"], key, label,
         f"{short} vs initial target SIR", "Initial target SIR (dB)", f"initial_sir_{key}", rotate=30)

# ------------------------------------------------------------------ examples/
idx = [f"# Listening examples\n\nSelected examples (valsep64, 160,000 training steps); not representative of average performance.",
       f"Stereo 16 kHz WAV (left, right); all signals of an example share one gain. Interactive version: {URL}\n",
       NOTE]
for e in examples:
    shown = [k for k in ORDER if k in e["models"]]
    a = e["audio"]
    txt = [f"Example {e['id']}: {e['title']}"] + ([e["description"]] if e["description"] else []) + ["",
           f"s1 at {e['azimuth']['s1']:+g} deg, s2 at {e['azimuth']['s2']:+g} deg (0 = front, positive = right), separation {e['separation_deg']} deg."]
    if e.get("listening"):
        txt.append("Listening review: " + ", ".join(f"{t} {v}" for t, v in e["listening"].items()) + ".")
    idx.append(f"## {e['id']}: {e['title']}\n" + (f"\n{e['description']}\n" if e["description"] else ""))
    idx.append(f"s1 at {e['azimuth']['s1']:+g}°, s2 at {e['azimuth']['s2']:+g}°, separation {e['separation_deg']}°. "
               f"Metric tables: [ex{e['id']}.txt](ex{e['id']}.txt)\n")
    if e.get("listening"):
        idx.append("Listening review: " + ", ".join(f"{t} {v}" for t, v in e["listening"].items()) + ".\n")
    for t in ("s1", "s2"):
        o = "s2" if t == "s1" else "s1"
        x = e["targets"][t]
        txt += ["", f"Requested {t} at {x['azimuth']:+g} deg, initial target SIR {x['input_sir_db']:+.1f} dB",
                table(["Signal", "SI-SDR", "SI-SDRi", "SI-SIR", "SI-SAR", "PESQ"],
                      [["Mixture", num(x["mixture_si_sdr"], 1), "-", "-", "-", num(x["mixture_pesq"])],
                       ["Reverberant target", "-", "-", "-", "-", num(x["reverberant_pesq"])]] +
                      [[f"{k} {NAMES[k]}", num(x["models"][k]["si_sdr"], 1), sgn(x["models"][k]["si_sdri"], 1), num(x["models"][k]["si_sir"], 1),
                        num(x["models"][k]["si_sar"], 1), num(x["models"][k]["pesq"])] for k in shown])]
        links = [("Mixture", a["mixture"]), (f"Target {t} near-anechoic", a[f"clean_{t}"])] + \
                [(f"{k} {NAMES[k]}", a[f"{k}_{t}"]) for k in shown] + \
                [(f"Target {t} reverberant", a[f"rev_{t}"]), (f"Interferer {o} near-anechoic", a[f"clean_{o}"]), (f"Interferer {o} reverberant", a[f"rev_{o}"])]
        idx.append(f"- Requested **{t}**: " + " · ".join(f"[{lab}](../site/{f})" for lab, f in links))
    idx.append("")
    (ROOT / "examples" / f"ex{e['id']}.txt").write_text("\n".join(txt) + "\n\n" + NOTE)
(ROOT / "examples" / "README.md").write_text("\n".join(idx) + "\n")

# ------------------------------------------------------------------ results/README.md
pngs = sorted(p.name for p in (ROOT / "results/plots").glob("*.png"))
(ROOT / "results" / "README.md").write_text("\n".join(
    [f"# Results\n\nGenerated from `site/data/*.json` by `tools/make_results.py`. Interactive version: {URL}\n",
     "- [`tables/overall.txt`](tables/overall.txt): overall results, valgrid, 160,000 steps.",
     "- [`tables/training.txt`](tables/training.txt): training progression, valsep64, measured checkpoints.",
     "- [`tables/initial_sir.txt`](tables/initial_sir.txt): performance vs initial target SIR, valgrid.",
     "- [`tables/pesq.txt`](tables/pesq.txt): wideband PESQ, valsep64, 160,000 steps.",
     "- [`plots/`](plots/): PNG and SVG of the two main plots for SI-SDR, SI-SDRi and SI-SIR.\n"] +
    [f"![{n}](plots/{n})" for n in pngs]) + "\n")
print(f"examples/: README.md + {len(examples)} txt; results/tables: 4 txt; results/plots: {len(pngs)} png + {len(pngs)} svg")
