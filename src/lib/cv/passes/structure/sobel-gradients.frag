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

const float SOBEL_G_MAX   = 48.0;
const float SOBEL_MAG_MAX = 51.264022471905186;

float encodeSnorm8(float v)
{
    return clamp(v * 0.5 + 0.5, 0.0, 1.0);
}

vec2 encodeUNorm16(float v)
{
    float x = clamp(v, 0.0, 1.0);
    float hi = floor(x * 65535.0 / 256.0);
    float lo = floor(x * 65535.0 - hi * 256.0);
    return vec2(hi, lo) / 255.0;
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

    // Signed int8-normalized gx/gy
    float gxN = clamp(gx / SOBEL_G_MAX, -1.0, 1.0);
    float gyN = clamp(gy / SOBEL_G_MAX, -1.0, 1.0);

    float mag = length(vec2(gx, gy));
    float magN = mag / SOBEL_MAG_MAX;

    vec2 magBA = encodeUNorm16(magN);

    outColor = vec4(
        encodeSnorm8(gxN),
        encodeSnorm8(gyN),
        magBA.x,
        magBA.y
    );
}
