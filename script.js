const startBtn = document.getElementById("startBtn");

startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);

  // Low-pass filter (speech filter)
  const lowPass = audioCtx.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 3000; // nutq 3 kHz gacha

  // Noise filter (high-pass)
  const highPass = audioCtx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 3000; // 3 kHz dan baland — shovqin

  source.connect(lowPass);
  source.connect(highPass);

  // Analyzer
  const analyserOriginal = audioCtx.createAnalyser();
  const analyserFiltered = audioCtx.createAnalyser();
  const analyserNoise = audioCtx.createAnalyser();

  source.connect(analyserOriginal);
  lowPass.connect(analyserFiltered);
  highPass.connect(analyserNoise);

  analyserOriginal.fftSize = 1024;
  analyserFiltered.fftSize = 1024;
  analyserNoise.fftSize = 1024;

  const bufferOriginal = new Uint8Array(analyserOriginal.fftSize);
  const bufferFiltered = new Uint8Array(analyserFiltered.fftSize);
  const bufferNoise = new Uint8Array(analyserNoise.fftSize);

  const canvasOriginal = document.getElementById("original");
  const canvasNoise = document.getElementById("noise");
  const canvasFiltered = document.getElementById("filtered");

  const ctxO = canvasOriginal.getContext("2d");
  const ctxN = canvasNoise.getContext("2d");
  const ctxF = canvasFiltered.getContext("2d");

  function draw() {
    requestAnimationFrame(draw);

    analyserOriginal.getByteTimeDomainData(bufferOriginal);
    analyserFiltered.getByteTimeDomainData(bufferFiltered);
    analyserNoise.getByteTimeDomainData(bufferNoise);

    drawWave(ctxO, bufferOriginal, "cyan"); // original signal
    drawWave(ctxN, bufferNoise, "red"); // noise
    drawWave(ctxF, bufferFiltered, "lime"); // filtered speech
  }

  function drawWave(ctx, data, color) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    let slice = ctx.canvas.width / data.length;
    ctx.moveTo(0, (data[0] / 255) * ctx.canvas.height);

    for (let i = 1; i < data.length; i++) {
      let y = (data[i] / 255) * ctx.canvas.height;
      ctx.lineTo(i * slice, y);
    }

    ctx.stroke();
  }

  draw();
};
