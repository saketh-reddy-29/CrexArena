/* CRICKET ARENA - pose -> skeleton retargeter (pure maths, no THREE dependency).
 *
 * The animation library (index.html) describes every pose with a handful of numbers
 * (lean, crouch, foot targets, hand targets, bat angle ...) in "game units" (x forward, y up,
 * hips 0.9 above ground).  This file converts such a pose into LOCAL BONE ROTATIONS for any
 * humanoid GLB that starts in a T-pose / A-pose.  It never edits bones, weights, scale or
 * materials: it only returns one rotation per bone (+ the hips position).
 *
 * Model space (glTF): +Y up, +Z forward, +X = character's left.
 */
(function (root) {
  'use strict';
  /* ---------- tiny vector / quaternion helpers (arrays) ---------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    cl = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qinv = q => [-q[0], -q[1], -q[2], q[3]];
  const qaxis = (ax, an) => { const s = Math.sin(an / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(an / 2)]; };
  const qrot = (q, v) => { const u = [q[0], q[1], q[2]], t = mul(crs(u, v), 2); return add(add(v, mul(t, q[3])), crs(u, t)); };
  const qfromTo = (a, b) => { /* shortest arc a->b (unit vectors) */
    const d = dot(a, b);
    if (d > 0.999999) return [0, 0, 0, 1];
    if (d < -0.999999) { let ax = crs([1, 0, 0], a); if (len(ax) < 1e-4) ax = crs([0, 1, 0], a); ax = nrm(ax); return [ax[0], ax[1], ax[2], 0]; }
    const c = crs(a, b), q = [c[0], c[1], c[2], 1 + d], l = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  };

  /* ---------- bone-name roles ---------- */
  const norm = s => String(s || '').toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '');
  function roleOf(n) {
    const k = norm(n);
    let side = '';
    if (/^(left|l)(?=[a-z])/.test(k) && !/^leg/.test(k)) side = 'L'; else if (/^(right|r)(?=[a-z])/.test(k)) side = 'R';
    const b = k.replace(/^(left|right)/, '').replace(/^[lr](?=(upper|lower|hand|foot|toe|shoulder|clav|arm|forearm|up|leg|thigh|shin|calf))/, '');
    const t = (re) => re.test(b);
    if (!side) {
      if (/^(hips|pelvis)$/.test(k)) return 'hips'; if (/^spine$|^spine0?$/.test(k)) return 'spine'; if (/^chest$|^spine1$/.test(k)) return 'chest';
      if (/^upperchest$|^spine2$/.test(k)) return 'upper'; if (/^neck$|^neck1$/.test(k)) return 'neck'; if (/^head$/.test(k)) return 'head'; return null;
    }
    if (t(/^(shoulder|clavicle|clav)$/)) return side + 'clav'; if (t(/^(upperarm|arm)$/)) return side + 'ua'; if (t(/^(lowerarm|forearm)$/)) return side + 'la';
    if (t(/^hand$/)) return side + 'hand'; if (t(/^(middleproximal|handmiddle1|middle1)$/)) return side + 'mid';
    if (t(/^(upperleg|upleg|thigh|leg)$/) && !/lower/.test(b)) return side + 'ul'; if (t(/^(lowerleg|shin|calf|leg2)$/)) return side + 'll';
    if (t(/^foot$/)) return side + 'foot'; if (t(/^(toes|toebase|toe)$/)) return side + 'toe';
    return null;
  }

  /* desc = { bones:[{n,p,lp,lq,wp,wq}], ground }   (model space, rest pose)
   *   n name, p parent index (-1 root), lp/lq local rest pos/quat, wp/wq world rest pos/quat */
  function build(desc) {
    const B = desc.bones, nb = B.length, R = {};
    B.forEach((b, i) => { const r = roleOf(b.n); if (r && R[r] === undefined) R[r] = i; });
    const need = ['hips', 'spine', 'chest', 'upper', 'neck', 'head', 'Lua', 'Lla', 'Lhand', 'Rua', 'Rla', 'Rhand', 'Lul', 'Lll', 'Lfoot', 'Rul', 'Rll', 'Rfoot'];
    const miss = need.filter(r => R[r] === undefined);
    if (miss.length) throw new Error('Rig is missing bones: ' + miss.join(', '));
    const W = i => B[i].wp, Q = i => B[i].wq, ground = desc.ground || 0;
    const thighY = (W(R.Lul)[1] + W(R.Rul)[1]) / 2 - ground, S = 0.9 / thighY /* model->game scale */, g2m = 1 / S;
    const ankleH = (W(R.Lfoot)[1] + W(R.Rfoot)[1]) / 2 - ground;
    const arm = {}, leg = {};
    ['L', 'R'].forEach(s => {
      const ua = R[s + 'ua'], la = R[s + 'la'], hd = R[s + 'hand'], mid = R[s + 'mid'];
      const palmV = mid !== undefined ? mul(sub(W(mid), W(hd)), 0.55) : mul(nrm(sub(W(hd), W(la))), 0.04);
      arm[s] = { ua, la, hd, clav: R[s + 'clav'], l1: len(sub(W(la), W(ua))), l2: len(sub(W(hd), W(la))), po: len(palmV), sgn: s === 'L' ? 1 : -1,
        d1: nrm(sub(W(la), W(ua))), d2: nrm(sub(W(hd), W(la))), sh: W(ua) };
      const ul = R[s + 'ul'], ll = R[s + 'll'], ft = R[s + 'foot'];
      leg[s] = { ul, ll, ft, l1: len(sub(W(ll), W(ul))), l2: len(sub(W(ft), W(ll))), d1: nrm(sub(W(ll), W(ul))), d2: nrm(sub(W(ft), W(ll))), sgn: s === 'L' ? 1 : -1 };
    });
    const spineChain = ['hips', 'spine', 'chest', 'upper', 'neck', 'head'].map(r => R[r]);
    const driven = new Array(nb).fill(false);
    [...spineChain, arm.L.ua, arm.L.la, arm.L.hd, arm.R.ua, arm.R.la, arm.R.hd, leg.L.ul, leg.L.ll, leg.L.ft, leg.R.ul, leg.R.ll, leg.R.ft].forEach(i => driven[i] = true);
    if (arm.L.clav !== undefined) driven[arm.L.clav] = true; if (arm.R.clav !== undefined) driven[arm.R.clav] = true;
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

    /* two-bone IK in 3D with pole vector. returns [mid, end] positions */
    function ik2(s, t, l1, l2, pole) {
      let v = sub(t, s), d = len(v); const mx = l1 + l2 - 1e-4, mn = Math.abs(l1 - l2) + 1e-3;
      const u = d > 1e-6 ? mul(v, 1 / d) : [0, -1, 0]; d = cl(d, mn, mx);
      const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      let pp = sub(pole, mul(u, dot(pole, u))); if (len(pp) < 1e-5) pp = sub([0, 0, -1], mul(u, dot([0, 0, -1], u))); pp = nrm(pp);
      return [add(s, add(mul(u, a), mul(pp, h))), add(s, mul(u, d))];
    }

    const lq = new Array(nb), wq = new Array(nb);
    /* ===================== SOLID BODY: colliders + anatomical limits ===================== */
    const T0 = thighY;                                    /* proportions are relative to leg height so any humanoid works */
    const RAD = { pelvis: 0.195 * T0, chest: 0.184 * T0, head: 0.25 * T0, uarm: 0.09 * T0, farm: 0.078 * T0, hand: 0.10 * T0, thigh: 0.125 * T0, shin: 0.125 * T0, elbow: 0.085 * T0, bat: 0.05 * T0 };
    const headOff = [0, 0.23 * T0, 0.045 * T0];
    const EXTRA = (typeof desc.limits === 'object' && desc.limits) || {};
    const LIM = Object.assign({ elbowFlex: 150, hipFlex: 125, hipExt: 35, hipAbd: 50, hipAdd: 25, shExt: 55, kneeFlex: 150, dorsi: 35, plantar: 50 }, EXTRA);
    const D2R = Math.PI / 180;
    function segPt(p, a, b) { const ab = sub(b, a), l2 = dot(ab, ab); const t = l2 > 1e-12 ? cl(dot(sub(p, a), ab) / l2, 0, 1) : 0; const c = add(a, mul(ab, t)); return { c, t, d: len(sub(p, c)) }; }
    /* clearance (>=0 ok, <0 penetration) of a limb segment a-b (radius ra, sampled between t0..t1) against a capsule; returns {m, n (push normal), at} */
    function clearSeg(a, b, ra, t0, t1, cap) {
      let best = { m: 1e9, n: [0, 0, 1], at: a };
      for (let i = 0; i <= 4; i++) {
        const t = t0 + (t1 - t0) * i / 4, p = add(a, mul(sub(b, a), t)), q = segPt(p, cap.a, cap.b), v = sub(p, q.c), d = len(v), m = d - (ra + cap.r);
        if (m < best.m) best = { m, n: d > 1e-6 ? mul(v, 1 / d) : [0, 0, 1], at: p };
      } return best;
    }
    function clearPt(p, ra, cap) { const q = segPt(p, cap.a, cap.b), v = sub(p, q.c), d = len(v); return { m: d - (ra + cap.r), n: d > 1e-6 ? mul(v, 1 / d) : [0, 0, 1] }; }
    const rot3 = (q, v) => qrot(q, v);

    function solve(p, st, dt) {
      st = st || (st = {}); dt = dt || 1 / 60;
      let key = ''; for (const k in p) key += (typeof p[k] === 'number' ? Math.round(p[k] * 2000) : p[k]) + ','; if (st.key === key && st.res) return st.res; /* unchanged pose: reuse */ st.phi = st.phi || { L: 0, R: 0 }; st.corr = st.corr || { L: [0, 0, 0], R: [0, 0, 0] }; st.baOff = st.baOff || 0; st.hz = st.hz || 0;
      const kS = 1 - Math.exp(-dt * 16);
      const out = {}, hipsRest = W(R.hips), dbg = out.dbg = { armTorso: 1e9, armArm: 1e9, legLeg: 1e9, legBody: 1e9, bat: 1e9, limit: 0 };
      const L = p.lean || 0, tw = p.tw || 0, YW = (p.yw || 0) * Math.PI / 2, EU = [Math.sin(YW), 0, Math.cos(YW)]; /* YW: body turned side-on; EU: model-space direction of the pitch axis */
      const ang = { hips: 0.1 * L, spine: 0.4 * L, chest: 0.75 * L, upper: L, neck: 0.8 * L, head: 0.55 * L + (p.head || 0) };
      const twd = { hips: 0, spine: 0.25 * tw, chest: 0.6 * tw, upper: tw, neck: tw + 0.35 * YW, head: tw + 0.9 * YW }; /* side-on: head turns to look down the pitch */
      const delta = {}, pos = {};
      function torso(hz) {
        const hipsPos = [hipsRest[0], hipsRest[1] - (p.crouch || 0) * g2m, hipsRest[2] + ((p.hz || 0) * g2m) - hz];
        let prev = null;
        for (const r of ['hips', 'spine', 'chest', 'upper', 'neck', 'head']) {
          const i = R[r], d = qmul(qaxis(Y, twd[r]), qaxis(X, ang[r])); delta[r] = d;
          pos[r] = prev === null ? hipsPos : add(pos[prev], qrot(delta[prev], sub(W(i), W(R[prev]))));
          wq[i] = qmul(d, Q(i)); prev = r;
        } return hipsPos;
      }
      const hipsPos = torso(st.hz); out.hips = hipsPos;
      /* body colliders (model space) */
      const headC = add(pos.head, qrot(delta.head, headOff));
      const body = [{ a: pos.hips, b: pos.chest, r: RAD.pelvis, n: 'pelvis' }, { a: pos.chest, b: pos.neck, r: RAD.chest, n: 'chest' }, { a: headC, b: headC, r: RAD.head, n: 'head' }];
      const thighCap = {};
      ['L', 'R'].forEach(s => { const G = leg[s]; thighCap[s] = { a: add(pos.hips, qrot(delta.hips, sub(W(G.ul), W(R.hips)))), r: RAD.thigh * 0.8 }; });

      /* ----- arms ----- */
      const armRes = {}, forearmCap = {};
      function armTarget(s) {
        const A = arm[s], k = s === 'L' ? 0 : 1;
        let hx = k ? p.rhx : p.lhx, hy = k ? p.rhy : p.lhy;
        const bd = [Math.sin(p.ba || 0), -Math.cos(p.ba || 0)];
        if ((p.grip || 0) > 1.5) { if (k === 0) { hx = p.bx; hy = p.by; } else { hx = p.bx + bd[0] * 0.14; hy = p.by + bd[1] * 0.14; } }
        const g = k ? cl(p.grip || 0, 0, 1) : cl((p.grip || 0) - 1, 0, 1);
        const clv = A.clav, baseSh = add(pos.upper, qrot(delta.upper, sub(W(A.ua), W(R.upper))));
        const chord = sub([hx * g2m * EU[0], hy * g2m, hx * g2m * EU[2]], baseSh), cd = len(chord) || 1, elev = cl(chord[1] / cd * 1.3, 0, 1);
        let shoulder, clavDelta = delta.upper;
        if (clv !== undefined) {
          clavDelta = qmul(delta.upper, qaxis(Z, A.sgn * 0.32 * elev)); wq[clv] = qmul(clavDelta, Q(clv));
          shoulder = add(add(pos.upper, qrot(delta.upper, sub(W(clv), W(R.upper)))), qrot(clavDelta, sub(W(A.ua), W(clv))));
        } else shoulder = baseSh;
        const lat0 = Math.abs(A.sh[0]), fw = cl(hx / 0.5, 0, 1), up = cl((hy - 1.5) / 0.6, 0, 1);
        const spread = 0.05 * (1 - 0.8 * fw) + 0.05 * up;
        const lat = lerp(A.sgn * (lat0 + spread), A.sgn * 0.012, g) + (p['lat' + s] || 0);
        return { A, k, g, shoulder, T: [lat + hx * g2m * EU[0], hy * g2m, hx * g2m * EU[2] + 0.26 * g2m * EU[0]] };
      }
      const obstacles = (s, other) => {
        const o = body.slice(); o.push({ a: thighCap.L.a, b: pos.hips, r: RAD.thigh * 0.45, n: 'thighL' }); // thigh handled loosely
        if (other) { o.push({ a: other.sh, b: other.E, r: RAD.uarm * 0.9, n: 'otherU', only: 'u' }); o.push({ a: other.E, b: other.W, r: RAD.farm, n: 'otherF', tmax: other.tmax }); }
        return o;
      };
      function projectPalm(Tp, grip, other) { /* hard push of the palm target out of the body */
        let T = Tp.slice();
        for (let it = 0; it < 3; it++) for (const c of body) { const q = clearPt(T, RAD.hand, c); if (q.m < 0) T = add(T, mul(q.n, -q.m + 0.002)); }
        if (other && grip < 0.5) { const q = clearPt(T, RAD.hand, { a: other.E, b: other.W, r: RAD.farm }); if (q.m < 0) T = add(T, mul(q.n, -q.m + 0.002)); }
        return T;
      }
      function evalArm(E, Wr, sh, other, s) { /* min clearance + joint-limit flags for candidate elbow/wrist */
        let m = 1e9, push = null, mp = 1e9;
        for (const c of body) {
          const u = clearSeg(sh, E, RAD.uarm, 0.62, 1, c); const f = clearSeg(E, Wr, RAD.farm, 0, 0.9, c);
          const e = clearPt(E, RAD.elbow, c);
          for (const q of [u, f, e]) { if (q.m < m) m = q.m; if (q.m < mp) { mp = q.m; push = q; q.who = c.n; } }
        }
        const tl = thighCap[s], tc = { a: tl.a, b: pos.hips.slice(), r: RAD.thigh * 0.55 };
        { const f = clearSeg(E, Wr, RAD.farm, 0, 0.9, { a: tl.a, b: add(tl.a, [0, -0.2 * T0, 0.02]), r: RAD.thigh * 0.5 }); if (f.m < m) m = f.m; }
        let ma = 1e9;
        if (other) { const f = clearSeg(E, Wr, RAD.farm, 0, 0.75, { a: other.E, b: other.W, r: RAD.farm }); ma = Math.min(ma, f.m); const e2 = clearPt(E, RAD.elbow, { a: other.sh, b: other.E, r: RAD.uarm }); ma = Math.min(ma, e2.m); if ((p.grip || 0) > 0.5) ma = Math.max(ma, 0); }
        return { m, ma, push };
      }
      function limitArm(A, sh, E0, T, upper) { /* anatomical limits: shoulder extension / cross-body, elbow flexion & hyperextension */
        let dir1 = nrm(sub(E0, sh)), flag = 0;
        const f = qrot(upper, Z), l = qrot(upper, X), u = qrot(upper, Y);
        const back = dot(dir1, f), outw = dot(dir1, l) * A.sgn;
        if (back < -Math.sin(LIM.shExt * D2R) - 0.25) { /* arm swung too far behind the back */ dir1 = nrm(add(dir1, mul(f, (-Math.sin(LIM.shExt * D2R) - 0.25) - back))); flag = 1; }
        if (outw < -0.45) { dir1 = nrm(add(dir1, mul(l, A.sgn * (-0.45 - outw)))); flag = 1; }
        const E = add(sh, mul(dir1, A.l1));
        let dir2 = nrm(sub(T, E)); /* elbow flexion limit: interior angle between upper arm and forearm >= 180-flex */
        const cosInt = dot(mul(dir1, -1), dir2), minInt = (180 - LIM.elbowFlex) * D2R;
        if (Math.acos(cl(cosInt, -1, 1)) < minInt) { const axis = nrm(crs(dir1, dir2)); const targetAng = Math.PI - minInt; dir2 = qrot(qaxis(axis, 0), dir1); const ax2 = len(crs(dir1, dir2)) > 1e-6 ? nrm(crs(dir1, nrm(sub(T, E)))) : Z; dir2 = qrot(qaxis(ax2, targetAng), dir1); flag = 1; }
        const Wr = add(E, mul(dir2, A.l2)); return { E, Wr, flag };
      }
      function solveArm(s, other, first) {
        const { A, k, g, shoulder, T: T0v } = armTarget(s);
        let Tg = T0v.slice(), best = null;
        const basePole = nrm(add(add(mul(X, A.sgn * 0.6), mul(Z, -0.8)), mul(Y, -0.5)));
        const minD = Math.sqrt(A.l1 * A.l1 + A.l2 * A.l2 - 2 * A.l1 * A.l2 * Math.cos((180 - LIM.elbowFlex) * D2R));
        /* palm target: raw -> projected -> smoothed correction -> projected again (hard guarantee) */
        const proj0 = projectPalm(Tg, g, other), cr = sub(proj0, Tg);
        st.corr[s] = add(mul(st.corr[s], 1 - kS), mul(cr, kS));
        Tg = projectPalm(add(Tg, st.corr[s]), g, other);
        for (let attempt = 0; attempt < 8; attempt++) {
          const u0 = nrm(sub(Tg, shoulder)); let Wt = sub(Tg, mul(u0, A.po));
          let dd = len(sub(Wt, shoulder)); if (dd < minD) Wt = add(shoulder, mul(nrm(sub(Wt, shoulder)), minD));
          const chord = nrm(sub(Wt, shoulder)); let cand = [];
          const angs = [0]; for (let a = 10; a <= 150; a += 10) { angs.push(a, -a); }
          const ph = st.phi[s]; angs.sort((x, y) => Math.abs(x * D2R - ph) - Math.abs(y * D2R - ph));
          let accepted = null;
          for (const a of angs) {
            const pole = qrot(qaxis(chord, a * D2R), basePole);
            const [E0] = ik2(shoulder, Wt, A.l1, A.l2, pole);
            const lm = limitArm(A, shoulder, E0, Wt, delta.upper);
            const ev = evalArm(lm.E, lm.Wr, shoulder, other, s);
            const pen = Math.min(ev.m, ev.ma), reachErr = len(sub(lm.Wr, Wt));
            const c = { a, lm, ev, pen, cost: lm.flag * 0.5 + reachErr * 6 };
            cand.push(c);
            if (pen >= -0.0015 && !lm.flag && reachErr < 0.004) { accepted = c; break; }
          }
          if (accepted) { best = accepted; break; }
          const ok = cand.filter(c => c.pen >= -0.0015).sort((x, y) => x.cost - y.cost);
          if (ok.length) { best = ok[0]; break; }
          cand.sort((x, y) => y.pen - x.pen); best = cand[0];
          /* every elbow position collides: move the hand out of the body and solve again (never through the torso) */
          const pu = best.ev.push; if (pu) Tg = add(Tg, mul(pu.n, Math.min(0.05, -best.pen + 0.006)));
        }
        st.phi[s] = best.a * D2R;
        const E = best.lm.E, Wr = best.lm.Wr;
        if (best.ev.m < dbg.armTorso) { dbg.armTorso = best.ev.m; dbg.who = (best.ev.push && best.ev.push.who) + ':' + s + ' a=' + best.a; } dbg.armArm = Math.min(dbg.armArm, best.ev.ma); dbg.limit += best.lm.flag;
        return { A, shoulder, E, Wr, sh: shoulder, W: Wr, tmax: 0.7 };
      }
      const rL = solveArm('L', null), rR = solveArm('R', rL);
      let rL2 = rL; { const chk = clearSeg(rL.E, rL.Wr, RAD.farm, 0, 0.75, { a: rR.E, b: rR.Wr, r: RAD.farm }).m; if (chk < 0 && !((p.grip || 0) > 0.5)) rL2 = solveArm('L', { sh: rR.sh, E: rR.E, W: rR.Wr, tmax: 0.7 }); }
      armRes.L = rL2; armRes.R = rR;
      ['L', 'R'].forEach(s => {
        const r = armRes[s], A = r.A, dir1 = nrm(sub(r.E, r.shoulder)), dir2 = nrm(sub(r.Wr, r.E));
        wq[A.ua] = qmul(qfromTo(A.d1, dir1), Q(A.ua)); const R2 = qfromTo(A.d2, dir2); wq[A.la] = qmul(R2, Q(A.la)); wq[A.hd] = qmul(R2, Q(A.hd));
        out['palm' + s] = add(r.Wr, mul(dir2, A.po)); out['elbow' + s] = r.E; out['wrist' + s] = r.Wr; out['shoulder' + s] = r.shoulder;
      });

      /* ----- legs ----- */
      const legRes = {};
      function solveLeg(s, other) {
        const G = leg[s], k = s === 'L' ? 0 : 1, fx0 = k ? p.rfx : p.lfx, fxo = k ? p.lfx : p.rfx, yw1 = p.yw || 0, fx = fx0 + (fxo - fx0) * yw1 /* side-on: left foot is the front foot */, fy = k ? p.rfy : p.lfy;
        const hipJoint = add(pos.hips, qrot(delta.hips, sub(W(G.ul), W(R.hips)))), ankleRest = W(G.ft);
        let T = [ankleRest[0] + (p['flat' + s] || 0) + fx * g2m * EU[0], ground + ankleH + fy * g2m, ankleRest[2] + fx * g2m * EU[2]];
        /* ankle (dorsiflexion) limit: when the shin leans too far over a flat foot the heel has to lift */
        let heel = 0, best = null;
        const basePole = nrm(add(mul(Z, 1), mul(X, G.sgn * 0.15)));
        for (let pass = 0; pass < 3; pass++) {
          const Tt = [T[0], T[1] + heel * 0.08 * Math.sin(heel), T[2] + 0.08 * (1 - Math.cos(heel)) * 0 + 0];
          const chord = nrm(sub(Tt, hipJoint)), angs = [0]; for (let a = 8; a <= 75; a += 8) angs.push(a, -a);
          let cand = [];
          for (const a of angs) {
            const pole = qrot(qaxis(chord, a * D2R), basePole), [K0] = ik2(hipJoint, Tt, G.l1, G.l2, pole);
            /* hip limits (flexion / extension / abduction / adduction) in the pelvis frame */
            const d1 = nrm(sub(K0, hipJoint)), f = qrot(delta.hips, Z), l = qrot(delta.hips, X), u = qrot(delta.hips, Y);
            let flex = Math.atan2(dot(d1, f), -dot(d1, u)), abd = Math.atan2(dot(d1, l) * G.sgn, -dot(d1, u)), flag = 0;
            const fl2 = cl(flex, -LIM.hipExt * D2R, LIM.hipFlex * D2R), ab2 = cl(abd, -LIM.hipAdd * D2R, LIM.hipAbd * D2R);
            if (fl2 !== flex || ab2 !== abd) { flag = 1; const cf = Math.cos(fl2), sf = Math.sin(fl2); const dd = nrm(add(add(mul(f, Math.sin(fl2)), mul(u, -Math.cos(fl2))), mul(l, G.sgn * Math.tan(ab2) * Math.cos(fl2)))); var Kk = add(hipJoint, mul(dd, G.l1)); } else Kk = K0;
            const d2 = nrm(sub(Tt, Kk)); const An = add(Kk, mul(d2, G.l2));
            /* knee flexion limit via IK range; hyperextension impossible (straight leg is max reach) */
            let m = 1e9;
            for (const c of body) { const t1 = clearSeg(hipJoint, Kk, RAD.thigh, 0.55, 1, c), t2 = clearSeg(Kk, An, RAD.shin, 0, 1, c); m = Math.min(m, t1.m, t2.m); }
            let ml = 1e9;
            if (other) { const q1 = clearSeg(Kk, An, RAD.shin * 0.8, 0.0, 1, { a: other.K, b: other.An, r: RAD.shin * 0.8 }); const q2 = clearSeg(hipJoint, Kk, RAD.thigh * 0.8, 0.45, 1, { a: other.hip, b: other.K, r: RAD.thigh * 0.8 }); ml = Math.min(q1.m, q2.m); }
            cand.push({ a, K: Kk, An, flag, m, ml, cost: Math.abs(a * D2R) * 0.08 + flag * 0.5 + len(sub(An, Tt)) * 8 + (m < 0 ? -m * 20 : 0) + (ml < 0 ? -ml * 20 : 0) });
            if (m >= -0.001 && ml >= -0.001 && !flag && len(sub(An, Tt)) < 0.004) { cand = [cand[cand.length - 1]]; break; }
          }
          cand.sort((x, y) => x.cost - y.cost); best = cand[0];
          const shin = nrm(sub(best.An, best.K)), tilt = Math.atan2(shin[2] * -1, -shin[1]) /* forward lean of shin from vertical */;
          const need = tilt - LIM.dorsi * D2R;
          if (need > 0.01 && fy < 0.02) { heel = Math.min(need, LIM.plantar * D2R); T = [T[0], T[1] + 0.08 * Math.sin(heel) * 0 + (0.07 * Math.sin(heel)), T[2] + 0.0]; } else break;
        }
        dbg.legBody = Math.min(dbg.legBody, best.m); if (other) dbg.legLeg = Math.min(dbg.legLeg, best.ml); dbg.limit += best.flag;
        return { G, hip: hipJoint, K: best.K, An: best.An, heel };
      }
      const lL = solveLeg('L', null), lR = solveLeg('R', lL), lL2 = solveLeg('L', { hip: lR.hip, K: lR.K, An: lR.An });
      legRes.L = lL2; legRes.R = lR;
      ['L', 'R'].forEach(s => {
        const r = legRes[s], G = r.G, fy = s === 'L' ? p.lfy : p.rfy;
        wq[G.ul] = qmul(qfromTo(G.d1, nrm(sub(r.K, r.hip))), Q(G.ul)); wq[G.ll] = qmul(qfromTo(G.d2, nrm(sub(r.An, r.K))), Q(G.ll));
        const pitch = cl(fy * 2.2, 0, LIM.plantar * D2R) + (p.toe || 0) + r.heel;
        wq[G.ft] = qmul(qaxis(X, cl(pitch, -20 * D2R, LIM.plantar * D2R)), Q(G.ft));
        out['ankle' + s] = r.An; out['knee' + s] = r.K;
      });

      /* ----- bat: keep the blade out of the player's own body ----- */
      out.ba = p.ba || 0;
      if ((p.grip || 0) > 0.5) {
        const two = p.grip > 1.5, pv = two ? out.palmL : out.palmR, hold = (b) => { const dx = Math.sin(b), dy = -Math.cos(b); const piv = [pv[0] - dx * 0.06 * g2m * EU[0], pv[1] - dy * 0.06 * g2m, pv[2] - dx * 0.06 * g2m * EU[2]]; const tip = [piv[0] + dx * 1.05 * g2m * EU[0], piv[1] + dy * 1.05 * g2m, piv[2] + dx * 1.05 * g2m * EU[2]]; return [piv, tip]; };
        const legCaps = [{ a: pos.hips, b: pos.chest, r: RAD.pelvis }, { a: pos.chest, b: pos.neck, r: RAD.chest }, { a: headC, b: headC, r: RAD.head }, { a: legRes.L.hip, b: legRes.L.K, r: RAD.thigh }, { a: legRes.L.K, b: legRes.L.An, r: RAD.shin }, { a: legRes.R.hip, b: legRes.R.K, r: RAD.thigh }, { a: legRes.R.K, b: legRes.R.An, r: RAD.shin }];
        const clr = b => { const [piv, tip] = hold(b); let m = 1e9; for (const c of legCaps) m = Math.min(m, clearSeg(piv, tip, RAD.bat, 0.22, 1, c).m); return m; };
        let want = p.ba || 0, bestB = want;
        if (clr(want) < 0) { let found = false; for (let d = 0.05; d <= 1.6 && !found; d += 0.05) for (const sg of [1, -1]) { if (clr(want + sg * d) >= 0) { bestB = want + sg * d; found = true; break; } } if (!found) bestB = want; }
        const off = bestB - want; st.baOff += (off - st.baOff) * Math.min(1, kS * 1.5); if (clr(want + st.baOff) < 0) st.baOff = off;
        out.ba = want + st.baOff; dbg.bat = clr(out.ba);
      } else st.baOff *= 0.8;
      st.hz = 0;

      /* ----- local rotations (parents before children) ----- */
      const res = new Float32Array(nb * 4);
      for (let i = 0; i < nb; i++) {
        const pa = B[i].p;
        if (!driven[i]) wq[i] = pa >= 0 ? qmul(wq[pa] || B[pa].wq, B[i].lq) : B[i].wq;
        const pq = pa >= 0 ? (wq[pa] || B[pa].wq) : [0, 0, 0, 1];
        const l = driven[i] ? qmul(qinv(pq), wq[i]) : B[i].lq;
        res[i * 4] = l[0]; res[i * 4 + 1] = l[1]; res[i * 4 + 2] = l[2]; res[i * 4 + 3] = l[3];
      }
      out.lq = res;
      const hb = B[R.hips], pp = hb.p >= 0 ? B[hb.p] : null;
      out.hipsLocal = pp ? qrot(qinv(pp.wq), sub(hipsPos, pp.wp)) : hipsPos;
      wq.length = 0; wq.length = nb;
      out.caps = { body, RAD };
      st.key = key; st.res = out;
      return out;
    }
    return { solve, R, S, g2m, ankleH, arm, leg, nb, bones: B };
  }
  const api = { build, roleOf, util: { qmul, qinv, qrot, qaxis, qfromTo } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CARig = api;
})(typeof self !== 'undefined' ? self : this);
