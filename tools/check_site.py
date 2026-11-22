"""
Static validation of the public site directory (everything under site/ is public once deployed).

    python tools/check_site.py [site_dir]

Checks: file-type allowlist and size budget; leak scan (private paths, hosts, account names, dataset identifiers)
over every file including WAV bytes; JSON schema and internal consistency (models, examples, counts, measured
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
EXAMPLES = ["041", "008", "024", "030", "006", "003"]
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
check(not any("leak scan" in f for f in failures), "leak scan clean (all files, including audio bytes)")

meta = json.loads((SITE / "data/meta.json").read_text())
examples = json.loads((SITE / "data/examples.json").read_text())
results = json.loads((SITE / "data/results.json").read_text())
training = json.loads((SITE / "data/training.json").read_text())

check(sorted(m["key"] for m in meta["models"]) == sorted(MODELS), "five models C, F, B, D, E1 in data")
check('MODEL_KEYS = ["B", "C", "D", "E1", "F"]' in (SITE / "assets/js/common.js").read_text(), "display order B, C, D, E1, F")
check(not any(k in t for t in [p.read_text() for p in files if p.suffix in (".js", ".css", ".html", ".json")] for k in ("★", "Suggested comparison", "featured", "FEATURED")),
      "no listening guidance (featured comparisons, ★ markers)")
check(meta["audio_status"] == "approved", "audio status = approved")
check([e["id"] for e in examples] == EXAMPLES, "six selected examples in order")

# audio
sha = meta["audio_sha256"]
wavs = sorted(str(p.relative_to(SITE)) for p in files if p.suffix == ".wav")
check(sorted(sha) == wavs, f"meta.audio_sha256 lists exactly the {len(wavs)} WAV files")
bad = [f for f in wavs if hashlib.sha256((SITE / f).read_bytes()).hexdigest() != sha.get(f)]
check(not bad, f"SHA-256 of every WAV matches meta.json {bad[:3]}")
for e in examples:
    a = e["audio"]
    want = {"mixture", "clean_s1", "clean_s2", "rev_s1", "rev_s2"} | {f"{m}_{t}" for m in MODELS for t in ("s1", "s2")}
    check(set(a) == want, f"example {e['id']}: 15 signals (both targets)")
    lengths = set()
    for f in a.values():
        info = wav_info((SITE / f).read_bytes())
        ok = info is not None and info[0] == [b"fmt ", b"data"] and info[1] == (1, 2, 16000, 64000, 4, 16)
        check(ok, f"{f}: RIFF fmt+data only, PCM 16-bit 16 kHz stereo") if not ok else None
        lengths.add(info[2] if info else None)
    check(len(lengths) == 1, f"example {e['id']}: all signals have equal length")
    check(abs(next(iter(lengths)) / 4 / 16000 - e["duration_s"]) < 0.01, f"example {e['id']}: duration matches audio")
    for t in ("s1", "s2"):
        tt = e["targets"][t]
        check(tt["azimuth"] == e["azimuth"][t] and tt["interferer_azimuth"] == e["azimuth"]["s2" if t == "s1" else "s1"],
              f"example {e['id']} {t}: geometry consistent")
        check(-90 <= tt["azimuth"] <= 90 and finite(tt["input_sir_db"]) and finite(tt["mixture_si_sdr"]),
              f"example {e['id']} {t}: azimuth / SIR / mixture SI-SDR valid")
        for m in MODELS:
            r = tt["models"][m]
            ok = all(finite(r[k]) for k in ("si_sdr", "si_sdri")) and isinstance(r["success"], bool) and \
                all(r[k] is None or finite(r[k]) for k in ("si_sir", "si_sar"))
            ok &= abs((r["si_sdr"] - tt["mixture_si_sdr"]) - r["si_sdri"]) < 0.011        # SI-SDRi = SI-SDR - mixture
            check(ok, f"example {e['id']} {t} {m}: metrics valid, SI-SDRi = SI-SDR - mixture") if not ok else None
    check(abs(e["targets"]["s1"]["input_sir_db"] + e["targets"]["s2"]["input_sir_db"]) < 0.011,
          f"example {e['id']}: target SIRs of s1 and s2 are opposite")
check(not any("metrics valid" in f for f in failures), "example metric tables complete and SI-SDRi consistent")

# aggregate plots
vg, vs = meta["sets"]["valgrid"], meta["sets"]["valsep64"]
for name, block, nb in (("separation", results["separation"], 4), ("input_sir", results["input_sir"], 8)):
    check(len(block["bins"]) == nb and block["step"] == 160000 and block["set"] == "valgrid", f"{name}: valgrid, 160k, {nb} bins")
    for m in MODELS:
        v = block["values"][m]
        check(len(v) == nb and all(finite(s[k]) for s in v for k in ("si_sdri", "si_sir", "si_sar")),
              f"{name} {m}: one measured value per bin (no gaps)") if len(v) != nb else None
        check(all(s["n_decomp_requests"] == s["n_requests"] for s in v), f"{name} {m}: SI-SIR/SAR over all requests") \
            if not all(s["n_decomp_requests"] == s["n_requests"] for s in v) else None
        check([(s["n_requests"], s["n_mixtures"]) for s in v] == [(s["n_requests"], s["n_mixtures"]) for s in block["values"]["C"]],
              f"{name} {m}: same counts as C (paired)") if m != "C" else None
    c = block["values"]["C"]
    check(sum(s["n_requests"] for s in c) == vg["n_requests"], f"{name}: requests sum to {vg['n_requests']}")
    if name == "separation":
        check(sum(s["n_mixtures"] for s in c) == vg["n_mixtures"] and all(s["n_requests"] == 2 * s["n_mixtures"] for s in c),
              "separation: 2 requests per mixture, mixtures sum to 192")
    else:
        check(all(s["n_requests"] == s["n_mixtures"] for s in c), "input SIR: 1 request per mixture per bin")
ov = results["overall"]
check(ov["set"] == "valgrid" and ov["step"] == 160000 and sorted(ov["values"]) == sorted(MODELS), "overall: valgrid, 160k, five models")
check(all(all(finite(v[k]) for k in ("si_sdr", "si_sdri", "si_sir", "si_sar", "success", "W", "ild_error_db", "itd_error_us"))
          and (v["n_mixtures"], v["n_requests"], v["n_decomp_requests"]) == (vg["n_mixtures"], vg["n_requests"], vg["n_requests"])
          and 0 <= v["W"] <= v["success"] <= 1 for v in ov["values"].values()), "overall: complete values, 192 / 384, W <= success")
check(all(abs(ov["values"][m]["si_sdri"] - sum(s["si_sdri"] * s["n_mixtures"] for s in results["separation"]["values"][m]) / vg["n_mixtures"]) < 1e-3
          for m in MODELS), "overall SI-SDRi = mixture-weighted mean of the separation bins")
check(training["steps"] == STEPS and training["set"] == "valsep64", "training: measured checkpoints 20k/40k/80k/120k/160k only")
check(all(len(training["values"][m]) == len(STEPS) and all(s["n_requests"] == vs["n_requests"] and s["n_mixtures"] == vs["n_mixtures"]
          for s in training["values"][m]) for m in MODELS), "training: 128 requests / 64 mixtures at every step, every model")

# references and statements
html = (SITE / "index.html").read_text()
js = {p.name: p.read_text() for p in (SITE / "assets/js").glob("*.js")}
refs = re.findall(r'(?:href|src)="(?!#|https?:|data:)([^"]+)"', html)
check(all((SITE / r).exists() for r in refs), f"index.html references exist {refs}")
imports = [(n, i) for n, t in js.items() for i in re.findall(r'from "\./([^"]+)"', t)]
check(all((SITE / "assets/js" / i).exists() for _, i in imports), "JS module imports resolve")
check('name="robots" content="noindex' in html and (SITE / "robots.txt").exists(), "preview is noindex (meta + robots.txt)")
text = html + "".join(js.values())
for s in ("speakers also appear in training", "not representative", "No held-out test-set results",
          "no statistically significant superiority", "Only the checkpoints shown were evaluated", "headphones"):
    check(s in text, f'statement present: "{s}"')

for line in notes + failures:
    print(line)
print(f"\n{len(notes)} passed, {len(failures)} failed")
sys.exit(1 if failures else 0)
