import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { LowCutoffPassSettings } from './LowCutoffPassSettings';
import lowCutoffFrag from './low-cutoff.frag?raw';

export class LowCutoffPass extends PassBase {
    private programInfo: twgl.ProgramInfo;
    private outputRenderTarget: RenderTarget2D;

    constructor(gl: WebGL2RenderingContext, settings: LowCutoffPassSettings) {
        super(gl, settings);
        this.programInfo = this.createProgramInfo(lowCutoffFrag);
        this.outputRenderTarget = RenderTarget2D.createRGBA8(gl);
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8 && !renderTargetIn.isRGBA8) {
            throw new Error('LowCutoffPass expects R8 or RGBA8 render targets');
        }
        this.executeProgram(this.programInfo, renderTargetIn, applyToScreen ? null : this.outputRenderTarget);
        return this.outputRenderTarget;
    }
}
