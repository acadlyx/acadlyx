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
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 6; i++) {
          value += amplitude * noise(p);
          p = p * 2.02 + vec2(17.17, 9.31);
          amplitude *= 0.48;
        }
        return value;
      }

      float softLine(float d, float width) {
        return exp(-(d * d) / max(width, 0.000001));
      }

      float arcField(vec2 p, float radius, float speed, float phase) {
        float r = length(p);
        float a = atan(p.y, p.x);
        float arc = 0.5 + 0.5 * sin(a * 8.0 + uTime * speed + phase);
        return softLine(r - radius, 0.0018) * smoothstep(0.10, 0.92, arc);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
        float t = uTime;
        float seed = uSeed * 6.2831853;
        float scroll = uScroll * 0.00024;

        vec2 pointer = uPointer * vec2(aspect * 0.18, 0.16);
        vec2 q = p + pointer * (0.18 + 0.30 * smoothstep(1.45, 0.0, length(p)));
        float r = length(q);
        float a = atan(q.y, q.x);

        // Deep enterprise-grade navy foundation.
        vec3 color = vec3(0.006, 0.012, 0.025);
        vec3 navy = vec3(0.018, 0.055, 0.105);
        vec3 blue = vec3(0.035, 0.180, 0.520);
        vec3 cyan = vec3(0.035, 0.430, 0.720);
        vec3 steel = vec3(0.16, 0.30, 0.46);

        // Large multi-scale moving atmospheric volumes.
        float cloudA = fbm(q * 1.15 + vec2(t * 0.022 + seed, -t * 0.014 + scroll));
        float cloudB = fbm(q * 2.25 - vec2(t * 0.016 - seed * 0.4, t * 0.011));
        float cloudC = fbm(q * 4.5 + vec2(-t * 0.010, t * 0.018) + seed);
        color += navy * smoothstep(0.30, 0.82, cloudA) * 1.15;
        color += blue * smoothstep(0.50, 0.88, cloudB) * 0.34;
        color += cyan * smoothstep(0.62, 0.94, cloudC) * 0.08;

        // Cursor-driven light volume and secondary halo.
        vec2 lightPos = pointer * 1.55;
        float light = exp(-length(q - lightPos) * 2.45);
        float halo = exp(-length(q - lightPos) * 5.8);
        color += cyan * light * 0.34;
        color += vec3(0.10, 0.30, 0.62) * halo * 0.22;

        // Deep perspective grid. It bends with pointer movement and scroll.
        vec2 gridP = q * (8.5 + 1.8 * sin(seed));
        gridP.y += scroll * 4.5;
        gridP += pointer * 0.9;
        vec2 gridCell = abs(fract(gridP) - 0.5);
        float gridLines = 1.0 - smoothstep(0.475, 0.497, min(gridCell.x, gridCell.y));
        float gridFade = smoothstep(1.75, 0.12, r);
        color += steel * gridLines * gridFade * 0.23;

        // Second finer grid adds depth without looking like a video texture.
        vec2 fine = q * 22.0 - pointer * 1.8 + vec2(scroll * 2.0, -scroll * 1.2);
        vec2 fineCell = abs(fract(fine) - 0.5);
        float fineGrid = 1.0 - smoothstep(0.492, 0.499, min(fineCell.x, fineCell.y));
        color += vec3(0.08, 0.20, 0.35) * fineGrid * smoothstep(1.45, 0.20, r) * 0.08;

        // Multiple orbital rings with independently moving segments.
        color += cyan * arcField(q, 0.25 + 0.012 * sin(t * 0.32 + seed), 1.1, seed) * 0.44;
        color += blue * arcField(q, 0.48 + 0.016 * cos(t * 0.22 - seed), -0.72, seed * 1.7) * 0.34;
        color += cyan * arcField(q, 0.73 + 0.020 * sin(t * 0.16 + seed), 0.46, seed * 0.4) * 0.22;
        color += blue * arcField(q, 1.02 + 0.024 * cos(t * 0.12), -0.28, seed * 2.1) * 0.14;

        // Sweeping architectural wave ribbons.
        float wave1 = sin(q.x * 5.2 + sin(q.y * 2.1 + t * 0.24) * 1.4 + t * 0.26 + seed);
        float wave2 = sin(q.x * 8.4 - q.y * 3.1 - t * 0.18 + seed * 1.8);
        float ribbon1 = exp(-abs(q.y - wave1 * 0.16 - sin(q.x * 2.0 + t * 0.16) * 0.10) * 12.0);
        float ribbon2 = exp(-abs(q.y + 0.42 - wave2 * 0.09) * 20.0);
        float ribbonMask = smoothstep(1.55, 0.15, r);
        color += blue * ribbon1 * ribbonMask * 0.12;
        color += cyan * ribbon2 * ribbonMask * 0.055;

        // Structured cursor-responsive particle field.
        vec2 particleUv = q * 34.0 + vec2(t * 0.020, -t * 0.014) + seed;
        vec2 cell = floor(particleUv);
        vec2 local = fract(particleUv) - 0.5;
        float particleSeed = hash21(cell);
        vec2 drift = vec2(
          sin(t * 0.25 + particleSeed * 8.0),
          cos(t * 0.21 + particleSeed * 9.0)
        ) * 0.08;
        float particle = smoothstep(0.055, 0.0, length(local - drift - pointer * 0.035));
        particle *= step(0.84, particleSeed);
        color += vec3(0.28, 0.58, 0.92) * particle * 0.46;

        // Scroll controls a subtle depth plane and makes long pages feel spatial.
        float depthWave = 0.5 + 0.5 * sin(r * 13.0 - scroll * 18.0 + a * 3.0 + seed);
        color += vec3(0.025, 0.065, 0.12) * depthWave * smoothstep(1.55, 0.08, r);

        // Edge falloff keeps text readable while preserving a strong center field.
        float vignette = smoothstep(1.70, 0.34, r);
        color *= 0.66 + 0.34 * vignette;

        // Professional contrast curve; avoid neon/video-game saturation.
        color = 1.0 - exp(-color * 1.42);
        gl_FragColor = vec4(color, 0.96);
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
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );

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
        pointerX += (targetPointerX - pointerX) * smooth * 0.65;
        pointerY += (targetPointerY - pointerY) * smooth * 0.65;
        scroll += (targetScroll - scroll) * smooth * 0.48;

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

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
