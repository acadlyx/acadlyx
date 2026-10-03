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
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
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

      #define PI 3.14159265359

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
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
        float amplitude = 0.5;
        for (int i = 0; i < 6; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + 17.17;
          amplitude *= 0.5;
        }
        return value;
      }

      float ring(vec2 p, float radius, float width) {
        float d = abs(length(p) - radius);
        return exp(-(d * d) / max(width, 0.0001));
      }

      float lineGlow(float value, float width) {
        return exp(-(value * value) / max(width, 0.00001));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;
        vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
        vec2 p = (uv - 0.5) * aspect;

        float t = uTime;
        float route = uSeed * 6.28318530718;
        float scroll = uScroll * 0.00075;
        float cinematic = t * 0.055 + scroll + route;

        // Deep architectural base.
        vec3 color = vec3(0.004, 0.008, 0.022);
        color += vec3(0.006, 0.018, 0.055) * (1.0 - length(p) * 0.55);

        // Slow-moving volumetric clouds.
        vec2 cloudUv = p * 1.55;
        cloudUv += vec2(cinematic * 0.17, -cinematic * 0.09);
        float cloudA = fbm(cloudUv + vec2(sin(route) * 2.0, cos(route) * 1.4));
        float cloudB = fbm(cloudUv * 1.7 - vec2(cinematic * 0.11, cinematic * 0.16));
        float cloud = smoothstep(0.28, 0.82, cloudA * 0.62 + cloudB * 0.38);
        color += cloud * vec3(0.018, 0.075, 0.20);

        // Three large orbital energy fields.
        vec2 q1 = p - vec2(
          sin(cinematic * 0.72) * 0.28,
          cos(cinematic * 0.54) * 0.20
        );
        vec2 q2 = p - vec2(
          cos(cinematic * 0.47 + 1.2) * 0.48,
          sin(cinematic * 0.63 + route) * 0.32
        );
        vec2 q3 = p + vec2(
          sin(cinematic * 0.39 + 2.0) * 0.38,
          cos(cinematic * 0.57 + route) * 0.44
        );

        float energy1 = exp(-dot(q1, q1) * 4.2);
        float energy2 = exp(-dot(q2, q2) * 6.0);
        float energy3 = exp(-dot(q3, q3) * 7.0);

        vec3 routeColorA = 0.5 + 0.5 * cos(route + vec3(0.0, 2.1, 4.2));
        vec3 routeColorB = 0.5 + 0.5 * cos(route * 1.7 + vec3(2.0, 4.0, 0.5));
        color += energy1 * (0.11 + 0.22 * routeColorA) * vec3(0.45, 0.78, 1.0);
        color += energy2 * (0.09 + 0.20 * routeColorB) * vec3(0.82, 0.34, 0.98);
        color += energy3 * vec3(0.02, 0.45, 0.62);

        // Cinematic orbital rings.
        float angle = atan(p.y, p.x);
        float radial = length(p);
        float twist = angle + radial * 2.7 + cinematic * 0.8;
        float ringPattern = 0.0;
        ringPattern += ring(p, 0.29 + 0.025 * sin(cinematic * 1.3), 0.0028);
        ringPattern += ring(p, 0.53 + 0.035 * sin(cinematic * 0.8 + route), 0.0022);
        ringPattern += ring(p, 0.78 + 0.05 * cos(cinematic * 0.61), 0.0030);
        ringPattern *= 0.35 + 0.65 * (0.5 + 0.5 * sin(twist * 7.0));
        color += ringPattern * vec3(0.06, 0.34, 0.58);

        // Rotating luminous ribbons.
        float wave1 = sin(p.x * 8.5 + sin(p.y * 3.0 + cinematic) * 2.2 + cinematic * 2.0);
        float wave2 = sin(p.y * 10.0 + cos(p.x * 2.4 - cinematic) * 1.8 - cinematic * 1.35);
        float ribbon1 = lineGlow(p.y - 0.20 * wave1 - 0.10 * sin(p.x * 2.0 + cinematic), 0.0017);
        float ribbon2 = lineGlow(p.x - 0.17 * wave2 + 0.08 * cos(p.y * 3.0 - cinematic), 0.0020);
        float ribbonMask = smoothstep(1.1, 0.05, radial);
        color += (ribbon1 * vec3(0.02, 0.30, 0.95) + ribbon2 * vec3(0.64, 0.10, 0.95)) * ribbonMask * 0.32;

        // Perspective-like architectural grid.
        vec2 gridP = p * 7.0;
        gridP.x += scroll * 4.0;
        gridP.y += scroll * 1.4;
        vec2 gridF = abs(fract(gridP) - 0.5);
        float gridLines = 1.0 - smoothstep(0.46, 0.498, min(gridF.x, gridF.y));
        float gridFade = smoothstep(1.05, 0.12, radial);
        color += gridLines * gridFade * vec3(0.015, 0.075, 0.14) * 0.34;

        // Dense star/particle field, route-seeded.
        vec2 starCell = floor((uv + route * 0.013) * 95.0);
        vec2 starLocal = fract((uv + route * 0.013) * 95.0) - 0.5;
        float starSeed = hash21(starCell + floor(route * 17.0));
        float star = step(0.972, starSeed);
        float twinkle = 0.35 + 0.65 * sin(t * (1.2 + starSeed * 5.0) + starSeed * 80.0);
        float starSize = smoothstep(0.075, 0.0, length(starLocal));
        color += star * starSize * twinkle * vec3(0.30, 0.62, 1.0) * 0.75;

        // Vertical light architecture and scanlines.
        float columns = pow(max(0.0, sin((p.x + sin(p.y * 2.0 + cinematic) * 0.035) * 20.0)), 18.0);
        color += columns * vec3(0.02, 0.11, 0.22) * smoothstep(1.0, 0.15, radial) * 0.16;
        float scan = 0.96 + 0.04 * sin(gl_FragCoord.y * 0.22 + t * 1.5);
        color *= scan;

        // Strong central depth + cinematic vignette.
        float centerGlow = exp(-dot(p, p) * 1.45);
        color += centerGlow * vec3(0.008, 0.025, 0.075);
        float vignette = smoothstep(1.55, 0.20, radial);
        color *= 0.48 + 0.52 * vignette;

        // Scroll drives the scene, not just a tiny parameter change.
        float scrollPulse = 0.5 + 0.5 * sin(scroll * 5.0 + route);
        color += scrollPulse * vec3(0.006, 0.025, 0.055);

        // Preserve a dark, readable public-site architecture.
        color = 1.0 - exp(-color * 1.35);
        gl_FragColor = vec4(color, 1.0);
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

    try {
      vertexShader = compile(gl.VERTEX_SHADER, vertex);
      fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "WebGL program link failed");
      gl.useProgram(program);

      const buffer = gl.createBuffer();
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

      let scroll = window.scrollY;
      let targetScroll = scroll;
      let frame = 0;
      const started = performance.now();
      const seed = hashPath(pathname || "/");

      const resize = () => {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
        canvas.width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
        canvas.height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        gl.viewport(0, 0, canvas.width, canvas.height);
      };

      const onScroll = () => {
        targetScroll = window.scrollY;
      };

      const draw = (now: number) => {
        scroll += (targetScroll - scroll) * 0.055;
        gl.uniform1f(timeLocation, (now - started) / 1000);
        gl.uniform1f(scrollLocation, scroll);
        gl.uniform1f(seedLocation, seed);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        frame = requestAnimationFrame(draw);
      };

      resize();
      window.addEventListener("resize", resize, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      frame = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", onScroll);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
      };
    } catch {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      return undefined;
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
