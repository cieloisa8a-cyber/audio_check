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

Con un perfil acústico aprobado para la plataforma y cadena de salida exactas, la aplicación presenta umbrales en **dB HL**. En la versión web se puede elegir continuar sin calibración para una exploración no clínica; esos resultados se expresan únicamente en dBFS y no son comparables con dB HL. La app no inventa ni estima valores clínicos a partir de dBFS.

> ⚠️ **Aviso importante / Disclaimer:**  
> Esta herramienta **no sustituye una audiometría clínica profesional** ni constituye un dispositivo médico. El nivel dB HL solo es trazable cuando un especialista incorpora referencias medidas con instrumental acústico y un acoplador apropiado para cada plataforma, salida, auricular y ajuste de volumen. El nivel digital dBFS del generador por sí solo no permite inferir dB HL. El catálogo se entrega vacío; en web se puede omitir el perfil únicamente para obtener niveles digitales exploratorios, nunca resultados dB HL. Android sigue exigiendo el perfil aprobado.

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
  - Trazado en tiempo real en dB HL con curvas identificadas por colores (rojo: oído izquierdo, verde azulado: oído derecho).
- **Exportación en PDF vectorial y Compartir nativo:**
  - Generación de reportes vectoriales en el backend con **ReportLab**, validando el perfil y la conversión dB HL.
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
│       ├── calibration-profiles.json # Perfiles acústicos aprobados por plataforma
│       ├── sw.js            # Service Worker para capacidades PWA y caché
│       └── manifest.webmanifest
├── android/                 # Módulo Android del proyecto
│   └── app/
│       └── src/main/java/com/audiocheck/app/
│           ├── MainActivity.java     # Actividad principal
│           ├── AndroidBridge.java    # Interfaz JavaScript para puente nativo (audio y PDF)
│           └── PdfFileProvider.java  # Proveedor seguro de archivos para compartir PDF
├── macos/                   # Scripts y LaunchAgent para despliegue local en macOS
├── pyproject.toml           # Punto de entrada FastAPI para Vercel
├── .github/workflows/       # Publicación automatizada del APK
├── requirements.txt         # Dependencias de Python
└── README.md
```

---

## 🚀 Publicar en Vercel

1. Importa `cieloisa8a-cyber/audio_check` en Vercel y conserva la raíz del proyecto como **Root Directory** (vacío o `./`).
2. Vercel detectará automáticamente `vercel.json` y desplegará `api/index.py` junto con los archivos estáticos de `frontend/`.
3. Asigna el dominio desde **Project → Settings → Domains**. Vercel genera una URL pública `https://<proyecto>.vercel.app`.
4. Cada despliegue publica conjuntamente el frontend y `/api/report.pdf`; el cliente usa rutas relativas.

La app Android contiene el mismo frontend estático empaquetado y no requiere que la API esté disponible para ejecutar la prueba o generar PDFs nativos. La web pública sí requiere el endpoint de Vercel para generar el PDF.

## 🔊 Perfiles de calibración requeridos

Edita `frontend/static/calibration-profiles.json` únicamente con datos medidos y aprobados por un responsable de calibración. La plantilla se entrega vacía intencionalmente. Cada entrada debe incluir `id`, `name`, `platform` (`web`, `ios` o `android`), `output_chain`, `reference_dbfs` y `db_hl_at_reference_dbfs`, con una referencia medida para cada frecuencia: 250, 500, 1000, 2000, 3000, 4000, 6000 y 8000 Hz.

La conversión aplicada es `dB HL = nivel de estímulo dBFS - reference_dbfs + db_hl_at_reference_dbfs[frecuencia]`. Cada perfil debe identificar la cadena exacta (dispositivo, salida, auricular y volumen); crea perfiles distintos para cada plataforma/cadena medida. Backend y Android verifican que perfil y resultado correspondan al catálogo. Android exige un perfil aprobado. En web se puede marcar **Continuar sin calibración** para hacer una exploración en dBFS; los resultados no se presentan como dB HL y no se puede exportar un PDF calibrado. **No agregues coeficientes de ejemplo ni uses un ajuste auditivo subjetivo como calibración**: se necesita medición acústica con instrumental y acoplador apropiados.

## 🛠️ Desarrollo local (opcional)

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

### Distribuir un APK instalable

Publica un tag de versión (`git tag v1.0.0 && git push origin v1.0.0`). GitHub Actions compilará un APK de depuración e intentará adjuntarlo a **GitHub Releases** como `AudioCheck.apk`; la web incluye el enlace a la descarga más reciente. Es para instalación directa/pruebas, no una publicación firmada de producción; para reemplazar una versión debug instalada con una clave efímera podría ser necesario desinstalarla primero. Para Play Store hacen falta una cuenta Play Console, una clave de firma de lanzamiento gestionada como secreto y revisión de Google. En iOS se puede instalar la PWA desde el navegador; una app de App Store requiere publicación independiente.

---

## 📋 Protocolo de la prueba

1. **Datos del paciente:** Ingresa el nombre del paciente y la edad en el formulario inicial.
2. **Entorno y perfil acústico:**
   - Conecta auriculares con cable (no uses altavoces ni auriculares Bluetooth con compresión).
   - Sitúate en un entorno silencioso para no enmascarar frecuencias graves.
   - Selecciona un perfil dB HL aprobado para esa plataforma, dispositivo, salida, auriculares y volumen. En la web, puedes continuar sin perfil en modo exploratorio: los valores serán dBFS, no dB HL, y no se habilitará el PDF calibrado. Android requiere perfil.
3. **Ejecución:**
   - Para cada frecuencia, reproduce el tono de 1 segundo.
   - Indica si lo percibiste para avanzar al siguiente escalón, representado y reportado en dB HL.
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
