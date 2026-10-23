/* Interactive version of Figure 3: IoU across hue and chroma for representative encoders. */
(function () {
  var D = window.PAGE_DATA;
  if (!D || !D.fig3) return;
  var DATA = D.fig3;
  var MODELS = DATA.models;
  var COLORS = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5'];
  var PARADIGM = {
    'aimv2_1b_patch14_224.apple_pt': 'language-supervised',
    'senet154.gluon_in1k': 'supervised',
    'eva02_base_patch14_224.mim_in22k': 'self-supervised',
    'mixnet_l.ft_in1k': 'supervised',
    'nest_base_jx.goog_in1k': 'supervised',
    'vit_base_patch14_dinov2': 'self-supervised',
    'vgg16': 'supervised',
    'OpenAI ViT-B-32': 'language-supervised',
    'stable-diffusion-xl-base-1.0': 'unsupervised (VAE)',
    'PE-Core-L14-336': 'language-supervised'
  };

  var svg = document.getElementById('f3Svg');
  var tip = document.getElementById('f3Tip');
  var legend = document.getElementById('f3Legend');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('#fig3 .if-tabs button'));
  var NS = 'http://www.w3.org/2000/svg';
  var W = 900, H = 380, M = { l: 52, r: 18, t: 16, b: 84 };
  var PW = W - M.l - M.r, PH = H - M.t - M.b, narrow = false;
  function layout() {
    W = Math.max(300, Math.round(svg.parentNode.clientWidth || 900));
    narrow = W < 600;
    H = narrow ? 300 : 380;
    M = narrow ? { l: 40, r: 10, t: 12, b: 74 } : { l: 52, r: 18, t: 16, b: 84 };
    PW = W - M.l - M.r; PH = H - M.t - M.b;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  var NE = 18;
  var chroma = '60', hidden = {}, ymax = 0.6, lines = [], focus = null;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function xAt(i) { return M.l + (i / (NE - 1)) * PW; }
  function yAt(v) { return M.t + PH - (v / ymax) * PH; }

  var gGrid, gAxis, gLines, gDots, guide, dot;

  function draw() {
    layout();
    svg.textContent = '';
    var series = DATA.chroma[chroma];
    var mx = 0;
    MODELS.forEach(function (m) { series[m].forEach(function (v) { mx = Math.max(mx, v); }); });
    ymax = Math.max(0.3, Math.ceil(mx * 10 + 0.001) / 10);

    gGrid = el('g', { 'class': 'grid' }, svg);
    gAxis = el('g', { 'class': 'axis' }, svg);
    for (var t = 0; t <= ymax + 1e-9; t += 0.1) {
      var y = yAt(t);
      el('line', { x1: M.l, x2: W - M.r, y1: y, y2: y }, gGrid);
      el('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end' }, gAxis).textContent = t.toFixed(1);
    }
    var yl = el('text', { 'class': 'lbl', x: 14, y: M.t + PH / 2, 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (M.t + PH / 2) + ')' }, gAxis);
    yl.textContent = 'IoU';

    var chips = DATA.chips[chroma];
    for (var i = 0; i < NE; i++) {
      var x = xAt(i);
      el('line', { x1: x, x2: x, y1: M.t, y2: M.t + PH }, gGrid).setAttribute('stroke-opacity', '.5');
      if (!narrow || i % 2 === 0) el('text', { x: x, y: M.t + PH + 18, 'text-anchor': 'middle' }, gAxis).textContent = 'E' + (i + 1);
      var cs = Math.min(16, PW / (NE - 1) - 4);
      el('rect', { x: x - cs / 2, y: M.t + PH + 28, width: cs, height: cs, rx: 3, fill: chips[i] }, gAxis);
    }
    el('text', { 'class': 'lbl', x: M.l + PW / 2, y: H - 10, 'text-anchor': 'middle' }, gAxis)
      .textContent = narrow ? 'Reference ellipse (hue, 20° steps)' : 'Reference ellipse (hue angle 0°–340° in 20° steps)';

    guide = el('line', { 'class': 'guide', y1: M.t, y2: M.t + PH, opacity: 0 }, svg);
    gLines = el('g', {}, svg);
    lines = MODELS.map(function (m, k) {
      var d = series[m].map(function (v, i) { return (i ? 'L' : 'M') + xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1); }).join('');
      var p = el('path', { 'class': 'ln', d: d, stroke: COLORS[k] }, gLines);
      if (hidden[m]) p.style.display = 'none';
      return { m: m, k: k, vals: series[m], path: p };
    });
    dot = el('circle', { r: 5.5, fill: '#fff', 'stroke-width': 2.5, opacity: 0 }, svg);
    setFocus(null);
  }

  function setFocus(line, idx) {
    focus = line;
    svg.classList.toggle('hl', !!line);
    lines.forEach(function (l) { l.path.classList.toggle('on', l === line); });
    if (line) { // bring to front
      line.path.parentNode.appendChild(line.path);
    }
    if (!line || idx == null) {
      dot.setAttribute('opacity', 0); guide.setAttribute('opacity', 0); tip.hidden = true;
      return;
    }
    var x = xAt(idx), y = yAt(line.vals[idx]);
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('stroke', COLORS[line.k]); dot.setAttribute('opacity', 1);
    guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.setAttribute('opacity', .6);
    var chip = DATA.chips[chroma][idx];
    tip.innerHTML = '<span class="sw" style="background:' + COLORS[line.k] + '"></span><b>' + line.m + '</b>' +
      '<br><span class="mono">' + PARADIGM[line.m] + '</span>' +
      '<br><span class="sw" style="background:' + chip + '"></span>E' + (idx + 1) + ' · hue ' + (idx * 20) + '° · C = ' + chroma +
      '<br>IoU <b>' + line.vals[idx].toFixed(3) + '</b>';
    var box = svg.getBoundingClientRect(), s = box.width / W;
    var px = x * s, py = y * s;
    tip.style.left = Math.max(120, Math.min(box.width - 120, px)) + 'px';
    tip.style.top = py + 'px';
    tip.hidden = false;
  }

  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    var cx = x1 + t * dx - px, cy = y1 + t * dy - py;
    return cx * cx + cy * cy;
  }

  svg.addEventListener('pointermove', function (evt) {
    var box = svg.getBoundingClientRect(), s = W / box.width;
    var px = (evt.clientX - box.left) * s, py = (evt.clientY - box.top) * s;
    if (px < M.l - 10 || px > W - M.r + 10 || py < M.t - 10 || py > M.t + PH + 10) { setFocus(null); return; }
    var idx = Math.round((px - M.l) / PW * (NE - 1));
    idx = Math.max(0, Math.min(NE - 1, idx));
    var best = null, bd = 14 * 14;
    lines.forEach(function (l) {
      if (hidden[l.m]) return;
      for (var i = 0; i < NE - 1; i++) {
        var d = segDist(px, py, xAt(i), yAt(l.vals[i]), xAt(i + 1), yAt(l.vals[i + 1]));
        if (d < bd) { bd = d; best = l; }
      }
    });
    setFocus(best, best ? idx : null);
  });
  svg.addEventListener('pointerleave', function () { setFocus(null); });

  // legend
  MODELS.forEach(function (m, k) {
    var b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<i style="background:' + COLORS[k] + '"></i>' + m;
    b.addEventListener('click', function () {
      hidden[m] = !hidden[m];
      b.classList.toggle('off', !!hidden[m]);
      lines[k].path.style.display = hidden[m] ? 'none' : '';
      setFocus(null);
    });
    b.addEventListener('mouseenter', function () { if (!hidden[m]) setFocus(lines[k]); });
    b.addEventListener('mouseleave', function () { setFocus(null); });
    legend.appendChild(b);
  });

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      chroma = t.getAttribute('data-chroma');
      tabs.forEach(function (o) { o.classList.toggle('on', o === t); o.setAttribute('aria-selected', o === t); });
      draw();
    });
    if (t.getAttribute('data-chroma') === chroma) { t.classList.add('on'); t.setAttribute('aria-selected', 'true'); }
  });

  draw();
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { var w = Math.round(svg.parentNode.clientWidth); if (w !== W) draw(); }, 150); });
})();
