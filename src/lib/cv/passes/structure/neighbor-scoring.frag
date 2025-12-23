#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input; //these are the sobel vectors
uniform sampler2D u_dogs;
uniform vec2      u_texelSize;
uniform float     u_dogThreshold;

out vec4 outColor;

vec2 unpackRGBA8ToHalf2x16(vec4 rgba)
{
    uint r = uint(round(rgba.r * 255.0));
    uint g = uint(round(rgba.g * 255.0));
    uint b = uint(round(rgba.b * 255.0));
    uint a = uint(round(rgba.a * 255.0));

    uint bits =
        (r << 24) |
        (g << 16) |
        (b <<  8) |
        (a <<  0);

    return unpackHalf2x16(bits);
}

float unpackRGBA8ToFloat(vec4 rgba)
{
    // Convert normalized [0,1] back to bytes
    uint r = uint(round(rgba.r * 255.0));
    uint g = uint(round(rgba.g * 255.0));
    uint b = uint(round(rgba.b * 255.0));
    uint a = uint(round(rgba.a * 255.0));

    // Reassemble uint32 (must match pack order!)
    uint bits =
        (r << 24) |
        (g << 16) |
        (b <<  8) |
        (a <<  0);

    // Reinterpret bits as float
    return uintBitsToFloat(bits);
}

vec3 packUnorm24(float v)
{
    v = clamp(v, 0.0, 1.0);

    uint u = uint(round(v * 16777215.0)); // 2^24 - 1

    return vec3(
        float((u >> 16) & 0xFFu) / 255.0,
        float((u >>  8) & 0xFFu) / 255.0,
        float((u >>  0) & 0xFFu) / 255.0
    );
}

const vec2 offsets[8] = vec2[8]
(
    vec2(-1.0,-1.0),
    vec2(-1.0,0.0),
    vec2(-1.0,1.0),
    vec2(0.0,-1.0),
    vec2(0.0,1.0),
    vec2(1.0,-1.0),
    vec2(1.0,0.0),
    vec2(1.0,1.0)
);

void main(){
    vec4 pixel = texture(u_input, v_uv).rgba;
    vec2 centerVectors = unpackRGBA8ToHalf2x16(pixel);
    vec2 centerTangent = vec2(-centerVectors.y, centerVectors.x);
    float dog = unpackRGBA8ToFloat(pixel);

    float maxCosine = 0.0;
    float direction = 0.0;
    float maxDirection =  0.0;

    for(int di = 0; di < 8; di++)
    {
            vec2 unitOffset = offsets[di];
            vec2 uvOffset = unitOffset * u_texelSize;
            vec4 neighborPixel = texture(u_input, v_uv + uvOffset).rgba;
            vec2 neighborVectors = unpackRGBA8ToHalf2x16(neighborPixel);
            float neighborDog = unpackRGBA8ToFloat(neighborPixel);

            //this is like our total agreement but it's not directional
            float cosine = abs(dot(centerVectors, neighborVectors));

             // Forward-only mask (1 if forward, 0 otherwise)
            float forward = step(1e-6, dot(centerTangent, unitOffset));

            // Gate the score
            cosine *= forward;

            // Branchless argmax
            float take = step(maxCosine, cosine);

            maxCosine    = mix(maxCosine, cosine, take);
            maxDirection = mix(maxDirection, direction, take);

            direction += 1.0;
    }

    vec3 scoreRGB = packUnorm24(maxCosine);

    outColor = vec4(
        maxDirection / 255.0, // R
        scoreRGB.r,           // G
        scoreRGB.g,           // B
        scoreRGB.b            // A
    );
}
