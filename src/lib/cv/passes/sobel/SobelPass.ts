import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { SobelPassSettings } from './SobelPassSettings';
import sobelFrag from './sobel.frag?raw';

export class SobelPass extends PassBase {
    private sobelProgramInfo: twgl.ProgramInfo;
    private sobelRenderTarget: RenderTarget2D;
    private outputRenderTarget: RenderTarget2D;
    private sobelArray: Uint8Array;
    private magAndCountBuckets: Float32Array;
    private strengthBuckets: Float32Array;
    private suppressedStrengthIndicesBuckets: Uint8Array;
    private strengthIndicesBuckets: Uint16Array;
    private displayArray: Uint8Array;

    constructor(gl: WebGL2RenderingContext, private sobelPassSettings: SobelPassSettings) {
        super(gl, sobelPassSettings);
        this.sobelProgramInfo = this.createProgramInfo(sobelFrag);
        this.outputRenderTarget = RenderTarget2D.createRGBA8(gl);
        this.sobelRenderTarget = RenderTarget2D.createRGBA8(gl);
        this.sobelArray = new Uint8Array(0);
        this.magAndCountBuckets = new Float32Array(64 * 128 * 2); //theta * rho bins that store sum of magnitudes and counts
        this.strengthBuckets = new Float32Array(64 * 128); //final normalized strength values
        this.suppressedStrengthIndicesBuckets = new Uint8Array(64 * 128); //after non-maximum suppression
        this.strengthIndicesBuckets = new Uint16Array(64 * 128); //indices sorted by strength
        this.displayArray = new Uint8Array(640 * 480 * 4); //RGBA for display
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8 && !renderTargetIn.isRGBA8) {
            throw new Error('SobelPass expects R8 or RGBA8 render targets');
        }
        this.executeProgram(this.sobelProgramInfo, renderTargetIn, applyToScreen ? null : this.sobelRenderTarget);

        this.readIntoSobelArray(this.sobelRenderTarget);
        this.sortIntoBuckets();
        this.normalizeBuckets();
        this.updateStrengthBuckets();
        const peaks = this.findPeaks();
        const box = this.chooseBox(peaks);
        this.drawLines(peaks);

        return this.outputRenderTarget;
    }

    private sortIntoBuckets(): void {
        for (let i = 0; i < this.sobelArray.length; i += 4) {
            const theta = this.sobelArray[i] / 255.0;
            const rho = this.sobelArray[i + 1] / 255.0;
            const magnitude = this.sobelArray[i + 2] / 255.0;
            const flags = this.sobelArray[i + 3];
            if ((flags & 0x1) === 0) continue; //reject diagonal

            const thetaBin = Math.min((theta * 64) | 0, 63);
            const rhoBin = Math.min((rho * 128) | 0, 127);

            const index = (thetaBin * 128 + rhoBin) * 2;
            this.magAndCountBuckets[index] += magnitude;
            this.magAndCountBuckets[index + 1] += 1;
        }
    }


    private normalizeBuckets(): void {
        let maxMagnitude = 0;
        let maxCount = 0;
        //find max values
        for (let i = 0; i < this.magAndCountBuckets.length; i += 2) {
            const magnitudeSum = this.magAndCountBuckets[i];
            const count = this.magAndCountBuckets[i + 1];
            if (magnitudeSum > maxMagnitude) {
                maxMagnitude = magnitudeSum;
            }
            if (count > maxCount) {
                maxCount = count;
            }
        }
        //normalize to [0,1]
        for (let i = 0; i < this.magAndCountBuckets.length; i += 2) {
            this.magAndCountBuckets[i] = maxMagnitude > 0 ? this.magAndCountBuckets[i] / maxMagnitude : 0;
            this.magAndCountBuckets[i + 1] = maxCount > 0 ? this.magAndCountBuckets[i + 1] / maxCount : 0;
        }
    }

    private updateStrengthBuckets(): void {
        const magScale = this.sobelPassSettings.magnitudeScale;
        const lengthScale = this.sobelPassSettings.lengthScale;
        for (let i = 0; i < this.magAndCountBuckets.length; i += 2) {
            const magnitudeNorm = this.magAndCountBuckets[i];
            const countNorm = this.magAndCountBuckets[i + 1];
            //combine magnitude and count into a single strength value
            const strength = Math.sqrt(Math.pow(magnitudeNorm, magScale) * Math.pow(countNorm, lengthScale));
            this.strengthBuckets[i / 2] = strength;
        }
    }

    private findPeaks(): { thetaIndex: number; rhoIndex: number; strength: number; }[] {
        const peaks = [];

        this.suppressedStrengthIndicesBuckets.fill(0);
        for (let index = 0; index < this.strengthIndicesBuckets.length; index++) {
            this.strengthIndicesBuckets[index] = index;
        }
        //sort indices by strength descending
        this.strengthIndicesBuckets = this.strengthIndicesBuckets.sort((a, b) => {
            return this.strengthBuckets[b] - this.strengthBuckets[a];
        });

        const thetaBinCount = 64;
        const rhoBinCount = 128;

        const suppressedBuckets = this.suppressedStrengthIndicesBuckets;
        const bucketStrengths = this.strengthBuckets;
        const sortedBucketIndices = this.strengthIndicesBuckets;

        for (const peakLinearIndex of sortedBucketIndices) {

            // skip if this bucket was already claimed by a stronger peak
            if (suppressedBuckets[peakLinearIndex]) continue;

            let mergedPeakStrength = bucketStrengths[peakLinearIndex];
            suppressedBuckets[peakLinearIndex] = 1;

            // convert linear index → (theta, rho)
            const peakThetaIndex = (peakLinearIndex / rhoBinCount) | 0;
            const peakRhoIndex = peakLinearIndex % rhoBinCount;

            // search neighborhood in theta–rho space
            for (
                let thetaOffset = -this.sobelPassSettings.thetaRadius;
                thetaOffset <= this.sobelPassSettings.thetaRadius;
                thetaOffset++
            ) {
                // theta wraps (angular dimension)
                let neighborThetaIndex = peakThetaIndex + thetaOffset;
                if (neighborThetaIndex < 0) neighborThetaIndex += thetaBinCount;
                if (neighborThetaIndex >= thetaBinCount) neighborThetaIndex -= thetaBinCount;

                for (
                    let rhoOffset = -this.sobelPassSettings.rhoRadius;
                    rhoOffset <= this.sobelPassSettings.rhoRadius;
                    rhoOffset++
                ) {
                    // rho clamps (distance dimension)
                    const neighborRhoIndex = peakRhoIndex + rhoOffset;
                    if (neighborRhoIndex < 0 || neighborRhoIndex >= rhoBinCount) continue;

                    const neighborLinearIndex =
                        neighborThetaIndex * rhoBinCount + neighborRhoIndex;

                    if (suppressedBuckets[neighborLinearIndex]) continue;

                    mergedPeakStrength += bucketStrengths[neighborLinearIndex];
                    suppressedBuckets[neighborLinearIndex] = 1;
                }
            }

            peaks.push({
                thetaIndex: peakThetaIndex,
                rhoIndex: peakRhoIndex,
                strength: mergedPeakStrength
            });
        }
        peaks.sort((a, b) => b.strength - a.strength);
        return peaks;
    }

    private chooseBox(
        peaks: { thetaIndex: number; rhoIndex: number; strength: number; }[]
    ): { thetaIndex: number; rhoIndex: number; strength: number; }[] {

        if (peaks.length < 2) return [];

        const strongest = peaks[0];

        const rhoBins = 128;
        const thetaBins = 64;

        // mirror around center (signed rho, signed theta intuition)
        const expectedRho = (rhoBins - strongest.rhoIndex) % rhoBins;
        const expectedTheta = (thetaBins - strongest.thetaIndex) % thetaBins;

        let bestMatch: typeof strongest | null = null;
        let bestDistance = Infinity;

        for (let i = 1; i < peaks.length; i++) {
            const p = peaks[i];

            const dRho = Math.abs(p.rhoIndex - expectedRho);
            const dTheta = Math.abs(p.thetaIndex - expectedTheta);

            // simple L1 distance in Hough space
            const distance = dRho + dTheta;

            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = p;
            }
        }

        if (!bestMatch) return [strongest];
       

        return [strongest, bestMatch];
    }



    private readIntoSobelArray(renderTarget: RenderTarget2D): void {
        const w = renderTarget.framebufferInfo.width;
        const h = renderTarget.framebufferInfo.height;
        const size = w * h * 4; // RGB
        if (this.sobelArray.length !== size) {
            this.sobelArray = new Uint8Array(size);
        }
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget.framebufferInfo.framebuffer);
        gl.readPixels(
            0, 0,
            w, h,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.sobelArray
        );
    }

    private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: return [v, t, p];
            case 1: return [q, v, p];
            case 2: return [p, v, t];
            case 3: return [p, q, v];
            case 4: return [t, p, v];
            case 5: return [v, p, q];
            default: return [0, 0, 0];
        }
    }

    private drawLines(
        peaks: { thetaIndex: number; rhoIndex: number; strength: number }[]
    ): void {
    
        const imgW = 640;
        const imgH = 480;
    
        const thetaBins = 64;
        const rhoBins   = 128;
    
        // ensure render target size
        if (
            this.outputRenderTarget.framebufferInfo.width  !== imgW ||
            this.outputRenderTarget.framebufferInfo.height !== imgH
        ) {
            this.outputRenderTarget.resize(imgW, imgH);
        }
    
        // clear output
        this.displayArray.fill(0);
        for (let i = 3; i < this.displayArray.length; i += 4) {
            this.displayArray[i] = 255;
        }
    
        const maxLines = Math.min(8, peaks.length);
    
        for (let i = 0; i < maxLines; i++) {
            const { thetaIndex, rhoIndex, strength } = peaks[i];
    
            // --- bin → (theta, rho) ---
            const theta =
                (thetaIndex + 0.5) / thetaBins * Math.PI;
    
            const rho =
                ((rhoIndex + 0.5) / rhoBins) * (2 * Math.SQRT2) - Math.SQRT2;
    
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);
    
            // color by rank (unchanged)
            const hue = i / maxLines;
            const [rf, gf, bf] = this.hsvToRgb(hue, 1.0, 1.0);
    
            const R = (rf * 255) | 0;
            const G = (gf * 255) | 0;
            const B = (bf * 255) | 0;
    
            const thickness = Math.max(1, Math.floor(strength * 3));
    
            // --- find intersections with image bounds ---
            const points: { x: number; y: number }[] = [];
    
            const w = imgW - 1;
            const h = imgH - 1;
    
            // left (x = -1)
            if (Math.abs(sinTheta) > 1e-6) {
                const xNorm = -1;
                const yNorm = (rho - xNorm * cosTheta) / sinTheta;
                if (yNorm >= -1 && yNorm <= 1) {
                    points.push({
                        x: 0,
                        y: ((yNorm * 0.5 + 0.5) * h) | 0
                    });
                }
            }
    
            // right (x = +1)
            if (Math.abs(sinTheta) > 1e-6) {
                const xNorm = 1;
                const yNorm = (rho - xNorm * cosTheta) / sinTheta;
                if (yNorm >= -1 && yNorm <= 1) {
                    points.push({
                        x: w,
                        y: ((yNorm * 0.5 + 0.5) * h) | 0
                    });
                }
            }
    
            // top (y = -1)
            if (Math.abs(cosTheta) > 1e-6) {
                const yNorm = -1;
                const xNorm = (rho - yNorm * sinTheta) / cosTheta;
                if (xNorm >= -1 && xNorm <= 1) {
                    points.push({
                        x: ((xNorm * 0.5 + 0.5) * w) | 0,
                        y: 0
                    });
                }
            }
    
            // bottom (y = +1)
            if (Math.abs(cosTheta) > 1e-6) {
                const yNorm = 1;
                const xNorm = (rho - yNorm * sinTheta) / cosTheta;
                if (xNorm >= -1 && xNorm <= 1) {
                    points.push({
                        x: ((xNorm * 0.5 + 0.5) * w) | 0,
                        y: h
                    });
                }
            }
    
            if (points.length < 2) continue;
    
            const p0 = points[0];
            const p1 = points[1];
    
            // --- draw line segment (Bresenham) ---
            let x0 = p0.x;
            let y0 = p0.y;
            const x1 = p1.x;
            const y1 = p1.y;
    
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = x0 < x1 ? 1 : -1;
            const sy = y0 < y1 ? 1 : -1;
            let err = dx - dy;
    
            while (true) {
                for (let t = -thickness; t <= thickness; t++) {
                    const xx = x0 + t;
                    const yy = y0 + t;
                    if (xx >= 0 && xx < imgW && yy >= 0 && yy < imgH) {
                        const idx = (yy * imgW + xx) * 4;
                        this.displayArray[idx + 0] = R;
                        this.displayArray[idx + 1] = G;
                        this.displayArray[idx + 2] = B;
                        this.displayArray[idx + 3] = 255;
                    }
                }
    
                if (x0 === x1 && y0 === y1) break;
    
                const e2 = err << 1;
                if (e2 > -dy) { err -= dy; x0 += sx; }
                if (e2 <  dx) { err += dx; y0 += sy; }
            }
        }
    
        // upload to GPU
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.outputRenderTarget.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0, 0,
            imgW,
            imgH,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.displayArray
        );
    }    

}
