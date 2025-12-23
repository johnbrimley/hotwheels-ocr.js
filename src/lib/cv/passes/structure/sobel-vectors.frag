#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input; //gradients
uniform sampler2D u_magnitude

out vec4 outColor;

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

float unpackFloatFromRGBA8LittleEndian(vec4 rgba)
{
    // Recover integer bytes with round-to-nearest
    uvec4 b = uvec4(rgba * 255.0 + 0.5);

    uint bits =
          (b.x)
        | (b.y << 8)
        | (b.z << 16)
        | (b.w << 24);

    return uintBitsToFloat(bits);
}

void main()
{
    vec4 gradientsPacked = texture(u_input, v_uv);
    vec4 magnitudePacked = texture(u_gradients, v_uv);

    vec2 gNorm = unpackHalf2FromRGBA8LittleEndian(gradientsPacked);
    float magNorm = unpackFloatFromRGBA8LittleEndian(magnitudePacked);

    magNorm = max(magNorm, 1e-6);

    vec2 unitVectors = clamp(gNorm / magNorm, -1.0,1.0);

    outColor = packHalf2ToRGBA8LittleEndian(unitVectors);
}
