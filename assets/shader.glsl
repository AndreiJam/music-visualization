#version 300 es
precision highp float;

uniform vec3      iResolution;           // viewport resolution (in pixels)
uniform float     iTime;                 // shader playback time (in seconds)
uniform float     iTimeDelta;            // render time (in seconds)
uniform float     iFrameRate;            // shader frame rate
uniform int       iFrame;                // shader playback frame
uniform float     iChannelTime[4];       // channel playback time (in seconds)
uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
uniform vec4      iMouse;                // mouse pixel coords. xy: current (if MLB down), zw: click
uniform sampler2D iChannel0;             // input channel. XX = 2D/Cube
uniform vec4      iDate;                 // (year, month, day, time in seconds)

out vec4 fragColor; // WebGL 2.0 output variable

float squared(float value) {
    return value * value;
}

float getAmp(float frequency) {
    return texture(iChannel0, vec2(frequency / 512.0, 0)).x;
}

float getWeight(float f) {
    return (+getAmp(f - 2.0) + getAmp(f - 1.0) + getAmp(f + 2.0) + getAmp(f + 1.0) + getAmp(f)) / 5.0;
}

void main() {
    vec2 uvTrue = gl_FragCoord.xy / iResolution.xy;
    vec2 uv = -1.0 + 2.0 * uvTrue;

    float lineIntensity;
    float glowWidth;
    vec3 color = vec3(0.0);

    for(float i = 0.0; i < 5.0; i++) {

        uv.y += (0.2 * sin(uv.x + i / 7.0 - iTime * 0.6));
        float Y = uv.y + getWeight(squared(i) * 20.0) *
            (texture(iChannel0, vec2(uvTrue.x, 1)).x - 0.5);
        lineIntensity = 0.4 + squared(1.6 * abs(mod(uvTrue.x + i / 1.3 + iTime, 2.0) - 1.0));
        glowWidth = abs(lineIntensity / (150.0 * Y));
        color += vec3(glowWidth * (2.0 + sin(iTime * 0.13)), glowWidth * (2.0 - sin(iTime * 0.23)), glowWidth * (2.0 - cos(iTime * 0.19)));
    }

    fragColor = vec4(color.x, color.y, color.z, 1.0);
}