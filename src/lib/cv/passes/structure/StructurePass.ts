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
import { Countdown } from '../../helpers/CountDown';
import { ShaderDataConverter } from '../../helpers/ShaderDataConverter';
import { Histogram } from '../../helpers/Histogram';


export class StructurePass extends PassBase {
    private sobelGradientsProgramInfo: twgl.ProgramInfo;
    private sobelGradientsRenderTarget: RenderTarget2D;
    private sobelGradientsRGBAData: Uint8Array = new Uint8Array();

    private sobelVectorsProgramInfo: twgl.ProgramInfo;
    private sobelVectorsRenderTarget: RenderTarget2D;


    private dogProgramInfo: twgl.ProgramInfo;
    private dogRenderTarget: RenderTarget2D;
    private currentSigmaSmall: number = -1;
    private currentSigmaLarge: number = -1;
    private currentSigmaSmallWeights: Float32Array = new Float32Array(19);
    private currentSigmaLargeWeights: Float32Array = new Float32Array(19);
    private dogRGBAData: Uint8Array = new Uint8Array();
    private dogHistogram: Histogram = new Histogram(256, 0);
    private dogCountdown: Countdown;
    private dogPercentileThreshold: number = 0.0;

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

        this.dogProgramInfo = this.createProgramInfo(dogFrag);
        this.dogRenderTarget = RenderTarget2D.createRGBA8(gl);

        this.checkAndUpdateGaussianWeights();

        this.dogCountdown = new Countdown(30, this.recalculateDoGPercentiles.bind(this));

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
        this.executeDifferenceOfGaussians();
        this.executeNeighborScoring();
        this.buildMetadata();
        this.drawJunk(this.neighborScoringRenderTarget.framebufferInfo.width, this.neighborScoringRenderTarget.framebufferInfo.height);
        return this.dogRenderTarget;
    }

    private drawJunk(width: number, height: number): void {
        const lumaArray = new Float32Array(this.metadata.length);
        const best = 
            this.metadata.slice()
            .filter((p) => p.score > .1)
            .sort((a, b) => b.score - b.score);
        for (let i = 0; i < 50000; i++) {
            let current = best[i];
            let count = 100;
            while (count-- > 0 && current && current.score > .1) {
                lumaArray[current.index] = 1.0;
                current = this.metadata[current.nextContinuityScoreIndex!];
            }
        }
        this.drawLumaArray(
            this.gl,
            this.debugProgramInfo,
            this.debugRenderTarget,
            width,
            height,
            lumaArray
        );
    }

    private checkAndUpdateGaussianWeights() {
        const settings = this.settings as StructurePassSettings;
        if (this.currentSigmaSmall !== settings.sigmaSmall) {
            this.currentSigmaSmall = settings.sigmaSmall;
            this.currentSigmaSmallWeights = DifferenceOfGaussians.calculateGaussianWeights(settings.sigmaSmall, 19);
        }
        if (this.currentSigmaLarge !== settings.sigmaLarge) {
            this.currentSigmaLarge = settings.sigmaLarge;
            this.currentSigmaLargeWeights = DifferenceOfGaussians.calculateGaussianWeights(settings.sigmaLarge, 19);
        }
    }

    private executeDifferenceOfGaussians(): void {
        this.settings.uniforms['u_sigmaSmallWeights'] = this.currentSigmaSmallWeights;
        this.settings.uniforms['u_sigmaLargeWeights'] = this.currentSigmaLargeWeights;
        this.executeProgram(this.dogProgramInfo, this.sobelGradientsRenderTarget, this.dogRenderTarget);
        this.dogCountdown.tick(); // periodically recalc DoG percentiles
    }

    private executeNeighborScoring(): void {
        this.settings.uniforms['u_dogThreshold'] = this.dogPercentileThreshold;
        this.settings.uniforms['u_dogs'] = this.dogRenderTarget.texture;
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

    private recalculateDoGPercentiles(): void {
        const width = this.dogRenderTarget.framebufferInfo.width;
        const height = this.dogRenderTarget.framebufferInfo.height;
        this.dogRGBAData = this.readRGBA8Framebuffer(this.gl, this.dogRenderTarget.framebufferInfo.framebuffer, width, height, this.dogRGBAData);

        this.dogHistogram.reset(width * height);
        for (let i = 0; i < width * height; i++) {
            const rgbaIndex = i * 4;
            const r = this.dogRGBAData[rgbaIndex + 0];
            const g = this.dogRGBAData[rgbaIndex + 1];
            const b = this.dogRGBAData[rgbaIndex + 2];
            const a = this.dogRGBAData[rgbaIndex + 3];
            const dog = ShaderDataConverter.unpackFloat32FromRGBA8(r, g, b, a);
            this.dogHistogram.addValue(dog);
        }
        this.dogHistogram.calculate();
        this.dogPercentileThreshold = this.dogHistogram.getPercentile(0.1);
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
        luma: Float32Array | number[]
    ) {
        // 1. Convert luma → RGBA (Uint8)
        const rgba = new Uint8Array(width * height * 4);

        for (let i = 0; i < width * height; i++) {
            const v = Math.max(0, Math.min(1, luma[i])) * 255;
            const o = i * 4;
            rgba[o + 0] = v; // R
            rgba[o + 1] = v; // G
            rgba[o + 2] = v; // B
            rgba[o + 3] = 255; // A
        }

        // 2. Create or update texture
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

        // 3. Bind framebuffer (null = screen)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);

        // 4. Draw fullscreen quad
        gl.useProgram(programInfo.program);

        twgl.setBuffersAndAttributes(gl, programInfo, this.quadBufferInfo);
        twgl.setUniforms(programInfo, {
            u_input: renderTarget.texture,
        });

        twgl.drawBufferInfo(gl, this.quadBufferInfo);
    }


}
