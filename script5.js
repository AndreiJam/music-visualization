(async function () {
    // WebGL initialization
    const canvas = document.getElementById("webglCanvas");
    const gl = canvas.getContext("webgl2");

    // Set canvas size to match the window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Shader sources
    const vertexShaderSource = `#version 300 es
    precision highp float;

    in vec2 position;
    out vec2 fragCoord;

    void main() {
        fragCoord = position;
        gl_Position = vec4(position, 0.0, 1.0);
    }
    `;

    const fragmentShaderSource = await fetch('assets/shader.glsl').then(res => res.text());

    // Create and compile shaders
    const compileShader = (source, type) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(`ERROR: Shader compilation failed\n${gl.getShaderInfoLog(shader)}`);
        }
        return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    // Create shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    // Create a buffer for the quad
    const vertices = new Float32Array([
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        1.0, 1.0
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Get the position attribute location and enable it
    const positionAttribLocation = gl.getAttribLocation(shaderProgram, "position");
    gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionAttribLocation);

    // Setup audio data and texture
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);

    // Create texture to hold audio frequency data
    const audioTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, audioTexture);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Play audio and connect to analyser
    const audio = new Audio('assets/Nick_Zaleski-Always.mp3');
    audio.crossOrigin = "anonymous";

    // Get uniform locations
    const iResolutionLoc = gl.getUniformLocation(shaderProgram, "iResolution");
    const iTimeLoc = gl.getUniformLocation(shaderProgram, "iTime");
    const iChannel0Loc = gl.getUniformLocation(shaderProgram, "iChannel0");

    // Function to update texture with audio data
    const updateAudioTexture = () => {
        analyser.getByteFrequencyData(frequencyData);

        // Upload frequency data to texture
        gl.bindTexture(gl.TEXTURE_2D, audioTexture);
        gl.texImage2D(iChannel0Loc, 0, gl.LUMINANCE, bufferLength, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, frequencyData);
    };

    // Start render loop
    let startTime = Date.now();
    function render() {
        const elapsedTime = (Date.now() - startTime) / 1000;

        // Update audio texture
        // updateAudioTexture();
        gl.uniform1f(iChannel0Loc, frequencyData);

        // Set resolution uniform
        gl.uniform3f(iResolutionLoc, canvas.width, canvas.height, 1);

        // Set shader uniforms
        gl.uniform1f(iTimeLoc, elapsedTime);

        // Render scene
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(render);
    }

    render();

    // Function to resize the canvas
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Update WebGL viewport
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Update the iResolution uniform
        const resolutionLocation = gl.getUniformLocation(shaderProgram, "iResolution");
        if (resolutionLocation) {
            gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1.0);
        }
    }

    // Resize when the window is resized
    window.addEventListener("resize", resizeCanvas);

    // Call the function once at the start
    resizeCanvas();

    let mediaElementSource;
    // Handle user interaction to start Web Audio
    document.body.addEventListener("click", () => {
        if (audioContext.state === "suspended") {
            audio.play();
            audioContext.resume().then(() => {
                if (!mediaElementSource) {
                    mediaElementSource = audioContext.createMediaElementSource(audio);
                    mediaElementSource.connect(analyser);
                }
                analyser.connect(audioContext.destination);
            });
        } else {
            audio.pause();
            audioContext.suspend();
        }
    });
})();