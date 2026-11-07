/**
 * Hero sculpture: a raymarched glass sphere with a rotating inner gyroscope
 * and an orbit ring, rendered in a single fragment shader (no dependencies).
 *
 * Performance safeguards:
 *  - rays are only marched inside a bounding sphere; the halo is analytic
 *  - rendered at reduced resolution, adapted from measured frame times
 *  - paused when the hero is off-screen or the tab is hidden
 *  - falls back (returns false) if WebGL is unavailable or too slow
 */

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uRot;
uniform vec2 uCenter;
uniform float uScale;

const vec3 BLUE   = vec3(0.31, 0.55, 1.00);
const vec3 VIOLET = vec3(0.55, 0.36, 0.96);
const vec3 CYAN   = vec3(0.21, 0.84, 0.91);

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }

float glass(vec3 p){
  vec3 q = p;
  q.xz *= rot(uRot.x);
  q.yz *= rot(uRot.y);
  float d = length(q) - 1.0;
  d += 0.032 * sin(4.0 * q.x + uTime * 0.55) * sin(4.0 * q.y + uTime * 0.45) * sin(4.0 * q.z + uTime * 0.35);
  return d;
}

float ring(vec3 p){
  vec3 r = p;
  r.yz *= rot(1.28);
  r.xy *= rot(0.32 + uTime * 0.06);
  return sdTorus(r, vec2(1.34, 0.006));
}

float inner(vec3 p){
  vec3 a = p;
  a.xy *= rot(uTime * 0.40);
  a.yz *= rot(uTime * 0.27);
  float t1 = sdTorus(a, vec2(0.52, 0.05));
  vec3 b = p;
  b.yz *= rot(1.5708 + uTime * 0.23);
  b.xz *= rot(uTime * 0.33);
  float t2 = sdTorus(b, vec2(0.35, 0.045));
  float s = length(p) - 0.13;
  return min(min(t1, t2), s);
}

vec3 env(vec3 d){
  vec3 c = mix(vec3(0.02, 0.03, 0.055), vec3(0.06, 0.08, 0.15), d.y * 0.5 + 0.5);
  c += BLUE   * pow(max(dot(d, normalize(vec3(-0.5, 0.7, 0.5))), 0.0), 8.0) * 1.5;
  c += VIOLET * pow(max(dot(d, normalize(vec3(0.85, -0.3, 0.3))), 0.0), 6.0) * 1.1;
  c += CYAN   * pow(max(dot(d, normalize(vec3(0.1, 0.25, -1.0))), 0.0), 4.0) * 0.35;
  c += vec3(0.4, 0.6, 1.0) * smoothstep(0.965, 1.0, abs(sin(d.y * 22.0))) * 0.05;
  return c;
}

vec3 glassNormal(vec3 p){
  const vec2 e = vec2(0.002, -0.002);
  return normalize(e.xyy * glass(p + e.xyy) + e.yyx * glass(p + e.yyx) + e.yxy * glass(p + e.yxy) + e.xxx * glass(p + e.xxx));
}

vec3 innerNormal(vec3 p){
  const vec2 e = vec2(0.002, -0.002);
  return normalize(e.xyy * inner(p + e.xyy) + e.yyx * inner(p + e.yyx) + e.yxy * inner(p + e.yxy) + e.xxx * inner(p + e.xxx));
}

void main(){
  float unit = min(uRes.x, uRes.y) * uScale;
  vec2 uv = (gl_FragCoord.xy - uCenter * uRes) / unit;

  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(uv, -1.6));

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // Analytic halo around the sculpture
  float tc = -dot(ro, rd);
  float dc = length(ro + rd * tc);
  float halo = exp(-max(dc - 0.98, 0.0) * 2.4);
  vec3 haloCol = mix(BLUE, VIOLET, smoothstep(-0.6, 0.6, uv.x - uv.y * 0.5));
  col += haloCol * halo * 0.22;
  alpha += halo * 0.22;

  // Bounding sphere
  float R = 1.45;
  float h = tc * tc - (dot(ro, ro) - R * R);
  if (h > 0.0) {
    float sh = sqrt(h);
    float t = tc - sh;
    float tMax = tc + sh;
    float minRing = 1e3;
    float minGlass = 1e3;
    bool hit = false;
    vec3 p;
    for (int i = 0; i < 56; i++) {
      p = ro + rd * t;
      float g = glass(p);
      minGlass = min(minGlass, g);
      float r = ring(p);
      minRing = min(minRing, r);
      float d = min(g, r);
      if (g < 0.0015) { hit = true; break; }
      t += max(d, 0.006);
      if (t > tMax) break;
    }

    float ringGlow = exp(-minRing * 90.0) * 0.55 + exp(-minRing * 18.0) * 0.06;
    col += CYAN * ringGlow;
    alpha += ringGlow * 0.8;

    if (!hit) {
      float px = 2.4 / (1.6 * unit);
      float edge = 1.0 - smoothstep(0.0, px * 1.5, minGlass);
      col += BLUE * edge * 0.55;
      alpha += edge * 0.55;
    }

    if (hit) {
      vec3 n = glassNormal(p);
      float ndv = max(dot(-rd, n), 0.0);
      float fres = pow(1.0 - ndv, 3.0);

      vec3 refl = env(reflect(rd, n));

      vec3 rd2 = refract(rd, n, 1.0 / 1.42);
      vec3 q = p + rd2 * 0.02;
      float ti = 0.0;
      bool hitIn = false;
      float glow = 0.0;
      for (int i = 0; i < 32; i++) {
        vec3 ip = q + rd2 * ti;
        float d = inner(ip);
        glow += exp(-d * 14.0) * 0.018;
        if (d < 0.002) { hitIn = true; q = ip; break; }
        ti += max(d, 0.004);
        if (ti > 2.1) break;
      }

      vec3 refr;
      if (hitIn) {
        vec3 ni = innerNormal(q);
        float diff = max(dot(ni, normalize(vec3(-0.4, 0.8, 0.5))), 0.0);
        vec3 base = mix(BLUE, VIOLET, 0.5 + 0.5 * ni.y);
        refr = base * (0.25 + 0.85 * diff) + CYAN * pow(1.0 - max(dot(-rd2, ni), 0.0), 2.0) * 0.6;
      } else {
        refr = env(rd2) * 0.55 + vec3(0.02, 0.03, 0.07);
      }
      refr += mix(BLUE, CYAN, 0.4) * glow;

      vec3 c = mix(refr, refl, clamp(fres * 0.9 + 0.06, 0.0, 1.0));
      vec3 rr = reflect(rd, n);
      c += vec3(1.0) * pow(max(dot(rr, normalize(vec3(-0.6, 0.8, 0.6))), 0.0), 70.0) * 1.3;
      c += VIOLET * pow(max(dot(rr, normalize(vec3(0.9, -0.2, 0.4))), 0.0), 18.0) * 0.6;
      c += BLUE * pow(fres, 1.4) * 0.55;

      float a = 0.9 + fres * 0.1;
      col = col * (1.0 - a) + c * a;
      alpha = alpha * (1.0 - a) + a;
    }
  }

  col = col / (1.0 + col * 0.6);
  alpha = clamp(alpha, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

export function initHeroGL(canvas, { reduce = false, hero, onFirstFrame } = {}) {
  let gl;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'high-performance', desynchronized: true });
  } catch (e) { gl = null; }
  if (!gl) return Promise.resolve(false);

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, VERT);
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, FRAG);
  gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  // Compile off the main thread where supported, so the intro never stalls
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const ready = new Promise((resolve) => {
    if (!parallel) { resolve(); return; }
    const poll = () => (gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR) ? resolve() : setTimeout(poll, 30));
    poll();
  });

  return ready.then(() => {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn(gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
      return false;
    }
    setup();
    return true;
  });

  function setup() {
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    ['uRes', 'uTime', 'uRot', 'uCenter', 'uScale'].forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });

    const isMobile = () => window.innerWidth < 760;
    // Render-resolution scale (1 = CSS pixels). Bounded by a pixel budget, then adapted live.
    let maxScale = 1;
    let scale = 1;
    let w = 0, h = 0, cssW = 0, cssH = 0;

    const computeMax = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width; cssH = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const budget = isMobile() ? 260000 : 720000;
      maxScale = Math.min(dpr, Math.sqrt(budget / Math.max(1, cssW * cssH)));
    };
    const applySize = () => {
      w = Math.max(1, Math.round(cssW * scale));
      h = Math.max(1, Math.round(cssH * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    computeMax();
    scale = maxScale * (isMobile() ? 0.85 : 0.9);
    applySize();

    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    window.addEventListener('pointermove', (e) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    let scrollFade = 0;
    const onScroll = () => { scrollFade = hero ? Math.min(window.scrollY / (hero.offsetHeight || 1), 1) : 0; };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    let running = false;
    let raf = 0;
    let last = 0;
    let time = 8.0;
    let ema = 16.7;
    let slowFor = 0;
    let fastFor = 0;
    let warm = 0;

    const draw = (dt) => {
      time += dt;
      cur.x += (target.x - cur.x) * Math.min(1, dt * 3);
      cur.y += (target.y - cur.y) * Math.min(1, dt * 3);
      const mobile = isMobile();
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uTime, time);
      gl.uniform2f(u.uRot, time * 0.12 + cur.x * 0.6, cur.y * 0.35);
      gl.uniform2f(u.uCenter, (mobile ? 0.5 : 0.73) + cur.x * 0.012, (mobile ? 0.76 : 0.47) - cur.y * 0.012 + scrollFade * 0.08);
      gl.uniform1f(u.uScale, (mobile ? 0.56 : 0.5) * (1 - scrollFade * 0.12));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const adapt = (frameMs, dt) => {
      if (warm < 20) { warm += 1; return; } // ignore start-up frames
      ema += (frameMs - ema) * 0.1;
      if (ema > 21) { slowFor += dt; fastFor = 0; } else if (ema < 17.5) { fastFor += dt; slowFor = 0; } else { slowFor = 0; fastFor = 0; }
      if (slowFor > 0.5) {
        slowFor = 0;
        const min = maxScale * 0.5;
        if (scale > min + 0.01) { scale = Math.max(min, scale * 0.8); applySize(); ema = 16.7; warm = 10; }
        else { stop(); canvas.dispatchEvent(new CustomEvent('gl-fallback')); }
      } else if (fastFor > 3 && scale < maxScale * 0.9) {
        fastFor = 0;
        scale = Math.min(maxScale * 0.9, scale * 1.1); applySize(); warm = 10;
      }
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const frameMs = last ? now - last : 16.7;
      last = now;
      const dt = Math.min(frameMs / 1000, 0.05);
      draw(dt);
      adapt(frameMs, dt);
    };

    function start() {
      if (running || reduce) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    draw(0);
    if (onFirstFrame) onFirstFrame();

    if (!reduce) {
      let heroVisible = true;
      if (hero && 'IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
          heroVisible = entry.isIntersecting;
          if (heroVisible && !document.hidden) start(); else stop();
        }).observe(hero);
      } else start();
      document.addEventListener('visibilitychange', () => (document.hidden || !heroVisible ? stop() : start()));
    }

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { computeMax(); scale = Math.min(scale, maxScale); applySize(); if (reduce) draw(0); }, 150);
    }, { passive: true });

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); canvas.dispatchEvent(new CustomEvent('gl-fallback')); });
  }
}
