'use strict';
/* Tiny SVG chart builders. They return markup strings; CSS handles colors and animation. */

const Charts = (() => {
  // pathLength="100" lets the dash offset be the percentage directly.
  function ring(p, { size = 22, stroke = 3.5 } = {}) {
    const c = size / 2, r = (size - stroke) / 2, v = Math.round(p * 100);
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`
      + `<circle class="ring-bg" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}"/>`
      + `<circle class="ring-fg" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}" pathLength="100" `
      + `stroke-dasharray="100" transform="rotate(-90 ${c} ${c})" `
      + `style="stroke-dashoffset:${100 - v};stroke-opacity:${v ? 1 : 0}"/></svg>`;
  }

  function setRing(svg, p) {
    const fg = svg && svg.querySelector('.ring-fg');
    if (!fg) return;
    const v = Math.round(p * 100);
    fg.style.strokeDashoffset = 100 - v;
    fg.style.strokeOpacity = v ? 1 : 0;
  }

  // Monotone cubic interpolation: smooth like the original's curves, but never overshoots 0–100%.
  function smooth(pts) {
    const n = pts.length;
    if (n < 2) return n ? `M${pts[0][0]},${pts[0][1]}` : '';
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
    }
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    const f = v => +v.toFixed(1);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ` C${f(pts[i][0] + h)},${f(pts[i][1] + h * t[i])} ${f(pts[i + 1][0] - h)},${f(pts[i + 1][1] - h * t[i + 1])} ${pts[i + 1][0]},${pts[i + 1][1]}`;
    }
    return d;
  }

  // values: completion (0–1) per day of the month, or null for days with no data yet.
  // width should match the rendered size so text stays at its real pixel size.
  function area(values, { labels = true, today = -1, width = 720 } = {}) {
    const W = Math.round(width), H = 230, L = 38, R = 14, T = 24, B = 28, n = values.length;
    const iw = W - L - R, ih = H - T - B;
    const X = i => +(L + (n > 1 ? (i * iw) / (n - 1) : iw / 2)).toFixed(1);
    const Y = v => +(T + ih * (1 - v)).toFixed(1);

    let grid = '';
    for (const v of [0, 0.5, 1]) {
      grid += `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>`
        + `<text class="ax" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v * 100}%</text>`;
    }
    for (const i of new Set([0, 4, 9, 14, 19, 24, n - 1])) {
      if (i < n) grid += `<text class="ax" x="${X(i)}" y="${H - 8}" text-anchor="middle">${i + 1}</text>`;
    }

    const runs = [];
    let run = [];
    values.forEach((v, i) => {
      if (v == null) { if (run.length) runs.push(run); run = []; } else run.push([X(i), Y(v), i, v]);
    });
    if (run.length) runs.push(run);

    let paths = '', marks = '', k = 0;
    for (const r of runs) {
      const d = smooth(r);
      if (r.length > 1) paths += `<path class="fill" d="${d} L${r[r.length - 1][0]},${Y(0)} L${r[0][0]},${Y(0)} Z"/>`;
      paths += `<path class="line" pathLength="1" d="${d}"/>`;
      r.forEach(([x, y, i, v], j) => {
        const isToday = i === today;
        marks += `<circle class="pt${isToday ? ' today' : ''}" cx="${x}" cy="${y}" r="${isToday ? 4.5 : 3}" style="--i:${k}"><title>Day ${i + 1}: ${Math.round(v * 100)}%</title></circle>`;
        if (labels && (j === 0 || r[j - 1][3] !== v)) {
          marks += `<text class="pl" x="${x}" y="${y - 9}" style="--i:${k}">${Math.round(v * 100)}%</text>`;
        }
        k++;
      });
    }

    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily completion this month">`
      + '<defs><linearGradient id="hgFill" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/>'
      + '<stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>'
      + grid + paths + marks + '</svg>';
  }

  return { ring, setRing, area };
})();
