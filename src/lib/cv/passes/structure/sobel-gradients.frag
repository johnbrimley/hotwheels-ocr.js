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

// Assumes input luma ∈ [0,1]
const float SOBEL_G_MAX = 48.0;

vec4 packHalf2ToRGBA8LittleEndian(vec2 v)
{
    uint p = packHalf2x16(v);

    return vec4(
        float( p        & 0xFFu),
        float((p >> 8)  & 0xFFu),
        float((p >> 16) & 0xFFu),
        float((p >> 24) & 0xFFu)
    ) / 255.0;
}

void main()
{
    float gx = 0.0;
    float gy = 0.0;

    for (int y = 0; y < 5; y++)
    {
        for (int x = 0; x < 5; x++)
        {
            vec2 o = vec2(float(x - 2), float(y - 2)) * u_texelSize;
            float l = texture(u_input, v_uv + o).r;

            gx += l * sobelDerivative[x] * sobelSmoothing[y];
            gy += l * sobelSmoothing[x] * sobelDerivative[y];
        }
    }

    // Linear normalization (NOT unit length)
    vec2 gN = vec2(gx, gy) / SOBEL_G_MAX;

    // Clamp to representable range
    gN = clamp(gN, -1.0, 1.0);

    // Store as two half-floats packed into RGBA8
    outColor = packHalf2ToRGBA8LittleEndian(gN);
}
