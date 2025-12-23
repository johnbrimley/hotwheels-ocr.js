#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;
uniform vec2      u_texelSize;

out vec4 outColor;

vec2 unpackHalf2FromRGBA8LittleEndian(vec4 rgba)
{
    // Convert normalized [0,1] back to integer bytes
    uvec4 b = uvec4(rgba * 255.0 + 0.5);

    uint packed =
          (b.x)
        | (b.y << 8)
        | (b.z << 16)
        | (b.w << 24);

    return unpackHalf2x16(packed);
}

vec4 packFloatToRGBA8LittleEndian(float v)
{
    uint bits = floatBitsToUint(v);

    return vec4(
        float( bits        & 0xFFu),
        float((bits >> 8)  & 0xFFu),
        float((bits >> 16) & 0xFFu),
        float((bits >> 24) & 0xFFu)
    ) / 255.0;
}



void main()
{
    vec4 packed = texture(u_input, v_uv);
    vec2 gNorm = unpackHalf2FromRGBA8LittleEndian(packed);

    float magNorm = length(gNorm);

    outColor = packFloatToRGBA8LittleEndian(magNorm);
}
