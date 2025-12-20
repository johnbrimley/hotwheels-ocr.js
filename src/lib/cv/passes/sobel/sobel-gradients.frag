#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;
uniform vec2      u_texelSize;

out vec4 outColor;

const float sobelDerivative[5] = float[5](
    -2.0, -1.0, 0.0, 1.0, 2.0
);

const float sobelSmoothing[5] = float[5](
     1.0,  4.0, 6.0, 4.0, 1.0
);

const float SOBEL_DIRECTION_NORMALIZATION = 48.0;

void main()
{
    float gradientX = 0.0;
    float gradientY = 0.0;

    for (int offsetY = 0; offsetY < 5; offsetY++)
    {
        for (int offsetX = 0; offsetX < 5; offsetX++)
        {
            vec2 sampleOffset =
                vec2(float(offsetX - 2), float(offsetY - 2)) * u_texelSize;

            float sampleLuma =
                texture(u_input, v_uv + sampleOffset).r;

            gradientX +=
                sampleLuma *
                sobelDerivative[offsetX] *
                sobelSmoothing[offsetY];

            gradientY +=
                sampleLuma *
                sobelSmoothing[offsetX] *
                sobelDerivative[offsetY];
        }
    }

    // Normalize to [-1, +1]
    float gxNorm = gradientX / SOBEL_DIRECTION_NORMALIZATION;
    float gyNorm = gradientY / SOBEL_DIRECTION_NORMALIZATION;

    // Map to [0, 65535]
    float gxU16 = (gxNorm * 0.5 + 0.5) * 65535.0;
    float gyU16 = (gyNorm * 0.5 + 0.5) * 65535.0;

    // Split into bytes
    float gxHigh = floor(gxU16 / 256.0);
    float gxLow  = mod(gxU16, 256.0);

    float gyHigh = floor(gyU16 / 256.0);
    float gyLow  = mod(gyU16, 256.0);

    // Store as normalized bytes
    outColor = vec4(
        gxHigh / 255.0,
        gxLow  / 255.0,
        gyHigh / 255.0,
        gyLow  / 255.0
    );
}
