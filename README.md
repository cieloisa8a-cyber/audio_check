# Audio Check (prototipo exploratorio)

Aplicacion local de prueba auditiva orientativa. No sustituye una audiometria clinica ni produce valores dB HL: el navegador no conoce la calibracion acustica de los audifonos, el dispositivo ni el volumen del sistema.

## Requisitos

- Python 3.9 o posterior
- VS Code con las extensiones Python (`ms-python.python`) y Pylance (`ms-python.vscode-pylance`); opcionalmente, EditorConfig
- Para abrir desde otro dispositivo por Wi-Fi: ambos en la misma red y el firewall del Mac permitiendo el puerto elegido

## Preparacion y ejecucion

Desde esta carpeta, crea un entorno virtual e instala las dependencias:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

En el Mac abre `http://127.0.0.1:8000`. Obtén la IP de la interfaz Wi-Fi con `ipconfig getifaddr en0` y abre `http://IP_DEL_MAC:8000` en Safari del iPhone (por ejemplo, `http://192.168.1.23:8000`). Si `en0` no devuelve una IP, revisa la interfaz activa en Ajustes del Sistema > Red.

### Inicio automatico en macOS

Para mantener la web disponible sin iniciar Uvicorn manualmente, copia la aplicacion y las dependencias Python fuera de OneDrive y luego instala el LaunchAgent incluido en `macos/`:

```sh
mkdir -p "$HOME/Library/Application Support/AudioCheck"
cp -R backend frontend "$HOME/Library/Application Support/AudioCheck/"
cp -R .venv/lib/python3.9/site-packages "$HOME/Library/Application Support/AudioCheck/python-packages"
mkdir -p ~/Library/LaunchAgents
cp macos/com.audiocheck.web.plist "$HOME/Library/LaunchAgents/"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.audiocheck.web.plist"
```

El servidor arrancara al iniciar sesion y se reiniciara si se detiene. La Mac debe estar encendida y conectada a la red. La copia en `~/Library/Application Support/AudioCheck` no se sincroniza automaticamente con la carpeta fuente; despues de actualizar el backend o frontend, vuelve a copiar esas carpetas. Los registros quedan en `~/Library/Logs/audiocheck-web*.log`. Para desactivarlo:

```sh
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.audiocheck.web.plist"
rm "$HOME/Library/LaunchAgents/com.audiocheck.web.plist"
```

El nombre Bonjour de esta Mac es `macbook-pro-de-juan.local`. No se cambio a `audiocheck.local`, para conservar el nombre de red existente; por eso usa `http://macbook-pro-de-juan.local:8000` o la IP local desde otros dispositivos conectados al mismo Wi-Fi.

HTTP por IP permite probar la interfaz, pero no es un contexto seguro: iOS Safari no habilita el Service Worker ni la instalacion PWA de forma fiable. Para probar la PWA sobre la red local con HTTPS:

1. Instala mkcert en el Mac (`brew install mkcert`) y crea su CA local (`mkcert -install`).
2. Desde esta carpeta ejecuta `mkdir -p certs` y `mkcert -cert-file certs/local.pem -key-file certs/local-key.pem IP_DEL_MAC localhost 127.0.0.1`, sustituyendo `IP_DEL_MAC` por la IP obtenida arriba.
3. Obtén la carpeta de la CA con `mkcert -CAROOT` y transfiere **solo** `rootCA.pem` al iPhone. Instala el perfil descargado en Ajustes > General > VPN y gestión de dispositivos; luego activa la confianza completa en Ajustes > General > Información > Ajustes de confianza de certificados. No compartas `rootCA-key.pem`.
4. Inicia el servidor con `.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --ssl-certfile certs/local.pem --ssl-keyfile certs/local-key.pem` y abre `https://IP_DEL_MAC:8000` en Safari.

Los certificados locales quedan ignorados por Git.

## Aplicacion Android instalable

El proyecto Android esta en `android/`. La app incluye los archivos del frontend dentro del APK y genera el PDF en el propio dispositivo; no necesita que la Mac este encendida ni una conexion a internet durante el uso.

Para generar un APK de depuracion, abre `android/` en Android Studio y ejecuta **Build > Build APK(s)**, o desde esta carpeta ejecuta:

```sh
cd android
gradle assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Copialo al Android e instalalo; puede ser necesario permitir temporalmente la instalacion desde esa fuente en Ajustes. La app requiere Android 10 (API 29) o posterior. Para distribuirla fuera de pruebas, genera y firma un APK de lanzamiento desde Android Studio.

La app Android detecta auriculares cableados y USB, bloquea la interfaz si no estan conectados y la habilita al conectarlos. Guarda los PDF en `Descargas/Audio Check` y comparte el archivo mediante el menu nativo del dispositivo.

La version web avisa si el navegador no reporta una salida de auriculares. Se puede continuar sin ellos, pero la experiencia auditiva puede ser limitada; la deteccion web no esta disponible en todos los navegadores. La APK Android, en cambio, conserva la deteccion nativa obligatoria y bloquea la prueba hasta conectar auriculares cableados o USB. En la web, la exportacion PDF sigue usando el servidor FastAPI.

## Uso

1. Conecta los audifonos cableados o USB, baja el volumen y marca ambas confirmaciones en pantalla. La APK verifica la salida cableada/USB con Android. La web depende de que el navegador reporte esa salida; la confirmacion visual no es una validacion clinica ni permite medir la calibracion acustica.
2. Inicia cada oido por separado. En cada frecuencia, reproduce el tono y registra si lo percibiste. Detente ante dolor o molestia.
3. Exporta el resumen PDF o usa Compartir para abrir el menu nativo del dispositivo. WhatsApp aparecera si esta instalado y acepta el archivo.

Los niveles mostrados son dBFS relativos del generador digital, no dB SPL ni dB HL. El volumen fisico depende del dispositivo, DAC, audifonos y sistema operativo. Esta aplicacion no debe usarse para diagnosticar ni para tomar decisiones clinicas.

## Estructura

```text
audiometro-pwa/
|-- backend/
|   `-- app/
|       |-- main.py
|       |-- reports.py
|       `-- schemas.py
|-- frontend/
|   |-- index.html
|   `-- static/
|       |-- app.css
|       |-- app.js
|       |-- icon.svg
|       |-- icons/
|       |   |-- icon-192.png
|       |   `-- icon-512.png
|       |-- manifest.webmanifest
|       `-- sw.js
|-- .gitignore
|-- README.md
`-- requirements.txt
```
