// Get references to HTML elements
const canvas = document.getElementById("webglCanvas");
const gl = canvas.getContext("webgl2");
const audio = document.getElementById("audioPlayer");
const exportButton = document.getElementById("exportButton");

// Set canvas size to match the window
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 🎵 Setup Web Audio API
// const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
// const analyser = audioCtx.createAnalyser();
// const source = audioCtx.createMediaElementSource(audio);

// Example: Using Web Audio API to analyze frequency data
// const audioContext = new (window.AudioContext || window.webkitAudioContext)();
// const analyser = audioContext.createAnalyser();
// analyser.fftSize = 256;  // Set FFT size for the frequency data


// source.connect(analyser);
// analyser.connect(audioCtx.destination);
// analyser.fftSize = 512;
// const frequencyData = new Uint8Array(analyser.frequencyBinCount);

// 🎨 Create WebGL Texture for Audio Data
const audioTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, audioTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 512, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

// 🎵 Setup Web Audio API
// Example: Using Web Audio API to analyze frequency data
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;  // Set FFT size for the frequency data

// Connect an audio source to the analyser (e.g., audio file or microphone)
const audioElement = new Audio('assets/Nick_Zaleski_Always.mp3');
const audioSource = audioContext.createMediaElementSource(audioElement);
audioSource.connect(analyser);
analyser.connect(audioContext.destination);

// Create buffer for frequency data
const bufferLength = analyser.frequencyBinCount; // This will be half of `fftSize`
const frequencyData = new Uint8Array(bufferLength);

// 📜 Load Shader File
async function loadShaderFile(url) {
    const response = await fetch(url);
    return await response.text();
}

// 🚀 Initialize WebGL
async function initWebGL() {
    // Vertex shader for full-screen quad
    const vertexShaderSource = `#version 300 es
        precision highp float;

        layout(location = 0) in vec4 position;

        void main() {
            gl_Position = position;
        }
    `;

    // Load the fragment shader (your `shader.glsl`)
    const fragmentShaderSource = await loadShaderFile("assets/shader.glsl");

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex Shader Error:", gl.getShaderInfoLog(vertexShader));
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment Shader Error:", gl.getShaderInfoLog(fragmentShader));
    }
    
    // Link shaders into a program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Shader Program Error:", gl.getProgramInfoLog(shaderProgram));
    }

    // Use the shader program
    gl.useProgram(shaderProgram);

    // 📐 Full-screen quad (two triangles)
    const vertices = new Float32Array([
        -1, -1,  1, -1,  -1, 1,  
        -1,  1,  1, -1,   1, 1
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Get position attribute and enable it
    const positionLocation = gl.getAttribLocation(shaderProgram, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const resolutionLocation = gl.getUniformLocation(shaderProgram, "iResolution");
    const timeLocation = gl.getUniformLocation(shaderProgram, "iTime");
    const channel0Location = gl.getUniformLocation(shaderProgram, "iChannel0");

    // 🎥 Render loop
    function render(time) {
        // Update texture with real-time audio data
        analyser.getByteFrequencyData(frequencyData);
        // Assuming texture size is equal to `bufferLength`
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, bufferLength, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, frequencyData);
    
       
        // gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 512, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, frequencyData);

        // Bind texture to shader
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, audioTexture);
        gl.uniform1i(channel0Location, 0);

        // Pass uniforms
        gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1.0);
        gl.uniform1f(timeLocation, time * 0.001);

        // Draw visualization
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

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
}

// 🎬 Recording Setup
let mediaRecorder;
let recordedChunks = [];

exportButton.addEventListener("click", () => {
    if (!mediaRecorder) {
        // Capture the canvas stream at 30 FPS
        const stream = canvas.captureStream(30);
        mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

        // Collect recorded video chunks
        mediaRecorder.ondataavailable = (event) => {
            recordedChunks.push(event.data);
        };

        // When recording stops, create a downloadable video file
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "visualization.webm";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            recordedChunks = []; // Clear for next recording
        };
    }

    if (mediaRecorder.state === "recording") {
        mediaRecorder.stop(); // Stop if already recording
    } else {
        recordedChunks = [];
        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 60000); // Stop recording after 1 min
    }
});

// 🔊 Start Web Audio API when user interacts
document.body.addEventListener("click", () => {
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}, { once: true });

// 🚀 Initialize WebGL rendering
initWebGL();