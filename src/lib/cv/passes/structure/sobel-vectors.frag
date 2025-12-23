#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;

out vec4 outColor;

// --- decoders ---

float decodeSnorm8(float v)
{
    return v * 2.0 - 1.0;
}

float decodeUNorm16(vec2 ba)
{
    float hi = ba.x * 255.0;
    float lo = ba.y * 255.0;
    return (hi * 256.0 + lo) / 65535.0;
}

// --- half pack ---

vec4 packHalf2x16ToRGBA8(float x, float y)
{
    uint bits = packHalf2x16(vec2(x, y));

    return vec4(
        float((bits >> 24) & 0xFFu) / 255.0,
        float((bits >> 16) & 0xFFu) / 255.0,
        float((bits >>  8) & 0xFFu) / 255.0,
        float((bits >>  0) & 0xFFu) / 255.0
    );
}

void main()
{
    vec4 packed = texture(u_input, v_uv);

    // Decode signed gradients (normalized)
    float gx = decodeSnorm8(packed.r);
    float gy = decodeSnorm8(packed.g);

    // Decode normalized magnitude (optional use)
    float mag = decodeUNorm16(packed.ba);

    // Protect against zero vector
    float len = max(length(vec2(gx, gy)), 1e-6);

    vec2 dir = vec2(gx, gy) / len;

    // Store direction as half floats
    outColor = packHalf2x16ToRGBA8(dir.x, dir.y);
}
