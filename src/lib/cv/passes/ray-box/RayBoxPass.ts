import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { RayBoxPassSettings } from './RayBoxPassSettings';
import boxOverlayFrag from './box-overlay.frag?raw';

type Point = { x: number; y: number };

export type RayBoxBox = { corners: Point[] };

export class RayBoxPass extends PassBase {
  private boxProgramInfo: twgl.ProgramInfo;
  private outputRenderTarget: RenderTarget2D;
  private pixelBuffer: Uint8Array | null = null;
  private pixelChannels = 0;
  public lastBox: RayBoxBox | null = null;

  constructor(gl: WebGL2RenderingContext, settings: RayBoxPassSettings) {
    super(gl, settings);
    this.boxProgramInfo = this.createProgramInfo(boxOverlayFrag);
    this.outputRenderTarget = RenderTarget2D.createRGBA8(gl);
  }

  /* ============================ Pixel Read ============================ */

  private ensurePixelBuffer(width: number, height: number, channels: number): void {
    const needed = width * height * channels;
    if (!this.pixelBuffer || this.pixelBuffer.length !== needed) {
      this.pixelBuffer = new Uint8Array(needed);
    }
    this.pixelChannels = channels;
  }

  private readPixelsToBuffer(rt: RenderTarget2D): { width: number; height: number } {
    const width = rt.framebufferInfo.width;
    const height = rt.framebufferInfo.height;
    const isR8 = rt.isR8;

    const format = isR8 ? this.gl.RED : this.gl.RGBA;
    const channels = isR8 ? 1 : 4;
    this.ensurePixelBuffer(width, height, channels);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, rt.framebufferInfo.framebuffer);
    this.gl.readPixels(0, 0, width, height, format, this.gl.UNSIGNED_BYTE, this.pixelBuffer!);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    return { width, height };
  }

  /* ============================ Sampling ============================ */
  // readPixels is bottom-left origin → flip Y here ONCE
  private sampleMax3x3(x: number, y: number, w: number, h: number): number {
    if (!this.pixelBuffer) return 0;

    const xi = Math.round(x);
    const yi = Math.round(y);
    let best = 0;

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const sx = Math.max(0, Math.min(w - 1, xi + ox));
        const syImg = Math.max(0, Math.min(h - 1, yi + oy));
        const sy = (h - 1) - syImg; // Y FLIP

        const idx = (sy * w + sx) * this.pixelChannels;
        const v = this.pixelBuffer[idx] / 255;
        if (v > best) best = v;
      }
    }

    return best;
  }

  /* ============================ Ray Cast ============================ */

  private findRayHits(
    width: number,
    height: number,
    threshold: number,
    rayCount: number,
    step: number
  ): Point[] {
    const cx = (width - 1) * 0.5;
    const cy = (height - 1) * 0.5;
    const hits: Point[] = [];

    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);

      const tx = dx > 0 ? (width - 1 - cx) / dx : dx < 0 ? -cx / dx : Infinity;
      const ty = dy > 0 ? (height - 1 - cy) / dy : dy < 0 ? -cy / dy : Infinity;
      const tMax = Math.min(tx, ty);
      if (!isFinite(tMax)) continue;

      for (let t = tMax; t >= 0; t -= step) {
        const x = cx + dx * t;
        const y = cy + dy * t;
        if (this.sampleMax3x3(x, y, width, height) >= threshold) {
          hits.push({
            x: x / (width - 1),
            y: y / (height - 1), // image-space (top-left)
          });
          break;
        }
      }
    }

    return hits;
  }

  /* ============================ PCA Box Fit ============================ */

  private computeOBBCorners(points: Point[], trimFraction: number): Point[] {
    if (points.length < 4) {
      const s = 0.25;
      return [
        { x: 0.5 - s, y: 0.5 - s },
        { x: 0.5 + s, y: 0.5 - s },
        { x: 0.5 + s, y: 0.5 + s },
        { x: 0.5 - s, y: 0.5 + s },
      ];
    }

    // centroid
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= points.length;
    cy /= points.length;

    // covariance
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of points) {
      const x = p.x - cx;
      const y = p.y - cy;
      sxx += x * x;
      sxy += x * y;
      syy += y * y;
    }

    const tr = sxx + syy;
    const det = sxx * syy - sxy * sxy;
    const root = Math.sqrt(Math.max(0, tr * tr - 4 * det));
    const lambda = (tr + root) * 0.5;

    let ux = sxy;
    let uy = lambda - sxx;
    const len = Math.hypot(ux, uy) || 1;
    ux /= len;
    uy /= len;

    const vx = -uy;
    const vy = ux;

    const us: number[] = [];
    const vs: number[] = [];

    for (const p of points) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      us.push(dx * ux + dy * uy);
      vs.push(dx * vx + dy * vy);
    }

    us.sort((a, b) => a - b);
    vs.sort((a, b) => a - b);

    const trim = Math.floor(us.length * Math.min(Math.max(trimFraction, 0), 0.45));
    const u0 = us[trim];
    const u1 = us[us.length - 1 - trim];
    const v0 = vs[trim];
    const v1 = vs[vs.length - 1 - trim];

    const corners = [
      { x: cx + u0 * ux + v0 * vx, y: cy + u0 * uy + v0 * vy },
      { x: cx + u1 * ux + v0 * vx, y: cy + u1 * uy + v0 * vy },
      { x: cx + u1 * ux + v1 * vx, y: cy + u1 * uy + v1 * vy },
      { x: cx + u0 * ux + v1 * vx, y: cy + u0 * uy + v1 * vy },
    ];

    for (const c of corners) {
      c.x = Math.max(0, Math.min(1, c.x));
      c.y = Math.max(0, Math.min(1, c.y));
    }

    return corners;
  }

  /* ============================ Apply ============================ */

  protected applyInternal(rt: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
    const settings = this.settings as RayBoxPassSettings;
    const { width, height } = this.readPixelsToBuffer(rt);

    const hits = this.findRayHits(
      width,
      height,
      settings.threshold,
      Math.max(32, settings.rayCount),
      settings.step
    );

    const corners = this.computeOBBCorners(hits, settings.trimFraction);
    this.lastBox = { corners };

    // Flip Y ONCE when sending to shader
    this.settings.uniforms.u_corners = [
      corners[0].x, 1 - corners[0].y,
      corners[1].x, 1 - corners[1].y,
      corners[2].x, 1 - corners[2].y,
      corners[3].x, 1 - corners[3].y,
    ];

    this.settings.uniforms.u_thickness = 1.5 / Math.max(width, height);
    this.settings.uniforms.u_input = rt.texture;

    this.executeProgram(
      this.boxProgramInfo,
      rt,
      applyToScreen ? null : this.outputRenderTarget
    );

    return this.outputRenderTarget;
  }
}
