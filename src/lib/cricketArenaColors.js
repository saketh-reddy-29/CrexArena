/* CRICKET ARENA - character colour system (pure data + maths; no THREE dependency).
 *
 * Nothing here edits the GLB.  Every character gets its OWN cloned materials; a small shader patch recolours
 * texels of the ORIGINAL texture (shading, stitching, logos and UVs are kept, roughness/metal untouched).
 *  - each mesh vertex is tagged with a "zone" (jersey / sleeves / collar / pants / legs / shoes / gloves)
 *    from its rest-pose position and the bone that drives it, so jersey, pants, pads, shoes and gloves are
 *    independent even though the model's meshes are cut into arbitrary slices;
 *  - inside a zone the texel's own colour decides what it is (dark base cloth, saturated trim, light pad...).
 */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- slots ---------- */
  /* shader slots (index = uniform index) */
  const SHADER_SLOTS = ['jersey', 'sleeves', 'collar', 'pants', 'socks', 'shoes', 'gloves', 'pads', 'accent'];
  /* every user-facing slot, grouped for the UI */
  const SLOTS = [
    ['Clothing', [['jersey', 'Main jersey'], ['sleeves', 'Jersey sleeves'], ['collar', 'Collar & shoulders'], ['pants', 'Pants / trousers'], ['socks', 'Socks & pad straps'], ['shoes', 'Shoes'], ['accent', 'Trim / stripes accent'], ['helmet', 'Helmet'], ['grille', 'Helmet grille']]],
    ['Protective gear', [['gloves', 'Gloves (batting / keeping)'], ['pads', 'Batting pads / leg guards (keeping pads)']]],
    ['Bat', [['batHandle', 'Bat handle'], ['batGrip', 'Bat grip'], ['batBlade', 'Bat blade']]]
  ];
  const ALL_SLOTS = SLOTS.reduce((a, g) => a.concat(g[1].map(x => x[0])), []);
  /* team palettes: primary / secondary / accent are editable in the UI, every slot derives from them */
  const TEAMS = [
    { name: 'Blue Strikers', p: '#1e56c8', s: '#0b2a66', a: '#ffd23f' },
    { name: 'Gold Kings', p: '#f2b705', s: '#22306b', a: '#ffffff' },
    { name: 'Green Hawks', p: '#0b8a3f', s: '#063d1f', a: '#ffe14d' },
    { name: 'Red Rapids', p: '#d42a2a', s: '#3d0c0c', a: '#ffffff' },
    { name: 'Purple Royals', p: '#6a2bb8', s: '#25104a', a: '#ff9f1c' },
    { name: 'Sky Spartans', p: '#e9f2ff', s: '#1d6fb8', a: '#12c4e0' }
  ];
  function teamSlots(t) {
    return { jersey: t.p, sleeves: t.p, collar: t.s, pants: t.s, socks: t.s, shoes: '#f4f4f4', accent: t.a, helmet: t.p, grille: '#c9ced6',
      gloves: t.a, pads: '#f4f4f4', batHandle: '#222222', batGrip: t.a, batBlade: '#d9a55a' };
  }
  /* 'Original' = no recolour (the model exactly as supplied); attachments get neutral defaults */
  const ORIGINAL = { helmet: '#1e56c8', grille: '#c9ced6', batHandle: '#222222', batGrip: '#e4501e', batBlade: '#d9a55a' };

  /* ---------- zones ---------- */
  const ZONE = { none: 0, jersey: 1, sleeves: 2, collar: 3, pants: 4, legs: 5, shoes: 6, gloves: 7 };
  const norm = s => String(s || '').toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '');
  function groupOf(name) {
    const n = norm(name);
    if (/hand|thumb|index|middle|ring|pinky/.test(n)) return 'hand';
    if (/foot|toe/.test(n)) return 'foot';
    if (/head|neck|eye|jaw|hair/.test(n)) return 'head';
    return 'body';
  }
  /* measures from the rest skeleton: desc.bones = [{n,wp}] , roleOf from rig.js */
  function measures(bones, roleOf) {
    const by = {}; bones.forEach(b => { const r = roleOf(b.n); if (r && !by[r]) by[r] = b; });
    const need = ['Lul', 'Lll', 'Lfoot', 'Lua', 'Lla', 'Lhand']; if (need.some(k => !by[k])) return null;
    const thighY = by.Lul.wp[1], kneeY = by.Lll.wp[1], shY = by.Lua.wp[1], shHalf = Math.abs(by.Lua.wp[0]), laX = Math.abs(by.Lla.wp[0]), handX = Math.abs(by.Lhand.wp[0]);
    return { hemY: thighY + 0.06 * (shY - thighY), pantsHem: kneeY + 0.38 * (thighY - kneeY), collarY: shY - 0.14 * (shY - thighY), collarX: 1.5 * shHalf,
      sleeveEnd: shHalf + 0.93 * (laX - shHalf), gloveStart: laX + 0.6 * (handX - laX), ankleY: by.Lfoot.wp[1] };
  }
  /* zone of one vertex: rest position p=[x,y,z], group = groupOf(dominant bone) */
  function zoneOf(p, group, m) {
    if (!m || group === 'head') return ZONE.none;
    if (group === 'hand') return ZONE.gloves;
    if (group === 'foot') return ZONE.shoes;
    const ax = Math.abs(p[0]), y = p[1];
    if (ax > m.collarX && y > m.pantsHem) return ax >= m.gloveStart ? ZONE.gloves : ZONE.sleeves;
    if (y >= m.hemY) return (y >= m.collarY && ax <= m.collarX) ? ZONE.collar : ZONE.jersey;
    if (y >= m.pantsHem) return ZONE.pants;
    return ZONE.legs;
  }

  /* ---------- recolour (JS mirror of the GLSL below; used by the offline checks) ---------- */
  const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  function hsv(c) {
    const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), d = mx - mn + 1e-5; let h;
    if (mx === c[0]) h = (((c[1] - c[2]) / d) % 6 + 6) % 6; else if (mx === c[1]) h = (c[2] - c[0]) / d + 2; else h = (c[0] - c[1]) / d + 4;
    return { v: mx, s: mx > 0.001 ? (mx - mn) / mx : 0, h: h * 60 };
  }
  const shade = (T, l, ref) => { const f = clamp(0.55 + 0.45 * l / ref, 0.5, 1.4); return [Math.min(1, T[0] * f), Math.min(1, T[1] * f), Math.min(1, T[2] * f)]; };
  /* slots: {name:{rgb:[r,g,b] 0..1, on:bool}} */
  function recolorZone(c, z, S) {
    if (z === 0) return c;
    const { v, s, h } = hsv(c), l = lum(c), skin = s > 0.18 && s < 0.62 && v > 0.34 && h > 8 && h < 42, acc = s >= 0.62 && v > 0.3, A = S.accent;
    if (z >= 1 && z <= 4) { const sl = S[['jersey', 'sleeves', 'collar', 'pants'][z - 1]]; if (skin) return c; if (acc) return A.on ? shade(A.rgb, l, 0.55) : c; if (v < 0.40) return sl.on ? shade(sl.rgb, l, 0.12) : c; return c; }
    if (z === 5) { if (skin) return c; if (acc) return A.on ? shade(A.rgb, l, 0.55) : c; if (v < 0.30) return S.socks.on ? shade(S.socks.rgb, l, 0.12) : c; if (s < 0.3) return S.pads.on ? shade(S.pads.rgb, l, 0.6) : c; return c; }
    if (z === 6) { if (acc) return A.on ? shade(A.rgb, l, 0.55) : c; return S.shoes.on ? shade(S.shoes.rgb, l, 0.55) : c; }
    if (z === 7) { if (s > 0.3 || acc) return S.gloves.on ? shade(S.gloves.rgb, l, 0.6) : c; return c; }
    return c;
  }

  /* ---------- shader patch (same maths as recolorZone, blended by per-vertex zone weights) ---------- */
  const GLSL_FRAG_DECL = `
uniform vec4 uCa[9];
varying vec4 vZa; varying vec4 vZb;
vec4 caS(int i){ if(i==0)return uCa[0]; if(i==1)return uCa[1]; if(i==2)return uCa[2]; if(i==3)return uCa[3]; if(i==4)return uCa[4]; if(i==5)return uCa[5]; if(i==6)return uCa[6]; if(i==7)return uCa[7]; return uCa[8]; }
vec3 caShade(vec3 T,float l,float ref){ return min(vec3(1.),T*clamp(.55+.45*l/ref,.5,1.4)); }
vec3 caZone(vec3 c,int z){
  float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),d=mx-mn+1e-5,h;
  if(mx==c.r)h=mod((c.g-c.b)/d,6.);else if(mx==c.g)h=(c.b-c.r)/d+2.;else h=(c.r-c.g)/d+4.;
  h*=60.; float v=mx,s=mx>.001?(mx-mn)/mx:0.,l=dot(c,vec3(.299,.587,.114));
  bool skin=s>.18&&s<.62&&v>.34&&h>8.&&h<42.; bool acc=s>=.62&&v>.3; vec4 A=caS(8);
  if(z>=1&&z<=4){ vec4 S=caS(z-1); if(skin)return c; if(acc)return A.a>.5?caShade(A.rgb,l,.55):c; if(v<.40)return S.a>.5?caShade(S.rgb,l,.12):c; return c; }
  if(z==5){ if(skin)return c; if(acc)return A.a>.5?caShade(A.rgb,l,.55):c; vec4 K=caS(4); if(v<.30)return K.a>.5?caShade(K.rgb,l,.12):c; vec4 P=caS(7); if(s<.3)return P.a>.5?caShade(P.rgb,l,.6):c; return c; }
  if(z==6){ if(acc)return A.a>.5?caShade(A.rgb,l,.55):c; vec4 S=caS(5); return S.a>.5?caShade(S.rgb,l,.55):c; }
  if(z==7){ vec4 S=caS(6); if(s>.3||acc)return S.a>.5?caShade(S.rgb,l,.6):c; return c; }
  return c;
}
vec3 caRecolor(vec3 c){
  float w[7]; w[0]=vZa.x;w[1]=vZa.y;w[2]=vZa.z;w[3]=vZa.w;w[4]=vZb.x;w[5]=vZb.y;w[6]=vZb.z;
  float tot=0.; vec3 acc3=vec3(0.);
  for(int i=0;i<7;i++){ if(w[i]>.001){ acc3+=w[i]*caZone(c,i+1); tot+=w[i]; } }
  return mix(c,acc3/max(tot,.001),min(1.,tot));
}`;
  const GLSL_VERT_DECL = 'attribute vec4 caZa; attribute vec4 caZb; varying vec4 vZa; varying vec4 vZb;';

  /* ---------- procedural gear (helmet, grille): built in model space, then fitted to bones ---------- */
  /* All builders return {p:[x,y,z,...], i:[tri indices]} in model rest space. */
  function mesh() { return { p: [], i: [] }; }
  function addGrid(m, rows, cols, fn, closeU) { /* fn(r,c)->[x,y,z], rows x cols grid */
    const base = m.p.length / 3;
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) { const v = fn(r / rows, c / cols); m.p.push(v[0], v[1], v[2]); }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = base + r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1; m.i.push(a, d, b, b, d, e, a, b, d, b, e, d); }
  }
  function tube(m, pts, r) { /* square-section bar along a polyline */
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1, t = d.map(x => x / L);
      let u = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let n1 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]]; const l1 = Math.hypot(...n1); n1 = n1.map(x => x / l1 * r);
      const n2 = [t[1] * n1[2] - t[2] * n1[1], t[2] * n1[0] - t[0] * n1[2], t[0] * n1[1] - t[1] * n1[0]];
      const base = m.p.length / 3; const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
      [a, b].forEach(P => corners.forEach(([s, q]) => m.p.push(P[0] + n1[0] * s + n2[0] * q, P[1] + n1[1] * s + n2[1] * q, P[2] + n1[2] * s + n2[2] * q)));
      for (let c = 0; c < 4; c++) { const c2 = (c + 1) % 4; m.i.push(base + c, base + 4 + c, base + c2, base + c2, base + 4 + c, base + 4 + c2); }
    }
  }
  /* head: centre c, hair-inclusive radii r=[rx,ry,rz] (measured from the model: the spiky hair reaches x -.18..+.16, z -.145..+.14, y .98) */
  function helmetShell(c, r) {
    const m = mesh(), rx = r[0], ry = r[1], rz = r[2];
    /* shell: cap from the crown down to below the ear line at the back, open at the front for the face */
    addGrid(m, 14, 40, (u, v) => {
      const az = (v - 0.5) * 2 * Math.PI; /* az=0 -> back, +-PI -> front (+z) */
      const frontness = Math.max(0, -Math.cos(az));
      const lim = Math.PI * 0.5 + 0.42 * (1 - frontness) - 0.45 * frontness;
      const t2 = u * lim, x = Math.sin(t2) * Math.sin(az), z = -Math.sin(t2) * Math.cos(az), y = Math.cos(t2);
      return [c[0] + rx * x, c[1] + ry * y, c[2] + rz * z];
    });
    /* peak (visor) over the forehead */
    addGrid(m, 3, 12, (u, v) => { const az = Math.PI + (v - 0.5) * 1.5; return [c[0] + rx * (1 + 0.1 * u) * Math.sin(az) * 0.98, c[1] + ry * 0.36 - 0.012 * u, c[2] - rz * (1 + 0.34 * u) * Math.cos(az) * 0.98]; });
    return m;
  }
  function helmetGrille(c, r) {
    const m = mesh(), gx = r[0] * 0.98, gy = r[1] * 0.93, gz = r[2] * 1.06, bar = r[0] * 0.03;
    const P = (th, az) => [c[0] + gx * Math.sin(th) * Math.sin(az), c[1] + gy * Math.cos(th), c[2] + gz * Math.sin(th) * Math.cos(az)]; /* az=0 -> front (+z) */
    const th0 = 1.3, th1 = 2.02;
    [-0.62, -0.31, 0, 0.31, 0.62].forEach(az => { const pts = []; for (let k = 0; k <= 8; k++) pts.push(P(th0 + (th1 - th0) * k / 8, az)); tube(m, pts, bar); });
    [1.38, 1.62, 1.86, 2.02].forEach(th => { const pts = []; for (let k = 0; k <= 12; k++) pts.push(P(th, -0.74 + 1.48 * k / 12)); tube(m, pts, bar); });
    return m;
  }

  const api = { SHADER_SLOTS, SLOTS, ALL_SLOTS, TEAMS, teamSlots, ORIGINAL, ZONE, groupOf, measures, zoneOf, recolorZone, GLSL_FRAG_DECL, GLSL_VERT_DECL,
    gear: { helmetShell, helmetGrille } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CAColors = api;
})(typeof self !== 'undefined' ? self : this);
