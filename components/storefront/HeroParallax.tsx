"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Depth-map parallax.
 *
 * One photo plus a grayscale depth map (scripts/depth.py). The shader walks
 * each pixel's UV along the cursor vector in proportion to its depth, so the
 * near table drifts further than the far wall and the room reads as layers
 * without anything ever having been cut into layers.
 *
 * No WebGL, or reduced motion: the plain <img> below carries the same framing.
 */

const COLOR_SRC = "/kroma_bg.webp";
const DEPTH_SRC = "/kroma_bg_depth.webp";
const IMAGE_ASPECT = 2560 / 1440;

/** UV units the nearest pixels travel at full cursor deflection. */
const STRENGTH_X = 0.03;
const STRENGTH_Y = 0.018;
/** Depth that stays put; everything nearer leads, everything further trails. */
const PIVOT = 0.45;
/** Oversample so displaced edges never reach past the texture. */
const ZOOM = 1.06;
/** Cursor easing — heavy enough to feel like the room has mass. */
const EASE = 0.045;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uOffset;
uniform float uCanvasAspect;
uniform float uImageAspect;

void main() {
  // object-cover: shrink the sampled range on whichever axis overflows.
  vec2 fit = uCanvasAspect > uImageAspect
    ? vec2(1.0, uImageAspect / uCanvasAspect)
    : vec2(uCanvasAspect / uImageAspect, 1.0);
  vec2 uv = (vUv - 0.5) * fit / ${ZOOM.toFixed(2)} + 0.5;

  // Fixed-point iteration: re-read depth where we land, then correct. Cheap
  // stand-in for ray marching, and it kills the smear a single tap leaves on
  // hard depth edges like the stair stringer.
  vec2 p = uv;
  for (int i = 0; i < 8; i++) {
    float d = texture2D(uDepth, p).r;
    p = uv + uOffset * (d - ${PIVOT.toFixed(2)});
  }

  gl_FragColor = texture2D(uColor, clamp(p, 0.0, 1.0));
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

function texture(gl: WebGLRenderingContext, image: HTMLImageElement) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // GL's origin is bottom-left
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return tex;
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`failed to load ${src}`));
    image.src = src;
  });
}

export function HeroParallax({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      setFallback(true);
      return;
    }

    let frame = 0;
    let disposed = false;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const onPointer = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
    };

    Promise.all([load(COLOR_SRC), load(DEPTH_SRC)])
      .then(([color, depth]) => {
        if (disposed) return;

        const program = gl.createProgram()!;
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
        }
        gl.useProgram(program);

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW,
        );
        const aPos = gl.getAttribLocation(program, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        texture(gl, color);
        gl.uniform1i(gl.getUniformLocation(program, "uColor"), 0);
        gl.activeTexture(gl.TEXTURE1);
        texture(gl, depth);
        gl.uniform1i(gl.getUniformLocation(program, "uDepth"), 1);

        const uOffset = gl.getUniformLocation(program, "uOffset");
        const uCanvasAspect = gl.getUniformLocation(program, "uCanvasAspect");
        gl.uniform1f(gl.getUniformLocation(program, "uImageAspect"), IMAGE_ASPECT);

        let width = 0;
        let height = 0;
        const resize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const next = {
            w: Math.round(canvas.clientWidth * dpr),
            h: Math.round(canvas.clientHeight * dpr),
          };
          if (next.w === width && next.h === height) return false;
          width = canvas.width = next.w;
          height = canvas.height = next.h;
          gl.viewport(0, 0, width, height);
          gl.uniform1f(uCanvasAspect, width / Math.max(height, 1));
          return true;
        };

        const render = () => {
          const dx = target.x - current.x;
          const dy = target.y - current.y;
          const moved = Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4;
          current.x += dx * EASE;
          current.y += dy * EASE;
          if (resize() || moved) {
            gl.uniform2f(uOffset, current.x * STRENGTH_X, current.y * STRENGTH_Y);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
          }
          frame = requestAnimationFrame(render);
        };

        resize();
        gl.uniform2f(uOffset, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        setReady(true);
        frame = requestAnimationFrame(render);

        window.addEventListener("pointermove", onPointer, { passive: true });
        document.addEventListener("pointerleave", onLeave);
      })
      .catch((error) => {
        if (disposed) return;
        console.error("hero parallax fell back to a still image:", error);
        setFallback(true);
      });

    // Deliberately no loseContext() here: a canvas element cannot recover a
    // lost context, and StrictMode remounts this effect onto the same one.
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  const still = reduced || fallback;

  return (
    <motion.div
      className={`absolute inset-0 ${className}`}
      initial={{ opacity: 0, scale: 1.06 }}
      animate={ready || still ? { opacity: 1, scale: 1 } : {}}
      transition={{ opacity: { duration: 1.1, ease: "easeOut" }, scale: { duration: 2.4, ease: [0.16, 1, 0.3, 1] } }}
    >
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={COLOR_SRC}
          alt=""
          onLoad={() => setReady(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <canvas ref={canvasRef} aria-hidden className="h-full w-full" />
      )}
    </motion.div>
  );
}
