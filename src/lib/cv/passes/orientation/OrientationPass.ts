import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { OrientationPassSettings } from './OrientationPassSettings';
import orientationFrag from './orientation.frag?raw';

export class OrientationPass extends PassBase {
    private programInfo: twgl.ProgramInfo;
    private outputRenderTarget: RenderTarget2D;

    constructor(gl: WebGL2RenderingContext, settings: OrientationPassSettings) {
        super(gl, settings);
        this.programInfo = this.createProgramInfo(orientationFrag);
        this.outputRenderTarget = RenderTarget2D.createR8(gl);
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8) {
            throw new Error('OrientationPass expects R8 render targets');
        }
        this.executeProgram(this.programInfo, renderTargetIn, applyToScreen ? null : this.outputRenderTarget);
        return this.outputRenderTarget;
    }
}
