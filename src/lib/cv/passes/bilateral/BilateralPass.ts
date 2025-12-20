import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { BilateralPassSettings } from './BilateralPassSettings';
import bilateralFrag from './bilateral.frag?raw'

export class BilateralPass extends PassBase {
    private bilateralProgramInfo: twgl.ProgramInfo;
    private outputRenderTarget: RenderTarget2D;
    constructor(gl: WebGL2RenderingContext, settings: BilateralPassSettings) {
        super(gl, settings);
        this.bilateralProgramInfo = this.createProgramInfo(bilateralFrag);
        this.outputRenderTarget = RenderTarget2D.createR8(gl);
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8) {
            throw new Error('BilateralPass only supports R8 render targets');
        }        
        this.executeProgram(this.bilateralProgramInfo, renderTargetIn, applyToScreen ? null : this.outputRenderTarget);
        return this.outputRenderTarget;
    }
}