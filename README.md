# 🎧 Audio Check

> **Plataforma interactiva para la exploración psicoacústica de umbrales auditivos y generación de reportes audiométricos.**

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-W3C-orange?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Android](https://img.shields.io/badge/Android-API_29+-3DDC84?style=flat-square&logo=android&logoColor=white)](https://developer.android.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

---

## 📌 Descripción general

**Audio Check** es una aplicación diseñada con fines formativos y de investigación psicoacústica para medir la percepción de tonos puros por vía aérea en un rango amplio de frecuencias (125 Hz – 8000 Hz).

La aplicación permite evaluar ambos oídos de forma independiente, trazando un audiograma interactivo en escala digital relativa (**dBFS**) y exportando un reporte clínico referencial en formato **PDF**, con los datos del paciente (nombre y edad).

> ⚠️ **Aviso importante / Disclaimer:**  
> Esta herramienta **no sustituye una audiometría clínica profesional** ni genera lecturas en dB HL o dB SPL. Al carecer de calibración con sonómetro y acoplador acústico (oído artificial), los resultados se expresan en escala digital relativa (dBFS) y su propósito es estrictamente académico y orientativo.

---

## ✨ Características principales

- **Evaluación binaural independiente:** Permite medir el oído izquierdo y derecho por separado, o ambos en una misma sesión.
- **Rango de 11 frecuencias:** Incluye octavas estándar e inter-octavas clínicas:
  $$\text{125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000 y 8000 Hz}$$
- **Audiograma dinámico:** Trazado en tiempo real en canvas HTML5 optimizado para altas densidades de píxeles (Retina / pantallas móviles).
- **Exportación en PDF vectorial:**
  - Generación en el backend con **ReportLab** para la versión web.
  - Generación nativa en el dispositivo con **Android PdfDocument** para la versión APK.
  - Incluye nombre, edad, curvas por color (rojo: oído izquierdo, verde azulado: oído derecho), cuadrícula de niveles (−60 a −20 dBFS) y advertencias clínicas.
- **Doble soporte multiplataforma:**
  - **PWA (Progressive Web App):** Instalable en escritorio y móviles con Service Worker para operación en local.
  - **App Nativa Android:** Detección de audífonos físicos (Jack 3.5 mm / USB-C), bloqueo de controles de volumen para preservar la consistencia de la prueba y soporte nativo de compartir vía `Intent.ACTION_SEND`.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | HTML5 semántico, CSS3 Vanilla (variables, glassmorphism), JavaScript ES6+ moderno |
| **Síntesis de Audio** | Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `StereoPannerNode`) |
| **Backend Web** | Python 3.9+, FastAPI, Uvicorn, Pydantic, ReportLab |
| **Móvil (Android)** | Java, Android SDK (minSdk 29, targetSdk 37), WebViewBridge, MediaStore API |
| **Caché / Offline** | Service Workers, Web App Manifest |

---

## 📂 Estructura del repositorio

```text
audio_check/
├── backend/
│   └── app/
│       ├── main.py          # Endpoints FastAPI y distribución de estáticos
│       ├── reports.py       # Renderizado del reporte PDF vectorial (ReportLab)
│       └── schemas.py       # Modelos de validación con Pydantic
├── frontend/
│   ├── index.html           # Interfaz de usuario y flujo de prueba (3 etapas)
│   └── static/
│       ├── app.css          # Estilos y diseño responsivo
│       ├── app.js           # Lógica psicoacústica, síntesis y exportación
│       ├── sw.js            # Service Worker para capacidades PWA / offline
│       └── manifest.webmanifest
├── android/                 # Proyecto Android Studio (app nativa)
│   └── app/
│       └── src/main/java/com/audiocheck/app/
│           └── MainActivity.java # Puente nativo, detección de hardware y PDF local
├── macos/                   # Scripts y LaunchAgent para despliegue local en macOS
├── requirements.txt         # Dependencias de Python
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
git clone https://github.com/tu-usuario/audio_check.git
cd audio_check
```

Crea y activa un entorno virtual de Python:

- **En Windows:**
  ```powershell
  python -m venv .venv
  .venv\Scripts\activate
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

Ejecuta el servidor de desarrollo con Uvicorn:

```bash
uvicorn backend.app.main:app --host 127.0.0.1 --port 8765 --reload
```

Abre tu navegador en:
👉 **[http://127.0.0.1:8765](http://127.0.0.1:8765)**

---

## 📱 Compilación de la aplicación Android

La carpeta `android/` contiene el proyecto completo para Android Studio:

1. Abre Android Studio y selecciona **Open**, eligiendo la carpeta `android/`.
2. Conecta tu dispositivo Android (Android 10 / API 29 en adelante) con la depuración USB activa.
3. Presiona **Run 'app'** o genera el APK desde el menú:  
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. El archivo generado estará en:  
   `android/app/build/outputs/apk/debug/app-debug.apk`.

*Nota: La versión de Android ejecuta el frontend de manera autónoma sin requerir una conexión activa a internet ni al servidor Python.*

---

## 📋 Protocolo de la prueba

1. **Datos del paciente:** Ingresa el nombre del paciente y la edad en el formulario inicial.
2. **Entorno y calibración:**
   - Conecta auriculares con cable (no uses altavoces ni auriculares Bluetooth con compresión).
   - Sitúate en un entorno silencioso para no enmascarar frecuencias graves.
   - Realiza la calibración con el tono de prueba de 1000 Hz ajustando el volumen físico del dispositivo a un nivel conversacional cómodo.
3. **Ejecución:**
   - Para cada frecuencia, reproduce el tono de 1 segundo.
   - Indica si lo percibiste claramente o no para avanzar al siguiente escalón de nivel.
4. **Resultados y entrega:**
   - Visualiza el audiograma resultante.
   - Pulsa **Exportar PDF** para descargar el archivo (`Audiometria_Nombre_Paciente.pdf`) o **Compartir** para enviarlo directamente por aplicaciones de mensajería o correo.

---

## 👥 Créditos y autoría

Proyecto desarrollado en el marco del programa de **Ingeniería de Sonido**:

- **Cielo Isabel Ochoa**
- **Juan José Guerrero**

📍 **Universidad de San Buenaventura Medellín**  
📚 **Asignatura:** Psicoacústica  
📅 **Semestre:** 2026-2
