/* Interactive explainer: how one similarity field is built.
 * Uses the DINOv2 similarity field for reference (a*, b*) = (30, 52), L* = 50, chroma 60,
 * reconstructed from the contour plot in the paper, and the human discrimination ellipse
 * drawn in that plot (semi-major = half the disc radius, major axis along the hue direction).
 */
(function () {
  var D = window.PAGE_DATA;
  if (!D) return;
  var F = D.field;
  var CMAP = D.cmap;

  // ---------------- configuration ----------------
  var REF = { L: 50, a: 30, b: 52 };             // reference color (CIELAB)
  var ELL = { a: F.ell.a, b: F.ell.b, angle: F.ell.angle }; // in units of disc radius
  // Disc radius in CIELAB a*b* units: 2 x semi-major axis of the threshold ellipse.
  // 3.7 = semi-major of a unit CIE94 ellipse at C* = 60 (S_C = 1 + 0.045 C*).
  var R_AB = 2 * 3.7;
  var N_IN = 250, N_OUT = 250, K = 250;
  var PAPER_IOU = null;
  try { PAPER_IOU = D.fig3.chroma['60']['vit_base_patch14_dinov2'][3]; } catch (e) {}

  // ---------------- field lookup ----------------
  var n = F.n;
  var raw = atob(F.b64);
  var grid = new Float32Array(n * n);
  for (var i = 0; i < raw.length; i++) grid[i] = raw.charCodeAt(i) / 255;

  function fieldAt(u, v) { // u right, v up, in disc-radius units
    var x = F.cx + u * F.R, y = F.cx - v * F.R;
    var fj = x * n - 0.5, fi = y * n - 0.5;
    var j0 = Math.max(0, Math.min(n - 2, Math.floor(fj)));
    var i0 = Math.max(0, Math.min(n - 2, Math.floor(fi)));
    var tx = Math.max(0, Math.min(1, fj - j0)), ty = Math.max(0, Math.min(1, fi - i0));
    var g = function (r, c) { return grid[r * n + c]; };
    return (g(i0, j0) * (1 - tx) + g(i0, j0 + 1) * tx) * (1 - ty) +
           (g(i0 + 1, j0) * (1 - tx) + g(i0 + 1, j0 + 1) * tx) * ty;
  }

  // ---------------- color helpers ----------------
  function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  var CM = CMAP.map(hexToRgb);
  function cmap(t) {
    t = Math.max(0, Math.min(1, t)) * (CM.length - 1);
    var k = Math.min(CM.length - 2, Math.floor(t)), f = t - k;
    var c = CM[k].map(function (v, q) { return Math.round(v + (CM[k + 1][q] - v) * f); });
    return 'rgb(' + c.join(',') + ')';
  }
  function cmapArr(t) {
    t = Math.max(0, Math.min(1, t)) * (CM.length - 1);
    var k = Math.min(CM.length - 2, Math.floor(t)), f = t - k;
    return CM[k].map(function (v, q) { return Math.round(v + (CM[k + 1][q] - v) * f); });
  }
  function labToRgb(L, a, b) {
    var fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    var inv = function (t) { return t > 6 / 29 ? t * t * t : 3 * (6 / 29) * (6 / 29) * (t - 4 / 29); };
    var X = 0.95047 * inv(fx), Y = inv(fy), Z = 1.08883 * inv(fz);
    var r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    var g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
    var bl = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    var gam = function (c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, c)) * 255); };
    return 'rgb(' + gam(r) + ',' + gam(g) + ',' + gam(bl) + ')';
  }
  var REF_RGB = labToRgb(REF.L, REF.a, REF.b);

  // ---------------- geometry ----------------
  var th = ELL.angle * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
  function inEllipse(u, v) {
    var x = u * ct + v * st, y = -u * st + v * ct;
    return (x * x) / (ELL.a * ELL.a) + (y * y) / (ELL.b * ELL.b) <= 1;
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------------- DOM ----------------
  var svg = document.getElementById('exSvg');
  var gPts = document.getElementById('exPoints');
  var ell = document.getElementById('exEllipse');
  var refDot = document.getElementById('exRef');
  var fieldImg = document.getElementById('exField');
  var radiusG = document.getElementById('exRadius');
  var tip = document.getElementById('exTip');
  var stage = svg.parentNode;
  var NS = 'http://www.w3.org/2000/svg';

  ell.setAttribute('rx', ELL.a);
  ell.setAttribute('ry', ELL.b);
  ell.setAttribute('transform', 'rotate(' + (-ELL.angle) + ')');
  refDot.setAttribute('fill', REF_RGB);

  // radius indicator along the minor-axis direction so it does not overlap the ellipse
  (function () {
    var ang = -(ELL.angle + 90) * Math.PI / 180;
    var line = radiusG.querySelector('line'), txt = radiusG.querySelector('text');
    line.setAttribute('x2', Math.cos(ang)); line.setAttribute('y2', Math.sin(ang));
    txt.setAttribute('x', Math.cos(ang) * 0.5 + 0.06); txt.setAttribute('y', Math.sin(ang) * 0.5 - 0.02);
    txt.setAttribute('text-anchor', 'start');
    txt.textContent = 'radius = 2 × semi-major axis';
  })();

  // heatmap image
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = n;
    var ctx = c.getContext('2d'), img = ctx.createImageData(n, n);
    for (var p = 0; p < n * n; p++) {
      var col = cmapArr(grid[p]);
      img.data[p * 4] = col[0]; img.data[p * 4 + 1] = col[1]; img.data[p * 4 + 2] = col[2]; img.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var x0 = -F.cx / F.R;
    fieldImg.setAttribute('href', c.toDataURL());
    fieldImg.setAttribute('x', x0); fieldImg.setAttribute('y', x0);
    fieldImg.setAttribute('width', 1 / F.R); fieldImg.setAttribute('height', 1 / F.R);
  })();
  document.getElementById('exCbarBar').style.background =
    'linear-gradient(90deg,' + CMAP.map(function (c, k) { return c + ' ' + (k / (CMAP.length - 1) * 100).toFixed(1) + '%'; }).join(',') + ')';

  // ---------------- samples ----------------
  var pts = [], seed = 7;
  function sample() {
    var r = rng(seed), out = [];
    while (out.length < N_IN) {
      var u = (r() * 2 - 1) * ELL.a, v = (r() * 2 - 1) * ELL.a;
      if (inEllipse(u, v)) out.push({ u: u, v: v, g: true });
    }
    while (out.length < N_IN + N_OUT) {
      var u2 = r() * 2 - 1, v2 = r() * 2 - 1;
      if (u2 * u2 + v2 * v2 <= 1 && !inEllipse(u2, v2)) out.push({ u: u2, v: v2, g: false });
    }
    // shuffle so in/out samples interleave when animating
    for (var k = out.length - 1; k > 0; k--) { var j = Math.floor(r() * (k + 1)); var t = out[k]; out[k] = out[j]; out[j] = t; }
    out.forEach(function (p, idx) {
      p.d = fieldAt(p.u, p.v);
      p.rank = 0; p.idx = idx;
    });
    var sorted = out.slice().sort(function (x, y) { return x.d - y.d; });
    sorted.forEach(function (p, k) { p.p = k < K; });
    pts = out;
    gPts.textContent = '';
    pts.forEach(function (p) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', p.u); c.setAttribute('cy', -p.v); c.setAttribute('r', 0);
      c.style.transitionDelay = (p.idx * 1.2) + 'ms';
      p.el = c;
      gPts.appendChild(c);
    });
  }

  // ---------------- steps ----------------
  var step = 0, exag = false, showField = true;
  var kicker = document.getElementById('exKicker');
  var title = document.getElementById('exTitle');
  var text = document.getElementById('exText');
  var box = document.getElementById('exBox');
  var cbar = document.getElementById('exCbar');
  var legend = document.getElementById('exLegend');
  var exagWrap = document.getElementById('exExagWrap');
  var fieldWrap = document.getElementById('exFieldWrap');
  var stepBtns = Array.prototype.slice.call(document.querySelectorAll('#exSteps button'));
  var prev = document.getElementById('exPrev'), next = document.getElementById('exNext');

  var STEPS = [
    { t: 'Pick a reference color',
      p: 'Lightness is fixed at L* = 50 and a reference is chosen on the hue circle, here a* = 30, b* = 52 (chroma 60, hue 60°). Around it we draw a disc whose radius is twice the semi-major axis of the human discrimination ellipse, so it covers both indistinguishable and clearly different colors.' },
    { t: 'Sample 500 colors',
      p: 'We draw 500 colors uniformly in the disc: 250 inside the human discrimination region and 250 outside it. Each one is rendered as a uniform patch and passed through the encoder. At true scale they look almost identical to the reference, because they sit close to the human threshold.' },
    { t: 'Measure cosine distance',
      p: 'The encoder embeds the reference patch and every sample. Each sample is colored by the cosine distance between its embedding and the reference embedding: blue samples are ones the model treats as close to the reference, red ones it treats as different. Interpolating between samples gives the heatmap used in the paper.' },
    { t: 'Overlay the human region',
      p: 'The black ellipse is the human discrimination region: colors inside it cannot be told apart from the reference by a human observer. Its 250 samples form the ground-truth set G. A human-aligned model would place the ellipse entirely inside its bluest area.' },
    { t: 'Compare with IoU',
      p: 'The model’s prediction P is its 250 closest samples, the same size as G. IoU measures how much the two sets overlap. Here the model\u2019s blue band crosses the ellipse instead of following it, so part of the human region is missed and many model-close samples lie outside it.' }
  ];

  function fmt(x, d) { return x.toFixed(d == null ? 2 : d); }

  function render() {
    var s = STEPS[step];
    kicker.textContent = 'Step ' + (step + 1) + ' of 5';
    title.textContent = s.t;
    text.textContent = s.p;
    stepBtns.forEach(function (b, k) { b.classList.toggle('on', k === step); b.classList.toggle('done', k < step); });
    prev.disabled = step === 0;
    next.textContent = step === 4 ? 'Start over' : 'Next →';

    exagWrap.hidden = step !== 1;
    fieldWrap.hidden = step < 2;
    cbar.hidden = step < 2;
    legend.hidden = step !== 4;

    ell.style.opacity = step >= 3 ? 1 : 0;
    radiusG.style.opacity = step === 0 ? 1 : 0;
    refDot.setAttribute('r', step === 0 ? 0.11 : 0.045);
    fieldImg.style.opacity = (step >= 2 && showField) ? (step === 4 ? 0.28 : 0.85) : 0;

    var nBoth = 0, nUnion = 0, dmin = 1, dmax = 0;
    pts.forEach(function (p) {
      var el = p.el, fill, r = 0.024, op = 1, stroke = 'rgba(0,0,0,.18)', sw = 0.004;
      if (p.g && p.p) nBoth++;
      if (p.g || p.p) nUnion++;
      dmin = Math.min(dmin, p.d); dmax = Math.max(dmax, p.d);
      if (step === 0) { r = 0; op = 0; fill = REF_RGB; }
      else if (step === 1) {
        var m = exag ? 6 : 1;
        fill = labToRgb(REF.L, REF.a + p.u * R_AB * m, REF.b + p.v * R_AB * m);
      } else if (step === 2) {
        fill = cmap(p.d);
        if (showField) { stroke = 'rgba(255,255,255,.85)'; sw = 0.006; }
      } else if (step === 3) {
        fill = cmap(p.d);
        op = p.g ? 1 : 0.28;
        stroke = p.g ? '#111' : 'rgba(0,0,0,.1)'; sw = p.g ? 0.006 : 0.004;
      } else {
        if (p.g && p.p) { fill = '#3b4cc0'; stroke = '#111'; sw = 0.008; r = 0.027; }
        else if (p.p) { fill = '#f2a07f'; stroke = 'rgba(0,0,0,.25)'; }
        else if (p.g) { fill = '#ffffff'; stroke = '#7a7f8c'; sw = 0.008; }
        else { fill = '#d6d3cc'; op = 0.45; r = 0.016; stroke = 'transparent'; }
      }
      el.setAttribute('r', r);
      el.style.fill = fill;
      el.style.opacity = op;
      el.style.stroke = stroke;
      el.style.strokeWidth = sw;
    });

    var html = '';
    if (step === 0) {
      html = '<div class="row" style="align-items:center;justify-content:flex-start"><span class="chip" style="background:' + REF_RGB + '"></span>' +
        '<span>L* = <b>50</b> &nbsp; a* = <b>30</b> &nbsp; b* = <b>52</b><br>chroma <b>60</b> &nbsp; hue <b>60°</b></span></div>';
    } else if (step === 1) {
      html = '<div class="row"><span>Samples</span><b>500</b></div>' +
        '<div class="row"><span>Inside human region</span><b>' + N_IN + '</b></div>' +
        '<div class="row"><span>Outside human region</span><b>' + N_OUT + '</b></div>';
    } else if (step === 2) {
      html = '<div class="row"><span>Closest sample</span><b>' + fmt(dmin) + '</b></div>' +
        '<div class="row"><span>Farthest sample</span><b>' + fmt(dmax) + '</b></div>';
    } else if (step === 3) {
      var gIn = pts.filter(function (p) { return p.g; });
      var meanIn = gIn.reduce(function (a, p) { return a + p.d; }, 0) / gIn.length;
      html = '<div class="row"><span>|G|, samples inside the ellipse</span><b>' + gIn.length + '</b></div>' +
        '<div class="row"><span>Mean cosine distance inside</span><b>' + fmt(meanIn) + '</b></div>';
    } else {
      var iou = nBoth / nUnion;
      html = '<div class="row"><span>|G ∩ P|, in both</span><b>' + nBoth + '</b></div>' +
        '<div class="row"><span>|G ∪ P|, in either</span><b>' + nUnion + '</b></div>' +
        '<div class="row" style="margin-top:8px;align-items:center"><span>IoU = <span class="frac2"><span>' + nBoth + '</span><span>' + nUnion + '</span></span></span><span class="big">' + fmt(iou, 3) + '</span></div>' +
        '<div class="row" style="margin-top:6px;font-size:13px"><span>Press Resample to see how much the value varies with the sampled points.</span></div>';
    }
    box.innerHTML = html;
  }

  function go(k) { step = (k + 5) % 5; hideTip(); render(); }
  next.addEventListener('click', function () { go(step === 4 ? 0 : step + 1); });
  prev.addEventListener('click', function () { if (step > 0) go(step - 1); });
  stepBtns.forEach(function (b, k) { b.addEventListener('click', function () { go(k); }); });
  document.getElementById('exResample').addEventListener('click', function () {
    seed = (seed * 9301 + 49297) % 233280 + 1;
    sample();
    // let the circles mount at r=0, then animate to the current step
    requestAnimationFrame(function () { requestAnimationFrame(render); });
  });
  document.getElementById('exExag').addEventListener('change', function (e) { exag = e.target.checked; render(); });
  document.getElementById('exFieldToggle').addEventListener('change', function (e) { showField = e.target.checked; render(); });

  // ---------------- hover ----------------
  var hovered = null;
  function hideTip() { tip.hidden = true; if (hovered) { hovered.el.classList.remove('hov'); hovered = null; } }
  function toSvg(evt) {
    var pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  svg.addEventListener('pointermove', function (evt) {
    if (step === 0) return;
    var q = toSvg(evt), best = null, bd = 0.0036; // (0.06)^2
    for (var k = 0; k < pts.length; k++) {
      var p = pts[k], dx = p.u - q.x, dy = -p.v - q.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) { hideTip(); return; }
    if (hovered !== best) {
      if (hovered) hovered.el.classList.remove('hov');
      hovered = best; best.el.classList.add('hov');
    }
    var da = best.u * R_AB, db = best.v * R_AB;
    var sw = labToRgb(REF.L, REF.a + da, REF.b + db);
    var lines = ['<span class="sw" style="background:' + sw + '"></span>Δa* ' + (da >= 0 ? '+' : '') + fmt(da) + ', Δb* ' + (db >= 0 ? '+' : '') + fmt(db)];
    if (step >= 2) lines.push('Cosine distance <b>' + fmt(best.d) + '</b>');
    if (step >= 3) lines.push('<span class="mono">' + (best.g ? 'inside' : 'outside') + ' human region</span>');
    if (step === 4) lines.push('<span class="mono">' + (best.p ? 'among' : 'not among') + ' model’s 250 closest</span>');
    tip.innerHTML = lines.join('<br>');
    var ctm = svg.getScreenCTM(), sr = stage.getBoundingClientRect();
    var pt = svg.createSVGPoint(); pt.x = best.u; pt.y = -best.v;
    var sp = pt.matrixTransform(ctm);
    tip.style.left = Math.max(80, Math.min(sr.width - 80, sp.x - sr.left)) + 'px';
    tip.style.top = (sp.y - sr.top) + 'px';
    tip.hidden = false;
  });
  svg.addEventListener('pointerleave', hideTip);

  sample();
  render();
})();
