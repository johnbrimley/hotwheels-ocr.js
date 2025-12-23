#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;      // Input luma texture (luma in .r)
uniform vec2      u_texelSize;  // 1.0 / texture resolution

uniform float u_sigmaSmall;
uniform float u_sigmaLarge;

uniform float u_sigmaSmallWeights[19];
uniform float u_sigmaLargeWeights[19];

out vec4 outColor;

/*
    Hard cap to keep footprint bounded.
*/
const float MAX_SIGMA_LARGE = 3.0;
const int   GAUSSIAN_RADIUS = 9;

vec4 packFloatToRGBA8(float v)
{
    uint bits = floatBitsToUint(v);

    uint r = (bits >> 24) & 0xFFu;
    uint g = (bits >> 16) & 0xFFu;
    uint b = (bits >>  8) & 0xFFu;
    uint a = (bits >>  0) & 0xFFu;

    //vec4 expects floats so we still need to do this.
    return vec4(
        float(r) / 255.0,
        float(g) / 255.0,
        float(b) / 255.0,
        float(a) / 255.0
    );
}

void main()
{
    float sigmaSmall = u_sigmaSmall;
    float sigmaLarge = min(u_sigmaLarge, MAX_SIGMA_LARGE);

    float smallBlur = 0.0;
    float largeBlur = 0.0;
    for (int y = -GAUSSIAN_RADIUS; y <= GAUSSIAN_RADIUS; y++)
    {
        float smallBlurX = 0.0;
        float LargeBlurX = 0.0;
        float xLuma = 0.0;
        for (int x = -GAUSSIAN_RADIUS; x <= GAUSSIAN_RADIUS; x++)
        {
            vec2 offset = vec2(float(x) * u_texelSize.x, float(y) * u_texelSize.y);
            xLuma = texture(u_input, v_uv + offset).r;
            smallBlurX += xLuma * u_sigmaSmallWeights[x+GAUSSIAN_RADIUS];
            LargeBlurX += xLuma * u_sigmaLargeWeights[x+GAUSSIAN_RADIUS];
        }

        smallBlur += smallBlurX * u_sigmaSmallWeights[y+GAUSSIAN_RADIUS];
        largeBlur += LargeBlurX * u_sigmaLargeWeights[y+GAUSSIAN_RADIUS];
    }

    float dog = largeBlur - smallBlur;

    outColor = packFloatToRGBA8(dog);
}
