// Shared Web Audio comparison player. All signals of a scene have the same length; switching schedules the new
// source at the same AudioContext time with the same offset (sample-aligned) and a short crossfade.
// Consistent gain = the files as exported (one common gain per scene, both ears). "Loudness-matched" scales each
// signal to the scene's median RMS (both ears), limited so that no sample exceeds 0.98.
import { MODEL_KEYS, chip, fmtTime, h } from "./common.js";

const FADE = 0.008;
let ctx = null, master = null, active = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  return ctx;
}

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>';

export class ExamplePlayer {
  constructor(example, models, { onChange } = {}) {
    this.ex = example;
    this.models = models;
    this.target = example.default_target;
    this.role = "mixture";
    this.onChange = onChange || (() => {});
    this.buffers = {};
    this.stats = {};
    this.loaded = false;
    this.playing = false;
    this.offset = 0;
    this.loop = false;
    this.matched = false;
    this.src = null;
  }

  other(t = this.target) { return t === "s1" ? "s2" : "s1"; }

  fileFor(role, target = this.target) {
    const a = this.ex.audio, o = this.other(target);
    if (role === "mixture") return a.mixture;
    if (role === "clean" || role === "rev") return a[`${role}_${target}`];
    if (role === "int_clean") return a[`clean_${o}`];
    if (role === "int_rev") return a[`rev_${o}`];
    return a[`${role}_${target}`];
  }

  roles() {
    const t = this.target, o = this.other();
    return {
      refs: [["mixture", "Mixture", "input"], ["clean", `Target ${t}`, "near-anechoic"], ["rev", `Target ${t}`, "reverberant"]],
      est: this.models.map((m) => [m.key, m.key, m.name]),
      interf: [["int_clean", `Interferer ${o}`, "near-anechoic"], ["int_rev", `Interferer ${o}`, "reverberant"]],
    };
  }

  render(container) {
    this.el = container;
    container.classList.add("player");
    container.tabIndex = -1;
    container.innerHTML = "";
    this.btn = h("button", { class: "play", type: "button", "aria-label": "Play", disabled: true }, PLAY);
    this.seek = h("input", { class: "seek", type: "range", min: 0, max: 1000, value: 0, step: 1, "aria-label": "Playback position", disabled: true });
    this.time = h("span", { class: "time", "aria-live": "off" }, `0:00.0 / ${fmtTime(this.ex.duration_s)}`);
    const transport = h("div", { class: "transport" });
    transport.append(this.btn, this.seek, this.time);
    const opts = h("div", { class: "opts" });
    const loop = h("label", {}, '<input type="checkbox"> Loop');
    const match = h("label", { title: "Scale every signal to the same RMS level (both ears)" }, '<input type="checkbox"> Loudness-matched');
    opts.append(loop, match, h("span", { class: "small" }, "Keys 1–8 switch signals · Space plays / pauses"));
    container.append(transport, opts);
    this.tileBox = h("div");
    container.append(this.tileBox);
    this.status = h("p", { class: "status", role: "status" }, "");
    container.append(this.status);
    this.renderTiles();

    this.btn.addEventListener("click", () => (this.playing ? this.pause() : this.play()));
    this.seek.addEventListener("input", () => this.seekTo((this.seek.value / 1000) * this.duration()));
    loop.querySelector("input").addEventListener("change", (e) => this.setLoop(e.target.checked));
    match.querySelector("input").addEventListener("change", (e) => this.setMatched(e.target.checked));
    container.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
      const order = ["mixture", "clean", "rev", ...MODEL_KEYS];
      if (/^[1-8]$/.test(e.key)) { e.preventDefault(); this.select(order[Number(e.key) - 1]); }
      else if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); this.playing ? this.pause() : this.play(); }
    });
  }

  renderTiles() {
    const r = this.roles(), order = ["mixture", "clean", "rev", ...MODEL_KEYS];
    const tile = ([role, main, sub]) => {
      const k = order.indexOf(role), isModel = MODEL_KEYS.includes(role);
      const lead = isModel ? chip(role) : "";
      const hint = k >= 0 ? ` (key ${k + 1})` : "";
      return `<button type="button" class="tile${isModel ? " model-tile" : ""}" data-role="${role}"
        aria-pressed="${role === this.role}" ${this.loaded ? "" : "disabled"} aria-label="${main}, ${sub}${hint}"
        title="${main} · ${sub}${hint}"><span class="t-main">${lead}${main}</span><span class="t-sub">${sub}</span></button>`;
    };
    const wasOpen = this.tileBox.querySelector("details.more")?.open;
    this.tileBox.innerHTML =
      `<div class="group-label">References</div><div class="tiles refs">${r.refs.map(tile).join("")}</div>
       <div class="group-label">Model estimates</div><div class="tiles models">${r.est.map(tile).join("")}</div>
       <details class="more"${wasOpen ? " open" : ""}><summary>Interfering speaker references</summary><div class="tiles interf">${r.interf.map(tile).join("")}</div></details>`;
    this.tileBox.querySelectorAll(".tile").forEach((b) => b.addEventListener("click", () => this.select(b.dataset.role)));
  }

  async load() {
    if (this.loaded || this.loading) return this.loading;
    this.status.textContent = "Loading audio…";
    const files = [...new Set(Object.values(this.ex.audio))];
    this.loading = (async () => {
      const ac = audio();
      try {
        await Promise.all(files.map(async (f) => {
          const res = await fetch(f);
          if (!res.ok) throw new Error(`${res.status}`);
          const buf = await ac.decodeAudioData(await res.arrayBuffer());
          this.buffers[f] = buf;
          let ss = 0, peak = 0, n = 0;
          for (let c = 0; c < buf.numberOfChannels; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < d.length; i++) { const v = d[i]; ss += v * v; if (Math.abs(v) > peak) peak = Math.abs(v); }
            n += d.length;
          }
          this.stats[f] = { rms: Math.sqrt(ss / n), peak };
        }));
      } catch (err) {
        this.status.textContent = "Audio could not be loaded. Please reload the page.";
        this.loading = null;
        throw err;
      }
      const rms = Object.values(this.stats).map((s) => s.rms).sort((a, b) => a - b);
      this.refRms = rms[Math.floor(rms.length / 2)];
      this.loaded = true;
      this.status.textContent = "";
      this.btn.disabled = false;
      this.seek.disabled = false;
      this.renderTiles();
    })();
    return this.loading;
  }

  duration() { const b = this.buffers[this.fileFor(this.role)]; return b ? b.duration : this.ex.duration_s; }

  gainFor(file) {
    if (!this.matched) return 1;
    const s = this.stats[file];
    return Math.min(this.refRms / s.rms, 0.98 / s.peak);
  }

  position(at = ctx ? ctx.currentTime : 0) {
    if (!this.playing) return this.offset;
    const d = this.duration(), p = at - this.t0 + this.off0;
    return this.loop ? ((p % d) + d) % d : Math.min(p, d);
  }

  startSource(file, at, offset, fade) {
    const src = ctx.createBufferSource(), g = ctx.createGain(), G = this.gainFor(file);
    src.buffer = this.buffers[file];
    src.loop = this.loop;
    if (fade) { g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(G, at + FADE); } else g.gain.setValueAtTime(G, at);
    src.connect(g).connect(master);
    src.start(at, offset);
    src.onended = () => {
      if (this.src && this.src.src === src && !src.loop) {
        this.src = null; this.playing = false; this.offset = 0; this.updateUI();
      }
    };
    this.src = { src, g, file };
    this.t0 = at;
    this.off0 = offset;
  }

  stopSource(at) {
    if (!this.src) return;
    const { src, g } = this.src;
    this.src = null;
    g.gain.setValueAtTime(g.gain.value, at);
    g.gain.linearRampToValueAtTime(0, at + FADE);
    try { src.stop(at + FADE + 0.002); } catch (_) { /* already stopped */ }
  }

  async play() {
    await this.load();
    const ac = audio();
    if (ac.state === "suspended") await ac.resume();
    if (active && active !== this) active.pause();
    active = this;
    if (this.offset >= this.duration() - 0.01) this.offset = 0;
    this.playing = true;
    this.startSource(this.fileFor(this.role), ac.currentTime + 0.02, this.offset, true);
    this.tick();
    this.updateUI();
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.position();
    this.stopSource(ctx.currentTime);
    this.playing = false;
    this.updateUI();
  }

  /** Re-schedule the current (or a new) signal at the same playback position. */
  reschedule(offset = null) {
    const at = ctx.currentTime + 0.02;
    const p = offset === null ? this.position(at) : offset;
    this.stopSource(at);
    this.startSource(this.fileFor(this.role), at, p, true);
  }

  select(role) {
    if (!this.loaded || role === this.role) { if (this.loaded && !this.playing) this.play(); return; }
    this.role = role;
    if (this.playing) this.reschedule();
    this.renderTiles();
    this.updateUI();
    if (!this.playing) this.play();
  }

  setTarget(t) {
    if (t === this.target) return;
    this.target = t;
    if (this.playing && this.loaded) this.reschedule();
    this.renderTiles();
    this.updateUI();
  }

  seekTo(p) {
    if (this.playing) this.reschedule(p); else this.offset = p;
    this.updateUI();
  }

  setLoop(on) {
    if (this.playing) { const p = this.position(); this.loop = on; this.src.src.loop = on; this.t0 = ctx.currentTime; this.off0 = p; }
    else this.loop = on;
  }

  setMatched(on) {
    this.matched = on;
    if (this.src) this.src.g.gain.setTargetAtTime(this.gainFor(this.src.file), ctx.currentTime, 0.01);
  }

  tick() {
    if (!this.playing) return;
    const p = this.position(), d = this.duration();
    this.seek.value = String(Math.round((p / d) * 1000));
    this.time.textContent = `${fmtTime(p)} / ${fmtTime(d)}`;
    requestAnimationFrame(() => this.tick());
  }

  updateUI() {
    this.btn.innerHTML = this.playing ? PAUSE : PLAY;
    this.btn.setAttribute("aria-label", this.playing ? "Pause" : "Play");
    this.el.classList.toggle("is-playing", this.playing);
    const p = this.position(), d = this.duration();
    this.seek.value = String(Math.round((p / d) * 1000));
    this.time.textContent = `${fmtTime(p)} / ${fmtTime(d)}`;
    this.onChange({ role: this.role, target: this.target, playing: this.playing });
  }
}
