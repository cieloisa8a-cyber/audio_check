# 🎧 Audio Check

> **Plataforma interactiva para la exploración psicoacústica de umbrales auditivos y generación de reportes audiométricos.**

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-W3C-orange?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Android](https://img.shields.io/badge/Android-API_29+-3DDC84?style=flat-square&logo=android&logoColor=white)](https://developer.android.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

---

## 📌 Descripción general

**Audio Check** es una aplicación diseñada con fines formativos y de investigación psicoacústica para medir la percepción de tonos puros por vía aérea en un rango amplio de frecuencias (250 Hz – 8000 Hz).

La aplicación permite evaluar ambos oídos de forma independiente o consecutiva, trazando un audiograma interactivo en escala digital relativa (**dBFS**) y exportando un reporte clínico referencial en formato **PDF**, con los datos del paciente (nombre y edad).

> ⚠️ **Aviso importante / Disclaimer:**  
> Esta herramienta **no sustituye una audiometría clínica profesional** ni genera lecturas en dB HL o dB SPL. Al carecer de calibración con sonómetro y acoplador acústico (oído artificial), los resultados se expresan en escala digital relativa (dBFS) y su propósito es estrictamente académico y orientativo.

---

## ✨ Características principales

- **Evaluación binaural independiente y bilateral fluida:**
  - Permite medir el oído izquierdo y derecho por separado o ambos en una misma sesión.
  - Al culminar un oído, la opción **"Medir el otro oído"** permite saltar directamente a la prueba del oído contralateral sin repetir el formulario de verificación inicial.
  - Opción de **"Nueva sesión"** para reiniciar limpiamente el proceso y datos del paciente.
- **Rango de 8 frecuencias normalizadas:**
  - Frecuencias tonales seleccionadas para tamizaje psicoacústico:
    $$\text{250, 500, 1000, 2000, 3000, 4000, 6000 y 8000 Hz}$$
  - Se omiten frecuencias redundantes (125, 750 y 1500 Hz) para una prueba más ágil y precisa.
- **Audiograma dinámico:**
  - Trazado en tiempo real en canvas HTML5 con curvas identificadas por colores normativos (rojo: oído izquierdo, verde azulado: oído derecho) y compensación para pantallas Retina y móviles.
- **Exportación en PDF vectorial y Compartir nativo:**
  - Generación de reportes vectoriales en el backend con **ReportLab**.
  - En la aplicación móvil, soporte nativo de **guardado en la carpeta Descargas** con notificación en la barra de estado del sistema.
  - Integración nativa con el menú de compartir de Android (`Intent.ACTION_SEND` mediante `FileProvider`) para enviar el PDF de forma directa a WhatsApp, Telegram, Gmail o Google Drive.
- **Protección de rigor médico y hardware:**
  - Detección en tiempo real de audífonos con cable (Jack 3.5 mm / USB-C).
  - Reinicio automático de seguridad en caso de desconexión durante la prueba con notificación clara del sistema.
  - **Bloqueo físico de controles de volumen** en la app móvil para evitar alterar la consistencia de los umbrales durante la sesión.
- **Interfaz adaptativa:**
  - Formulario de paciente con campos de Nombre y Edad compactos y optimizados para dispositivos móviles.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | HTML5 semántico, CSS3 Vanilla (variables, diseño responsivo adaptativo), JavaScript ES6+ moderno |
| **Síntesis de Audio** | Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `StereoPannerNode`) |
| **Backend** | Python 3.9+, FastAPI, Uvicorn, Pydantic, ReportLab |
| **Móvil (Android)** | Android SDK (minSdk 29, targetSdk 37), Jetpack Compose / WebViewBridge, FileProvider, MediaStore API |
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
│       ├── app.css          # Estilos y diseño responsivo adaptativo
│       ├── app.js           # Lógica psicoacústica, síntesis, comunicación puente y exportación
│       ├── sw.js            # Service Worker para capacidades PWA y caché
│       └── manifest.webmanifest
├── android/                 # Módulo Android del proyecto
│   └── app/
│       └── src/main/java/com/audiocheck/app/
│           ├── MainActivity.java     # Actividad principal
│           ├── AndroidBridge.java    # Interfaz JavaScript para puente nativo (audio y PDF)
│           └── PdfFileProvider.java  # Proveedor seguro de archivos para compartir PDF
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
git clone https://github.com/juanitowarrior28/audio_check.git
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

1. Abre el proyecto en **Android Studio**.
2. Conecta tu dispositivo Android con la depuración USB activa.
3. Presiona **Run 'app'** (▶ o `Shift + F10`) para compilar e instalar en el dispositivo.
4. Funcionalidades integradas:
   - Detección automática del estado de conexión de auriculares alámbricos.
   - Bloqueo de botones de volumen físico con advertencia médica en pantalla.
   - Guardado directo de reportes en `Descargas/Audio Check` con notificación del sistema.
   - Menú de compartir nativo para WhatsApp, Telegram y otras aplicaciones.

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
   - Pulsa **Medir el otro oído** para evaluar el oído restante de forma inmediata sin repetir los pasos de preparación.
   - Pulsa **Exportar PDF** para descargar el reporte (`Audiometria_Nombre_Paciente.pdf`) o **Compartir** para enviarlo por mensajería o correo.

---

## 👥 Créditos y autoría

Proyecto desarrollado en el marco del programa de **Ingeniería de Sonido**:

- **Cielo Isabel Ochoa**
- **Juan José Guerrero**

📍 **Universidad de San Buenaventura Medellín**  
📚 **Asignatura:** Psicoacústica  
📅 **Semestre:** 2026-2
