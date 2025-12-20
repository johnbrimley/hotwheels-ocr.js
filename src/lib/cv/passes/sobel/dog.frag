#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;      // Input luma texture (luma in .r)
uniform vec2      u_texelSize;  // 1.0 / texture resolution

uniform float u_sigmaSmall;
uniform float u_sigmaLarge;

out vec4 outColor;

/*
    Hard cap to keep footprint bounded.
*/
const float MAX_SIGMA_LARGE = 3.0;
const int   GAUSSIAN_RADIUS = 9;

void main()
{
    float sigmaSmall = u_sigmaSmall;
    float sigmaLarge = min(u_sigmaLarge, MAX_SIGMA_LARGE);

    float invTwoSigmaSmallSq =
        1.0 / (2.0 * sigmaSmall * sigmaSmall);

    float invTwoSigmaLargeSq =
        1.0 / (2.0 * sigmaLarge * sigmaLarge);

    float blurSmall = 0.0;
    float blurLarge = 0.0;

    float weightSumSmall = 0.0;
    float weightSumLarge = 0.0;

    for (int y = -GAUSSIAN_RADIUS; y <= GAUSSIAN_RADIUS; y++)
    {
        for (int x = -GAUSSIAN_RADIUS; x <= GAUSSIAN_RADIUS; x++)
        {
            vec2 offset =
                vec2(float(x), float(y)) * u_texelSize;

            float luma =
                texture(u_input, v_uv + offset).r;

            float distSq =
                float(x * x + y * y);

            float weightSmall =
                exp(-distSq * invTwoSigmaSmallSq);

            float weightLarge =
                exp(-distSq * invTwoSigmaLargeSq);

            blurSmall += luma * weightSmall;
            blurLarge += luma * weightLarge;

            weightSumSmall += weightSmall;
            weightSumLarge += weightLarge;
        }
    }

    blurSmall /= weightSumSmall;
    blurLarge /= weightSumLarge;

    // Difference of Gaussians
    float dog = blurSmall - blurLarge;

    /*
        dog ∈ [-1, +1] by construction.
        Map to signed 32-bit range.
    */
    float dogSigned32 =
        clamp(dog, -1.0, 1.0) * 2147483647.0;

    // Convert to unsigned for packing
    float dogUnsigned32 =
        dogSigned32 + 2147483648.0;

    // Split into 4 bytes (big-endian)
    float byteR = floor(dogUnsigned32 / 16777216.0);          // >> 24
    float byteG = floor(mod(dogUnsigned32 / 65536.0, 256.0)); // >> 16
    float byteB = floor(mod(dogUnsigned32 / 256.0, 256.0));   // >> 8
    float byteA = floor(mod(dogUnsigned32, 256.0));           // >> 0

    outColor = vec4(
        byteR / 255.0,
        byteG / 255.0,
        byteB / 255.0,
        byteA / 255.0
    );
}
