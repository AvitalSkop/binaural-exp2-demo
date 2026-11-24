"""
Headless-browser check of the local site (Firefox, WebDriver BiDi): page renders, no console errors, accordion,
player switching (signal and target), metric selector, chart tooltip; full-page screenshots at phone and desktop
widths, light and dark.

    python tools/browser_check.py --out <screenshot dir> [--site site]

Requires Firefox and the `websockets` package. Serves the site on 127.0.0.1 only, for the duration of the check.
"""
import argparse
import asyncio
import base64
import functools
import http.server
import json
import shutil
import socket
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import websockets


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Bidi:
    def __init__(self, ws):
        self.ws, self.i, self.logs = ws, 0, []

    async def cmd(self, method, **params):
        self.i += 1
        my = self.i
        await self.ws.send(json.dumps({"id": my, "method": method, "params": params}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("type") == "event":
                if msg["method"] == "log.entryAdded":
                    self.logs.append(msg["params"])
                continue
            if msg.get("id") == my:
                if msg.get("type") == "error":
                    raise RuntimeError(f"{method}: {msg.get('error')} {msg.get('message')}")
                return msg["result"]

    async def js(self, ctx, expr):
        r = await self.cmd("script.evaluate", expression=expr, target={"context": ctx}, awaitPromise=True,
                           userActivation=True)
        if r.get("type") == "exception":
            raise RuntimeError(r["exceptionDetails"]["text"])
        v = r["result"]
        return json.loads(v["value"]) if v.get("type") == "string" else v.get("value")

    async def click(self, ctx, selector):
        rect = await self.js(ctx, f"""(() => {{ const e = document.querySelector({json.dumps(selector)});
            e.scrollIntoView({{block: 'center', behavior: 'instant'}}); const r = e.getBoundingClientRect();
            return JSON.stringify([r.x + r.width / 2, r.y + r.height / 2]); }})()""")
        await self.cmd("input.performActions", context=ctx, actions=[{"type": "pointer", "id": "mouse", "actions": [
            {"type": "pointerMove", "x": int(rect[0]), "y": int(rect[1])},
            {"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]}])

    async def hover(self, ctx, selector):
        rect = await self.js(ctx, f"""(() => {{ const e = document.querySelector({json.dumps(selector)});
            e.scrollIntoView({{block: 'center', behavior: 'instant'}}); const r = e.getBoundingClientRect();
            return JSON.stringify([r.x + r.width / 2, r.y + r.height / 2]); }})()""")
        await self.cmd("input.performActions", context=ctx, actions=[{"type": "pointer", "id": "mouse", "actions": [
            {"type": "pointerMove", "x": int(rect[0]) - 3, "y": int(rect[1])},
            {"type": "pointerMove", "x": int(rect[0]), "y": int(rect[1])}]}])


async def run(url, out, dark, report):
    prof = Path(tempfile.mkdtemp(prefix="ffprof-", dir=out))
    prefs = {"media.autoplay.default": 0, "media.autoplay.blocking_policy": 0, "browser.shell.checkDefaultBrowser": False,
             "layout.css.prefers-color-scheme.content-override": 0 if dark else 1, "datareporting.policy.dataSubmissionEnabled": False,
             "toolkit.telemetry.enabled": False, "app.update.enabled": False}
    (prof / "user.js").write_text("".join(f'user_pref("{k}", {json.dumps(v)});\n' for k, v in prefs.items()))
    port = free_port()
    ff = subprocess.Popen(["firefox", "--headless", "--no-remote", "--profile", str(prof), f"--remote-debugging-port={port}"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                ws = await websockets.connect(f"ws://127.0.0.1:{port}/session", max_size=2**28)
                break
            except OSError:
                await asyncio.sleep(0.2)
        b = Bidi(ws)
        await b.cmd("session.new", capabilities={})
        await b.cmd("session.subscribe", events=["log.entryAdded"])
        ctx = (await b.cmd("browsingContext.getTree"))["contexts"][0]["context"]
        mode = "dark" if dark else "light"
        for name, (w, h) in {"phone": (390, 844), "desktop": (1366, 900)}.items():
            await b.cmd("browsingContext.setViewport", context=ctx, viewport={"width": w, "height": h})
            await b.cmd("browsingContext.navigate", context=ctx, url=url, wait="complete")
            for _ in range(100):
                if await b.js(ctx, "document.querySelectorAll('details.example').length === 5 && !!document.querySelector('#chart-training svg') && !document.querySelector('#example-047 .aplay').disabled"):
                    break
                await asyncio.sleep(0.2)
            dom = await b.js(ctx, """JSON.stringify({
                examples: document.querySelectorAll('details.example').length,
                ids: [...document.querySelectorAll('details.example')].map(d => d.id.slice(8)).join(' '),
                open: [...document.querySelectorAll('details.example[open]')].map(d => d.id),
                tableRows: document.querySelectorAll('#example-047 .ex-table tbody tr').length,
                charts: document.querySelectorAll('.chart svg').length,
                trainMarkers: document.querySelectorAll('#chart-training .pt').length,
                sirMarkers: document.querySelectorAll('#chart-sir .pt').length,
                loaded: !document.querySelector('#example-047 .aplay').disabled,
                rows041: [...document.querySelectorAll('#example-047 .arow')].map(r => r.dataset.role).join(' '),
                rows024: [...document.querySelectorAll('#example-024 .arow')].map(r => r.dataset.role).join(' '),
                bdRows: document.querySelectorAll('.arow[data-role="B"], .arow[data-role="D"]').length,
                hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
                overflow: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('.table-wrap'))
                  .slice(0, 6).map(e => `${e.tagName}.${e.className.baseVal ?? e.className} ${Math.round(e.getBoundingClientRect().right)}`),
                tableOverflow: Math.max(0, ...[...document.querySelectorAll('details[open] .table-wrap, .overall .table-wrap')].map(w => w.scrollWidth - w.clientWidth)),
                theme: getComputedStyle(document.body).backgroundColor,
                legend: document.querySelector('[data-legend]').textContent.replace(/\s+/g, ' ').trim(),
                bestCells: document.querySelectorAll('#example-047 td.best').length,
                overallRows: [...document.querySelectorAll('.overall-table tbody tr')].map(r => (r.querySelector('b') || r.cells[0].querySelector('.long') || r.cells[0]).textContent).join(' | '),
                overallTable: [...document.querySelectorAll('.overall-table tr')].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ; ')),
                overallHeads: [...document.querySelectorAll('.tbl-h')].map(x => x.textContent.trim()),
                overallCols: document.querySelectorAll('.overall-table thead th').length,
                protocolOpen: document.querySelector('details.protocol').open,
                note003: (document.querySelector('#example-006 .listen-note') || {}).textContent || null,
                geoWidth: Math.round(document.querySelector('#example-047 .geometry svg').getBoundingClientRect().width) })""")
            report[f"{mode}/{name}/dom"] = dom
            if name == "desktop" and not dark:
                ex = "#example-047"
                state = "JSON.stringify({theme: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor, label: document.getElementById('theme-toggle').getAttribute('aria-label')})"
                t0 = await b.js(ctx, state)
                await b.click(ctx, "#theme-toggle")
                await asyncio.sleep(0.3)
                t1 = await b.js(ctx, state)
                await b.cmd("browsingContext.reload", context=ctx, wait="complete")
                await asyncio.sleep(1.0)
                t2 = await b.js(ctx, state)
                await b.click(ctx, "#theme-toggle")
                await asyncio.sleep(0.3)
                t3 = await b.js(ctx, state)
                report["theme_toggle"] = {"initial": t0, "after_click": t1, "after_reload": t2, "after_second_click": t3}
                for _ in range(50):
                    if await b.js(ctx, "!document.querySelector('#example-047 .aplay').disabled"):
                        break
                    await asyncio.sleep(0.2)
                rowstate = lambda sel: f"""JSON.stringify({{playing: [...document.querySelectorAll('.arow.playing')].map(r => r.closest('details').id.slice(8) + ':' + r.dataset.role),
                    times: Object.fromEntries([...document.querySelectorAll('{sel} .arow')].map(r => [r.dataset.role, r.querySelector('.atime').textContent.split(' /')[0]])),
                    head: (document.querySelector('{sel} .ex-table thead th') || {{}}).textContent, geo: document.querySelector('{sel} .geometry svg').getAttribute('aria-label')}})"""
                await b.click(ctx, f'{ex} .arow[data-role="mixture"] .aplay')
                await asyncio.sleep(1.0)
                st1 = await b.js(ctx, rowstate(ex))
                await b.click(ctx, f'{ex} .arow[data-role="F"] .aplay')
                await asyncio.sleep(0.6)
                st2 = await b.js(ctx, rowstate(ex))
                await b.click(ctx, f"{ex} .target-row .seg button:nth-child(2)")
                await asyncio.sleep(0.6)
                st3 = await b.js(ctx, rowstate(ex))
                await b.click(ctx, '#example-006 > summary')
                for _ in range(50):
                    if await b.js(ctx, "!document.querySelector('#example-006 .aplay').disabled"):
                        break
                    await asyncio.sleep(0.2)
                await b.click(ctx, '#example-006 .arow[data-role="E1"] .aplay')
                await asyncio.sleep(0.6)
                st4 = await b.js(ctx, rowstate("#example-006"))
                await b.click(ctx, '#example-006 .arow[data-role="E1"] .aplay')
                await asyncio.sleep(0.3)
                st5 = await b.js(ctx, rowstate("#example-006"))
                seek_js = """(() => { const s = document.querySelector('#example-047 .arow[data-role="int_rev"] .aseek'); s.value = '500';
                    s.dispatchEvent(new Event('input')); return JSON.stringify(document.querySelector('#example-047 .arow[data-role="int_rev"] .atime').textContent); })()"""
                seek_paused = await b.js(ctx, seek_js)
                await b.click(ctx, '#example-047 .arow[data-role="int_rev"] .aplay')
                await asyncio.sleep(0.6)
                seek_play = await b.js(ctx, rowstate("#example-047"))
                await b.click(ctx, '#example-047 .arow[data-role="int_rev"] .aplay')
                report["seek"] = {"after_seek_paused": seek_paused, "after_play": {"playing": seek_play["playing"], "int_rev": seek_play["times"]["int_rev"]}}
                await b.js(ctx, "document.querySelector('#example-047 thead .info').focus(), JSON.stringify('ok')")
                await asyncio.sleep(0.2)
                tipbox = await b.js(ctx, "JSON.stringify({visible: !document.getElementById('tipbox').hidden, text: document.getElementById('tipbox').textContent.slice(0, 60)})")
                await b.click(ctx, '[data-metric-group="training"] .seg button:nth-child(2)')
                await asyncio.sleep(0.3)
                axis = await b.js(ctx, "JSON.stringify([document.querySelector('#chart-training .axis-title').textContent, document.querySelectorAll('#chart-training .base').length])")
                await b.hover(ctx, '#chart-sir .hit[data-i="0"]')
                await asyncio.sleep(0.3)
                tip = await b.js(ctx, "JSON.stringify({visible: !document.querySelector('#chart-sir .tip').hidden, text: document.querySelector('#chart-sir .tip').textContent.replace(/\\s+/g, ' ').trim()})")
                report["interaction"] = {"mixture_playing": st1, "F_started_mixture_paused": st2, "target_s2_F_continues": st3,
                                         "other_example_pauses_041": st4, "pause_006": st5, "info_tooltip": tipbox,
                                         "training_metric_SI-SDRi": axis, "sir_tooltip": tip}
                await b.click(ctx, '[data-metric-group="training"] .seg button:nth-child(1)')
                await b.js(ctx, "window.scrollTo({top: 0, behavior: 'instant'}), JSON.stringify(1)")
            shot = await b.cmd("browsingContext.captureScreenshot", context=ctx, origin="document")
            (out / f"{mode}_{name}.png").write_bytes(base64.b64decode(shot["data"]))
        report[f"{mode}/console"] = [f"{l.get('level')}: {l.get('text')}" for l in b.logs if l.get("level") in ("error", "warn")]
        await ws.close()
    finally:
        ff.terminate()
        try:
            ff.wait(10)
        except subprocess.TimeoutExpired:
            ff.kill()
        shutil.rmtree(prof, ignore_errors=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--site", default=str(Path(__file__).resolve().parents[1] / "site"))
    p.add_argument("--out", required=True)
    a = p.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    handler = functools.partial(Quiet, directory=a.site)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    report = {}
    try:
        asyncio.run(run(url, out, False, report))
        asyncio.run(run(url, out, True, report))
    finally:
        srv.shutdown()
    (out / "browser_report.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
