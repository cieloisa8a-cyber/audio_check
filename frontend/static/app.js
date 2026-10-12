const FREQUENCIES = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];
const MIN_LEVEL = -60;
const MAX_LEVEL = -20;
const LEVEL_STEP = 5;

const elements = {
  setup: document.querySelector("#setup"),
  testPanel: document.querySelector("#test-panel"),
  resultsPanel: document.querySelector("#results-panel"),
  wiredCheck: document.querySelector("#wired-check"),
  volumeCheck: document.querySelector("#volume-check"),
  silenceCheck: document.querySelector("#silence-check"),
  volumeLockCheck: document.querySelector("#volume-lock-check"),
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
  bypassHeadphones: document.querySelector("#bypass-headphones"),
  scanDevicesBtn: document.querySelector("#scan-devices-btn"),
  outputSelectWrap: document.querySelector("#output-select-wrap"),
  outputSelect: document.querySelector("#output-select"),
  confirmDeviceBtn: document.querySelector("#confirm-device-btn"),
  calibrateBtn: document.getElementById("calibrate-btn"),
  patientName: document.querySelector("#patient-name"),
  patientAge: document.querySelector("#patient-age"),
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
let selectedAudioDeviceId = "";
let availableOutputs = [];
let sessionPatientName = "";
let sessionPatientAge = null;

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
window.checkHeadphones = checkHeadphones;
elements.headphoneDialog.addEventListener("cancel", (event) => event.preventDefault());
elements.headphoneRetryButton.addEventListener("click", checkHeadphones);
let toastTimer;
function showToast(message, durationMs = 6000) {
  let toast = document.querySelector("#toast-banner");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-banner";
    toast.className = "toast-banner";
    toast.setAttribute("role", "alert");
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">⚠️</span><span class="toast-text"></span>`;
    document.body.appendChild(toast);
  }
  const textSpan = toast.querySelector(".toast-text");
  if (textSpan) textSpan.textContent = message;
  toast.onclick = () => { toast.hidden = true; };
  toast.classList.remove("toast-closing");
  toast.hidden = false;

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.add("toast-closing");
    window.setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove("toast-closing");
    }, 300);
  }, durationMs);
}

elements.headphoneContinueButton?.addEventListener("click", async () => {
  headphoneWarningAcknowledged = true;
  elements.headphoneDialog.close();
  setHeadphonesDetected(true);
  if (elements.patientName && !elements.patientName.value.trim()) {
    elements.patientName.value = "Paciente QA";
  }
  if (elements.patientAge && !elements.patientAge.value.trim()) {
    elements.patientAge.value = "25";
  }
  sessionPatientName = elements.patientName?.value?.trim() || "Paciente QA";
  sessionPatientAge = parseInt(elements.patientAge?.value, 10) || 25;
  [elements.wiredCheck, elements.volumeCheck, elements.silenceCheck, elements.volumeLockCheck].forEach((cb) => {
    if (cb) cb.checked = true;
  });
  updateSetupState();
  showToast("Los resultados son inválidos sin un dispositivo de salida conectado");
  await startTest();
});
elements.bypassHeadphones?.addEventListener("click", async (e) => {
  e.preventDefault();
  const dialog = e.currentTarget.closest("dialog") || elements.headphoneDialog;
  dialog?.close();
  headphoneWarningAcknowledged = true;
  setHeadphonesDetected(true);
  if (elements.patientName && !elements.patientName.value.trim()) {
    elements.patientName.value = "Paciente QA";
  }
  if (elements.patientAge && !elements.patientAge.value.trim()) {
    elements.patientAge.value = "25";
  }
  sessionPatientName = elements.patientName?.value?.trim() || "Paciente QA";
  sessionPatientAge = parseInt(elements.patientAge?.value, 10) || 25;
  [elements.wiredCheck, elements.volumeCheck, elements.silenceCheck, elements.volumeLockCheck].forEach((cb) => {
    if (cb) cb.checked = true;
  });
  updateSetupState();
  showToast("Los resultados son inválidos sin un dispositivo de salida conectado");
  await startTest();
});

async function scanAndSelectAudioDevices() {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices) {
    const confirmWired = window.confirm(
      "Al abrir la app por IP de red local (HTTP 192.168.x.x), Chrome bloquea la detección de hardware por privacidad (requiere HTTPS o http://localhost).\n\n¿Confirmas que tienes conectados auriculares de cable a este equipo para continuar?"
    );
    if (confirmWired) {
      selectedAudioDeviceId = "manual-pc-wired";
      if (elements.selectedDeviceName) {
        elements.selectedDeviceName.textContent = "Auriculares de cable (PC)";
      }
      headphoneWarningAcknowledged = true;
      setHeadphonesDetected(true);
      if (elements.headphoneDialog?.open) {
        elements.headphoneDialog.close();
      }
    }
    return;
  }

  // 1. API nativa selectAudioOutput (Chrome/Edge 110+)
  if (typeof mediaDevices.selectAudioOutput === "function") {
    try {
      const selected = await mediaDevices.selectAudioOutput();
      if (selected) {
        await handleDeviceChosen(selected);
        return;
      }
    } catch (err) {
      if (err.name === "AbortError" || err.name === "NotAllowedError") return;
      console.warn("selectAudioOutput no disponible:", err);
    }
  }

  // 2. Fallback: Desbloquear etiquetas (labels) mediante permiso temporal de audio
  try {
    if (mediaDevices.getUserMedia) {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    }
  } catch (err) {
    console.warn("No se pudo desbloquear nombres con micrófono:", err);
  }

  // 3. Enumerar dispositivos con nombres visibles
  try {
    const devices = await mediaDevices.enumerateDevices();
    let outputs = devices.filter((d) => d.kind === "audiooutput");
    if (outputs.length === 0) {
      outputs = devices.filter((d) => d.kind === "audioinput");
    }

    if (outputs.length === 0) {
      window.alert("No se detectaron salidas de audio en el navegador.");
      return;
    }

    availableOutputs = outputs;
    populateOutputSelect(outputs);
  } catch (err) {
    window.alert("Error al enumerar dispositivos: " + err.message);
  }
}

function populateOutputSelect(outputs) {
  const select = elements.outputSelect;
  if (!select) return;
  select.innerHTML = "";
  outputs.forEach((device, index) => {
    const opt = document.createElement("option");
    opt.value = device.deviceId;
    opt.textContent = device.label || `Salida de audio ${index + 1}`;
    select.appendChild(opt);
  });

  if (elements.outputSelectWrap) {
    elements.outputSelectWrap.hidden = false;
  }
  if (selectedAudioDeviceId) {
    select.value = selectedAudioDeviceId;
  }
}

async function handleDeviceChosen(device) {
  selectedAudioDeviceId = device.deviceId;
  const label = device.label || "Dispositivo seleccionado";

  if (elements.selectedDeviceName) {
    elements.selectedDeviceName.textContent = label;
  }

  if (/bluetooth|wireless|airpods?|buds/i.test(label)) {
    const proceed = window.confirm(
      "⚠️ Recomendamos usar auriculares de cable para mejores resultados clínicos. El Bluetooth introduce latencia y compresión. ¿Deseas continuar con Bluetooth de todas formas?"
    );
    if (!proceed) {
      setHeadphonesDetected(false);
      return;
    }
  }

  headphoneWarningAcknowledged = true;
  setHeadphonesDetected(true);
  if (elements.headphoneDialog?.open) {
    elements.headphoneDialog.close();
  }
  await applyAudioSink();
}

async function applyAudioSink() {
  if (selectedAudioDeviceId && audioContext && typeof audioContext.setSinkId === "function") {
    try {
      await audioContext.setSinkId(selectedAudioDeviceId);
    } catch (e) {
      console.warn("setSinkId no permitido o no soportado:", e);
    }
  }
}

elements.scanDevicesBtn?.addEventListener("click", scanAndSelectAudioDevices);
elements.confirmDeviceBtn?.addEventListener("click", () => {
  if (!elements.outputSelect) return;
  const chosen = availableOutputs.find((d) => d.deviceId === elements.outputSelect.value)
    || { deviceId: elements.outputSelect.value, label: elements.outputSelect.options[elements.outputSelect.selectedIndex]?.text };
  if (chosen) {
    handleDeviceChosen(chosen);
  }
});

async function checkHeadphones() {
  const requestId = ++headphoneCheckRequest;
  if (selectedAudioDeviceId) {
    setHeadphonesDetected(true);
    return;
  }
  if (window.AndroidApp?.getAudioOutputType) {
    const outputType = window.AndroidApp.getAudioOutputType();
    if (outputType === "bluetooth") {
      const proceed = window.confirm(
        "⚠️ Recomendamos usar auriculares de cable para mejores resultados clínicos. El Bluetooth introduce latencia y compresión. ¿Deseas continuar con Bluetooth de todas formas?"
      );
      setHeadphonesDetected(proceed);
      return;
    }
    if (outputType === "wired") {
      setHeadphonesDetected(true);
      return;
    }
    setHeadphonesDetected(false);
    return;
  }

  if (window.AndroidApp) {
    setHeadphonesDetected(window.AndroidApp.isHeadphonesConnected());
    return;
  }

  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.enumerateDevices) {
    elements.headphoneDialogSupport.innerHTML =
      "Acceso por IP local (HTTP): Chrome desactiva la detección automática de hardware sin HTTPS. Si estás en esta PC, abre <strong>http://localhost:8000</strong> para escanear dispositivos, o confirma tus auriculares abajo.";
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
  const patientNameValid = Boolean(elements.patientName?.value?.trim());
  const ageRaw = parseInt(elements.patientAge?.value, 10);
  const patientAgeValid = Boolean(!Number.isNaN(ageRaw) && ageRaw >= 1 && ageRaw <= 120);
  const patientValid = patientNameValid && patientAgeValid;

  const canContinueWithHeadphones = headphonesDetected && elements.wiredCheck.checked;
  const canContinueAfterWarning = !window.AndroidApp && headphoneWarningAcknowledged;
  const allChecksConfirmed = Boolean(
    elements.wiredCheck.checked
    && elements.volumeCheck.checked
    && elements.silenceCheck?.checked
    && (!elements.volumeLockCheck || elements.volumeLockCheck.checked)
  );
  const ready = Boolean(
    AudioContextClass
    && patientValid
    && allChecksConfirmed
    && (headphonesDetected || canContinueAfterWarning)
  );
  elements.startButton.disabled = !ready;
  if (!patientValid) {
    elements.audioSupport.textContent = "Ingresa el nombre del paciente y una edad válida (1 a 120 años).";
  } else if (!headphonesDetected && !window.AndroidApp && headphoneWarningAcknowledged) {
    elements.audioSupport.textContent = "Sin auriculares, la experiencia puede ser limitada. Confirma que dejaste el volumen bajo para continuar.";
  } else if (!headphonesDetected) {
    elements.audioSupport.textContent = "Conecta auriculares auxiliares para habilitar la prueba.";
  } else if (!AudioContextClass) {
    elements.audioSupport.textContent = "Este navegador no permite generar tonos de audio.";
  } else if (!allChecksConfirmed) {
    elements.audioSupport.textContent = "Confirma las condiciones obligatorias para habilitar la prueba.";
  } else {
    elements.audioSupport.textContent = "Auriculares detectados. Confirma las condiciones para continuar.";
  }
}

async function startTest() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();
  await applyAudioSink();
  if (elements.patientName?.value?.trim()) {
    sessionPatientName = elements.patientName.value.trim();
  }
  const ageNum = parseInt(elements.patientAge?.value, 10);
  if (!Number.isNaN(ageNum) && ageNum > 0) {
    sessionPatientAge = ageNum;
  }
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
  elements.testStatus.textContent = "Preparando...";

  try {
    audioContext ||= new AudioContextClass();
    await audioContext.resume();
    await applyAudioSink();

    const currentPlaybackId = ++playbackId;
    const delayMs = 1500 + Math.random() * 2500;

    playbackTimer = window.setTimeout(() => {
      if (currentPlaybackId !== playbackId) return;
      try {
        elements.testStatus.textContent = "Tono en reproducción…";
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

        const panValue = currentEar === "left" ? -1 : 1;
        let finalNode = envelope;
        if (typeof audioContext.createStereoPanner === "function") {
          const panner = audioContext.createStereoPanner();
          panner.pan.setValueAtTime(panValue, startAt);
          envelope.connect(panner);
          finalNode = panner;
        }
        oscillator.connect(envelope);
        finalNode.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 1.01);

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
    }, delayMs);
  } catch {
    isPlaying = false;
    elements.playButton.disabled = false;
    elements.testStatus.textContent = "No se pudo iniciar el audio. Toca Reproducir e inténtalo de nuevo.";
  }
}

async function playCalibrationTone() {
  if (!elements.calibrateBtn || elements.calibrateBtn.disabled) return;
  const originalText = elements.calibrateBtn.textContent;
  elements.calibrateBtn.disabled = true;
  elements.calibrateBtn.textContent = "Reproduciendo...";

  try {
    audioContext ||= new AudioContextClass();
    await audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = audioContext.currentTime;
    const amplitude = 10 ** (-20 / 20);

    oscillator.type = "sine";
    oscillator.frequency.value = 1000;
    gainNode.gain.setValueAtTime(amplitude, startAt);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + 3);

    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error) {
    console.error("Error al reproducir el tono de calibración:", error);
  } finally {
    elements.calibrateBtn.disabled = false;
    elements.calibrateBtn.textContent = originalText;
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
  updateOtherEarButton();
  renderChart();
  elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

const OTHER_EAR_LABEL = "Medir el otro oído";
const NEW_SESSION_LABEL = "Nueva sesión";

function bothEarsTested() {
  return ["left", "right"].every((ear) => measurements.some((item) => item.ear === ear));
}

function updateOtherEarButton() {
  elements.otherEarButton.textContent = bothEarsTested() ? NEW_SESSION_LABEL : OTHER_EAR_LABEL;
}

function goToOtherEar() {
  elements.earSelect.value = currentEar === "left" ? "right" : "left";
  elements.resultsPanel.hidden = true;
  elements.setup.hidden = false;
  elements.setup.scrollIntoView({ behavior: "smooth", block: "start" });
  updateSetupState();
}

// Reinicia la sesión para un nuevo paciente. Se conserva el AudioContext ya
// desbloqueado (iOS) y el estado de detección de auriculares.
function resetSession() {
  playbackId += 1;
  window.clearTimeout(playbackTimer);
  try { activeOscillator?.stop(); } catch { /* ya detenido */ }
  activeOscillator = null;
  isPlaying = false;

  measurements.length = 0;
  currentEar = "left";
  frequencyIndex = 0;
  currentLevel = MIN_LEVEL;
  elements.earSelect.value = "left";
  sessionPatientName = "";
  sessionPatientAge = null;

  // El nuevo paciente debe volver a ingresar sus datos y confirmar las condiciones.
  if (elements.patientName) elements.patientName.value = "";
  if (elements.patientAge) elements.patientAge.value = "";
  [elements.wiredCheck, elements.volumeCheck, elements.silenceCheck, elements.volumeLockCheck].forEach((input) => {
    if (input) input.checked = false;
  });

  const context = elements.canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  elements.testStatus.textContent = "";
  elements.otherEarButton.textContent = OTHER_EAR_LABEL;

  elements.testPanel.hidden = true;
  elements.resultsPanel.hidden = true;
  elements.setup.hidden = false;
  updateSetupState();
  window.scrollTo({ top: 0, behavior: "smooth" });

  headphoneWarningAcknowledged = false;
  checkHeadphones();
}

function renderChart() {
  const canvas = elements.canvas;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return;

  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(1, Math.round(bounds.width * ratio));
  canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = bounds.width;
  const height = bounds.height;
  const pointRadius = 5;
  const fontSize = width < 360 ? 10 : 12;
  const plot = {
    left: width < 360 ? 44 : 54,
    right: width - 24,
    top: 18 + pointRadius,
    bottom: height - 42 - pointRadius,
  };
  // Eje X equidistante: cada frecuencia ocupa una columna fija según su índice.
  const lastIndex = FREQUENCIES.length - 1;
  const columnWidth = (plot.right - plot.left) / lastIndex;
  const x = (frequency) => plot.left + FREQUENCIES.indexOf(frequency) * columnWidth;
  const y = (level) => plot.top + (-level / 100) * (plot.bottom - plot.top);

  context.clearRect(0, 0, width, height);
  context.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let level = 0; level >= -100; level -= 20) {
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
  // Evita superposición: etiquetas completas si caben; si no, formato compacto
  // (1k, 1.5k, 8k); y si aún no caben, se escalonan en dos filas.
  const fitsColumns = (labels) =>
    Math.max(...labels.map((label) => context.measureText(label).width)) + 4 <= columnWidth;
  const fullLabels = FREQUENCIES.map(String);
  const compactLabels = FREQUENCIES.map((frequency) => (frequency >= 1000 ? `${frequency / 1000}k` : String(frequency)));
  const labels = fitsColumns(fullLabels) ? fullLabels : compactLabels;
  const staggerLabels = !fitsColumns(labels);
  FREQUENCIES.forEach((frequency, index) => {
    const columnX = x(frequency);
    context.strokeStyle = "#edf0eb";
    context.beginPath();
    context.moveTo(columnX, plot.top);
    context.lineTo(columnX, plot.bottom);
    context.stroke();
    context.fillStyle = "#687671";
    const labelY = plot.bottom + 12 + (staggerLabels && index % 2 === 1 ? fontSize + 2 : 0);
    context.fillText(labels[index], columnX, labelY);
  });

  const styles = { left: "#d56c50", right: "#237e72" };
  ["left", "right"].forEach((ear) => {
    const points = measurements
      .filter((item) => item.ear === ear && item.level_dbfs !== null && FREQUENCIES.includes(item.frequency_hz))
      .map((item) => ({ x: x(item.frequency_hz), y: y(item.level_dbfs) }));
    context.strokeStyle = styles[ear];
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.stroke();
    points.forEach((point) => {
      context.fillStyle = styles[ear];
      context.beginPath();
      context.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#fff";
      context.lineWidth = 2;
      context.stroke();
    });
  });
}

function getReportPayload() {
  const patientName = sessionPatientName || elements.patientName?.value?.trim() || null;
  const ageRaw = sessionPatientAge || parseInt(elements.patientAge?.value, 10);
  const patientAge = (!Number.isNaN(ageRaw) && ageRaw > 0) ? ageRaw : null;
  return {
    measurements,
    patient_name: patientName,
    patient_age: patientAge,
  };
}

function getReportFilename() {
  const rawName = sessionPatientName || elements.patientName?.value?.trim();
  if (rawName) {
    const cleanName = rawName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (cleanName) {
      return `Audiometria_${cleanName}.pdf`;
    }
  }
  return "Audiometria.pdf";
}

function downloadPdfBlob(blob, filename) {
  let finalName = filename || getReportFilename();
  if (!finalName.toLowerCase().endsWith(".pdf")) {
    finalName += ".pdf";
  }

  const pdfBlob = (blob instanceof Blob && blob.type === "application/pdf")
    ? blob
    : new Blob([blob], { type: "application/pdf" });

  const downloadUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.style.display = "none";
  link.setAttribute("href", downloadUrl);
  link.setAttribute("download", finalName);
  link.download = finalName;
  document.body.appendChild(link);

  try {
    link.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  } catch {
    link.click();
  }

  // Dejar el Blob URL activo 60 segundos para que el gestor de descargas
  // del navegador resuelva el nombre y la extensión sin revertir a UUID.
  setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }, 60000);
}

async function fetchPdfBlob() {
  const response = await fetch("/api/report.pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getReportPayload()),
  });
  if (!response.ok) throw new Error("No se pudo crear el PDF en el servidor.");
  return await response.blob();
}

async function exportPdf() {
  if (elements.pdfButton.disabled) return;
  elements.pdfButton.disabled = true;
  const originalText = elements.pdfButton.textContent;
  elements.pdfButton.textContent = "Generando PDF...";

  try {
    if (window.AndroidApp) {
      window.AndroidApp.exportPdf(JSON.stringify(getReportPayload()), false);
      return;
    }

    const blob = await fetchPdfBlob();
    downloadPdfBlob(blob, getReportFilename());
    showToast("PDF descargado correctamente.");
  } catch (error) {
    console.error("Error al exportar PDF:", error);
    const msg = error.message && error.message.includes("fetch")
      ? "No se pudo conectar con el servidor local para generar el PDF. Verifica que esté activo."
      : (error.message || "No se pudo generar el PDF.");
    showToast("⚠️ " + msg, 5000);
    if (elements.testStatus) elements.testStatus.textContent = msg;
  } finally {
    elements.pdfButton.disabled = false;
    elements.pdfButton.textContent = originalText;
  }
}

async function shareResults() {
  if (elements.shareButton.disabled) return;
  elements.shareButton.disabled = true;
  const originalText = elements.shareButton.textContent;
  elements.shareButton.textContent = "Preparando...";

  try {
    if (window.AndroidApp) {
      window.AndroidApp.exportPdf(JSON.stringify(getReportPayload()), true);
      return;
    }

    const blob = await fetchPdfBlob();
    const filename = getReportFilename();
    const file = new File([blob], filename, { type: "application/pdf" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Resultado Audiometría" });
    } else {
      downloadPdfBlob(blob, filename);
      showToast("Descargando PDF (compartir no disponible en este dispositivo).");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Error al compartir:", error);
    const msg = error.message && error.message.includes("fetch")
      ? "No se pudo conectar con el servidor local para compartir. Verifica que esté activo."
      : (error.message || "No se pudo compartir el resultado.");
    showToast("⚠️ " + msg, 5000);
  } finally {
    elements.shareButton.disabled = false;
    elements.shareButton.textContent = originalText;
  }
}

elements.patientName?.addEventListener("input", updateSetupState);
elements.patientAge?.addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "");
  if (e.target.value.length > 0) {
    const num = parseInt(e.target.value, 10);
    if (num > 120) e.target.value = "120";
    if (num === 0) e.target.value = "";
  }
  updateSetupState();
});
elements.patientAge?.addEventListener("keydown", (e) => {
  if (["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
});

[elements.wiredCheck, elements.volumeCheck, elements.silenceCheck, elements.volumeLockCheck].forEach((input) => input?.addEventListener("change", updateSetupState));
elements.startButton.addEventListener("click", startTest);
elements.playButton.addEventListener("click", playTone);
elements.heardButton.addEventListener("click", () => recordResponse(true));
elements.notHeardButton.addEventListener("click", () => recordResponse(false));
elements.pdfButton.addEventListener("click", exportPdf);
elements.shareButton.addEventListener("click", shareResults);
elements.calibrateBtn?.addEventListener("click", playCalibrationTone);
elements.otherEarButton.addEventListener("click", () => {
  if (bothEarsTested()) {
    resetSession();
  } else {
    goToOtherEar();
  }
});
if ("ResizeObserver" in window) {
  const chartObserver = new ResizeObserver(() => {
    if (!elements.resultsPanel.hidden) renderChart();
  });
  chartObserver.observe(elements.canvas.parentElement);
} else {
  window.addEventListener("resize", () => {
    if (!elements.resultsPanel.hidden) renderChart();
  });
}

if ("serviceWorker" in navigator && !window.AndroidApp) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { }));
}

if (navigator.mediaDevices) {
  navigator.mediaDevices.ondevicechange = () => {
    checkHeadphones();
    if (!elements.testPanel.hidden) {
      window.alert("Se detectó un cambio en el hardware de audio durante la prueba activa.");
    }
  };
}

if (window.AndroidApp) {
  if (elements.headphoneContinueButton) elements.headphoneContinueButton.hidden = true;
  elements.headphoneDialogSupport.textContent = "La aplicación comprobará automáticamente la conexión.";
  checkHeadphones();
} else {
  checkHeadphones();
  window.addEventListener("focus", checkHeadphones);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkHeadphones();
  });
}

updateSetupState();
