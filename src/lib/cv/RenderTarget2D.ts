import * as twgl from 'twgl.js';
export class RenderTarget2D{
    public framebufferInfo: twgl.FramebufferInfo;
    public texture: WebGLTexture;

    get isRGBA8(): boolean{
        return this.internalFormat === this.gl.RGBA8 && this.format === this.gl.RGBA;
    }

    get isR8(): boolean{
        return this.internalFormat === this.gl.R8 && this.format === this.gl.RED;
    }

    private constructor(public gl: WebGL2RenderingContext, public internalFormat: number, public format: number, minMag: number){
        this.texture = twgl.createTexture(gl, {
            width: gl.canvas.width,
            height: gl.canvas.height,
            internalFormat: internalFormat,
            format: format,
            type: gl.UNSIGNED_BYTE,
            minMag: minMag,
            wrap: gl.CLAMP_TO_EDGE
        });
        this.framebufferInfo = twgl.createFramebufferInfo(gl, [{ attachment: this.texture }], gl.canvas.width, gl.canvas.height);
    }

    static createRGBA8(gl: WebGL2RenderingContext, minMag: number = gl.LINEAR): RenderTarget2D{
        return new RenderTarget2D(gl, gl.RGBA8, gl.RGBA, minMag);
    }

    static createRGB8(gl: WebGL2RenderingContext, minMag: number = gl.LINEAR): RenderTarget2D{
        return new RenderTarget2D(gl, gl.RGB8, gl.RGB, minMag);
    }

    static createR8(gl: WebGL2RenderingContext, minMag: number = gl.LINEAR): RenderTarget2D{
        return new RenderTarget2D(gl, gl.R8, gl.RED, minMag);
    }

    public resize(width: number, height: number): void{
        twgl.resizeTexture(this.gl, this.texture, { width: width, height: height });
        twgl.resizeFramebufferInfo(this.gl, this.framebufferInfo, [{ attachment: this.texture }], width, height);
    }
}