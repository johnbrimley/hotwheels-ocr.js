#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input; // sobel unit vectors (half2 packed)
uniform sampler2D u_dogs;  // DoG scalar (float packed)
uniform vec2      u_texelSize;
uniform float     u_dogThreshold;

out vec4 outColor;

// ---------- unpack helpers ----------

vec2 unpackRGBA8ToHalf2x16(vec4 rgba)
{
    uint r = uint(round(rgba.r * 255.0));
    uint g = uint(round(rgba.g * 255.0));
    uint b = uint(round(rgba.b * 255.0));
    uint a = uint(round(rgba.a * 255.0));

    uint bits = (r << 24) | (g << 16) | (b << 8) | a;
    return unpackHalf2x16(bits);
}

float unpackRGBA8ToFloat(vec4 rgba)
{
    uint r = uint(round(rgba.r * 255.0));
    uint g = uint(round(rgba.g * 255.0));
    uint b = uint(round(rgba.b * 255.0));
    uint a = uint(round(rgba.a * 255.0));

    uint bits = (r << 24) | (g << 16) | (b << 8) | a;
    return uintBitsToFloat(bits);
}

vec3 packUnorm24(float v)
{
    v = clamp(v, 0.0, 1.0);
    uint u = uint(round(v * 16777215.0));

    return vec3(
        float((u >> 16) & 0xFFu) / 255.0,
        float((u >>  8) & 0xFFu) / 255.0,
        float((u >>  0) & 0xFFu) / 255.0
    );
}

// ---------- neighbor offsets ----------

const vec2 offsets[8] = vec2[8](
    vec2(-1,-1), vec2(-1,0), vec2(-1,1),
    vec2( 0,-1),             vec2( 0,1),
    vec2( 1,-1), vec2( 1,0), vec2( 1,1)
);

void main()
{
    // Center data
    vec2 centerVec = unpackRGBA8ToHalf2x16(texture(u_input, v_uv));
    float centerDog = unpackRGBA8ToFloat(texture(u_dogs, v_uv));
    vec2 centerTangent = vec2(-centerVec.y, centerVec.x);

    float maxScore = 0.0;
    float bestDir  = 0.0;

    for (int i = 0; i < 8; i++)
    {
        vec2 uv = v_uv + offsets[i] * u_texelSize;

        vec2 nVec = unpackRGBA8ToHalf2x16(texture(u_input, uv));
        float nDog = unpackRGBA8ToFloat(texture(u_dogs, uv));

        // Directional agreement
        float cosine = abs(dot(centerVec, nVec));

        // Forward-only
        float forward = step(1e-6, dot(centerTangent, offsets[i]));

        // DoG filters
        float sameSign = step(0.0, centerDog * nDog);
        float strong   = step(u_dogThreshold, abs(nDog));

        cosine *= forward;// * sameSign;// * strong;

        float take = step(maxScore, cosine);

        maxScore = mix(maxScore, cosine, take);
        bestDir  = mix(bestDir, float(i), take);
    }

    vec3 scoreRGB = packUnorm24(maxScore);

    outColor = vec4(
        bestDir / 255.0, // direction index
        scoreRGB.r,
        scoreRGB.g,
        scoreRGB.b
    );
}
