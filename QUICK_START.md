# 🚀 MisFinanzas APK - Quick Start

## Resumen Rápido

Tienes un proyecto Android completo listo para compilar. Sigue estos pasos y tendrás la app en tu celular en 15 minutos.

---

## 📱 Instalación Ultra-Rápida

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/mecanicoproapp-maker/misfinanzas.git
cd misfinanzas
```

### Paso 2: Descargar Android Studio
- Ve a: https://developer.android.com/studio
- Descarga e instala (es gratis)

### Paso 3: Abrir en Android Studio
1. Abre Android Studio
2. **File** → **Open**
3. Selecciona la carpeta `android/` del proyecto
4. Espera a que sincronice Gradle

### Paso 4: Compilar APK
```bash
cd android
./gradlew assembleDebug
```

**O desde Android Studio:**
- **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**

### Paso 5: Instalar en tu Celular

#### Con Cable USB:
```bash
# Asegúrate de tener USB Debugging habilitado
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### Sin Cable:
1. Abre el archivo `app-debug.apk` desde tu celular
2. Toca **Instalar**

---

## ✅ ¿Qué Obtienes?

✅ App completa de gestión de finanzas  
✅ Funciona sin internet (offline)  
✅ Interfaz moderna y oscura  
✅ Datos guardados en tu celular  

---

## 📍 Ubicación del APK Compilado

Después de compilar, encontrarás el APK en:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🛠️ Requisitos

- **Android Studio** 2022.1+
- **JDK** 11+ (incluido en Android Studio)
- **Android SDK 34** (se descarga automáticamente)
- **Cable USB** (opcional, puedes instalar sin cable)

---

## ⚠️ Si Algo Falla

### Error: "SDK not found"
- Abre SDK Manager en Android Studio
- Instala Android SDK API 34

### Error: "Gradle sync failed"
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Error: "Device not found"
- Habilita USB Debugging en tu celular:
  - Configuración → Acerca del Teléfono
  - Toca "Build Number" 7 veces
  - Vuelve a Configuración → Opciones de Desarrollador
  - Activa "Depuración USB"

---

## 🎥 Pasos Visuales

```
[1] Clonar repo
        ↓
[2] Instalar Android Studio
        ↓
[3] Abrir proyecto en Android Studio
        ↓
[4] Click en Build → Build APK
        ↓
[5] Conectar celular por USB
        ↓
[6] Instalar APK
        ↓
[7] ¡Listo! Abre la app en tu celular
```

---

## 📞 Soporte

Si necesitas ayuda:
1. Lee el README.md del proyecto
2. Verifica que tengas todos los requisitos
3. Abre un Issue en GitHub

---

**¡Disfruta tu app de finanzas!** 💰
