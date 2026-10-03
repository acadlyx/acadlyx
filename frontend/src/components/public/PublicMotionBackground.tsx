"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function hashPath(path: string) {
  let h = 2166136261;
  for (let i = 0; i < path.length; i += 1) h = Math.imul(h ^ path.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function PublicMotionBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const vertex = `
      attribute vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;

    const fragment = `
      precision highp float;

      uniform float uTime;
      uniform float uScroll;
      uniform float uSeed;
      uniform vec2 uResolution;
      uniform vec2 uPointer;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
        return fract(p.x * p.y * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.52;
        for (int i = 0; i < 5; i++) {
          value += amp * noise(p);
          p = p * 2.03 + vec2(17.17, 9.31);
          amp *= 0.48;
        }
        return value;
      }

      float line(float d, float width) {
        return exp(-(d * d) / max(width, 0.000001));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

        // The pointer changes the camera/light field, not the content itself.
        vec2 pointer = uPointer * vec2(aspect * 0.12, 0.10);
        vec2 parallax = pointer * (0.20 + 0.32 * smoothstep(1.0, 0.0, length(p)));
        vec2 q = p + parallax;

        float t = uTime;
        float seed = uSeed * 6.28318;
        float scroll = uScroll * 0.00018;

        vec3 base = vec3(0.018, 0.027, 0.050);
        vec3 slate = vec3(0.055, 0.090, 0.145);
        vec3 blue = vec3(0.075, 0.270, 0.600);
        vec3 accent = vec3(0.160, 0.430, 0.820);

        // Quiet ambient field: deliberately slow and low contrast.
        float cloud = fbm(q * 1.35 + vec2(t * 0.018 + seed, -t * 0.012 + scroll));
        float cloud2 = fbm(q * 2.7 - vec2(t * 0.010, t * 0.008));
        base += slate * smoothstep(0.30, 0.82, cloud) * 0.30;
        base += blue * smoothstep(0.52, 0.88, cloud2) * 0.055;

        // Fine enterprise grid with subtle perspective.
        vec2 gridUv = q * 8.0;
        gridUv.y += scroll * 3.0;
        vec2 cell = abs(fract(gridUv) - 0.5);
        float grid = 1.0 - smoothstep(0.475, 0.495, min(cell.x, cell.y));
        float gridFade = smoothstep(1.55, 0.18, length(q));
        base += grid * gridFade * vec3(0.10, 0.17, 0.26) * 0.15;

        // Thin orbital geometry: stable, architectural, not a sci-fi tunnel.
        float r = length(q);
        float a = atan(q.y, q.x);
        float ring1 = line(r - (0.28 + 0.008 * sin(t * 0.18 + seed)), 0.0018);
        float ring2 = line(r - (0.58 + 0.010 * cos(t * 0.13 + seed)), 0.0022);
        float ringMask = 0.25 + 0.75 * (0.5 + 0.5 * sin(a * 10.0 + t * 0.20 + seed));
        base += ring1 * accent * 0.18 * ringMask;
        base += ring2 * blue * 0.12 * (1.0 - ringMask * 0.45);

        // Cursor-reactive soft light. This is the main interaction.
        vec2 lightPos = pointer * 1.7;
        float light = exp(-length(q - lightPos) * 3.2);
        float edge = smoothstep(1.35, 0.10, r);
        base += accent * light * edge * 0.18;

        // Very restrained particle field.
        vec2 pp = q * 28.0 + vec2(t * 0.012, -t * 0.009) + seed;
        vec2 pi = floor(pp);
        vec2 pf = fract(pp) - 0.5;
        float pr = hash21(pi);
        float particle = smoothstep(0.045, 0.0, length(pf));
        particle *= step(0.91, pr);
        base += particle * vec3(0.42, 0.62, 0.90) * 0.22;

        // Scroll subtly changes depth, never becoming a video-like animation.
        float depth = 0.5 + 0.5 * sin(r * 8.0 - scroll * 12.0 + seed);
        base += depth * edge * vec3(0.025, 0.050, 0.085);

        float vignette = smoothstep(1.55, 0.30, r);
        base *= 0.72 + 0.28 * vignette;

        // Soft, professional contrast curve.
        base = 1.0 - exp(-base * 1.18);
        gl_FragColor = vec4(base, 0.92);
      }
    `;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to create WebGL shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "WebGL shader compilation failed";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };

    const program = gl.createProgram();
    if (!program) return;

    let vertexShader: WebGLShader | null = null;
    let fragmentShader: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    let frame = 0;

    try {
      vertexShader = compile(gl.VERTEX_SHADER, vertex);
      fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "WebGL program link failed");
      }

      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to create WebGL buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const timeLocation = gl.getUniformLocation(program, "uTime");
      const scrollLocation = gl.getUniformLocation(program, "uScroll");
      const seedLocation = gl.getUniformLocation(program, "uSeed");
      const resolutionLocation = gl.getUniformLocation(program, "uResolution");
      const pointerLocation = gl.getUniformLocation(program, "uPointer");

      let scroll = window.scrollY;
      let targetScroll = scroll;
      let pointerX = 0;
      let pointerY = 0;
      let targetPointerX = 0;
      let targetPointerY = 0;
      let last = performance.now();
      const started = last;
      const seed = hashPath(pathname || "/");

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
        canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
        canvas.style.width = "100vw";
        canvas.style.height = "100vh";
        gl.viewport(0, 0, canvas.width, canvas.height);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        targetPointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2.0;
        targetPointerY = (0.5 - event.clientY / Math.max(window.innerHeight, 1)) * 2.0;
      };

      const onPointerLeave = () => {
        targetPointerX = 0;
        targetPointerY = 0;
      };

      const onScroll = () => {
        targetScroll = window.scrollY;
      };

      const draw = (now: number) => {
        const delta = Math.min(now - last, 50);
        last = now;
        const smooth = 1.0 - Math.pow(0.001, delta / 16.67);
        pointerX += (targetPointerX - pointerX) * smooth * 0.55;
        pointerY += (targetPointerY - pointerY) * smooth * 0.55;
        scroll += (targetScroll - scroll) * smooth * 0.45;

        gl.uniform1f(timeLocation, (now - started) / 1000);
        gl.uniform1f(scrollLocation, scroll);
        gl.uniform1f(seedLocation, seed);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform2f(pointerLocation, pointerX, pointerY);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        frame = requestAnimationFrame(draw);
      };

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resize();
      window.addEventListener("resize", resize, { passive: true });
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });

      if (reducedMotion) {
        gl.uniform1f(timeLocation, 0);
        gl.uniform1f(scrollLocation, scroll);
        gl.uniform1f(seedLocation, seed);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform2f(pointerLocation, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else {
        frame = requestAnimationFrame(draw);
      }

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("scroll", onScroll);
        if (buffer) gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
      };
    } catch (error) {
      console.error("Public WebGL background failed to initialize", error);
      cancelAnimationFrame(frame);
      if (buffer) gl.deleteBuffer(buffer);
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
    }
  }, [pathname]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" />;
}
