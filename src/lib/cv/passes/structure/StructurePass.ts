import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { StructurePassSettings } from './StructurePassSettings';
import sobelGradientsFrag from './sobel-gradients.frag?raw';
import sobelVectorsFrag from './sobel-vectors.frag?raw';
import dogFrag from './dog.frag?raw';
import neighborScoringFrag from './neighbor-scoring.frag?raw';
import { draw } from 'svelte/transition';
import { type Metadata } from './metadata';
import { ContinuityScore } from '../../models/ContinuityScore';
import { DifferenceOfGaussians } from '../../models/DifferenceOfGaussians';
import { ShaderDataConverter } from '../../helpers/ShaderDataConverter';
import { Histogram } from '../../helpers/Histogram';


export class StructurePass extends PassBase {
    private sobelGradientsProgramInfo: twgl.ProgramInfo;
    private sobelGradientsRenderTarget: RenderTarget2D;
    private sobelGradientsRGBAData: Uint8Array = new Uint8Array();

    private sobelVectorsProgramInfo: twgl.ProgramInfo;
    private sobelVectorsRenderTarget: RenderTarget2D;

    private neighborScoringProgramInfo: twgl.ProgramInfo;
    private neighborScoringRenderTarget: RenderTarget2D;
    private neighborScoringRGBAData: Uint8Array = new Uint8Array();
    private continuityScores: ContinuityScore[] = [];

    private metadata: Metadata[] = [];

    private debugProgramInfo: twgl.ProgramInfo;
    private debugRenderTarget: RenderTarget2D;
    private debugQuadBufferInfo: twgl.BufferInfo;

    private debugFragmentShaderSource =
        `
#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_input;

out vec4 outColor;

void main() {
outColor = texture(u_input, v_uv);
}
`;

    constructor(gl: WebGL2RenderingContext, private sobelPassSettings: StructurePassSettings) {
        super(gl, sobelPassSettings);

        this.sobelGradientsProgramInfo = this.createProgramInfo(sobelGradientsFrag);
        this.sobelGradientsRenderTarget = RenderTarget2D.createRGBA8(gl);

        this.sobelGradientsProgramInfo = this.createProgramInfo(sobelGradientsFrag);
        this.sobelGradientsRenderTarget = RenderTarget2D.createRGBA8(gl);

        this.sobelVectorsProgramInfo = this.createProgramInfo(sobelVectorsFrag);
        this.sobelVectorsRenderTarget = RenderTarget2D.createRGBA8(gl);

        this.neighborScoringProgramInfo = this.createProgramInfo(neighborScoringFrag);
        this.neighborScoringRenderTarget = RenderTarget2D.createRGBA8(gl);

        this.debugProgramInfo = this.createProgramInfo(this.debugFragmentShaderSource);
        this.debugRenderTarget = RenderTarget2D.createRGBA8(gl);
        this.debugQuadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl);
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8) {
            throw new Error('StructurePass expects R8 target');
        }
        this.executeProgram(this.sobelGradientsProgramInfo, renderTargetIn, this.sobelGradientsRenderTarget);
        this.executeProgram(this.sobelVectorsProgramInfo, this.sobelGradientsRenderTarget, this.sobelVectorsRenderTarget);
        this.executeNeighborScoring();
        this.buildMetadata();
        this.drawJunk(this.neighborScoringRenderTarget.framebufferInfo.width, this.neighborScoringRenderTarget.framebufferInfo.height);
        return this.neighborScoringRenderTarget;
    }


    private drawJunk(width: number, height: number): void {
        let count = 0;
        this.metadata.sort((a, b) => {
            const dc = b.continuityScore.score - a.continuityScore.score;
            if (Math.abs(dc) > 0.01) return dc;
            return b.magnitude - a.magnitude;
        });
        
        const lumaArray = new Float32Array(this.metadata.length);
        
        for (let i = 0; i < this.metadata.length; i++) {
            const seed = this.metadata[i];
        
            if (seed.visited) continue;
            if (seed.continuityScore.score < 0.96) break;
        
            let cur = seed;
        
            while (
                cur &&
                !cur.visited &&
                cur.continuityScore.score > 0.8 &&
                cur.magnitude > 0.04
            ) {
                cur.visited = true;
                lumaArray[cur.index] = cur.magnitude;
                count++;
        
                const nextIdx = cur.nextContinuityScoreIndex;
                if (nextIdx < 0) break;
        
                cur = this.metadata[nextIdx];
            }
        }
        console.log(`StructurePass: drew ${count} pixels in structure lines`);
        this.drawLumaArray(
            this.gl,
            this.debugProgramInfo,
            this.debugRenderTarget,
            width,
            height,
            lumaArray,
            false
        );
    }

    private executeNeighborScoring(): void {
        this.executeProgram(this.neighborScoringProgramInfo, this.sobelVectorsRenderTarget, this.neighborScoringRenderTarget);
        const width = this.neighborScoringRenderTarget.framebufferInfo.width;
        const height = this.neighborScoringRenderTarget.framebufferInfo.height;
        this.neighborScoringRGBAData = this.readRGBA8Framebuffer(this.gl, this.neighborScoringRenderTarget.framebufferInfo.framebuffer, width, height, this.neighborScoringRGBAData);
        if (this.continuityScores.length < width * height) {
            this.continuityScores = new Array(width * height);
        }
        for (let i = 0; i < width * height; i++) {
            const rgbaIndex = i * 4;
            const r = this.neighborScoringRGBAData[rgbaIndex + 0];
            const g = this.neighborScoringRGBAData[rgbaIndex + 1];
            const b = this.neighborScoringRGBAData[rgbaIndex + 2];
            const a = this.neighborScoringRGBAData[rgbaIndex + 3];
            this.continuityScores[i] = new ContinuityScore(r, g, b, a);
        }
    }

    private buildMetadata() {
        const width = this.neighborScoringRenderTarget.framebufferInfo.width;
        const height = this.neighborScoringRenderTarget.framebufferInfo.height;

        if (this.metadata.length < width * height) {
            this.metadata = new Array(width * height);
        }

        this.sobelGradientsRGBAData =
            this.readRGBA8Framebuffer(
                this.gl,
                this.sobelGradientsRenderTarget.framebufferInfo.framebuffer,
                width,
                height,
                this.sobelGradientsRGBAData
            );

        for (let i = 0; i < width * height; i++) {
            const rgbaIndex = i * 4;

            const b = this.sobelGradientsRGBAData[rgbaIndex + 2];
            const a = this.sobelGradientsRGBAData[rgbaIndex + 3];
            const magnitude = ((b << 8) | a) / 65535.0;

            const cs = this.continuityScores[i];

            let nextIndex = -1;

            if (cs.neighborXOffset !== 0 || cs.neighborYOffset !== 0) {
                const x = i % width;
                const y = (i / width) | 0;

                const nx = x + cs.neighborXOffset;
                const ny = y + cs.neighborYOffset;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    nextIndex = ny * width + nx;
                }
            }

            this.metadata[i] = {
                index: i,
                visited: false,
                continuityScore: cs,
                nextContinuityScoreIndex: nextIndex,
                magnitude,
                score: cs.score * magnitude
            };
            // let maxMagnitude = 0;
            // let minMagnitude = Number.POSITIVE_INFINITY;
            // let maxScore = 0;
            // let minScore = Number.POSITIVE_INFINITY;
            // for(let i = 0; i < width * height; i++){
            //     const meta = this.metadata[i];
            //     const cs = this.continuityScores[i];
            //     if(meta.magnitude > maxMagnitude) maxMagnitude = meta.magnitude;
            //     if(meta.magnitude < minMagnitude) minMagnitude = meta.magnitude;
            //     if(cs.score > maxScore) maxScore = cs.score;
            //     if(cs.score < minScore) minScore = cs.score;
            // }
        }
    }

    private readRGBA8Framebuffer(
        gl: WebGL2RenderingContext,
        framebuffer: WebGLFramebuffer,
        width: number,
        height: number,
        target?: Uint8Array
    ) {
        if (!target || target.length < width * height * 4) {
            target = new Uint8Array(width * height * 4);
        }

        // Bind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)

        // Ensure correct pack alignment
        gl.pixelStorei(gl.PACK_ALIGNMENT, 1)

        // Read pixels
        gl.readPixels(
            0,
            0,
            width,
            height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            target
        )

        // Unbind (optional but good hygiene)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return target;
    }

    private drawLumaArray(
        gl: WebGLRenderingContext,
        programInfo: twgl.ProgramInfo,
        renderTarget: RenderTarget2D,
        width: number,
        height: number,
        luma: Float32Array | number[],
        showHue: boolean = false
    ) {
        const rgba = new Uint8Array(width * height * 4);

        if (!showHue) {
            // -------- Grayscale path --------
            for (let i = 0; i < width * height; i++) {
                const v = Math.max(0, Math.min(1, luma[i])) * 255;
                const o = i * 4;
                rgba[o + 0] = v;
                rgba[o + 1] = v;
                rgba[o + 2] = v;
                rgba[o + 3] = 255;
            }
        } else {
            // -------- Hue visualization path --------
            for (let i = 0; i < width * height; i++) {
                const v = Math.max(0, Math.min(1, luma[i]));
                const hue = v * 360.0;

                const [r, g, b] = StructurePass.hsvToRgb(hue, 1.0, 1.0);

                const o = i * 4;
                rgba[o + 0] = r;
                rgba[o + 1] = g;
                rgba[o + 2] = b;
                rgba[o + 3] = 255;
            }
        }

        // Upload texture
        gl.bindTexture(gl.TEXTURE_2D, renderTarget.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            rgba
        );

        // Draw fullscreen quad
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);

        gl.useProgram(programInfo.program);

        twgl.setBuffersAndAttributes(gl, programInfo, this.quadBufferInfo);
        twgl.setUniforms(programInfo, {
            u_input: renderTarget.texture,
        });

        twgl.drawBufferInfo(gl, this.quadBufferInfo);
    }


    static hsvToRgb(h: number, s: number, v: number): [number, number, number] {
        const c = v * s;
        const hp = h / 60;
        const x = c * (1 - Math.abs((hp % 2) - 1));

        let r = 0, g = 0, b = 0;

        if (hp < 1) [r, g, b] = [c, x, 0];
        else if (hp < 2) [r, g, b] = [x, c, 0];
        else if (hp < 3) [r, g, b] = [0, c, x];
        else if (hp < 4) [r, g, b] = [0, x, c];
        else if (hp < 5) [r, g, b] = [x, 0, c];
        else[r, g, b] = [c, 0, x];

        const m = v - c;
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255),
        ];
    }


}
