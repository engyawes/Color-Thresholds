/* Interactive version of Figure 2: mIoU ranking of all evaluated encoders. */
(function () {
  var D = window.PAGE_DATA;
  if (!D || !D.fig2) return;
  var BARS = D.fig2; // sorted by mIoU, descending
  var TYPES = [
    { key: 'supervised', label: 'Supervised', color: '#1f77b4' },
    { key: 'self-supervised', label: 'Self-supervised', color: '#2ca02c' },
    { key: 'language-supervised', label: 'Language-supervised', color: '#9467bd' },
    { key: 'unsupervised', label: 'Unsupervised (VAE)', color: '#d62728' }
  ];
  var COLOR = {}; TYPES.forEach(function (t) { COLOR[t.key] = t.color; });
  var LABEL = {}; TYPES.forEach(function (t) { LABEL[t.key] = t.label; });
  var COUNT = {}; BARS.forEach(function (b) { COUNT[b.type] = (COUNT[b.type] || 0) + 1; });
  var RANK_IN = {}; var seen = {};
  BARS.forEach(function (b, i) { seen[b.type] = (seen[b.type] || 0) + 1; RANK_IN[i] = seen[b.type]; });

  var svg = document.getElementById('f2Svg');
  var tip = document.getElementById('f2Tip');
  var typesEl = document.getElementById('f2Types');
  var NS = 'http://www.w3.org/2000/svg';
  var W, H, M, PW, PH, narrow, YMAX = 0.25, rects = [], active = null, hovered = -1;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function y(v) { return M.t + PH - v / YMAX * PH; }
  function bw() { return PW / BARS.length; }

  function draw() {
    W = Math.max(300, Math.round(svg.parentNode.clientWidth || 900));
    narrow = W < 640;
    H = narrow ? 300 : 420;
    M = narrow ? { l: 42, r: 8, t: 12, b: 30 } : { l: 52, r: 12, t: 14, b: 34 };
    PW = W - M.l - M.r; PH = H - M.t - M.b;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.textContent = '';

    var grid = el('g', { 'class': 'grid' }, svg), axis = el('g', { 'class': 'axis' }, svg);
    for (var t = 0; t <= YMAX + 1e-9; t += 0.05) {
      el('line', { x1: M.l, x2: W - M.r, y1: y(t), y2: y(t) }, grid);
      el('text', { x: M.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, axis).textContent = t.toFixed(2);
    }
    el('text', { 'class': 'lbl', x: 14, y: M.t + PH / 2, 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (M.t + PH / 2) + ')' }, axis).textContent = 'mIoU';
    el('text', { 'class': 'lbl', x: M.l + PW / 2, y: H - 8, 'text-anchor': 'middle' }, axis)
      .textContent = narrow ? 'Models, ranked (hover for names)' : 'Models, ranked by mIoU';

    var w = bw(), gap = Math.min(2, w * 0.12);
    var gb = el('g', {}, svg), gl = el('g', { 'class': 'f2-names' }, svg);
    rects = BARS.map(function (b, i) {
      var x = M.l + i * w + gap / 2;
      var r = el('rect', { x: x, y: y(b.miou), width: w - gap, height: M.t + PH - y(b.miou), fill: COLOR[b.type], 'class': 'f2-bar' }, gb);
      var lbl = null;
      if (!narrow && w >= 12) {
        var cx = x + (w - gap) / 2, ty = M.t + PH - 6;
        lbl = el('text', { x: cx, y: ty, transform: 'rotate(-90 ' + cx + ' ' + ty + ')', dy: '0.35em' }, gl);
        lbl.textContent = b.name;
        var maxLen = (M.t + PH - y(b.miou)) - 10;
        // trim long names so they stay inside the bar
        var fs = 9.5, est = b.name.length * fs * 0.6;
        if (est > maxLen) lbl.textContent = b.name.slice(0, Math.max(4, Math.floor(maxLen / (fs * 0.6)) - 1)) + '…';
      }
      return { r: r, lbl: lbl };
    });
    el('line', { x1: M.l, x2: W - M.r, y1: M.t + PH, y2: M.t + PH, stroke: '#9aa0ad' }, svg);
    applyState();
  }

  function applyState() {
    rects.forEach(function (o, i) {
      var b = BARS[i];
      var dim = (active && b.type !== active) || (hovered >= 0 && hovered !== i);
      o.r.style.opacity = dim ? (hovered >= 0 && !(active && b.type !== active) ? 0.35 : 0.15) : 1;
      if (o.lbl) o.lbl.style.opacity = dim ? 0.25 : 1;
    });
  }

  function showTip(i) {
    var b = BARS[i];
    tip.innerHTML = '<span class="sw" style="background:' + COLOR[b.type] + '"></span><b>' + b.name + '</b>' +
      '<br><span class="mono">' + LABEL[b.type].toLowerCase() + '</span>' +
      '<br>mIoU <b>' + b.miou.toFixed(3) + '</b>' +
      '<br><span class="mono">rank ' + (i + 1) + ' of ' + BARS.length + ' · ' + RANK_IN[i] + ' of ' + COUNT[b.type] + ' ' + LABEL[b.type].toLowerCase() + '</span>';
    var box = svg.getBoundingClientRect(), s = box.width / W;
    var px = (M.l + (i + 0.5) * bw()) * s, py = y(b.miou) * s;
    tip.style.left = Math.max(130, Math.min(box.width - 130, px)) + 'px';
    tip.style.top = py + 'px';
    tip.hidden = false;
  }

  svg.addEventListener('pointermove', function (evt) {
    var box = svg.getBoundingClientRect(), s = W / box.width;
    var px = (evt.clientX - box.left) * s, py = (evt.clientY - box.top) * s;
    var i = Math.floor((px - M.l) / bw());
    if (i < 0 || i >= BARS.length || py < M.t - 20 || py > M.t + PH + 6) { leave(); return; }
    if (i !== hovered) { hovered = i; applyState(); showTip(i); }
  });
  function leave() { hovered = -1; tip.hidden = true; applyState(); }
  svg.addEventListener('pointerleave', leave);

  TYPES.forEach(function (t) {
    var b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<i style="background:' + t.color + ';height:10px;width:10px"></i>' + t.label + ' <span class="cnt">' + (COUNT[t.key] || 0) + '</span>';
    b.addEventListener('click', function () {
      active = active === t.key ? null : t.key;
      Array.prototype.forEach.call(typesEl.children, function (c) { c.classList.remove('sel'); });
      if (active) b.classList.add('sel');
      applyState();
    });
    typesEl.appendChild(b);
  });

  draw();
  var rz; window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { if (Math.round(svg.parentNode.clientWidth) !== W) draw(); }, 150);
  });
})();
