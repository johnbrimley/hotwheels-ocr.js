#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;   // R8 luma
uniform vec2 u_texelSize;

uniform float u_sigmaSpatial;
uniform float u_sigmaRange;
uniform int   u_radius;      // must be <= MAX_RADIUS

out vec4 outColor;

const int MAX_RADIUS = 5;

void main() {
    vec2 uv = v_uv;

    float center = texture(u_input, uv).r;

    float sum = 0.0;
    float weightSum = 0.0;

    float invSpatial2 = 1.0 / (2.0 * u_sigmaSpatial * u_sigmaSpatial);
    float invRange2   = 1.0 / (2.0 * u_sigmaRange   * u_sigmaRange);

    for (int y = -MAX_RADIUS; y <= MAX_RADIUS; ++y) {
        for (int x = -MAX_RADIUS; x <= MAX_RADIUS; ++x) {

            // branchless radius mask
            float mx = step(float(abs(x)), float(u_radius));
            float my = step(float(abs(y)), float(u_radius));
            float mask = mx * my;

            vec2 offset = vec2(float(x), float(y)) * u_texelSize;
            float sample = texture(u_input, uv + offset).r;

            float spatialDist2 = float(x * x + y * y);
            float rangeDist2   = (sample - center) * (sample - center);

            float w =
                exp(-spatialDist2 * invSpatial2) *
                exp(-rangeDist2   * invRange2) *
                mask;

            sum       += sample * w;
            weightSum += w;
        }
    }

    // weightSum is guaranteed > 0 because center tap always included
    float result = sum / weightSum;

    outColor = vec4(result, result, result, 1.0);
}
