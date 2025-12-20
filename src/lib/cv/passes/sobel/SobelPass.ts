import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { SobelPassSettings } from './SobelPassSettings';
import sobelFrag from './sobel.frag?raw';
import { draw } from 'svelte/transition';
import drawLineFrag from './draw-lines.frag?raw';

export class SobelPass extends PassBase {
    private sobelProgramInfo: twgl.ProgramInfo;
    private lineProgramInfo: twgl.ProgramInfo;
    private sobelRenderTarget: RenderTarget2D;
    private outputRenderTarget: RenderTarget2D;
    private sobelArray: Uint8Array;
    private magAndCountBuckets: Float32Array;
    private strengthBuckets: Float32Array;
    private suppressedStrengthIndicesBuckets: Uint8Array;
    private strengthIndicesBuckets: Uint16Array;
    private displayArray: Uint8Array;

    private lineTexture: WebGLTexture | null = null;
    private readonly MAX_LINES = 6;
    private consoleCounter = 0;

    constructor(gl: WebGL2RenderingContext, private sobelPassSettings: SobelPassSettings) {
        super(gl, sobelPassSettings);
        this.sobelProgramInfo = this.createProgramInfo(sobelFrag);
        this.lineProgramInfo = this.createProgramInfo(drawLineFrag);
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
        const topX = [];
        for (let i = 0; i < 4; i++) {
            if (this.consoleCounter % 111 === 0) {
                console.log('Peak', i, peaks[i]);
            }
            topX.push(peaks[i]);

        }
        this.drawLines(box);
        this.consoleCounter++;
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
    
        const thetaBins = 64;
        const rhoBins   = 128;
    
        const thetaCenter = thetaBins >> 1; // 32
        const rhoCenter   = rhoBins >> 1;   // 64
    
        let verticalLeft:  { thetaIndex: number; rhoIndex: number; strength: number } | null = null;
        let verticalRight: { thetaIndex: number; rhoIndex: number; strength: number } | null = null;
        let horizontalAbove: { thetaIndex: number; rhoIndex: number; strength: number } | null = null;
        let horizontalBelow: { thetaIndex: number; rhoIndex: number; strength: number } | null = null;
    
        for (const p of peaks) {
            const ti = p.thetaIndex;
            const ri = p.rhoIndex;
    
            // distance to vertical (0 or 63)
            const distToVertical = Math.min(
                ti,
                thetaBins - ti
            );
    
            // distance to horizontal (32)
            const distToHorizontal = Math.abs(ti - thetaCenter);
    
            if (distToVertical < distToHorizontal) {
                // mostly vertical
                if (ri < rhoCenter) {
                    if (!verticalLeft || p.strength > verticalLeft.strength) {
                        verticalLeft = p;
                    }
                } else {
                    if (!verticalRight || p.strength > verticalRight.strength) {
                        verticalRight = p;
                    }
                }
            } else {
                // mostly horizontal
                if (ri < rhoCenter) {
                    if (!horizontalAbove || p.strength > horizontalAbove.strength) {
                        horizontalAbove = p;
                    }
                } else {
                    if (!horizontalBelow || p.strength > horizontalBelow.strength) {
                        horizontalBelow = p;
                    }
                }
            }
        }
    
        if (this.consoleCounter % 111 === 0) {
            console.log('VLC', verticalLeft);
            console.log('VRC', verticalRight);
            console.log('HAC', horizontalAbove);
            console.log('HBC', horizontalBelow);
        }
    
        // return strongest from each quadrant (if present)
        const result: { thetaIndex: number; rhoIndex: number; strength: number }[] = [];
    
        if (verticalLeft)     result.push(verticalLeft);
        if (verticalRight)    result.push(verticalRight);
        if (horizontalAbove)  result.push(horizontalAbove);
        if (horizontalBelow)  result.push(horizontalBelow);
    
        return result;
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

        const gl = this.gl;

        const imgW = 640;
        const imgH = 480;

        const thetaBins = 64;
        const rhoBins = 128;

        const lineCount = Math.min(this.MAX_LINES, peaks.length);

        // ---------------------------------------------------------------------
        // 1) Build CPU-side line array (RGBA32F, width = MAX_LINES, height = 1)
        // ---------------------------------------------------------------------
        const lineData = new Float32Array(this.MAX_LINES * 4);

        for (let i = 0; i < lineCount; i++) {
            const { thetaIndex, rhoIndex } = peaks[i];

            const theta =
                (thetaIndex + 0.5) / thetaBins * Math.PI;

            const rho =
                ((rhoIndex + 0.5) / rhoBins) * (2 * Math.SQRT2) - Math.SQRT2;

            const base = i * 4;
            lineData[base + 0] = theta;
            lineData[base + 1] = rho;
            lineData[base + 2] = 0.0;
            lineData[base + 3] = 0.0;
        }

        // zero unused slots
        for (let i = lineCount; i < this.MAX_LINES; i++) {
            const base = i * 4;
            lineData[base + 0] = 0.0;
            lineData[base + 1] = 0.0;
            lineData[base + 2] = 0.0;
            lineData[base + 3] = 0.0;
        }

        // ---------------------------------------------------------------------
        // 2) Create / update 1D texture for lines
        // ---------------------------------------------------------------------
        if (!this.lineTexture) {
            this.lineTexture = gl.createTexture()!;
            gl.bindTexture(gl.TEXTURE_2D, this.lineTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA32F,
                this.MAX_LINES,
                1,
                0,
                gl.RGBA,
                gl.FLOAT,
                lineData
            );
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.lineTexture);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                0, 0,
                this.MAX_LINES,
                1,
                gl.RGBA,
                gl.FLOAT,
                lineData
            );
        }

        // ---------------------------------------------------------------------
        // 3) Bind output render target
        // ---------------------------------------------------------------------
        if (
            this.outputRenderTarget.framebufferInfo.width !== imgW ||
            this.outputRenderTarget.framebufferInfo.height !== imgH
        ) {
            this.outputRenderTarget.resize(imgW, imgH);
        }

        twgl.bindFramebufferInfo(gl, this.outputRenderTarget.framebufferInfo);
        gl.viewport(0, 0, imgW, imgH);

        // ---------------------------------------------------------------------
        // 4) Draw fullscreen quad with line shader
        // ---------------------------------------------------------------------
        gl.useProgram(this.lineProgramInfo.program);

        twgl.setBuffersAndAttributes(
            gl,
            this.lineProgramInfo,
            this.quadBufferInfo
        );

        twgl.setUniforms(this.lineProgramInfo, {
            u_lines: this.lineTexture,
            u_imageSize: [imgW, imgH]
        });

        twgl.drawBufferInfo(gl, this.quadBufferInfo);
    }


}
