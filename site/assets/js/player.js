// One playback row per signal (play/pause, seek, time), like the original Experiment 2 dashboard. Only one signal
// plays at a time on the whole page. Default = the files as exported (one common gain per example, both ears);
// "Loudness-matched" scales each signal to the example's median RMS (both ears), limited so no sample exceeds 0.98.
// Web Audio is used because iOS ignores <audio>.volume.
import { chip, fmtTime, h } from "./common.js";

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
  constructor(example, models) {
    this.ex = example;
    this.models = models;                 // the estimates shown for this example, display order
    this.target = example.default_target;
    this.buffers = {};
    this.stats = {};
    this.pos = {};                        // playback position per signal role
    this.playing = null;                  // role currently playing
    this.src = null;
    this.matched = false;
    this.loaded = false;
  }

  other(t = this.target) { return t === "s1" ? "s2" : "s1"; }

  fileFor(role, t = this.target) {
    const a = this.ex.audio, o = this.other(t);
    if (role === "mixture") return a.mixture;
    if (role === "clean" || role === "rev") return a[`${role}_${t}`];
    if (role === "int_clean") return a[`clean_${o}`];
    if (role === "int_rev") return a[`rev_${o}`];
    return a[`${role}_${t}`];
  }

  groups() {
    const t = this.target, o = this.other();
    return {
      refs: [["mixture", "Mixture"], ["clean", `Target ${t} · near-anechoic`]],
      est: this.models.map((m) => [m.key, `${m.key} · ${m.name}`, m.key]),
      more: [["rev", `Target ${t} · reverberant`], ["int_clean", `Interferer ${o} · near-anechoic`], ["int_rev", `Interferer ${o} · reverberant`]],
    };
  }

  render(container) {
    this.el = container;
    container.classList.add("player");
    this.rowsBox = h("div");
    const opts = h("label", { class: "loud" }, '<input type="checkbox"> Loudness-matched');
    opts.querySelector("input").addEventListener("change", (e) => this.setMatched(e.target.checked));
    this.status = h("p", { class: "status", role: "status" }, "");
    container.append(this.rowsBox, opts, this.status);
    this.renderRows();
  }

  renderRows() {
    const g = this.groups(), d = this.ex.duration_s;
    const row = ([role, label, key]) => `<div class="arow" data-role="${role}">
        <button type="button" class="aplay" aria-label="Play ${label}" ${this.loaded ? "" : "disabled"}>${PLAY}</button>
        <span class="alabel">${key ? chip(key) : ""}<span>${label}</span></span>
        <input class="aseek" type="range" min="0" max="1000" step="1" value="0" aria-label="Position: ${label}" ${this.loaded ? "" : "disabled"}>
        <span class="atime">${fmtTime(0)} / ${fmtTime(d)}</span></div>`;
    const wasOpen = this.rowsBox.querySelector("details")?.open;
    this.rowsBox.innerHTML = `<div class="group-label">References</div>${g.refs.map(row).join("")}
      <div class="group-label">Estimates</div>${g.est.map(row).join("")}
      <details class="more"${wasOpen ? " open" : ""}><summary>More references</summary>${g.more.map(row).join("")}</details>`;
    this.rowsBox.querySelectorAll(".arow").forEach((r) => {
      const role = r.dataset.role;
      r.querySelector(".aplay").addEventListener("click", () => (this.playing === role ? this.pause() : this.play(role)));
      r.querySelector(".aseek").addEventListener("input", (e) => this.seek(role, (e.target.value / 1000) * this.duration()));
    });
    this.updateRows();
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
            const x = buf.getChannelData(c);
            for (let i = 0; i < x.length; i++) { ss += x[i] * x[i]; if (Math.abs(x[i]) > peak) peak = Math.abs(x[i]); }
            n += x.length;
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
      this.renderRows();
    })();
    return this.loading;
  }

  duration() { const b = this.buffers[this.ex.audio.mixture]; return b ? b.duration : this.ex.duration_s; }
  gainFor(file) { if (!this.matched) return 1; const s = this.stats[file]; return Math.min(this.refRms / s.rms, 0.98 / s.peak); }

  position() {
    if (!this.playing) return 0;
    return Math.min(ctx.currentTime - this.t0 + this.off0, this.duration());
  }

  async play(role) {
    await this.load();
    const ac = audio();
    if (ac.state === "suspended") await ac.resume();
    if (active && active !== this) active.pause();
    if (this.playing) this.pause();
    active = this;
    let off = this.pos[role] || 0;
    if (off >= this.duration() - 0.01) off = 0;
    const file = this.fileFor(role), at = ac.currentTime + 0.02;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = this.buffers[file];
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(this.gainFor(file), at + FADE);
    src.connect(g).connect(master);
    src.start(at, off);
    src.onended = () => {
      if (this.src && this.src.src === src) { this.src = null; this.pos[this.playing] = 0; this.playing = null; this.updateRows(); }
    };
    this.src = { src, g, file };
    this.playing = role;
    this.t0 = at;
    this.off0 = off;
    this.updateRows();
    this.tick();
  }

  pause() {
    if (!this.playing) return;
    this.pos[this.playing] = this.position();
    const { src, g } = this.src;
    this.src = null;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + FADE);
    try { src.stop(t + FADE + 0.002); } catch (_) { /* already stopped */ }
    this.playing = null;
    this.updateRows();
  }

  seek(role, p) {
    if (this.playing === role) { this.pause(); this.pos[role] = p; this.play(role); }
    else { this.pos[role] = p; this.updateRows(); }
  }

  /** Change the requested speaker; a playing signal continues as the same role for the new target, same position. */
  setTarget(t) {
    if (t === this.target) return;
    const role = this.playing;
    if (role) this.pause();
    this.target = t;
    this.renderRows();
    if (role) this.play(role);
  }

  setMatched(on) {
    this.matched = on;
    if (this.src) this.src.g.gain.setTargetAtTime(this.gainFor(this.src.file), ctx.currentTime, 0.01);
  }

  tick() {
    if (!this.playing) return;
    this.updateRow(this.playing);
    requestAnimationFrame(() => this.tick());
  }

  updateRow(role) {
    const r = this.rowsBox.querySelector(`.arow[data-role="${role}"]`);
    if (!r) return;
    const on = this.playing === role, p = on ? this.position() : (this.pos[role] || 0), d = this.duration();
    r.classList.toggle("playing", on);
    const b = r.querySelector(".aplay");
    b.innerHTML = on ? PAUSE : PLAY;
    b.setAttribute("aria-pressed", String(on));
    r.querySelector(".aseek").value = String(Math.round((p / d) * 1000));
    r.querySelector(".atime").textContent = `${fmtTime(p)} / ${fmtTime(d)}`;
  }

  updateRows() { this.rowsBox.querySelectorAll(".arow").forEach((r) => this.updateRow(r.dataset.role)); }
}
