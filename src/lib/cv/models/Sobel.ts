/**
 * Represents unpacked Sobel gradient components for a single pixel.
 *
 * This class converts packed RGBA8 Sobel output back into
 * normalized gradient components in the range [-1, +1].
 *
 * No edge logic, no thresholds, no magnitude.
 * Intended for CPU-side line following.
 */
export class Sobel {
    public readonly gradientX: number;
    public readonly gradientY: number;

    /**
     * @param gradientXHighByte High byte of packed unsigned gradX
     * @param gradientXLowByte  Low byte of packed unsigned gradX
     * @param gradientYHighByte High byte of packed unsigned gradY
     * @param gradientYLowByte  Low byte of packed unsigned gradY
     */
    constructor(
        gradientXHighByte: number,
        gradientXLowByte: number,
        gradientYHighByte: number,
        gradientYLowByte: number
    ) {
        // Reconstruct unsigned 16-bit values
        const gradientXUnsigned16 =
            (gradientXHighByte << 8) | gradientXLowByte;

        const gradientYUnsigned16 =
            (gradientYHighByte << 8) | gradientYLowByte;

        // Map back from [0, 65535] to [-1, +1]
        this.gradientX =
            (gradientXUnsigned16 / 65535.0) * 2.0 - 1.0;

        this.gradientY =
            (gradientYUnsigned16 / 65535.0) * 2.0 - 1.0;
    }
}
