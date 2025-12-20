#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;
uniform vec2      u_texelSize;
uniform float     u_diagonalWeakening; // [0,1]

out vec4 outColor;

/* Fixed 5x5 Sobel (true 5x5). */
const float d5[5] = float[5](
    -2.0, -1.0, 0.0, 1.0, 2.0
);

const float s5[5] = float[5](
     1.0, 4.0, 6.0, 4.0, 1.0
);

void main() {
    vec2 uv = v_uv;
    vec2 t  = u_texelSize;

    float gradX = 0.0;
    float gradY = 0.0;

    const float PI    = 3.14159265359;
    const float SQRT2 = 1.41421356237;

    for (int y = 0; y < 5; ++y) {
        for (int x = 0; x < 5; ++x) {
            vec2 offset = vec2(float(x - 2), float(y - 2)) * t;
            float luma  = texture(u_input, uv + offset).r;

            gradX += luma * d5[x] * s5[y];
            gradY += luma * s5[x] * d5[y];
        }
    }

    vec2 g = vec2(gradX, gradY);
    float mag = length(g);

    // --- theta ---
    float theta = atan(g.y, g.x);
    theta = mod(theta + PI, PI);       // [0, PI)
    float thetaNorm = theta / PI;      // [0,1)

    // --- axis / diagonal gating (linear, CPU-visible) ---
    // distance to nearest axis (0 or PI/2), normalized
    float d = min(thetaNorm, abs(thetaNorm - 0.5));

    // allowed angular half-width
    float halfWidth = 0.25 * (1.0 - u_diagonalWeakening);

    // axisAllowed flag: 1 = keep, 0 = reject
    float axisAllowed = step(d, halfWidth);

    // --- rho ---
    vec2 pos = v_uv * 2.0 - 1.0;
    vec2 n   = vec2(cos(theta), sin(theta));
    float rho = dot(pos, n);

    // map rho [-√2, √2] → [0,1]
    float rhoNorm = clamp((rho + SQRT2) / (2.0 * SQRT2), 0.0, 1.0);

    // quantize rho to 8 bits (this matches 128-bin usage)
    float rhoByte = floor(rhoNorm * 255.0 + 0.5) / 255.0;

    // --- magnitude ---
    float magNorm = clamp(mag, 0.0, 1.0);

    // --- output ---
    outColor = vec4(
        thetaNorm,   // R : theta
        rhoByte,     // G : rho (8-bit)
        magNorm,     // B : magnitude
        axisAllowed  // A : flags (0 or 1)
    );
}
