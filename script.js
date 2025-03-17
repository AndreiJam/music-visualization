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
    audioContext.suspend();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);

    // Create texture to hold audio frequency data
    const audioTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, audioTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // Play audio and connect to analyser
    const audio = new Audio('assets/Nick_Zaleski-Always.mp3');
    audio.pause();

    // Get uniform locations
    const iResolutionLoc = gl.getUniformLocation(shaderProgram, "iResolution");
    const iTimeLoc = gl.getUniformLocation(shaderProgram, "iTime");
    const iChannel0Loc = gl.getUniformLocation(shaderProgram, "iChannel0");

    // Function to update texture with audio data
    const updateAudioTexture = () => {
        analyser.getByteFrequencyData(frequencyData);

        gl.uniform1i(iChannel0Loc, 0);

        // Upload frequency data to texture
        gl.bindTexture(gl.TEXTURE_2D, audioTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, bufferLength, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, frequencyData);
    };

    // Start render loop
    let startTime;
    function render() {
        const elapsedTime = (Date.now() - startTime) / 1000;

        // Update audio texture
        updateAudioTexture();

        // Set resolution uniform
        gl.uniform3f(iResolutionLoc, canvas.width, canvas.height, 1);

        // Set shader uniforms
        gl.uniform1f(iTimeLoc, elapsedTime);

        // Render scene
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(render);
    }

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

    let audioSource;
    // Handle user interaction to start Web Audio
    document.body.addEventListener("click", () => {
        if (audioContext.state === "suspended") {
            audio.play();
            startTime = Date.now();
            render();
            audioContext.resume().then(() => {
                if (!audioSource) {
                    audioSource = audioContext.createMediaElementSource(audio);
                    audioSource.connect(analyser);
                }
                analyser.connect(audioContext.destination);
                startRecording();
            });
        }
    }, { once: true });

    // Recording Setup
    let mediaRecorder;
    let recordedChunks = [];
    let maxDuration = 60 * 1000; // Store only last 60 sec
    let canvasStream;

    // Function to start recording
    async function startRecording() {
        // Get the canvas stream
        canvasStream = canvas.captureStream(30); // 30 FPS

        const destination = audioContext.createMediaStreamDestination();
        audioSource.connect(destination);

        // Merge audio and canvas streams
        const combinedStream = new MediaStream([...canvasStream.getTracks(), ...destination.stream.getTracks()]);

        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm; codecs=vp9" });

        // Store recorded data in chunks
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }

            // Keep only the last 60 seconds
            let totalTime = Date.now() - startTime;
            if (totalTime > maxDuration) {
                recordedChunks.shift(); // Remove oldest frame
            }
        };

        // Start recording
        mediaRecorder.start(1000); // Save every second
    }

    // Function to stop and save recording
    function saveRecording() {
        if (recordedChunks.length === 0) {
            console.warn("No recording available.");
            return;
        }

        // Combine chunks into a single Blob
        const recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(recordedBlob);

        // Create download link
        const a = document.createElement("a");
        a.href = url;
        a.download = "recording.webm";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    const exportButton = document.getElementById("exportButton");
    exportButton.addEventListener("click", saveRecording);
})();