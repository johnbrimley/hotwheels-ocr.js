import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { SobelPassSettings } from './SobelPassSettings';
import sobelGradientsFrag from './sobel-gradients.frag?raw';
import { draw } from 'svelte/transition';
import drawLineFrag from './draw-lines.frag?raw';

export class SobelPass extends PassBase {
    private sobelGradientsProgramInfo: twgl.ProgramInfo;
    private sobelGradientsRenderTarget: RenderTarget2D;

    constructor(gl: WebGL2RenderingContext, private sobelPassSettings: SobelPassSettings) {
        super(gl, sobelPassSettings);
        this.sobelGradientsProgramInfo = this.createProgramInfo(sobelGradientsFrag);
        this.sobelGradientsRenderTarget = RenderTarget2D.createRGBA8(gl);
       }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8) {
            throw new Error('SobelPass expects R8 or RGBA8 render targets');
        }
        this.executeProgram(this.sobelGradientsProgramInfo, renderTargetIn, applyToScreen ? null : this.sobelGradientsRenderTarget);

        return this.sobelGradientsRenderTarget;
    }

 
}
