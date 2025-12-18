import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { TemporalPassSettings } from './TemporalPassSettings';
import temporalFrag from './temporal.frag?raw';

export class TemporalPass extends PassBase {
    private programInfo: twgl.ProgramInfo;
    private outputRenderTarget: RenderTarget2D;
    private history: RenderTarget2D[] = [];
    private historyWriteIndex = 0;
    private historyInitialized = false;

    constructor(gl: WebGL2RenderingContext, settings: TemporalPassSettings) {
        super(gl, settings);
        this.programInfo = this.createProgramInfo(temporalFrag);
        this.outputRenderTarget = RenderTarget2D.createRGBA8(gl);
        this.history = [
            RenderTarget2D.createRGBA8(gl),
            RenderTarget2D.createRGBA8(gl),
            RenderTarget2D.createRGBA8(gl),
            RenderTarget2D.createRGBA8(gl),
        ];
    }

    private ensureHistorySized(width: number, height: number): void {
        for (const rt of this.history) {
            if (rt.framebufferInfo.width !== width || rt.framebufferInfo.height !== height) {
                rt.resize(width, height);
            }
        }
    }

    private copyToHistory(renderTargetIn: RenderTarget2D): void {
        const gl = this.gl;
        const writeTarget = this.history[this.historyWriteIndex];

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, renderTargetIn.framebufferInfo.framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, writeTarget.texture);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, renderTargetIn.framebufferInfo.width, renderTargetIn.framebufferInfo.height);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

        this.historyWriteIndex = (this.historyWriteIndex + 1) % this.history.length;
    }

    private seedHistory(renderTargetIn: RenderTarget2D): void {
        for (let i = 0; i < this.history.length; i++) {
            this.historyWriteIndex = i;
            this.copyToHistory(renderTargetIn);
        }
        this.historyInitialized = true;
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8 && !renderTargetIn.isRGBA8) {
            throw new Error('TemporalPass expects R8 or RGBA8 render targets');
        }

        this.ensureHistorySized(renderTargetIn.framebufferInfo.width, renderTargetIn.framebufferInfo.height);
        if (this.outputRenderTarget.framebufferInfo.width !== renderTargetIn.framebufferInfo.width ||
            this.outputRenderTarget.framebufferInfo.height !== renderTargetIn.framebufferInfo.height) {
            this.outputRenderTarget.resize(renderTargetIn.framebufferInfo.width, renderTargetIn.framebufferInfo.height);
        }

        if (!this.historyInitialized) {
            this.seedHistory(renderTargetIn);
        }

        this.settings.uniforms['u_frame1'] = this.history[0].texture;
        this.settings.uniforms['u_frame2'] = this.history[1].texture;
        this.settings.uniforms['u_frame3'] = this.history[2].texture;
        this.settings.uniforms['u_frame4'] = this.history[3].texture;

        this.executeProgram(this.programInfo, renderTargetIn, applyToScreen ? null : this.outputRenderTarget);

        this.copyToHistory(renderTargetIn);

        return this.outputRenderTarget;
    }
}
