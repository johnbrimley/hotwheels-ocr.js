import type { PassBase } from "./passes/PassBase";
import { RenderTarget2D } from "./RenderTarget2D";

export abstract class ComputerVisionPipeline<TOutput = void> {
    protected passChain: PassBase[] = [];
    protected bitmapRenderTarget: RenderTarget2D;
    public gl: WebGL2RenderingContext;

    protected constructor(public canvas: HTMLCanvasElement | OffscreenCanvas) {
        const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
        if (!gl) {
            throw new Error('WebGL2 not available for pipeline');
        }
        this.gl = gl;
        this.bitmapRenderTarget = RenderTarget2D.createRGBA8(gl);
    }

    addPass(pass: PassBase): void {
        this.passChain.push(pass);
    }

    protected applyBitmap(texture: WebGLTexture, bitmap: ImageBitmap): void {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texSubImage2D(
            this.gl.TEXTURE_2D,
            0,
            0,
            0,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            bitmap
        );
    }

    protected resize(width: number, height: number): void {
        // @ts-ignore canvas width/height exist on both HTMLCanvasElement and OffscreenCanvas
        this.canvas.width = width;
        // @ts-ignore
        this.canvas.height = height;
        this.bitmapRenderTarget.resize(width, height);
    }

    protected postprocess(_finalTarget: RenderTarget2D): TOutput {
        return undefined as TOutput;
    }

    async render(bitmap: ImageBitmap): Promise<TOutput> {
        if ((this.canvas as any).width !== bitmap.width || (this.canvas as any).height !== bitmap.height) {
            this.resize(bitmap.width, bitmap.height);
        }

        this.applyBitmap(this.bitmapRenderTarget.texture, bitmap);

        const enabledPasses = this.passChain.filter(p => p.enabled);

        if (enabledPasses.length === 0) {
            throw new Error('No passes in pipeline');
        }

        let renderTarget: RenderTarget2D = this.bitmapRenderTarget;
        for (let i = 0; i < enabledPasses.length - 1; i++) {
            const pass = enabledPasses[i];
            renderTarget = pass.apply(renderTarget);
        }
        const finalPass = enabledPasses[enabledPasses.length - 1];
        const finalTarget = finalPass.applyToScreen(renderTarget) ?? renderTarget;

        return this.postprocess(finalTarget);
    }
}
