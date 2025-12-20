import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { StructurePassSettings } from './StructurePassSettings';
import sobelGradientsFrag from './sobel-gradients.frag?raw';
import dogFrag from './dog.frag?raw';
import { draw } from 'svelte/transition';


export class StructurePass extends PassBase {
    private sobelGradientsProgramInfo: twgl.ProgramInfo;
    private sobelGradientsRenderTarget: RenderTarget2D;

    private dogProgramInfo: twgl.ProgramInfo;
    private dogRenderTarget: RenderTarget2D;

    constructor(gl: WebGL2RenderingContext, private sobelPassSettings: StructurePassSettings) {
        super(gl, sobelPassSettings);

        this.sobelGradientsProgramInfo = this.createProgramInfo(sobelGradientsFrag);
        this.sobelGradientsRenderTarget = RenderTarget2D.createRGBA8(gl);

        this.dogProgramInfo = this.createProgramInfo(dogFrag);
        this.dogRenderTarget = RenderTarget2D.createRGBA8(gl);
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8) {
            throw new Error('SobelPass expects R8 or RGBA8 render targets');
        }
        this.executeProgram(this.sobelGradientsProgramInfo, renderTargetIn, applyToScreen ? null : this.sobelGradientsRenderTarget);
        //this.executeProgram(this.dogProgramInfo, this.sobelGradientsRenderTarget, applyToScreen ? null : this.dogRenderTarget);

        return this.dogRenderTarget;
    }


}
