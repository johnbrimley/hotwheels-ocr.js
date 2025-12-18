#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_input;   // Sobel magnitude (0..1)
uniform float u_threshold;

out vec4 outColor;

void main() {
    float strength = texture(u_input, v_uv).r;
    float edge = step(u_threshold, strength);
    outColor = vec4(edge, edge, edge, 1.0);
}
