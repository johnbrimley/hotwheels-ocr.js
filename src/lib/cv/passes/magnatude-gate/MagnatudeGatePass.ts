import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { MagnatudeGatePassSettings } from './MagnatudeGatePassSettings';
import magnatudeGateFrag from './magnatude-gate.frag?raw';

export class MagnatudeGatePass extends PassBase {
    private programInfo: twgl.ProgramInfo;
    private outputRenderTarget: RenderTarget2D;

    constructor(gl: WebGL2RenderingContext, settings: MagnatudeGatePassSettings) {
        super(gl, settings);
        this.programInfo = this.createProgramInfo(magnatudeGateFrag);
        this.outputRenderTarget = RenderTarget2D.createRGBA8(gl);
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8 && !renderTargetIn.isRGBA8) {
            throw new Error('MagnatudeGatePass expects R8 or RGBA8 render targets');
        }
        this.executeProgram(this.programInfo, renderTargetIn, applyToScreen ? null : this.outputRenderTarget);
        return this.outputRenderTarget;
    }
}
