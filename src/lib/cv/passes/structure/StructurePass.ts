import * as twgl from 'twgl.js';
import { RenderTarget2D } from '../../RenderTarget2D';
import { PassBase } from '../PassBase';
import type { StructurePassSettings } from './StructurePassSettings';
import sobelGradientsFrag from './sobel-gradients.frag?raw';
import sobelMagnitudeFrag from './sobel-magnitude.frag?raw';
import sobelVectorsFrag from './sobel-vectors.frag?raw';
import sobelContinuityFrag from './sobel-continuity.frag?raw';
import houghTransformFrag from './hough-transform.frag?raw';
import * as wasm from '../../../../wasm/hotwheels-ocr-wasm.js';


export class StructurePass extends PassBase {
    private sobelGradientsProgramInfo: twgl.ProgramInfo;
    private sobelGradientsRenderTarget: RenderTarget2D;

    private sobelMagnitudeProgramInfo: twgl.ProgramInfo;
    private sobelMagnitudeRenderTarget: RenderTarget2D;
    private sobelMagnitudeRGBAReadbackBuffer: Uint8Array;
    
    private sobelVectorsProgramInfo: twgl.ProgramInfo;
    private sobelVectorsRenderTarget: RenderTarget2D;

    private sobelContinuityProgramInfo: twgl.ProgramInfo;
    private sobelContinuityRenderTarget: RenderTarget2D;
    private sobelContinuityRGBAReadbackBuffer: Uint8Array;

    private houghTransformProgramInfo: twgl.ProgramInfo;
    private houghTransformRenderTarget: RenderTarget2D;
    private houghTransformRGBAReadbackBuffer: Uint8Array;

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

    constructor(gl: WebGL2RenderingContext, private structurePassSettings: StructurePassSettings) {
        super(gl, structurePassSettings);

        this.sobelGradientsProgramInfo = this.createProgramInfo(sobelGradientsFrag);
        this.sobelGradientsRenderTarget = RenderTarget2D.createRGBA8(gl);

        this.sobelMagnitudeProgramInfo = this.createProgramInfo(sobelMagnitudeFrag);
        this.sobelMagnitudeRenderTarget = RenderTarget2D.createRGBA8(gl);
        this.sobelMagnitudeRGBAReadbackBuffer = new Uint8Array();

        this.sobelVectorsProgramInfo = this.createProgramInfo(sobelVectorsFrag);
        this.sobelVectorsRenderTarget = RenderTarget2D.createRGBA8(gl);

        this.sobelContinuityProgramInfo = this.createProgramInfo(sobelContinuityFrag);
        this.sobelContinuityRenderTarget = RenderTarget2D.createRGBA8(gl);
        this.sobelContinuityRGBAReadbackBuffer = new Uint8Array();

        this.houghTransformProgramInfo = this.createProgramInfo(houghTransformFrag);
        this.houghTransformRenderTarget = RenderTarget2D.createRGBA8(gl);
        this.houghTransformRGBAReadbackBuffer = new Uint8Array();

        this.debugProgramInfo = this.createProgramInfo(this.debugFragmentShaderSource);
        this.debugRenderTarget = RenderTarget2D.createRGBA8(gl);
        this.debugQuadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl);
    }

    public applyInternal(renderTargetIn: RenderTarget2D, applyToScreen: boolean): RenderTarget2D {
        if (!renderTargetIn.isR8) {
            throw new Error('StructurePass expects R8 target');
        }
        this.executeProgram(this.sobelGradientsProgramInfo, renderTargetIn, this.sobelGradientsRenderTarget);
        this.executeProgram(this.sobelMagnitudeProgramInfo, this.sobelGradientsRenderTarget, this.sobelMagnitudeRenderTarget);
        this.executeSobelVectors();
        this.executeSobelContinuity();
        this.executeProgram(this.houghTransformProgramInfo, this.sobelVectorsRenderTarget, this.houghTransformRenderTarget);
        
        this.houghTransformRGBAReadbackBuffer = this.readRGBA8Framebuffer(
            this.gl,
            this.houghTransformRenderTarget.framebufferInfo.framebuffer,
            this.houghTransformRenderTarget.framebufferInfo.width,
            this.houghTransformRenderTarget.framebufferInfo.height,
            this.houghTransformRGBAReadbackBuffer
        )

        this.sobelMagnitudeRGBAReadbackBuffer = this.readRGBA8Framebuffer(
            this.gl,
            this.sobelMagnitudeRenderTarget.framebufferInfo.framebuffer,
            this.sobelMagnitudeRenderTarget.framebufferInfo.width,
            this.sobelMagnitudeRenderTarget.framebufferInfo.height,
            this.sobelMagnitudeRGBAReadbackBuffer
        )

        this.sobelContinuityRGBAReadbackBuffer = this.readRGBA8Framebuffer(
            this.gl,
            this.sobelContinuityRenderTarget.framebufferInfo.framebuffer,
            this.sobelContinuityRenderTarget.framebufferInfo.width,
            this.sobelContinuityRenderTarget.framebufferInfo.height,
            this.sobelContinuityRGBAReadbackBuffer
        );

        const lumaBuffer = wasm.draw(this.structurePassSettings.toRustStruct(), this.sobelMagnitudeRGBAReadbackBuffer, this.sobelContinuityRGBAReadbackBuffer, this.houghTransformRGBAReadbackBuffer);

        this.drawLumaArray(
            this.gl,
            this.debugProgramInfo,
            this.debugRenderTarget,
            this.sobelMagnitudeRenderTarget.framebufferInfo.width,
            this.sobelMagnitudeRenderTarget.framebufferInfo.height,
            lumaBuffer
        );

        

        return this.sobelContinuityRenderTarget;
    }
    
    private executeSobelVectors():void{
        this.settings.uniforms['u_magnitude'] = this.sobelMagnitudeRenderTarget.texture;
        this.executeProgram(
            this.sobelVectorsProgramInfo,
            this.sobelGradientsRenderTarget,
            this.sobelVectorsRenderTarget
        );
    }

    private executeSobelContinuity():void{
        this.settings.uniforms['u_magnitude'] = this.sobelMagnitudeRenderTarget.texture;
        this.executeProgram(
            this.sobelContinuityProgramInfo,
            this.sobelVectorsRenderTarget,
            this.sobelContinuityRenderTarget
        );
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
        luma: Float32Array | number[],
        showHue: boolean = false
    ) {
        if(this.gl.canvas.width !== width || this.gl.canvas.height !== height){
            this.gl.canvas.width = width;
            this.gl.canvas.height = height;
        }

        const rgba = new Uint8Array(width * height * 4);

        if (!showHue) {
            // -------- Grayscale path --------
            for (let i = 0; i < width * height; i++) {
                const v = Math.max(0, Math.min(1, luma[i])) * 255;
                const o = i * 4;
                rgba[o + 0] = v;
                rgba[o + 1] = v;
                rgba[o + 2] = v;
                rgba[o + 3] = 255;
            }
        } else {
            // -------- Hue visualization path --------
            for (let i = 0; i < width * height; i++) {
                const v = Math.max(0, Math.min(1, luma[i]));
                const hue = v * 360.0;

                const [r, g, b] = StructurePass.hsvToRgb(hue, 1.0, 1.0);

                const o = i * 4;
                rgba[o + 0] = r;
                rgba[o + 1] = g;
                rgba[o + 2] = b;
                rgba[o + 3] = 255;
            }
        }

        // Upload texture
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

        // Draw fullscreen quad
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);

        gl.useProgram(programInfo.program);

        twgl.setBuffersAndAttributes(gl, programInfo, this.quadBufferInfo);
        twgl.setUniforms(programInfo, {
            u_input: renderTarget.texture,
        });

        twgl.drawBufferInfo(gl, this.quadBufferInfo);
    }


    static hsvToRgb(h: number, s: number, v: number): [number, number, number] {
        const c = v * s;
        const hp = h / 60;
        const x = c * (1 - Math.abs((hp % 2) - 1));

        let r = 0, g = 0, b = 0;

        if (hp < 1) [r, g, b] = [c, x, 0];
        else if (hp < 2) [r, g, b] = [x, c, 0];
        else if (hp < 3) [r, g, b] = [0, c, x];
        else if (hp < 4) [r, g, b] = [0, x, c];
        else if (hp < 5) [r, g, b] = [x, 0, c];
        else[r, g, b] = [c, 0, x];

        const m = v - c;
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255),
        ];
    }


}
