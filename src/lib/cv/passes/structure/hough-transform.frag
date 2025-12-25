#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;   // packed Sobel unit normals
uniform vec2      u_texelSize;

out vec4 outColor;

const float PI = 3.14159265358979323846;
const float TWO_PI = 6.28318530717958647692;

/* ---------- packing helpers ---------- */

vec2 unpackHalf2FromRGBA8LittleEndian(vec4 rgba)
{
    uvec4 b = uvec4(rgba * 255.0 + 0.5);
    uint packed =
          (b.x)
        | (b.y << 8)
        | (b.z << 16)
        | (b.w << 24);
    return unpackHalf2x16(packed);
}

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

/* ---------- main ---------- */

void main()
{
    // unit normal from Sobel
    vec2 n = unpackHalf2FromRGBA8LittleEndian(texture(u_input, v_uv));

    // pixel-space position, origin at image center
    vec2 p = (v_uv - 0.5) / u_texelSize;

    // signed normal-form Hough parameters
    float theta = atan(n.y, n.x);          // (-π, π]
    float rho   = dot(p, n);               // signed

    // map theta -> [0, 2π)
    theta = mod(theta + TWO_PI, TWO_PI);

    // max rho = distance from center to corner
    vec2  dims   = vec2(1.0 / u_texelSize.x, 1.0 / u_texelSize.y);
    float rhoMax = 0.5 * length(dims);

    // normalize
    float thetaNorm = theta / TWO_PI;      // [0, 1)
    float rhoNorm   = rho / rhoMax;        // [-1, 1]

    outColor = packHalf2ToRGBA8LittleEndian(vec2(thetaNorm, rhoNorm));
}
