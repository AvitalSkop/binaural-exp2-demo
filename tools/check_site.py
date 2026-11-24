"""
Static validation of the public site directory (everything under site/ is public once deployed).

    python tools/check_site.py [site_dir]

Checks: file-type allowlist and size budget; leak scan (private paths, hosts, account names, dataset identifiers)
over every file including WAV bytes, also in the repository exports examples/ and results/; JSON schema and internal consistency (models, examples, counts, measured
checkpoints); audio integrity (SHA-256 against meta.json, RIFF chunks = fmt + data only, PCM 16-bit 16 kHz stereo,
equal length within an example); every asset referenced by index.html / JS imports exists; required scientific
statements are present. Exit 1 on any failure. Standard library only.
"""
import hashlib
import json
import math
import re
import struct
import sys
from pathlib import Path

SITE = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "site")
ALLOWED = {".html", ".css", ".js", ".json", ".wav", ".txt"}
MAX_FILE, MAX_TOTAL = 25 * 2**20, 40 * 2**20
MODELS = ["C", "F", "B", "D", "E1"]
EXAMPLES = ["047", "058", "041", "008", "006"]
STEPS = [20000, 40000, 80000, 120000, 160000]
LEAKS = [rb"/home", rb"/tmp", rb"/mnt", rb"/srv", rb"runs/", rb"\.ckpt", rb"wsj0", rb"si_tr_s", rb"si_dt_", rb"si_et_",
         rb"@[a-z0-9-]+\.(com|org|ac\.il)", rb"GPU-[0-9a-f]{8}", rb"CATT_", rb"0_5s", rb"0_0s", rb"hadamard_e1", rb"wandb",
         rb"milestone", rb"valsep64\.json", rb"manifest"]
# Site-specific private identifiers (user, host, lab and server paths) live in a git-ignored local file, one regex per
# line, so that they never enter the repository: tools/leak_patterns.local
LOCAL_LEAKS = Path(__file__).with_name("leak_patterns.local")
if LOCAL_LEAKS.exists():
    LEAKS += [l.strip().encode() for l in LOCAL_LEAKS.read_text().splitlines() if l.strip() and not l.startswith("#")]
WSJ0_ID = re.compile(rb"\b[0-9][0-9a-z]{2}[a-z][0-9]{3}[0-9a-z]\b")       # e.g. 40do030k
failures, notes = [], []


def check(ok, msg):
    (notes if ok else failures).append(("ok  " if ok else "FAIL") + "  " + msg)
    return ok


def finite(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def wav_info(data):
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return None
    i, chunks, fmt, n = 12, [], None, None
    while i + 8 <= len(data):
        cid, size = data[i:i + 4], struct.unpack("<I", data[i + 4:i + 8])[0]
        chunks.append(cid)
        if cid == b"fmt ":
            fmt = struct.unpack("<HHIIHH", data[i + 8:i + 24])
        if cid == b"data":
            n = size
        i += 8 + size + (size & 1)
    return chunks, fmt, n


files = [p for p in SITE.rglob("*") if p.is_file()]
if not LOCAL_LEAKS.exists():
    notes.append("note  tools/leak_patterns.local not found: site-specific identifiers not scanned")
total = sum(p.stat().st_size for p in files)
check(all(p.suffix in ALLOWED for p in files), f"file types allowed ({len(files)} files)")
check(all(p.stat().st_size <= MAX_FILE for p in files), "every file <= 25 MiB")
check(total <= MAX_TOTAL, f"total size {total / 2**20:.1f} MiB <= 40 MiB")
for p in files:
    data = p.read_bytes()
    hits = [pat.decode() for pat in LEAKS if re.search(pat, data, re.I)]
    if p.suffix != ".wav":
        hits += [m.decode() for m in WSJ0_ID.findall(data)]
    if hits:
        check(False, f"leak scan {p.relative_to(SITE)}: {sorted(set(hits))}")
# repository exports (examples/, results/tables, results/plots): text and figures only, leak-free, links resolve
REPO = SITE.parent
exp_files = [p for d in ("examples", "results") if (REPO / d).exists() for p in (REPO / d).rglob("*") if p.is_file()]
check(all(p.suffix in (".md", ".txt", ".png", ".svg") for p in exp_files), f"exports: only .md, .txt, .png, .svg ({len(exp_files)} files)")
for p in exp_files:
    data = p.read_bytes()
    hits = [pat.decode() for pat in LEAKS if re.search(pat, data, re.I)]
    if p.suffix != ".png":
        hits += [m.decode() for m in WSJ0_ID.findall(data)]
    if hits:
        check(False, f"leak scan {p.relative_to(REPO)}: {sorted(set(hits))}")
links = [(p, l) for p in exp_files if p.suffix == ".md" for l in re.findall(r"\]\(([^)#]+)\)", p.read_text()) if not l.startswith("http")]
check(all((p.parent / l).resolve().exists() for p, l in links), f"exports: all {len(links)} relative links resolve")
check(not any("leak scan" in f for f in failures), "leak scan clean (site incl. audio bytes, examples/, results/)")

meta = json.loads((SITE / "data/meta.json").read_text())
examples = json.loads((SITE / "data/examples.json").read_text())
results = json.loads((SITE / "data/results.json").read_text())
training = json.loads((SITE / "data/training.json").read_text())

check(sorted(m["key"] for m in meta["models"]) == sorted(MODELS), "five models in data")
check('MODEL_KEYS = ["B", "C", "D", "E1", "F"]' in (SITE / "assets/js/common.js").read_text(), "display order B, C, D, E1, F")
text_all = [p.read_text() for p in files if p.suffix in (".js", ".css", ".html", ".json")]
check(not any(k in t for t in text_all for k in ("★", "Suggested comparison", "featured", "FEATURED", "More references", "Target selected", "Both targets")),
      "no listening guidance, no collapsed references, no selection columns")
exp_text = [p.read_text() for p in exp_files if p.suffix in (".md", ".txt", ".svg")] + [(REPO / "README.md").read_text()]
check(not any("Hadamard" in t for t in text_all + exp_text) and any("Element-wise" in t for t in text_all),
      "E1 shown as Element-wise everywhere (site, exports, README)")
check(meta["audio_status"] == "approved", "audio status = approved")
check([e["id"] for e in examples] == EXAMPLES, "selected examples in order 047, 058, 041, 008, 006")
check(all(e["description"] == "" for e in examples), "no descriptive sentences under the example titles")
ex = {e["id"]: e for e in examples}
check("success" not in ex["008"]["title"].lower(), "008 is not described as successful")
check(ex["006"].get("listening", {}).get("s1", "").startswith("FiLM") and ex["006"]["listening"].get("s2", "").startswith("Element-wise"),
      "006 keeps both listening directions (FiLM better for s1, Element-wise better for s2)")

# audio: only the shown signals, byte-identical, consistent per example
sha = meta["audio_sha256"]
wavs = sorted(str(p.relative_to(SITE)) for p in files if p.suffix == ".wav")
check(sorted(sha) == wavs, f"meta.audio_sha256 lists exactly the {len(wavs)} WAV files")
bad = [f for f in wavs if hashlib.sha256((SITE / f).read_bytes()).hexdigest() != sha.get(f)]
check(not bad, f"SHA-256 of every WAV matches meta.json {bad[:3]}")
for e in examples:
    shown = e["models"]
    check(sorted(shown) == ["E1", "F"], f"example {e['id']}: shown models {shown} (F and E1 only)")
    a = e["audio"]
    want = {"mixture", "clean_s1", "clean_s2", "rev_s1", "rev_s2"} | {f"{m}_{t}" for m in shown for t in ("s1", "s2")}
    check(set(a) == want and all(f.startswith(f"audio/ex{e['id']}/") for f in a.values()), f"example {e['id']}: {len(want)} signals (both targets), no B/C/D audio")
    lengths = set()
    for f in a.values():
        info = wav_info((SITE / f).read_bytes())
        ok = info is not None and info[0] == [b"fmt ", b"data"] and info[1] == (1, 2, 16000, 64000, 4, 16)
        check(ok, f"{f}: RIFF fmt+data only, PCM 16-bit 16 kHz stereo") if not ok else None
        lengths.add(info[2] if info else None)
    check(len(lengths) == 1 and abs(next(iter(lengths)) / 4 / 16000 - e["duration_s"]) < 0.01, f"example {e['id']}: equal lengths, duration matches")
    for t in ("s1", "s2"):
        tt = e["targets"][t]
        ok = tt["azimuth"] == e["azimuth"][t] and tt["interferer_azimuth"] == e["azimuth"]["s2" if t == "s1" else "s1"]
        ok &= -90 <= tt["azimuth"] <= 90 and finite(tt["input_sir_db"]) and finite(tt["mixture_si_sdr"]) and sorted(tt["models"]) == sorted(shown)
        for m in shown:
            r = tt["models"][m]
            ok &= all(finite(r[k]) for k in ("si_sdr", "si_sdri")) and "success" not in r and \
                all(r[k] is None or finite(r[k]) for k in ("si_sir", "si_sar"))
            ok &= abs((r["si_sdr"] - tt["mixture_si_sdr"]) - r["si_sdri"]) < 0.011 and 1.0 <= r["pesq"] <= 4.64
        ok &= all(1.0 <= tt[f] <= 4.64 for f in ("mixture_pesq", "reverberant_pesq"))
        check(ok, f"example {e['id']} {t}: geometry, metrics, SI-SDRi = SI-SDR - mixture")
    check(abs(e["targets"]["s1"]["input_sir_db"] + e["targets"]["s2"]["input_sir_db"]) < 0.011, f"example {e['id']}: s1/s2 SIRs opposite")

# overall table and the two plots
vg, vs = meta["sets"]["valgrid"], meta["sets"]["valsep64"]
ov = results["overall"]
check(ov["set"] == "valgrid" and ov["step"] == 160000 and sorted(ov["values"]) == sorted(MODELS) and
      all(sorted(v) == sorted(["si_sdr", "si_sdri", "si_sir", "si_sar", "pesq", "n_mixtures", "n_requests"]) and
          all(finite(v[k]) for k in ("si_sdr", "si_sdri", "si_sir", "si_sar")) and 1.0 <= v["pesq"] <= 4.64 and
          (v["n_mixtures"], v["n_requests"]) == (vg["n_mixtures"], vg["n_requests"])
          for v in ov["values"].values()), "overall: valgrid 160k, five models, 192 / 384, SI metrics + PESQ (no selection rates)")
ref = ov["reference"]
check(all(abs(ov["values"][m]["si_sdr"] - ov["values"][m]["si_sdri"] - ref["mixture"]["si_sdr"]) < 2e-3 for m in MODELS) and
      all(1.0 <= ref[k]["pesq"] <= 4.64 for k in ("mixture", "reverberant_target")) and "wideband" in ov["pesq_mode"],
      "overall reference rows: mixture SI-SDR = SI-SDR - SI-SDRi for every model; mixture / reverberant PESQ within 1-4.64")
check("pesq" not in results, "no separate valsep64 PESQ table")
b = results["input_sir"]
check(b["set"] == "valgrid" and b["step"] == 160000 and len(b["bins"]) == 8 and all(len(b["values"][m]) == 8 for m in MODELS),
      "initial-SIR plot: valgrid 160k, 8 bins, every model")
c = b["values"]["C"]
check(sum(x["n_requests"] for x in c) == vg["n_requests"] and all(x["n_requests"] == x["n_mixtures"] for x in c), "initial SIR: 384 requests, one per mixture per bin")
check(all(abs(ov["values"][m]["si_sdri"] - sum(x["si_sdri"] for x in b["values"][m]) / 8) < 1e-3 for m in MODELS),
      "overall SI-SDRi = mean of the 8 equal-size SIR bins")
check(training["steps"] == STEPS and training["set"] == "valsep64" and all(len(training["values"][m]) == len(STEPS) and
      all(x["n_requests"] == vs["n_requests"] and x["n_mixtures"] == vs["n_mixtures"] for x in training["values"][m]) for m in MODELS),
      "training: measured checkpoints 20k/40k/80k/120k/160k only, 128 / 64 at every step")
blocks = [b["values"], training["values"]]
check(all(abs(x["si_sdr"] - x["mixture_si_sdr"] - x["si_sdri"]) < 1e-3 for bl in blocks for m in MODELS for x in bl[m]),
      "SI-SDR - mixture SI-SDR = SI-SDRi at every bin and checkpoint")
check(all([x["mixture_si_sdr"] for x in bl[m]] == [x["mixture_si_sdr"] for x in bl["C"]] for bl in blocks for m in MODELS),
      "mixture SI-SDR identical across models (paired requests)")

# references and statements
html = (SITE / "index.html").read_text()
js = {p.name: p.read_text() for p in (SITE / "assets/js").glob("*.js")}
refs = [r.split("?")[0] for r in re.findall(r'(?:href|src)="(?!#|https?:|data:)([^"]+)"', html)]
vers = set(re.findall(r'\?v=([0-9a-z]+)"', html + "".join((SITE / "assets/js" / f).read_text() for f in ("app.js", "common.js", "player.js", "charts.js", "geometry.js"))))
check(len(vers) == 1, f"one cache-busting asset version everywhere {sorted(vers)}")
check(all((SITE / r).exists() for r in refs), f"index.html references exist {refs}")
imports = [(n, i.split("?")[0]) for n, t in js.items() for i in re.findall(r'from "\./([^"]+)"', t)]
check(all((SITE / "assets/js" / i).exists() for _, i in imports), "JS module imports resolve")
check('name="robots" content="noindex' in html and (SITE / "robots.txt").exists(), "preview is noindex (meta + robots.txt)")
text = html + "".join(js.values())
for s_ in ("Speakers seen during training", "Unseen utterances and room", "No held-out test results", "not representative"):
    check(s_ in text, f'statement present: "{s_}"')

for line in notes + failures:
    print(line)
print(f"\n{len(notes)} passed, {len(failures)} failed")
sys.exit(1 if failures else 0)
