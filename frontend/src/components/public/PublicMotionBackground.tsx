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

      #define PI 3.14159265359
      #define TAU 6.28318530718

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
        return fract(p.x * p.y * 43758.5453);
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
        float amplitude = 0.52;
        for (int i = 0; i < 7; i++) {
          value += amplitude * noise(p);
          p = p * 2.02 + vec2(17.17, 9.31);
          amplitude *= 0.49;
        }
        return value;
      }

      float glowLine(float d, float width) {
        return exp(-(d * d) / max(width, 0.000001));
      }

      float ring(float radius, float width, float r) {
        float d = abs(r - radius);
        return exp(-(d * d) / max(width, 0.000001));
      }

      vec3 palette(float seed, float phase) {
        return 0.5 + 0.5 * cos(TAU * (vec3(0.00, 0.17, 0.33) + seed * 0.23 + phase * 0.07));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;
        float aspectRatio = uResolution.x / max(uResolution.y, 1.0);
        vec2 p = (uv - 0.5) * vec2(aspectRatio, 1.0);
        float r = length(p);
        float t = uTime;
        float seed = uSeed;
        float scroll = uScroll * 0.00065;
        float route = seed * TAU;
        float cinematic = t * 0.065 + scroll + route;

        vec3 cyan = vec3(0.00, 0.38, 0.95);
        vec3 electric = vec3(0.05, 0.85, 1.00);
        vec3 violet = vec3(0.58, 0.08, 1.00);
        vec3 blue = vec3(0.04, 0.12, 0.50);

        // Deep near-black cinematic base.
        vec3 color = vec3(0.0015, 0.0035, 0.012);
        color += vec3(0.006, 0.015, 0.055) * smoothstep(1.65, 0.05, r);

        // Dense moving volumetric atmosphere.
        vec2 cloudP = p * 1.9 + vec2(cinematic * 0.13, -cinematic * 0.075);
        float cloud1 = fbm(cloudP + vec2(sin(route) * 2.4, cos(route) * 1.7));
        float cloud2 = fbm(cloudP * 1.55 - vec2(cinematic * 0.10, cinematic * 0.17));
        float cloud3 = fbm(cloudP * 0.58 + vec2(cinematic * 0.07, -cinematic * 0.05));
        float cloud = smoothstep(0.24, 0.86, cloud1 * 0.52 + cloud2 * 0.32 + cloud3 * 0.16);
        color += cloud * (0.10 * cyan + 0.055 * violet);

        // Multi-depth nebula lanes.
        float lane = sin(p.x * 3.7 + sin(p.y * 4.2 + cinematic) * 1.7 + cinematic * 1.8);
        float lane2 = sin(p.y * 5.4 - cos(p.x * 3.1 - cinematic) * 1.9 - cinematic * 1.1);
        float nebula = smoothstep(0.45, 0.98, abs(lane) * 0.58 + abs(lane2) * 0.42);
        nebula *= smoothstep(1.35, 0.12, r);
        color += nebula * (0.035 * electric + 0.025 * violet);

        // Massive orbital architecture with independently rotating rings.
        float a = atan(p.y, p.x);
        float ringA = ring(0.19 + 0.018 * sin(t * 0.85 + route), 0.0017, r);
        float ringB = ring(0.37 + 0.035 * sin(t * 0.52 + route * 1.7), 0.0022, r);
        float ringC = ring(0.61 + 0.045 * cos(t * 0.41 + route), 0.0028, r);
        float ringD = ring(0.86 + 0.055 * sin(t * 0.30 - route), 0.0032, r);
        float angularA = 0.35 + 0.65 * (0.5 + 0.5 * sin(a * 8.0 + t * 1.8 + r * 18.0));
        float angularB = 0.35 + 0.65 * (0.5 + 0.5 * cos(a * 13.0 - t * 1.25 + r * 22.0));
        color += ringA * angularA * electric * 0.55;
        color += ringB * angularB * cyan * 0.48;
        color += ringC * angularA * violet * 0.42;
        color += ringD * angularB * electric * 0.34;

        // Rotating sweeping energy ribbons.
        float ribbonCurve1 = p.y - 0.17 * sin(p.x * 4.0 + t * 1.9 + sin(p.y * 3.0) * 2.0) - 0.09 * sin(p.x * 1.7 - t);
        float ribbonCurve2 = p.x - 0.18 * cos(p.y * 4.5 - t * 1.4 + cos(p.x * 2.0) * 1.7) + 0.07 * sin(p.y * 2.4 + t);
        float ribbonCurve3 = p.y + 0.13 * sin(p.x * 7.0 - t * 2.3 + route) + 0.18 * p.x;
        float ribbon1 = glowLine(ribbonCurve1, 0.0018);
        float ribbon2 = glowLine(ribbonCurve2, 0.0020);
        float ribbon3 = glowLine(ribbonCurve3, 0.0012);
        float ribbonFade = smoothstep(1.30, 0.08, r);
        color += ribbonFade * (ribbon1 * electric * 0.50 + ribbon2 * violet * 0.42 + ribbon3 * cyan * 0.38);

        // Perspective tunnel: animated depth lines converging toward the center.
        vec2 tunnelP = p;
        tunnelP.x += 0.11 * sin(t * 0.42 + tunnelP.y * 2.0);
        float tunnelAngle = atan(tunnelP.y, tunnelP.x);
        float tunnelRadius = max(length(tunnelP), 0.025);
        float radialPhase = fract(1.0 / tunnelRadius + scroll * 1.8 - t * 0.8);
        float depthLine = smoothstep(0.045, 0.0, abs(radialPhase - 0.5));
        float spoke = pow(max(0.0, sin(tunnelAngle * 18.0 + t * 0.45 + route)), 34.0);
        float tunnelMask = smoothstep(1.35, 0.08, tunnelRadius);
        color += tunnelMask * depthLine * (0.018 * electric + 0.012 * violet);
        color += tunnelMask * spoke * electric * 0.08;

        // Architectural wireframe grid moving with scroll.
        vec2 gp = p * 9.0;
        gp.y += scroll * 7.0;
        gp.x += scroll * 2.2 + sin(t * 0.3) * 0.5;
        vec2 gf = abs(fract(gp) - 0.5);
        float grid = 1.0 - smoothstep(0.455, 0.495, min(gf.x, gf.y));
        float gridPerspective = smoothstep(1.45, 0.16, r) * (0.25 + 0.75 * smoothstep(1.0, 0.0, abs(p.y)));
        color += grid * gridPerspective * cyan * 0.13;

        // Large moving vertical light pillars.
        float pillars = pow(max(0.0, sin((p.x + 0.035 * sin(p.y * 4.0 + t)) * 22.0 + cinematic)), 22.0);
        float pillars2 = pow(max(0.0, sin((p.x - 0.06 * cos(p.y * 2.5 - t)) * 11.0 - cinematic * 0.7)), 30.0);
        color += (pillars * electric * 0.11 + pillars2 * violet * 0.075) * smoothstep(1.2, 0.08, r);

        // Hundreds of procedural depth particles with route-dependent motion.
        vec2 particleUv = uv * vec2(aspectRatio, 1.0);
        float particleAccum = 0.0;
        float particleBright = 0.0;
        for (int layer = 0; layer < 4; layer++) {
          float layerF = float(layer);
          vec2 cellUv = particleUv * (34.0 + layerF * 17.0);
          cellUv += vec2(t * (0.08 + layerF * 0.035) + seed * 13.0, -t * (0.055 + layerF * 0.025));
          vec2 cell = floor(cellUv);
          vec2 local = fract(cellUv) - 0.5;
          float rnd = hash21(cell + layerF * 31.7 + seed * 7.0);
          float enabled = step(0.72 - layerF * 0.035, rnd);
          float pulse = 0.55 + 0.45 * sin(t * (1.2 + rnd * 4.0) + rnd * 60.0);
          float point = smoothstep(0.075, 0.0, length(local));
          float depthFade = 0.18 + 0.82 * pow(rnd, 0.55);
          particleAccum += enabled * point * pulse * depthFade;
          particleBright += enabled * point * depthFade;
        }
        color += particleAccum * (0.08 * electric + 0.055 * violet);
        color += particleBright * 0.018 * vec3(0.35, 0.65, 1.0);

        // Route-specific rotating radial beams.
        float beamAngle = a + sin(t * 0.27) * 0.25 + route;
        float beams = pow(max(0.0, cos(beamAngle * 5.0 + t * 0.16)), 42.0);
        beams *= smoothstep(1.5, 0.10, r);
        color += beams * (0.055 * electric + 0.028 * violet);

        // Pulsing central reactor / depth portal.
        float pulse = 0.5 + 0.5 * sin(t * 1.35 + route);
        float reactor = exp(-r * r * (28.0 - pulse * 8.0));
        float reactorRing = ring(0.075 + pulse * 0.018, 0.0012, r);
        color += reactor * (0.08 * electric + 0.035 * violet);
        color += reactorRing * electric * 0.65;

        // Scroll creates actual camera/depth movement rather than a simple color pulse.
        float scrollWave = sin(scroll * 7.0 + r * 9.0 - t * 0.18 + route);
        color += smoothstep(0.0, 1.0, scrollWave) * smoothstep(1.3, 0.12, r) * 0.018 * cyan;

        // Strong cinematic vignette and filmic response.
        float vignette = smoothstep(1.55, 0.16, r);
        color *= 0.38 + 0.62 * vignette;
        color += vec3(0.004, 0.009, 0.026);
        color = 1.0 - exp(-color * 1.48);

        // Subtle scanline/flicker texture for the dark sci-fi architecture.
        float scan = 0.985 + 0.015 * sin(gl_FragCoord.y * 0.32 + t * 1.7);
        color *= scan;

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

      let scroll = window.scrollY;
      let targetScroll = scroll;
      let lastFrame = performance.now();
      const started = lastFrame;
      const seed = hashPath(pathname || "/");

      const resize = () => {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
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
        const delta = Math.min(now - lastFrame, 50);
        lastFrame = now;
        const smoothing = 1.0 - Math.pow(0.0008, delta / 16.67);
        scroll += (targetScroll - scroll) * smoothing;

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
