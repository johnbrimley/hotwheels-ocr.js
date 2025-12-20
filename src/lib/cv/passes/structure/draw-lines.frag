#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_lines;      // 1D texture: (theta, rho, _, _)
uniform vec2      u_imageSize;  // (width, height)

const int   MAX_LINES = 8;
const float HALF_THICKNESS = 2.5; // 5px total thickness

void main() {

    // pixel coordinates
    float px = v_uv.x * (u_imageSize.x - 1.0);
    float py = v_uv.y * (u_imageSize.y - 1.0);

    // normalized y in [-1,1]
    float yNorm = v_uv.y * 2.0 - 1.0;

    float hit = 0.0;

    for (int i = 0; i < MAX_LINES; i++) {

        vec4 line = texelFetch(u_lines, ivec2(i, 0), 0);

        float theta = line.r;
        float rho   = line.g;

        float cosT = cos(theta);
        float sinT = sin(theta);

        // avoid divide-by-zero branchlessly
        float invCosT = cosT / (cosT * cosT + 1e-6);

        // predicted x (normalized)
        float xNorm = (rho - yNorm * sinT) * invCosT;

        // to pixel space
        float xPix = (xNorm * 0.5 + 0.5) * (u_imageSize.x - 1.0);

        // distance test (branchless)
        float dx = abs(xPix - px);

        float lineHit = 1.0 - step(HALF_THICKNESS, dx);

        hit = max(hit, lineHit);
    }

    outColor = vec4(hit, hit, hit, 1.0);
}
