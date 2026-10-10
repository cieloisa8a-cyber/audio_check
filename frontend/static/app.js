const FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000];
const MIN_LEVEL = -60;
const MAX_LEVEL = -20;
const LEVEL_STEP = 5;

const elements = {
  setup: document.querySelector("#setup"),
  testPanel: document.querySelector("#test-panel"),
  resultsPanel: document.querySelector("#results-panel"),
  wiredCheck: document.querySelector("#wired-check"),
  volumeCheck: document.querySelector("#volume-check"),
  earSelect: document.querySelector("#ear-select"),
  startButton: document.querySelector("#start-button"),
  audioSupport: document.querySelector("#audio-support"),
  testTitle: document.querySelector("#test-title"),
  frequencyLabel: document.querySelector("#frequency-label"),
  frequencyProgress: document.querySelector("#frequency-progress"),
  levelLabel: document.querySelector("#level-label"),
  playButton: document.querySelector("#play-button"),
  heardButton: document.querySelector("#heard-button"),
  notHeardButton: document.querySelector("#not-heard-button"),
  testStatus: document.querySelector("#test-status"),
  canvas: document.querySelector("#audiogram"),
  pdfButton: document.querySelector("#pdf-button"),
  shareButton: document.querySelector("#share-button"),
  otherEarButton: document.querySelector("#other-ear-button"),
  headphoneDialog: document.querySelector("#headphone-dialog"),
  headphoneDialogSupport: document.querySelector("#headphone-dialog-support"),
  headphoneRetryButton: document.querySelector("#headphone-retry-button"),
  headphoneContinueButton: document.querySelector("#headphone-continue-button"),
};

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const measurements = [];
let audioContext;
let currentEar = "left";
let frequencyIndex = 0;
let currentLevel = MIN_LEVEL;
let isPlaying = false;
let headphonesDetected = false;
let headphoneCheckRequest = 0;
let headphoneWarningAcknowledged = false;
let activeOscillator;
let playbackTimer;
let playbackId = 0;

function setHeadphonesDetected(detected) {
  headphonesDetected = Boolean(detected);
  if (headphonesDetected) {
    if (elements.headphoneDialog.open) elements.headphoneDialog.close();
  } else if (!headphoneWarningAcknowledged && !elements.headphoneDialog.open) {
    elements.headphoneDialog.showModal();
    if (isPlaying) {
      playbackId += 1;
      window.clearTimeout(playbackTimer);
      activeOscillator?.stop();
      activeOscillator = null;
      isPlaying = false;
    }
  }
  updateSetupState();
}

window.setHeadphonesDetected = setHeadphonesDetected;
elements.headphoneDialog.addEventListener("cancel", (event) => event.preventDefault());
elements.headphoneRetryButton.addEventListener("click", checkHeadphones);
elements.headphoneContinueButton.addEventListener("click", () => {
  headphoneWarningAcknowledged = true;
  elements.headphoneDialog.close();
  updateSetupState();
});

async function checkHeadphones() {
  const requestId = ++headphoneCheckRequest;
  if (window.AndroidApp) {
    setHeadphonesDetected(window.AndroidApp.isHeadphonesConnected());
    return;
  }

  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.enumerateDevices) {
    elements.headphoneDialogSupport.textContent =
      "Este navegador no permite comprobar la salida de audio. Prueba con HTTPS y un navegador compatible.";
    setHeadphonesDetected(false);
    return;
  }

  try {
    const outputs = await mediaDevices.enumerateDevices();
    if (requestId !== headphoneCheckRequest) return;
    const headphonesReported = outputs.some((device) => {
      if (device.kind !== "audiooutput" || !device.label.trim()) return false;
      if (/bluetooth|wireless|airpods?|buds/i.test(device.label)) return false;
      return /headphones?|headsets?|earphones?|auriculares|aud[ií]fonos/i.test(device.label);
    });
    elements.headphoneDialogSupport.textContent = headphonesReported
      ? ""
      : "Conecta auriculares auxiliares y toca «Volver a comprobar». Si el aviso sigue, el navegador no está informando la salida de auriculares.";
    setHeadphonesDetected(headphonesReported);
  } catch {
    if (requestId !== headphoneCheckRequest) return;
    elements.headphoneDialogSupport.textContent =
      "El navegador no pudo comprobar la salida de audio. Conecta los auriculares y vuelve a intentarlo.";
    setHeadphonesDetected(false);
  }
}

function updateSetupState() {
  const canContinueWithHeadphones = headphonesDetected && elements.wiredCheck.checked;
  const canContinueAfterWarning = !window.AndroidApp && headphoneWarningAcknowledged;
  const ready = Boolean(
    AudioContextClass
    && elements.volumeCheck.checked
    && (canContinueWithHeadphones || canContinueAfterWarning)
  );
  elements.startButton.disabled = !ready;
  if (!headphonesDetected && !window.AndroidApp && headphoneWarningAcknowledged) {
    elements.audioSupport.textContent = "Sin auriculares, la experiencia puede ser limitada. Confirma que dejaste el volumen bajo para continuar.";
  } else if (!headphonesDetected) {
    elements.audioSupport.textContent = "Conecta auriculares auxiliares para habilitar la prueba.";
  } else if (!AudioContextClass) {
    elements.audioSupport.textContent = "Este navegador no permite generar tonos de audio.";
  } else if (!elements.wiredCheck.checked || !elements.volumeCheck.checked) {
    elements.audioSupport.textContent = "Confirma ambas condiciones para habilitar la prueba.";
  } else {
    elements.audioSupport.textContent = "Auriculares detectados. Confirma ambas condiciones para continuar.";
  }
}

function startTest() {
  currentEar = elements.earSelect.value;
  frequencyIndex = 0;
  currentLevel = MIN_LEVEL;
  measurements.splice(0, measurements.length, ...measurements.filter((result) => result.ear !== currentEar));
  elements.setup.hidden = true;
  elements.resultsPanel.hidden = true;
  elements.testPanel.hidden = false;
  renderCurrentFrequency();
}

function renderCurrentFrequency() {
  const frequency = FREQUENCIES[frequencyIndex];
  elements.testTitle.textContent = currentEar === "left" ? "Oído izquierdo" : "Oído derecho";
  elements.frequencyLabel.textContent = String(frequency);
  elements.frequencyProgress.innerHTML = `${frequencyIndex + 1} <span>/ ${FREQUENCIES.length}</span>`;
  elements.levelLabel.textContent = `Nivel relativo: ${currentLevel} dBFS`;
  elements.testStatus.textContent = "Reproduce el tono antes de responder.";
  elements.playButton.disabled = false;
  elements.heardButton.disabled = true;
  elements.notHeardButton.disabled = true;
}

async function playTone() {
  if (isPlaying) return;
  isPlaying = true;
  elements.playButton.disabled = true;
  elements.heardButton.disabled = true;
  elements.notHeardButton.disabled = true;
  elements.testStatus.textContent = "Tono en reproducción…";

  try {
    audioContext ||= new AudioContextClass();
    await audioContext.resume();
    const oscillator = audioContext.createOscillator();
    activeOscillator = oscillator;
    const envelope = audioContext.createGain();
    const startAt = audioContext.currentTime;
    const amplitude = 10 ** (currentLevel / 20);

    oscillator.type = "sine";
    oscillator.frequency.value = FREQUENCIES[frequencyIndex];
    envelope.gain.setValueAtTime(0, startAt);
    envelope.gain.linearRampToValueAtTime(amplitude, startAt + 0.04);
    envelope.gain.setValueAtTime(amplitude, startAt + 0.88);
    envelope.gain.linearRampToValueAtTime(0, startAt + 1);
    oscillator.connect(envelope);
    envelope.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 1.01);

    const currentPlaybackId = ++playbackId;
    oscillator.addEventListener("ended", () => {
      if (activeOscillator === oscillator) activeOscillator = null;
    }, { once: true });
    playbackTimer = window.setTimeout(() => {
      if (currentPlaybackId !== playbackId) return;
      isPlaying = false;
      activeOscillator = null;
      elements.heardButton.disabled = false;
      elements.notHeardButton.disabled = false;
      elements.playButton.disabled = false;
      elements.testStatus.textContent = "¿Percibiste el tono con claridad?";
    }, 1050);
  } catch {
    isPlaying = false;
    elements.playButton.disabled = false;
    elements.testStatus.textContent = "No se pudo iniciar el audio. Toca Reproducir e inténtalo de nuevo.";
  }
}

function recordResponse(heard) {
  if (isPlaying) return;
  if (heard) {
    measurements.push({ ear: currentEar, frequency_hz: FREQUENCIES[frequencyIndex], level_dbfs: currentLevel });
    nextFrequency();
    return;
  }

  if (currentLevel < MAX_LEVEL) {
    currentLevel = Math.min(currentLevel + LEVEL_STEP, MAX_LEVEL);
    renderCurrentFrequency();
    elements.testStatus.textContent = "Subió un paso el nivel. Reproduce el tono otra vez.";
    return;
  }

  measurements.push({ ear: currentEar, frequency_hz: FREQUENCIES[frequencyIndex], level_dbfs: null });
  nextFrequency();
}

function nextFrequency() {
  frequencyIndex += 1;
  if (frequencyIndex < FREQUENCIES.length) {
    currentLevel = MIN_LEVEL;
    renderCurrentFrequency();
    return;
  }

  elements.testPanel.hidden = true;
  elements.resultsPanel.hidden = false;
  renderChart();
  elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderChart() {
  const canvas = elements.canvas;
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(bounds.width * ratio));
  canvas.height = Math.round(330 * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);

  const width = bounds.width;
  const height = 330;
  const plot = { left: 54, right: width - 16, top: 25, bottom: height - 48 };
  const logMin = Math.log10(FREQUENCIES[0]);
  const logMax = Math.log10(FREQUENCIES.at(-1));
  const x = (frequency) => plot.left + ((Math.log10(frequency) - logMin) / (logMax - logMin)) * (plot.right - plot.left);
  const y = (level) => plot.top + ((-60 - level) / 40) * (plot.bottom - plot.top);

  context.clearRect(0, 0, width, height);
  context.font = "12px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let level = -20; level >= -60; level -= 10) {
    const rowY = y(level);
    context.strokeStyle = "#dce4de";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(plot.left, rowY);
    context.lineTo(plot.right, rowY);
    context.stroke();
    context.fillStyle = "#687671";
    context.fillText(String(level), plot.left - 10, rowY);
  }

  context.textAlign = "center";
  context.textBaseline = "top";
  FREQUENCIES.forEach((frequency) => {
    const columnX = x(frequency);
    context.strokeStyle = "#edf0eb";
    context.beginPath();
    context.moveTo(columnX, plot.top);
    context.lineTo(columnX, plot.bottom);
    context.stroke();
    context.fillStyle = "#687671";
    context.fillText(String(frequency), columnX, plot.bottom + 12);
  });

  const styles = { left: "#d56c50", right: "#237e72" };
  ["left", "right"].forEach((ear) => {
    const points = measurements
      .filter((item) => item.ear === ear && item.level_dbfs !== null)
      .map((item) => ({ x: x(item.frequency_hz), y: y(item.level_dbfs) }));
    context.strokeStyle = styles[ear];
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.stroke();
    points.forEach((point) => {
      context.fillStyle = styles[ear];
      context.beginPath();
      context.arc(point.x, point.y, 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#fff";
      context.lineWidth = 2;
      context.stroke();
    });
  });
}

async function fetchPdf() {
  const response = await fetch("/api/report.pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ measurements }),
  });
  if (!response.ok) throw new Error("No se pudo crear el PDF.");
  return response.blob();
}

async function exportPdf() {
  elements.pdfButton.disabled = true;
  try {
    if (window.AndroidApp) {
      window.AndroidApp.exportPdf(JSON.stringify(measurements), false);
      return;
    }

    const blob = await fetchPdf();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "resumen-auditivo.pdf";
    link.click();
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    elements.testStatus.textContent = error.message;
    window.alert(error.message);
  } finally {
    elements.pdfButton.disabled = false;
  }
}

async function shareResults() {
  elements.shareButton.disabled = true;
  try {
    if (window.AndroidApp) {
      window.AndroidApp.exportPdf(JSON.stringify(measurements), true);
      return;
    }

    const blob = await fetchPdf();
    const file = new File([blob], "resumen-auditivo.pdf", { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "Resumen auditivo", text: "Registro exploratorio de tonos percibidos.", files: [file] });
    } else if (navigator.share) {
      const summary = measurements.map((item) => {
        const ear = item.ear === "left" ? "Izquierdo" : "Derecho";
        const level = item.level_dbfs === null ? "sin percepción al nivel máximo" : `${item.level_dbfs} dBFS`;
        return `${ear}, ${item.frequency_hz} Hz: ${level}`;
      }).join("\n");
      await navigator.share({ title: "Resumen auditivo", text: `Registro exploratorio (no clínico):\n${summary}` });
    } else {
      await exportPdf();
      window.alert("Este navegador no ofrece compartir. Se descargó el PDF para que puedas adjuntarlo.");
    }
  } catch (error) {
    if (error.name !== "AbortError") window.alert(error.message || "No se pudo compartir el resultado.");
  } finally {
    elements.shareButton.disabled = false;
  }
}

[elements.wiredCheck, elements.volumeCheck].forEach((input) => input.addEventListener("change", updateSetupState));
elements.startButton.addEventListener("click", startTest);
elements.playButton.addEventListener("click", playTone);
elements.heardButton.addEventListener("click", () => recordResponse(true));
elements.notHeardButton.addEventListener("click", () => recordResponse(false));
elements.pdfButton.addEventListener("click", exportPdf);
elements.shareButton.addEventListener("click", shareResults);
elements.otherEarButton.addEventListener("click", () => {
  elements.earSelect.value = currentEar === "left" ? "right" : "left";
  elements.resultsPanel.hidden = true;
  elements.setup.hidden = false;
  elements.setup.scrollIntoView({ behavior: "smooth", block: "start" });
  updateSetupState();
});
window.addEventListener("resize", () => {
  if (!elements.resultsPanel.hidden) renderChart();
});

if ("serviceWorker" in navigator && !window.AndroidApp) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

if (window.AndroidApp) {
  elements.headphoneContinueButton.hidden = true;
  elements.headphoneDialogSupport.textContent = "La aplicación comprobará automáticamente la conexión.";
  checkHeadphones();
} else {
  checkHeadphones();
  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", checkHeadphones);
  }
  window.addEventListener("focus", checkHeadphones);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkHeadphones();
  });
}

updateSetupState();
