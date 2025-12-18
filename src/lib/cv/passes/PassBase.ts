import * as twgl from 'twgl.js';
import type { RenderTarget2D } from '../RenderTarget2D';
import type { PassSettingsBase } from './PassSettingsBase';
import fullscreenQuadVert from './fullscreen-quad.vert?raw'


export abstract class PassBase {
    public enabled: boolean = true;
    protected quadBufferInfo: twgl.BufferInfo;
    protected constructor(protected gl: WebGL2RenderingContext, public settings: PassSettingsBase) {
        this.quadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl);
    }

    protected abstract applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D | null;
    
    public apply(renderTargetIn: RenderTarget2D): RenderTarget2D{
        return this.applyInternal(renderTargetIn, false)!;
    }
    public applyToScreen(renderTargetIn: RenderTarget2D): void{
        this.applyInternal(renderTargetIn, true);
    }

    protected executeProgram(programInfo: twgl.ProgramInfo, renderTargetIn: RenderTarget2D, renderTargetOut: RenderTarget2D | null, outboundTargetHasExplicitSize: boolean = false): void {
        //by default u_input is the input texture. We'll set it here.
        this.settings.input = renderTargetIn.texture;

        
        //many types use a textelSize uniform
        if(programInfo.uniformSetters['u_texelSize']){
            this.settings.setTextelSize(renderTargetIn.framebufferInfo.width, renderTargetIn.framebufferInfo.height);
        }

        //make sure the output render target is the correct size
        if (renderTargetOut && !outboundTargetHasExplicitSize) {
            if (renderTargetOut.framebufferInfo.width !== this.gl.canvas.width ||
                renderTargetOut.framebufferInfo.height !== this.gl.canvas.height) {
                renderTargetOut.resize(this.gl.canvas.width, this.gl.canvas.height);
            }
        }
        
        //If renderTargetOut is not specified, we are rendering to the screen
        const viewWidth = renderTargetOut ? renderTargetOut.framebufferInfo.width : this.gl.canvas.width;
        const viewHeight = renderTargetOut ? renderTargetOut.framebufferInfo.height : this.gl.canvas.height;
        if (renderTargetOut) {
            twgl.bindFramebufferInfo(this.gl, renderTargetOut.framebufferInfo);
        }
        else{
            twgl.bindFramebufferInfo(this.gl, null);
        }

        this.gl.useProgram(programInfo.program);

        this.gl.viewport(0, 0, viewWidth, viewHeight);

        twgl.setBuffersAndAttributes(this.gl, programInfo, this.quadBufferInfo);

        twgl.setUniforms(programInfo, this.settings.uniforms);

        twgl.drawBufferInfo(this.gl, this.quadBufferInfo);
    }

    protected createProgramInfo(fragmentShaderSource: string): twgl.ProgramInfo {
        return twgl.createProgramInfo(this.gl, [fullscreenQuadVert, fragmentShaderSource]);
    }
}