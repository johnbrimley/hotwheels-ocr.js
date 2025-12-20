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
        /*
            Reconstruct unsigned 32-bit integer.
            Use >>> 0 to force unsigned arithmetic.
        */
        const unsigned32 =
            ((r << 24) >>> 0) |
            (g << 16) |
            (b << 8)  |
            a;

        /*
            Convert back to signed 32-bit integer.
            Range: [-2147483648, +2147483647]
        */
        const signed32 =
            unsigned32 - 0x80000000;

        /*
            Normalize back to [-1, +1].

            Note:
            We divide by 2147483647.0 (INT32_MAX),
            which matches the shader packing.
        */
        this.value =
            signed32 / 2147483647.0;
    }
}
