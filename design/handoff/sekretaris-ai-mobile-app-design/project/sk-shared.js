(function () {
  if (!document.getElementById('sk-keyframes')) {
    const st = document.createElement('style');
    st.id = 'sk-keyframes';
    st.textContent = '@keyframes sk-breath{from{transform:scale(1)}to{transform:scale(1.04)}}@keyframes sk-dot{0%,70%,100%{opacity:.35;transform:translateY(0)}35%{opacity:1;transform:translateY(-30%)}}@keyframes sk-listen{0%{transform:scale(1)}15%{transform:scale(1.07)}30%{transform:scale(1.02)}48%{transform:scale(1.1)}62%{transform:scale(1.03)}80%{transform:scale(1.06)}100%{transform:scale(1)}}@keyframes sk-wave{from{transform:scale(1);opacity:.55}to{transform:scale(1.5);opacity:0}}@keyframes sk-flow{0%{transform:translate(var(--fx),var(--fy));opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translate(var(--tx),var(--ty));opacity:0}}@keyframes sk-blink{0%,100%{opacity:0}50%{opacity:1}}@keyframes sk-join{0%{transform:translate(var(--jx),var(--jy)) scale(.4);opacity:0}60%{opacity:1}100%{transform:none;opacity:1}}@keyframes sk-fadein{from{opacity:0}to{opacity:1}}@keyframes sk-tab{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}@keyframes sk-sheet{from{transform:translateY(100%)}to{transform:none}}@keyframes sk-toast{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}';
    document.head.appendChild(st);
  }
  const P = {
    home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
    calendar: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 4v4M16 4v4',
    bulb: 'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z',
    store: 'M4 9l1.5-5h13L20 9M4 9h16M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 11v9h14v-9M10 20v-5h4v5',
    mail: 'M4.5 6h15a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5zM4.5 7l7.5 6 7.5-6',
    chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    snow: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5',
    camera: 'M4 7h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM16 10.5l5-3v9l-5-3',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
    bank: 'M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
    lock: 'M6.5 11h11a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    chevD: 'M7 10l5 5 5-5', chevR: 'M9 6l6 6-6 6', back: 'M15 6l-6 6 6 6',
    clip: 'M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7',
    mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
    micOff: 'M15 10V6a3 3 0 0 0-5.8-1M9 9v3a3 3 0 0 0 4.6 2.5M6 11a6 6 0 0 0 9.7 4.7M18 11c0 .7-.1 1.4-.3 2M12 17v4M4 4l16 16',
    wave: 'M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4',
    file: 'M7 3h7l5 5v13H7zM14 3v5h5',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    keyboard: 'M3.5 7h17a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-17a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5zM7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17.5 10.5h.01M8 14h8',
    note: 'M6.5 4h11a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-15a.5.5 0 0 1 .5-.5zM9 8.5h6M9 12h6M9 15.5h4',
    bolt: 'M13 3 5.5 13h5.5l-1 8 7.5-10H12z',
    bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
    power: 'M12 3v8M7 6.3a7 7 0 1 0 10 0',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
    plane: 'M21 15.5v-2l-7.5-4.5V4a1.5 1.5 0 0 0-3 0v5L3 13.5v2l7.5-2.5V18L8.5 19.5V21l3.5-1 3.5 1v-1.5L13.5 18v-5z',
    box: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 15.5h6M9 9h.01M12 9h.01M15 9h.01',
    thermo: 'M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0zM12 9v6',
    drop: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z',
    fan: 'M12 10.5C12 6 13 3.5 15.5 4s2 4-3.5 6.5M13.5 12c4.5 0 7 1 6.5 3.5s-4 2-6.5-3.5M12 13.5c0 4.5-1 7-3.5 6.5s-2-4 3.5-6.5M10.5 12C6 12 3.5 11 4 8.5s4-2 6.5 3.5',
    auto: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
    shield: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
    phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2-2.4 3.3M12 17h.01',
    bag: 'M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8',
    undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    repeat: 'M17 2.5 20.5 6 17 9.5M3.5 11V9a3 3 0 0 1 3-3h14M7 21.5 3.5 18 7 14.5M20.5 13v2a3 3 0 0 1-3 3h-14',
    task: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
    taskDone: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 12.5l3 3 5-6',
    call: 'M5 4h3.5l1.5 4.5-2.2 1.3a11 11 0 0 0 6.4 6.4l1.3-2.2L20 15.5V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z',
    backspace: 'M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7zM12 9.5l5 5M17 9.5l-5 5',
    bt: 'M7 7.5l10 9-5 4.5V3l5 4.5-10 9',
    send: 'M12 19V5M6 11l6-6 6 6',
    x: 'M6 6l12 12M18 6 6 18',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
    share: 'M12 4v11M7 9l5-5 5 5M5 14v5h14v-5',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4l3 2'
  };
  let IC = null;
  function icons(h) {
    if (IC) return IC;
    IC = {};
    for (const k in P) IC[k] = h('svg', { viewBox: '0 0 24 24', width: '100%', height: '100%', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block' } }, h('path', { d: P[k] }));
    IC.status = h('svg', { width: 56, height: 14, viewBox: '0 0 56 14', fill: 'currentColor' },
      h('rect', { x: 0, y: 9, width: 3, height: 4, rx: 1 }), h('rect', { x: 4.5, y: 6.5, width: 3, height: 6.5, rx: 1 }), h('rect', { x: 9, y: 4, width: 3, height: 9, rx: 1 }), h('rect', { x: 13.5, y: 1, width: 3, height: 12, rx: 1 }),
      h('path', { d: 'M22 5.2a10 10 0 0 1 14 0L29 13z' }),
      h('rect', { x: 40, y: 2, width: 14, height: 10, rx: 2.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }), h('rect', { x: 42, y: 4, width: 9, height: 6, rx: 1 }));
    return IC;
  }
  // Inti: the S ribbon from the logo, dots overlaid so they can animate.
  const DOTS = [27.8, 39.2, 50.5], DOT_Y = 72.3;
  function inti(h, size, st, o) {
    o = o || {};
    const rm = !!o.rm, light = !!o.light, a = v => (rm ? undefined : v);
    const w = Math.round(size * 282 / 310), d = Math.max(3, size * 0.068);
    const ring = light ? '#81C084' : '#81C084';
    const kids = [];
    const circ = (k, D, extra) => h('div', { key: k, style: Object.assign({ position: 'absolute', left: '50%', top: '50%', width: D, height: D, marginLeft: -D / 2, marginTop: -D / 2, borderRadius: '50%', boxSizing: 'border-box' }, extra) });
    if (st === 'listen') {
      kids.push(circ('l1', size * 1.22, { border: '2px solid ' + ring, opacity: .85, animation: a('sk-listen 1.4s ease-in-out infinite') }));
      kids.push(circ('l2', size * 1.48, { border: '1.5px solid ' + ring, opacity: .35, animation: a('sk-listen 1.4s ease-in-out .25s infinite') }));
    }
    if (st === 'speak') [0, 1, 2].forEach(i => kids.push(circ('w' + i, size * 1.08, { border: '1.5px solid ' + ring, opacity: rm ? (i === 0 ? .4 : 0) : 0, transform: rm ? 'scale(1.2)' : undefined, animation: a('sk-wave 2.4s ease-out ' + (i * 0.8) + 's infinite') })));
    const dotColor = light ? '#C9E6C7' : '#2A8A5C';
    const dots = DOTS.map((x, i) => h('span', { key: 'd' + i, style: { position: 'absolute', left: 'calc(' + x + '% - ' + d / 2 + 'px)', top: 'calc(' + DOT_Y + '% - ' + d / 2 + 'px)', width: d, height: d, borderRadius: '50%', background: dotColor, animation: st === 'think' ? a('sk-dot 1.2s ease-in-out ' + (i * 0.18) + 's infinite') : undefined } }));
    kids.push(h('div', { key: 'core', style: {
      position: 'absolute', inset: 0, opacity: st === 'off' ? .35 : 1, filter: st === 'off' ? 'grayscale(.8)' : undefined,
      transformOrigin: '50% 55%', animation: (st === 'idle' || st === 'speak' || !st) ? a('sk-breath 4s ease-in-out infinite alternate') : undefined
    } }, h('img', { src: light ? 'assets/s-ribbon-light.png' : 'assets/s-ribbon.png', alt: '', draggable: false, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' } }), dots));
    return h('div', { key: o.key, style: { position: 'relative', width: w, height: size, flex: 'none' } }, kids);
  }
  const NODES = [['calendar', 'Google Kalender'], ['mail', 'Gmail'], ['chat', 'WhatsApp'], ['snow', 'AC kamar'], ['camera', 'CCTV', true], ['receipt', 'Kasir Kopi Rindang'], ['bank', 'Bank']];
  function orbit(h, o) {
    o = o || {};
    const ic = icons(h), rm = !!o.rm;
    const nodes = o.nodes || NODES;
    const W = o.W || 360, H = o.H || 304, cx = W / 2, cy = H / 2, r = o.r || 126, ri = o.ri || 80, IS = o.intiSize || 140;
    const pos = nodes.map((n, i) => { const t = -Math.PI / 2 + i * 2 * Math.PI / nodes.length; return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t), c: Math.cos(t), s: Math.sin(t) }; });
    const svg = h('svg', { width: W, height: H, style: { position: 'absolute', inset: 0 } },
      h('circle', { cx, cy, r, fill: 'none', stroke: 'var(--sage, #81C084)', strokeOpacity: .55, strokeWidth: 1 }),
      ...pos.map((p, i) => h('line', { key: i, x1: cx + ri * p.c, y1: cy + ri * p.s, x2: p.x - 22 * p.c, y2: p.y - 22 * p.s, stroke: 'var(--sage, #81C084)', strokeOpacity: nodes[i][2] ? .3 : .6, strokeWidth: 1, strokeDasharray: nodes[i][2] ? '3 4' : undefined, style: i === o.join ? { animation: rm ? undefined : 'sk-fadein 900ms ease-out' } : undefined })));
    const els = nodes.map((n, i) => h('div', { key: n[1] + (i === o.join ? 'j' + (o.tick || 0) : ''), title: n[1], style: {
      position: 'absolute', left: pos[i].x - 22, top: pos[i].y - 22, width: 44, height: 44, borderRadius: '50%', boxSizing: 'border-box',
      background: n[2] ? 'var(--paper, #F6F6F0)' : (i === o.join ? 'var(--mint, #E8F4E8)' : 'var(--card, #FCFCF8)'), border: '1px solid ' + (i === o.join ? 'var(--sage, #81C084)' : 'var(--line, #E2E6DE)'), color: n[2] ? 'var(--muted, #647069)' : (i === o.join ? 'var(--green, #1D7550)' : 'var(--ink, #0D2B22)'), padding: 11, opacity: n[2] ? .7 : 1,
      '--jx': (pos[i].c * 70) + 'px', '--jy': (pos[i].s * 70) + 'px', animation: i === o.join && !rm ? 'sk-join 900ms cubic-bezier(.2,.8,.2,1) both' : undefined } },
      ic[n[0]], n[2] ? h('span', { style: { position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: 'var(--clay, #A14E2E)', border: '2px solid var(--paper, #F6F6F0)' } }) : null));
    const kids = [svg, ...els];
    if (o.node != null && o.tick) {
      const p = pos[o.node];
      kids.push(h('span', { key: 'f' + o.tick, style: {
        position: 'absolute', left: cx - 2, top: cy - 2, width: 4, height: 4, borderRadius: '50%', background: 'var(--leaf, #4DA36E)', boxShadow: '0 0 0 2px var(--paper, #F6F6F0)',
        '--fx': (p.x - 22 * p.c - cx) + 'px', '--fy': (p.y - 22 * p.s - cy) + 'px', '--tx': (ri * p.c) + 'px', '--ty': (ri * p.s) + 'px',
        transform: rm ? 'translate(' + (p.x - 22 * p.c - cx) + 'px,' + (p.y - 22 * p.s - cy) + 'px)' : undefined, opacity: 0,
        animation: rm ? 'sk-blink 600ms ease-in-out' : 'sk-flow 600ms ease-in forwards' } }));
    }
    const iw = Math.round(IS * 282 / 310);
    kids.push(h('div', { key: 'inti', onClick: o.onInti, onPointerDown: o.onIntiDown, onPointerUp: o.onIntiUp, onPointerLeave: o.onIntiUp, style: { position: 'absolute', left: cx - iw / 2, top: cy - IS / 2, cursor: o.onInti ? 'pointer' : undefined, touchAction: 'none' } }, inti(h, IS, o.intiState || 'idle', { light: o.light, rm })));
    return h('div', { onClick: o.onRing, style: { position: 'relative', width: W, height: H, maxWidth: '100%', cursor: o.onRing ? 'pointer' : undefined, flex: 'none' } }, kids);
  }
  let QR = null;
  function qr(h) {
    if (QR) return QR;
    const N = 25; let s = 11;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const fin = (lx, ly) => lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const ox = x < 8 ? x : x >= N - 8 ? x - (N - 7) : -1, oy = y < 8 ? y : y >= N - 8 ? y - (N - 7) : -1;
      const inF = (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
      const on = inF ? (ox >= 0 && ox < 7 && oy >= 0 && oy < 7 && fin(ox, oy)) : rnd() > .52;
      if (on) cells.push(h('rect', { key: x + '-' + y, x, y, width: 1.02, height: 1.02 }));
    }
    return (QR = h('svg', { viewBox: '0 0 25 25', width: '100%', height: '100%', fill: '#0D2B22', shapeRendering: 'crispEdges', style: { display: 'block' } }, cells));
  }
  window.SK = { P, icons, inti, orbit, qr, NODES };
})();
