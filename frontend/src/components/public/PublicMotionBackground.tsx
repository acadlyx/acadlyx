"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function hashPath(path: string) { let h = 2166136261; for (let i = 0; i < path.length; i++) h = Math.imul(h ^ path.charCodeAt(i), 16777619); return (h >>> 0) / 4294967295; }

export function PublicMotionBackground() {
  const ref = useRef<HTMLCanvasElement>(null); const pathname = usePathname();
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true }); if (!gl) return;
    const vertex = `attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}`;
    const fragment = `precision highp float; uniform float uTime,uScroll,uSeed; uniform vec2 uRes;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      void main(){vec2 uv=gl_FragCoord.xy/uRes; vec2 p=(uv-.5)*vec2(uRes.x/uRes.y,1.); float s=uScroll*.0025+uSeed*6.2831; p*=1.05;
        float n=noise(p*2.2+vec2(s,-s*.7)+uTime*.018); float n2=noise(p*4.5-vec2(s*.6,s)+uTime*.012);
        vec2 a=p-vec2(sin(s*.8)*.25,cos(s*.7)*.16); vec2 b=p-vec2(cos(s*.6)*.42,sin(s*.9)*.28); vec2 c=p+vec2(sin(s*.5)*.35,cos(s*.8)*.3);
        float g1=exp(-dot(a,a)*2.7),g2=exp(-dot(b,b)*3.8),g3=exp(-dot(c,c)*4.5);
        vec3 col=vec3(.035,.07,.15)+g1*vec3(.05,.28,.72)+g2*vec3(.34,.16,.68)+g3*vec3(.05,.55,.55); col+=n*.025+n2*.018;
        float vign=smoothstep(1.25,.15,length(p)); col*=.72+.28*vign; gl_FragColor=vec4(col,.28*vign);}`;
    const compile=(type:number,src:string)=>{const sh=gl.createShader(type)!;gl.shaderSource(sh,src);gl.compileShader(sh);return sh;};
    const program=gl.createProgram()!; gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);gl.useProgram(program);
    const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,"p");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const timeLoc=gl.getUniformLocation(program,"uTime"),scrollLoc=gl.getUniformLocation(program,"uScroll"),seedLoc=gl.getUniformLocation(program,"uSeed"),resLoc=gl.getUniformLocation(program,"uRes");
    let scroll=window.scrollY,target=scroll,raf=0,start=performance.now(); const seed=hashPath(pathname||"/");
    const resize=()=>{const d=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.floor(innerWidth*d);canvas.height=Math.floor(innerHeight*d);gl.viewport(0,0,canvas.width,canvas.height);};
    const onScroll=()=>{target=window.scrollY;}; resize(); addEventListener("resize",resize,{passive:true});addEventListener("scroll",onScroll,{passive:true});
    const draw=(now:number)=>{scroll+=(target-scroll)*.065;gl.uniform1f(timeLoc,(now-start)/1000);gl.uniform1f(scrollLoc,scroll);gl.uniform1f(seedLoc,seed);gl.uniform2f(resLoc,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);raf=requestAnimationFrame(draw);}; raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);removeEventListener("scroll",onScroll);gl.deleteProgram(program);gl.deleteBuffer(buffer);};
  },[pathname]);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-90" />;
}
