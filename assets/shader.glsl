#version 300 es
precision highp float;

uniform vec3 iResolution;           // viewport resolution (in pixels)
uniform float iTime;                 // shader playback time (in seconds)
uniform sampler2D iChannel0;             // input channel. XX = 2D/Cube

out vec4 fragColor; // WebGL 2.0 output variable

float squared(float value) {
    return value * value;
}

float getAmp(float frequency) {
    return texture(iChannel0, vec2(frequency / 512.0f, 0)).x;
}

float getWeight(float f) {
    return (+getAmp(f - 2.0f) + getAmp(f - 1.0f) + getAmp(f + 2.0f) + getAmp(f + 1.0f) + getAmp(f)) / 5.0f;
}

void main() {
    vec2 uvTrue = gl_FragCoord.xy / iResolution.xy;
    vec2 uv = -1.0f + 2.0f * uvTrue;

    float lineIntensity;
    float glowWidth;
    vec3 color = vec3(0.0f);

    for(float i = 0.0f; i < 5.0f; i++) {

        uv.y += (0.2f * sin(uv.x + i / 7.0f - iTime * 0.6f));
        float Y = uv.y + getWeight(squared(i) * 20.0f) *
            (texture(iChannel0, vec2(uvTrue.x, 1)).x - 0.5f);
        lineIntensity = 0.4f + squared(1.6f * abs(mod(uvTrue.x + i / 1.3f + iTime, 2.0f) - 1.0f));
        glowWidth = abs(lineIntensity / (150.0f * Y));
        color += vec3(glowWidth * (2.0f + sin(iTime * 0.13f)), glowWidth * (2.0f - sin(iTime * 0.23f)), glowWidth * (2.0f - cos(iTime * 0.19f)));
    }

    fragColor = vec4(color, 1.0f);
}