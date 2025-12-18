import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { BilateralPassSettings } from './BilateralPassSettings';
import bilateralFrag from './bilateral.frag?raw'

export class BilateralPass extends PassBase {
    private colorBilateralProgramInfo: twgl.ProgramInfo;
    private outputRenderTarget: RenderTarget2D;
    constructor(gl: WebGL2RenderingContext, settings: BilateralPassSettings) {
        super(gl, settings);
        this.colorBilateralProgramInfo = this.createProgramInfo(bilateralFrag);
        this.outputRenderTarget = RenderTarget2D.createRGBA8(gl);
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isRGBA8) {
            throw new Error('ColorBilateralPass only supports RGBA8 render targets');
        }
        this.executeProgram(this.colorBilateralProgramInfo, renderTargetIn, applyToScreen ? null : this.outputRenderTarget);
        return this.outputRenderTarget;
    }
}