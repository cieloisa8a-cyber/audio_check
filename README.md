# 🎧 Audio Check

> **Plataforma interactiva para la exploración psicoacústica de umbrales auditivos y generación de reportes audiométricos.**

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-W3C-orange?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Android](https://img.shields.io/badge/Android-API_29+-3DDC84?style=flat-square&logo=android&logoColor=white)](https://developer.android.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

---

## 📌 Descripción general

**Audio Check** es una plataforma psicoacústica diseñada para la estimación de umbrales de audición aérea en el rango tonal de **250 Hz a 8000 Hz**, implementando el protocolo psicofísico estandarizado **Hughson-Westlake modificado (ASHA, 2005)**.

La aplicación permite evaluar ambos oídos de forma independiente o consecutiva, trazando un audiograma interactivo en escala **dB HL aproximada** (ref. ANSI S3.6), comparándolo contra la referencia de normalidad por edad (**ISO 7029**) y exportando reportes vectoriales en formato **PDF** con rigor técnico y legal.

> ⚠️ **Aviso de tamizaje / Nota técnica:**  
> Resultados en escala dB HL aproximada (ref. ANSI S3.6). Debido al uso de transductores no calibrados en acoplador acústico (oído artificial), existe incertidumbre instrumental de ganancia física ($\sigma \approx \pm 7-10\text{ dB}$; Masalski et al., 2014). Herramienta de tamizaje académico en psicoacústica; no sustituye una audiometría diagnóstica clínica realizada en cabina sonoamortiguada.

---

## ✨ Características principales

- **Protocolo clínico ASHA (2005) estricto:**
  - **Fase de familiarización:** Inicio a 30 dB HL. Si no hay respuesta, salta a 50 dB HL y asciende de +10 en +10 dB hasta la primera respuesta afirmativa.
  - **Búsqueda de umbral (Staircase):** Descenso de 10 dB tras respuesta afirmativa ("Sí oí") y ascenso de 5 dB tras respuesta negativa ("No oí").
  - **Criterio de umbral:** Determinado formalmente al obtener al menos 2 de 3 respuestas afirmativas en series ascendentes. Piso acústico en $0\text{ dB HL}$ y techo de seguridad en $80\text{ dB HL}$.
- **Curva de referencia por edad (ISO 7029):**
  - Trazado comparativo automático en la interfaz y en el reporte PDF según la edad del paciente (1–19 años, 20–39 años, 40–59 años, 60+ años) para visualizar tendencias normativas y presbiacusia.
- **Botón STOP de aborto inmediato:**
  - Botón siempre activo durante la reproducción tonal que detiene el oscilador al instante y reinicia la prueba al menú inicial de verificación.
- **Rango de 8 frecuencias tonales normalizadas:**
  $$\text{250, 500, 1000, 2000, 3000, 4000, 6000 y 8000 Hz}$$
  Envolvente de coseno alzado (Hann de 20 ms) para erradicar clics y transitorios de conmutación.
- **Audiograma dinámico y visualización clínica:**
  - Trazado de simbología audiométrica estándar (Rojo: Oído Izquierdo $\times$, Verde/Azul: Oído Derecho $\bigcirc$) con compensación para pantallas Retina y móviles.
- **Exportación en PDF vectorial y Compartir nativo:**
  - Generación de reportes clínicos vectoriales con **ReportLab**.
  - En la aplicación móvil Android: guardado directo en la carpeta pública `Descargas` e integración nativa con el menú de compartir (`Intent.ACTION_SEND` vía `FileProvider`) para WhatsApp, correo, Drive, etc.
- **Protección de hardware y rigor de prueba:**
  - Detección en tiempo real de audífonos con cable (Jack 3.5 mm / USB-C).
  - Pausa/reinicio de seguridad automático ante desconexión física de auriculares.
  - Instrucción unificada de volumen físico calibrado entre un **20% y 25%** del dispositivo ($C_{ref} = 120\text{ dB}$).

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | HTML5 semántico, CSS3 Vanilla responsivo, JavaScript ES6+ moderno |
| **Síntesis de Audio** | Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `ChannelMergerNode`) |
| **Backend** | Python 3.9+, FastAPI, Uvicorn, Pydantic, ReportLab |
| **Móvil (Android)** | Android SDK (Java 17, minSdk 29, targetSdk 35/37), WebViewBridge, FileProvider |
| **Infraestructura** | Vercel (Frontend & Serverless API), GitHub Actions, PWA |

---

## 📂 Estructura del repositorio

```text
audio_check/
├── .github/
│   ├── CODEOWNERS               # Reglas de protección y revisión de administradores
│   └── workflows/               # Automatización e integración continua
├── backend/
│   └── app/
│       ├── main.py              # Endpoints FastAPI y distribución de estáticos
│       ├── reports.py           # Renderizado del reporte PDF vectorial (ReportLab)
│       └── schemas.py           # Modelos de validación con Pydantic
├── frontend/
│   ├── index.html               # Interfaz de usuario y flujo de prueba (3 etapas)
│   └── static/
│       ├── app.css              # Estilos y diseño responsivo adaptativo
│       ├── app.js               # Protocolo ASHA 2005, síntesis Web Audio y bridge nativo
│       ├── sw.js                # Service Worker para capacidades PWA y caché
│       └── manifest.webmanifest
├── android/                     # Módulo Android nativo
│   └── app/
│       ├── src/main/assets/     # Assets web embebidos sincronizados
│       └── src/main/java/com/audiocheck/app/
│           ├── MainActivity.java     # Actividad principal, control de audio y WebView
│           ├── AndroidBridge.java    # Interfaz JavaScript para puente nativo (PDF/compartir)
│           └── PdfFileProvider.java  # Proveedor seguro de archivos para compartir PDF
├── macos/                       # Scripts y LaunchAgent para despliegue local en macOS
├── requirements.txt             # Dependencias de Python
└── README.md
```

---

## 🚀 Instalación y uso local

### 1. Prerrequisitos
- **Python 3.9** o superior instalado en el sistema.
- Auriculares alámbricos (3.5 mm o USB-C) para realizar la prueba.

### 2. Configuración del entorno

Clona el repositorio y sitúate en la raíz del proyecto:

```bash
git clone https://github.com/cieloisa8a-cyber/audio_check.git
cd audio_check
```

Crea y activa un entorno virtual de Python:

- **En Windows (PowerShell):**
  ```powershell
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  ```

- **En macOS / Linux:**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

Instala las dependencias necesarias:

```bash
pip install -r requirements.txt
```

### 3. Iniciar el servidor

Para uso local en el navegador:

```bash
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Abre tu navegador en:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

Para permitir conexión desde la aplicación móvil en la misma red Wi-Fi:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📱 Aplicación Android

La aplicación móvil conecta el frontend optimizado con capacidades nativas del sistema operativo:

1. Abre la carpeta `android` en **Android Studio**.
2. Conecta tu dispositivo Android con la depuración USB activa (o inicia un emulador).
3. Presiona **Run 'app'** (▶ o `Shift + F10`) para compilar e instalar en el dispositivo.
4. Funcionalidades nativas:
   - Detección automática del estado de conexión de auriculares alámbricos.
   - Guardado directo de reportes en `Descargas` con notificación del sistema.
   - Menú de compartir nativo (`Intent.ACTION_SEND`) para WhatsApp, Gmail, Drive, etc.
   - Icono oficial adaptativo integrado.

---

## 📋 Protocolo de la prueba

1. **Datos del paciente:** Ingresa el nombre y edad en el formulario inicial.
2. **Entorno y calibración:**
   - Conecta auriculares con cable (no usar altavoces ni auriculares Bluetooth con compresión/latencia).
   - Ajusta el volumen físico del dispositivo entre el **20% y 25%**.
   - Sitúate en una habitación silenciosa libre de ruido ambiental.
3. **Ejecución (Protocolo ASHA 2005):**
   - Para cada frecuencia, reproduce el tono de prueba.
   - Responde si lo escuchaste con claridad o no. El algoritmo ajustará automáticamente el nivel según la técnica de ascenso/descenso.
   - Si necesitas cancelar o reiniciar en cualquier momento, presiona el botón **STOP**.
4. **Resultados y entrega:**
   - Visualiza el audiograma resultante comparado con la referencia ISO 7029 según tu edad.
   - Pulsa **Medir el otro oído** para evaluar el oído contralateral inmediatamente.
   - Pulsa **Exportar PDF** para descargar el reporte o **Compartir** para enviarlo directamente.

---

## 🔒 Seguridad y Gobernanza del Código

El repositorio cuenta con configuración de **CODEOWNERS** en [`.github/CODEOWNERS`](file:///.github/CODEOWNERS). Cualquier contribución o modificación en la rama principal (`main`) requiere obligatoriamente:
- Apertura de un **Pull Request**.
- Revisión y aprobación explícita del administrador (`@cieloisa8a-cyber`).

---

## 👥 Créditos y autoría

Proyecto desarrollado en el marco del programa de **Ingeniería de Sonido**:

- **Cielo Isabel Ochoa**
- **Juan José Guerrero**

📍 **Universidad de San Buenaventura Medellín**  
📚 **Asignatura:** Psicoacústica  
📅 **Semestre:** 2026-2
