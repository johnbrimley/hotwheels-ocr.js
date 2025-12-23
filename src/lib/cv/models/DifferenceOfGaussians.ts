import { ShaderDataConverter } from "../helpers/ShaderDataConverter";

/**
 * Represents a single Difference-of-Gaussians (DoG) sample
 * unpacked from an RGBA8 render target.
 *
 * The GPU packs the DoG value as a signed 32-bit integer
 * normalized to [-1, +1] and split across RGBA bytes.
 *
 * This class reverses that packing.
 */
export class DifferenceOfGaussians {
    public readonly value: number;

    /**
     * @param r Red   channel byte [0..255] (most significant byte)
     * @param g Green channel byte [0..255]
     * @param b Blue  channel byte [0..255]
     * @param a Alpha channel byte [0..255] (least significant byte)
     */
    constructor(
        r: number,
        g: number,
        b: number,
        a: number
    ) {
        this.value = ShaderDataConverter.unpackFloat32FromRGBA8(r, g, b, a);
    }

    static calculateGaussianWeights(sigma: number, kernelSize: number): Float32Array {
        const weights = new Float32Array(kernelSize);
        const halfSize = Math.floor(kernelSize / 2);
        const sigmaSquared = sigma * sigma;
        for (let i = -halfSize; i <= halfSize; i++) {
            const weight = Math.exp(-(i * i) / (2 * sigmaSquared));
            weights[i + halfSize] = weight;
        }
        return weights;
    }
}
