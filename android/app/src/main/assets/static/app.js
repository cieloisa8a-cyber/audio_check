const FREQUENCIES = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];
const MIN_LEVEL = -60;
const MAX_LEVEL = -20;
const LEVEL_STEP = 5;

// Conversión estandarizada clínica a dB HL (Hearing Level)
// -60 dBFS (mínimo nivel digital audible) -> 0 dB HL
// -20 dBFS (máxima ganancia evaluada)    -> 100 dB HL
function dbfsToDbhl(dbfs) {
  if (dbfs === null || dbfs === undefined) return null;
  const hl = (dbfs - MIN_LEVEL) * (100 / (MAX_LEVEL - MIN_LEVEL));
  return Math.round(hl);
}

function dbhlToDbfs(dbhl) {
  if (dbhl === null || dbhl === undefined) return null;
  return MIN_LEVEL + (dbhl / 100) * (MAX_LEVEL - MIN_LEVEL);
}

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
  newSessionButton: document.querySelector("#new-session-button"),
  headphoneDialog: document.querySelector("#headphone-dialog"),
  headphoneDialogTitle: document.querySelector("#headphone-dialog-title"),
  headphoneDialogMessage: document.querySelector(".headphone-dialog-message"),
  headphoneDialogSupport: document.querySelector("#headphone-dialog-support"),
  headphoneRetryButton: document.querySelector("#headphone-retry-button"),
  headphoneContinueButton: document.querySelector("#headphone-continue-button"),
  devicePickerArea: document.querySelector("#device-picker-area"),
  bypassHeadphones: document.querySelector("#bypass-headphones"),
  scanDevicesBtn: document.querySelector("#scan-devices-btn"),
  outputSelectWrap: document.querySelector("#output-select-wrap"),
  outputSelect: document.querySelector("#output-select"),
  confirmDeviceBtn: document.querySelector("#confirm-device-btn"),
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
let isQaMode = false;
let activeOscillator;
let playbackTimer;
let playbackId = 0;
let selectedAudioDeviceId = "";
let availableOutputs = [];
let sessionPatientName = "";
let sessionPatientAge = null;

let disconnectRedirectTimer = null;
let isDisconnectingFromTest = false;

function hideToast() {
  window.clearTimeout(toastTimer);
  const toast = document.querySelector("#toast-banner");
  if (toast) {
    toast.hidden = true;
    toast.classList.remove("toast-closing");
    if (toast.parentNode && toast.parentNode !== document.body) {
      document.body.appendChild(toast);
    }
  }
}

function setHeadphonesDetected(detected) {
  const isNowConnected = Boolean(detected);
  headphonesDetected = isNowConnected;

  // En Modo QA, ignorar desconexiones de hardware para no interrumpir la prueba del desarrollador
  if (isQaMode && !isNowConnected) {
    return;
  }

  // CASO A: Auriculares conectados o reconectados
  if (isNowConnected) {
    if (disconnectRedirectTimer) {
      window.clearTimeout(disconnectRedirectTimer);
      disconnectRedirectTimer = null;
    }
    const wasDisconnecting = isDisconnectingFromTest;
    isDisconnectingFromTest = false;
    hideToast();

    if (elements.headphoneDialog?.open) {
      try {
        elements.headphoneDialog.close();
      } catch {
        elements.headphoneDialog.removeAttribute("open");
      }
    }

    if (wasDisconnecting) {
      // Si se reconectaron en plena desconexión (la prueba fue interrumpida),
      // la prueba quedó invalidada: resetear estado y regresar a setup con checkboxes listos para confirmar
      measurements.length = 0;
      frequencyIndex = 0;
      currentLevel = MIN_LEVEL;
      [elements.wiredCheck, elements.volumeCheck, elements.silenceCheck, elements.volumeLockCheck].forEach((cb) => {
        if (cb) cb.checked = false;
      });
      elements.testPanel.hidden = true;
      elements.resultsPanel.hidden = true;
      elements.setup.hidden = false;
    }

    headphoneWarningAcknowledged = false;
    updateSetupState();
    return;
  }

  // CASO B: Auriculares desconectados

  // Si ya estamos procesando la transición programada desde la prueba activa, no reiniciar temporizadores
  if (isDisconnectingFromTest) {
    return;
  }

  const testActive = !elements.testPanel.hidden;

  if (testActive) {
    // -------------------------------------------------------------
    // ETAPA DE LA PRUEBA COMO TAL (checkboxes ya completados y test en curso)
    // -------------------------------------------------------------
    isDisconnectingFromTest = true;

    // 1. Detener audio activo inmediatamente
    playbackId += 1;
    window.clearTimeout(playbackTimer);
    try { activeOscillator?.stop(); } catch { /* ya detenido */ }
    activeOscillator = null;
    isPlaying = false;

    // Asegurar que el modal NO esté abierto en esta primera instancia
    if (elements.headphoneDialog?.open) {
      try { elements.headphoneDialog.close(); } catch { elements.headphoneDialog.removeAttribute("open"); }
    }

    // 2. Mostrar aviso: en app móvil sólo aviso nativo del sistema (sin banner para no duplicar)
    if (window.AndroidApp?.notifyHeadphonesDisconnected) {
      window.AndroidApp.notifyHeadphonesDisconnected();
    } else {
      showToast("Auriculares desconectados, la prueba se reiniciará", 2400);
    }

    // 3. Luego redirigir a los checkboxes, ocultar la barrita y mostrar el modal
    window.clearTimeout(disconnectRedirectTimer);
    disconnectRedirectTimer = window.setTimeout(() => {
      disconnectRedirectTimer = null;
      isDisconnectingFromTest = false;

      // Ocultar por completo la barrita flotante negra de aviso antes de abrir el modal
      hideToast();

      // Reiniciar estado de prueba
      measurements.length = 0;
      frequencyIndex = 0;
      currentLevel = MIN_LEVEL;
      headphoneWarningAcknowledged = false;

      // Desmarcar todos los checkboxes
      [elements.wiredCheck, elements.volumeCheck, elements.silenceCheck, elements.volumeLockCheck].forEach((cb) => {
        if (cb) cb.checked = false;
      });

      // Redirigir a la parte de los checkboxes
      elements.testPanel.hidden = true;
      elements.resultsPanel.hidden = true;
      elements.setup.hidden = false;

      // Abrir el modal limpio (sin la barrita flotante negra de fondo)
      if (!headphonesDetected && elements.headphoneDialog && !elements.headphoneDialog.open) {
        try {
          elements.headphoneDialog.showModal();
        } catch {
          elements.headphoneDialog.setAttribute("open", "");
        }
      }

      updateSetupState();
    }, 1800);

    return;
  }

  // -------------------------------------------------------------
  // ETAPA DE LOS CHECKBOXES / SETUP
  // -------------------------------------------------------------
  // Mientras el modal se muestre, que NO se muestre la barrita flotante
  hideToast();

  // Desmarcar todos los checkboxes
  [elements.wiredCheck, elements.volumeCheck, elements.silenceCheck, elements.volumeLockCheck].forEach((cb) => {
    if (cb) cb.checked = false;
  });
  headphoneWarningAcknowledged = false;

  // Si no está en la pantalla de resultados, abrir el modal de inmediato
  if (elements.resultsPanel.hidden) {
    if (elements.headphoneDialog && !elements.headphoneDialog.open) {
      try {
        elements.headphoneDialog.showModal();
      } catch {
        elements.headphoneDialog.setAttribute("open", "");
      }
    }
  }

  updateSetupState();
}

window.setHeadphonesDetected = setHeadphonesDetected;
window.checkHeadphones = checkHeadphones;
elements.headphoneDialog.addEventListener("cancel", (event) => event.preventDefault());
elements.headphoneRetryButton.addEventListener("click", requestHeadphonePermissionAndCheck);

let toastTimer;

function showToast(message, durationMs = 6000) {
  // Mientras el modal esté abierto, no mostrar barrita flotante
  if (elements.headphoneDialog?.open) {
    return;
  }

  let toast = document.querySelector("#toast-banner");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-banner";
    toast.className = "toast-banner";
    toast.setAttribute("role", "alert");
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">⚠️</span><span class="toast-text"></span>`;
  }
  const textSpan = toast.querySelector(".toast-text");
  const cleanMessage = String(message || "").replace(/^(?:⚠️\s*)+/, "");
  if (textSpan) textSpan.textContent = cleanMessage;
  toast.onclick = () => { toast.hidden = true; };
  toast.classList.remove("toast-closing");
  toast.hidden = false;

  if (toast.parentNode !== document.body) {
    document.body.appendChild(toast);
  }

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
  isQaMode = true;
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
  isQaMode = true;
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

async function requestHeadphonePermissionAndCheck() {
  isQaMode = false;
  if (window.AndroidApp) {
    checkHeadphones();
    return;
  }

  const btn = elements.headphoneRetryButton;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Solicitando autorización...";
  }

  try {
    if (navigator.mediaDevices?.getUserMedia) {
      // El navegador solicita autorización de audio para desbloquear los nombres de hardware de salida
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Apagar inmediatamente el micrófono: solo se necesitó para desbloquear las etiquetas de hardware
      stream.getTracks().forEach((track) => track.stop());
    }
  } catch (err) {
    console.warn("Permiso de audio no concedido:", err);
    if (elements.headphoneDialogSupport) {
      elements.headphoneDialogSupport.textContent =
        "Por privacidad, el navegador solicita autorizar el «micrófono» para leer las salidas de audio. Puedes habilitarlo en el icono del candado 🔒 de tu navegador.";
    }
    if (btn) {
      btn.textContent = "Reintentar autorización en el navegador";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
    }
  }

  await checkHeadphones();
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

async function checkHeadphones() {
  if (isQaMode) {
    return;
  }
  const requestId = ++headphoneCheckRequest;

  // 1. En la app Android, SIEMPRE consultar directamente el hardware nativo
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

  if (window.AndroidApp?.isHeadphonesConnected) {
    setHeadphonesDetected(window.AndroidApp.isHeadphonesConnected());
    return;
  }

  // 2. En la versión Web (PC):
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.enumerateDevices) {
    if (elements.headphoneDialogSupport) {
      elements.headphoneDialogSupport.innerHTML =
        "Acceso por IP local (HTTP): Chrome desactiva la detección de hardware sin HTTPS. Si estás en esta PC, abre <strong>http://localhost:8000</strong>.";
    }
    setHeadphonesDetected(false);
    return;
  }

  try {
    const devices = await mediaDevices.enumerateDevices();
    if (requestId !== headphoneCheckRequest) return;

    const headphonesReported = devices.some((device) => {
      if (!device.label.trim()) return false;
      if (/bluetooth|wireless|airpods?|buds/i.test(device.label)) return false;
      return /headphones?|headsets?|earphones?|auriculares|aud[ií]fonos/i.test(device.label);
    });

    const hasAnyLabels = devices.some((d) => d.label.trim().length > 0);

    // Visibilidad del botón de autorización:
    // Si la autorización ya está concedida (hasAnyLabels === true) o estamos en Android, el botón es inútil y se oculta.
    // Solo se muestra si el usuario NO ha concedido aún el permiso en el navegador.
    if (elements.headphoneRetryButton) {
      if (window.AndroidApp) {
        elements.headphoneRetryButton.hidden = true;
      } else {
        elements.headphoneRetryButton.hidden = hasAnyLabels;
        if (!hasAnyLabels && !elements.headphoneRetryButton.textContent.includes("Reintentar")) {
          elements.headphoneRetryButton.textContent = "Autoriza el uso de tus auriculares en el navegador";
        }
      }
    }

    if (elements.headphoneDialogSupport) {
      if (headphonesReported) {
        elements.headphoneDialogSupport.textContent = "";
      } else if (!hasAnyLabels) {
        elements.headphoneDialogSupport.textContent =
          "Para detectar si tus audífonos están conectados, el navegador requiere autorizar el acceso de audio (se solicita como «micrófono» por privacidad).";
      } else {
        elements.headphoneDialogSupport.textContent =
          "Autorización concedida. Conecta tus auriculares de cable y la prueba se activará automáticamente.";
      }
    }

    setHeadphonesDetected(headphonesReported);
  } catch {
    if (requestId !== headphoneCheckRequest) return;
    if (elements.headphoneDialogSupport) {
      elements.headphoneDialogSupport.textContent =
        "El navegador no pudo comprobar la salida de audio. Conecta los auriculares y vuelve a intentarlo.";
    }
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
    && (Boolean(window.AndroidApp) || !elements.volumeLockCheck || elements.volumeLockCheck.checked)
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
  elements.levelLabel.textContent = `Nivel: ${dbfsToDbhl(currentLevel)} dB HL`;
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
    await applyAudioSink();

    const currentPlaybackId = ++playbackId;

    // Generación matemática de onda senoidal pura en tiempo real (Web Audio API - latencia cero)
    const oscillator = audioContext.createOscillator();
    activeOscillator = oscillator;
    const envelope = audioContext.createGain();
    const startAt = audioContext.currentTime;
    const amplitude = 10 ** (currentLevel / 20);

    oscillator.type = "sine";
    oscillator.frequency.value = FREQUENCIES[frequencyIndex];

    // Control dinámico de ganancia con envolvente suave (elimina transientes o chasquidos)
    envelope.gain.setValueAtTime(0, startAt);
    envelope.gain.linearRampToValueAtTime(amplitude, startAt + 0.04);
    envelope.gain.setValueAtTime(amplitude, startAt + 0.88);
    envelope.gain.linearRampToValueAtTime(0, startAt + 1.0);

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
  } catch (error) {
    console.error("Error al reproducir tono:", error);
    isPlaying = false;
    elements.playButton.disabled = false;
    elements.testStatus.textContent = "No se pudo iniciar el audio. Toca Reproducir e inténtalo de nuevo.";
  }
}

function recordResponse(heard) {
  if (isPlaying) return;
  if (heard) {
    measurements.push({
      ear: currentEar,
      frequency_hz: FREQUENCIES[frequencyIndex],
      level_dbfs: currentLevel,
      level_dbhl: dbfsToDbhl(currentLevel)
    });
    nextFrequency();
    return;
  }

  if (currentLevel < MAX_LEVEL) {
    currentLevel = Math.min(currentLevel + LEVEL_STEP, MAX_LEVEL);
    renderCurrentFrequency();
    elements.testStatus.textContent = "Subió un paso el nivel. Reproduce el tono otra vez.";
    return;
  }

  measurements.push({
    ear: currentEar,
    frequency_hz: FREQUENCIES[frequencyIndex],
    level_dbfs: null,
    level_dbhl: null
  });
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
  updateResultActionButtons();
  renderChart();
  elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

const OTHER_EAR_LABEL = "Medir el otro oído";
const NEW_SESSION_LABEL = "Nueva sesión";

function bothEarsTested() {
  return ["left", "right"].every((ear) => measurements.some((item) => item.ear === ear));
}

function updateResultActionButtons() {
  const bothDone = bothEarsTested();
  if (elements.otherEarButton) {
    elements.otherEarButton.hidden = bothDone;
    elements.otherEarButton.textContent = OTHER_EAR_LABEL;
  }
  if (elements.newSessionButton) {
    elements.newSessionButton.hidden = false;
    elements.newSessionButton.textContent = NEW_SESSION_LABEL;
  }
}

async function goToOtherEar() {
  elements.earSelect.value = currentEar === "left" ? "right" : "left";
  await startTest();
  elements.testPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Reinicia la sesión para un nuevo paciente. Se conserva el AudioContext ya
// desbloqueado (iOS) y el estado de detección de auriculares.
function resetSession() {
  isQaMode = false;
  headphoneWarningAcknowledged = false;
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
  updateResultActionButtons();

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
    top: 22 + pointRadius,
    bottom: height - 42 - pointRadius,
  };
  // Eje X equidistante: cada frecuencia ocupa una columna fija según su índice
  // (250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz).
  const lastIndex = FREQUENCIES.length - 1;
  const columnWidth = (plot.right - plot.left) / lastIndex;
  const x = (frequency) => plot.left + FREQUENCIES.indexOf(frequency) * columnWidth;
  // Escala clínica dB HL: 0 dB HL arriba (umbral óptimo), 100 dB HL abajo (pérdida profunda)
  const y = (levelDbhl) => plot.top + (levelDbhl / 100) * (plot.bottom - plot.top);

  context.clearRect(0, 0, width, height);
  context.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = "right";
  context.textBaseline = "middle";

  // Rótulo del eje vertical en dB HL
  context.fillStyle = "#142b2a";
  context.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  context.fillText("dB HL", plot.left - 4, plot.top - 12);
  context.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;

  for (let level = 0; level <= 100; level += 20) {
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
      .filter((item) => item.ear === ear && (item.level_dbhl != null || item.level_dbfs != null) && FREQUENCIES.includes(item.frequency_hz))
      .map((item) => {
        const val = item.level_dbhl != null ? item.level_dbhl : dbfsToDbhl(item.level_dbfs);
        return { x: x(item.frequency_hz), y: y(val) };
      });
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

  const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });

  const reader = new FileReader();
  reader.onloadend = () => {
    const dataUrl = reader.result;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = finalName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
    }, 1500);
  };
  reader.onerror = () => {
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    }, 60000);
  };
  reader.readAsDataURL(pdfBlob);
}

async function fetchPdfBlob() {
  const response = await fetch("/api/report.pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getReportPayload()),
  });
  if (!response.ok) throw new Error("No se pudo crear el PDF.");
  return await response.blob();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function exportPdf() {
  elements.pdfButton.disabled = true;
  const originalText = elements.pdfButton.textContent;
  elements.pdfButton.textContent = "Exportando...";
  try {
    const filename = getReportFilename();

    if (window.AndroidApp?.savePdfBase64) {
      showToast("Descargando reporte PDF...", 3000);
      const blob = await fetchPdfBlob();
      const base64 = await blobToBase64(blob);
      window.AndroidApp.savePdfBase64(base64, filename, false);
      return;
    }

    if (window.AndroidApp?.exportPdf) {
      showToast("Descargando reporte PDF...", 3000);
      const blob = await fetchPdfBlob();
      const base64 = await blobToBase64(blob);
      window.AndroidApp.exportPdf(base64, filename);
      return;
    }

    const blob = await fetchPdfBlob();
    downloadPdfBlob(blob, filename);
  } catch (error) {
    if (elements.testStatus) elements.testStatus.textContent = error.message;
    showToast(error.message || "Error al exportar PDF", 5000);
  } finally {
    setTimeout(() => {
      elements.pdfButton.disabled = false;
      elements.pdfButton.textContent = originalText;
    }, 1000);
  }
}

async function shareResults() {
  elements.shareButton.disabled = true;
  const originalText = elements.shareButton.textContent;
  elements.shareButton.textContent = "Preparando...";
  try {
    const filename = getReportFilename();

    if (window.AndroidApp?.savePdfBase64) {
      const blob = await fetchPdfBlob();
      const base64 = await blobToBase64(blob);
      window.AndroidApp.savePdfBase64(base64, filename, true);
      return;
    }

    if (window.AndroidApp?.sharePdf) {
      const blob = await fetchPdfBlob();
      const base64 = await blobToBase64(blob);
      window.AndroidApp.sharePdf(base64, filename);
      return;
    }

    const blob = await fetchPdfBlob();
    const file = new File([blob], filename, { type: "application/pdf" });

    try {
      if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
        throw new Error("Web Share no disponible.");
      }
      await navigator.share({ files: [file], title: "Resultado Audiometría" });
    } catch (shareErr) {
      if (shareErr.name === "AbortError") return;
      downloadPdfBlob(blob, filename);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      showToast(error.message || "No se pudo compartir el resultado.", 5000);
    }
  } finally {
    setTimeout(() => {
      elements.shareButton.disabled = false;
      elements.shareButton.textContent = originalText;
    }, 1000);
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
elements.otherEarButton?.addEventListener("click", () => {
  goToOtherEar();
});
elements.newSessionButton?.addEventListener("click", () => {
  if (!bothEarsTested() && measurements.length > 0) {
    const ok = window.confirm("¿Deseas iniciar una nueva sesión? Las mediciones actuales del oído evaluado se reiniciarán para un nuevo paciente.");
    if (!ok) return;
  }
  resetSession();
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
    if (!isQaMode) checkHeadphones();
  };
}

if (window.AndroidApp) {
  if (elements.headphoneContinueButton) elements.headphoneContinueButton.hidden = true;
  if (elements.devicePickerArea) elements.devicePickerArea.hidden = true;
  if (elements.headphoneRetryButton) elements.headphoneRetryButton.hidden = true;
  if (elements.headphoneDialogTitle) elements.headphoneDialogTitle.textContent = "Conecta tus auriculares de cable";
  if (elements.headphoneDialogMessage) elements.headphoneDialogMessage.textContent = "Conecta tus auriculares de cable para continuar con la prueba.";
  if (elements.headphoneDialogSupport) elements.headphoneDialogSupport.textContent = "La aplicación detectará la conexión automáticamente al enchufarlos.";
  const icon = document.querySelector(".headphone-dialog-icon");
  if (icon) icon.textContent = "🎧";
  const volumeLockRow = document.querySelector("#volume-lock-row");
  if (volumeLockRow) volumeLockRow.style.display = "none";
  checkHeadphones();
} else {
  checkHeadphones();
  window.addEventListener("focus", () => {
    if (!isQaMode) checkHeadphones();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !isQaMode) checkHeadphones();
  });
}

// Comprobación periódica constante para detectar desconexión en cualquier momento
// (incluso mientras el usuario escribe sus datos o interactúa con los checkboxes)
window.setInterval(() => {
  if (!document.hidden && !isQaMode) {
    checkHeadphones();
  }
}, 1200);

updateSetupState();
updateResultActionButtons();
