#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input; // sobel unit vectors (half2 packed)
uniform sampler2D u_magnitude; 
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

uint8 packDirections(uint8 pos, uint8 neg){
    return (pos << 4) | neg;
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

// ---------- neighbor offsets ----------

const vec2 offsets[8] = vec2[8](
    vec2(-1,-1), vec2(-1,0), vec2(-1,1),
    vec2( 0,-1),             vec2( 0,1),
    vec2( 1,-1), vec2( 1,0), vec2( 1,1)
);

const vec2 offsetDirs[8] = vec2[8](
    normalize(vec2(-1.0,-1.0)),
    vec2(-1.0, 0.0),
    normalize(vec2(-1.0, 1.0)),

    vec2( 0.0,-1.0),
    vec2( 0.0, 1.0),

    normalize(vec2( 1.0,-1.0)),
    vec2( 1.0, 0.0),
    normalize(vec2( 1.0, 1.0))
);

const float ARC_THRESHOLD = 0.382683432;

void main()
{
    // Center data
    vec2 centerVec = unpackHalf2FromRGBA8LittleEndian(texture(u_input, v_uv));
    vec2 centerTangent = vec2(-centerVec.y, centerVec.x);
    float centerMag = unpackFloatFromRGBA8LittleEndian(texture(u_magnitude, v_uv));
    centerMag = max(centerMag, 1e-6);

    //front and back here just refer to either side of the perimeter pixels.

    float bestFrontScore = 0.0;
    float bestFrontPosition = -1;
    float bestFrontIsPositive = 0;

    float bestBackScore = 0.0;
    float bestBackPosition = -1;

    for(int i = 0; i <4; i++){
        vec2 front_uv = v_uv + offsets[i] * u_texelSize;
        vec2 back_uv = v_uv + offsets[i+4] * u_texelSize;

        vec2 frontVec = unpackHalf2FromRGBA8LittleEndian(texture(u_input, front_uv));
        vec2 backVec = unpackHalf2FromRGBA8LittleEndian(texture(u_input, back_uv));

        float frontMag = unpackFloatFromRGBA8LittleEndian(texture(u_magnitude, front_uv));
        float backMag = unpackFloatFromRGBA8LittleEndian(texture(u_magnitude, back_uv));

        frontMag = max(frontMag, 1-e6);
        backMag = max(backMag, 1-e6);

        float frontCos = dot(centerVec, frontVec);
        float backCos = dot(centerVec, backVec);

        //works for both
        float frontDirectionCos = dot(centerTangent, offsetDirs[i]);
        float areEligible = step(ARC_THRESHOLD,abs(frontDirectionCos));

        float frontGradientAgrees = step(0.0, frontCos);
        float backGradientAgrees = step(0.0, backCos);

        float frontMagnitudeAgreement =
            min(centerMag, frontMag) / max(centerMag, frontMag);

        float backMagnitudeAgreement  =
            min(centerMag, backMag) / max(centerMag, backMag);

        frontScore = abs(frontCos) * frontMagnitudeAgreement * frontGradientAgrees * areEligible;
        backScore = abs(backCos) * backMagnitudeAgreement * backGradientAgrees * areEligible;

        float frontIsPositive = step(0.0, frontDirectionCos);

        float frontIsBetter = step(bestFrontScore, frontScore);
        float backIsBetter = step(bestBackScore, backScore);

        bestFrontScore = mix(bestFrontScore, frontScore, frontIsBetter);
        bestFrontPosition = mix(float(bestFrontPosition), float(i), frontIsBetter);
        bestFrontIsPositive = mix(bestFrontIsPositive, frontIsPositive, frontIsBetter);

        bestBackScore = mix(bestBackScore, backScore, backIsBetter);
        bestBackPosition = mix(float(bestBackPosition), float(i+4), backIsBetter);
    }

    float continuity = bestFrontScore * bestBackScore;

    //pack the directions into a byte.
    float positiveDirection = mix(bestBackPosition, bestFrontPosition, bestFrontIsPositive);
    float negativeDirection = mix(bestFrontPosition, bestBackPosition, bestFrontIsPositive);
    uint8 packedDirections = packDirections(positiveDirection, negativeDirection);

    outColor = vec4(
        packedDirections,
        0.0, //placeholders
        0.0,
        0.0
    )/255;



}
