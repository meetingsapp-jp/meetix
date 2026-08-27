# MEETIX — Próximos Pasos (Roadmap Post-Demo)

## Fase 1: Personas & Directorio (P0 — Crítico)

### 1.1 **People Directory Page**
Página para ver/editar el directorio de personas (decoupled from events).

**UI:**
- Buscar por: nombre, documento, email
- Listar personas: nombre, email, teléfono, documento
- Click: abre card con historial de eventos (qué eventos asistió)
- Edit: cambiar datos (nombre, email, teléfono, dietary, alergias, special needs, contacto emergencia)
- Botón "+ Nueva persona"

**Archivo:** `src/features/people/PeoplePage.tsx`

**Data layer:** Ya existe `src/data/passengers.ts` que maneja personas.

**Tiempo:** 2-3 horas

---

## Fase 2: Notificaciones en Vivo (P1 — Alta prioridad)

### 2.1 **Toast notifications en Dashboard**
Cuando hay eventos en tiempo real, mostrar notificación:
```
"✓ Juan Pérez llegó (AA123, 14:30)" → auto-close en 5s
"⚠️ Alergia reportada: Carlos López" → rojo, no auto-close
```

**Implementación:**
- Toast context + provider
- Escuchar cambios en `arrival_checkins` (INSERT)
- Escuchar cambios en `incidents` (INSERT donde severity='urgent')

**Archivos:** `src/components/Toast.tsx`, `src/providers/ToastProvider.tsx`

**Tiempo:** 1-2 horas

### 2.2 **Notificación en Coordinador tab badge**
- Badge en tab "Recepción" mostrando "3 llegaron en los últimos 5 min"
- Auto-dismiss después de 2 llegadas

**Tiempo:** 30 min

---

## Fase 3: Check-in por QR (P2 — Media prioridad)

### 3.1 **QR Scanner en Recepción**
Botón "📱 Escanear QR" abre modal con:
- `<input type="file" accept="image/*">` para cámara
- Usa librería `jsQR` o `qr-scanner`
- QR contiene: `passenger_id` o `flight_number` o `document_id`
- Al detectar QR: auto-marca como "llegó" + toast

**Data:** Generar QRs en PDF itinerario (pasajero imprime/recibe código)

**Librería:** `qr-scanner` (más rápida que jsQR)

**Tiempo:** 2-3 horas

---

## Fase 4: Directorio de Compañías & Coordinadores (P2 — Soporte)

### 4.1 **Company Settings Page**
- Ver lista de direcciones (todos los coordinadores/guías de la agencia)
- Invitar nuevo coordinador (admin solo)
- Ver historial: qué coordinador trabajó en qué evento

**Tiempo:** 1-2 horas (usa mismo flujo que Team)

---

## Fase 5: Contacto Masivo (P1 — Alta prioridad)

### 5.1 **Send to missing** en Recepción
Botón: "📞 Contactar faltantes" → abre modal:
- Lista de NO-llegados
- Seleccionar: todos / solo VIP / selección manual
- Enviar vía: WhatsApp / SMS / Email
- Mensaje template: "¡Hola {{name}}! ¿Dónde estás? Tu vuelo {{flight}} llega a las {{time}}."

**Implementación:**
- Template i18n
- Integración WhatsApp API (ya existe `waHref` para wa.me)
- Email: Supabase Function que envía via Resend/SendGrid

**Tiempo:** 2-3 horas

---

## Fase 6: Dashboard Real-time (P0 — Crítico)

### 6.1 **Auto-sync Dashboard**
Actualmente Dashboard se carga una sola vez. Agregar listeners para:
- Pasajeros llegados (arrival_checkins)
- Incidencias nuevas
- Sesiones (si hay cambios en agenda)

**Igual a CoordinatorPage:** usar `useEffect` + `supabase.channel().on()`

**Tiempo:** 1 hora

---

## Fase 7: Historial de Cambios (P3 — Refinamiento)

### 7.1 **Audit log**
Tabla `audit_log` que registra:
- Quién marcó "llegó" (coordinador)
- Cuándo
- Pasajero
- IP / dispositivo

Usar Supabase `auth.uid()` en trigger RLS.

**Tiempo:** 1-2 horas

---

## Fase 8: Asistencia & Presencia (P2 — Refinamiento)

### 8.1 **Session attendance**
En cada sesión, coordinador marca asistencia:
- Tab en CoordinatorPage: "Check-in sesión"
- Lista de asistentes (de esa sesión)
- Botón para cada persona: "✓ Presente / ⚪ Falta"
- Guarda en `attendance` table

**Tiempo:** 1-2 horas

---

## Timeline sugerido

**Semana 1 (demo Jimena):**
- ✅ Real-time sync en `arrival_checkins` + `incidents` (HECHO)
- Notificaciones toast en Dashboard (Fase 2.1)

**Semana 2:**
- People Directory (Fase 1)
- Dashboard real-time (Fase 6)

**Semana 3:**
- Contacto masivo (Fase 5)
- QR Scanner (Fase 3) — SI Jimena lo pide

**Semana 4+:**
- Refinos (historial, asistencia, auditoría)

---

## Estimación total

| Fase | Componente | Horas | Prioridad |
|------|-----------|-------|-----------|
| 1 | People Directory | 3 | P0 |
| 2.1 | Notificaciones Dashboard | 2 | P1 |
| 2.2 | Badge Recepción | 0.5 | P1 |
| 3 | QR Scanner | 3 | P2 |
| 4 | Company Coordinators | 2 | P2 |
| 5 | Contacto masivo | 3 | P1 |
| 6 | Dashboard real-time | 1 | P0 |
| 7 | Audit log | 2 | P3 |
| 8 | Asistencia sesiones | 2 | P2 |
| **Total** | | **18.5h** | |

**Si ponen 2 personas:** ~2.5 días  
**Una persona a tiempo completo:** ~3 días

---

## Criterio de Done

- ✅ Compila sin errores TS
- ✅ Se deplyó a staging
- ✅ Se testeó con 2+ tabs abiertas (real-time sync verificado)
- ✅ Anda en móvil (responsive)
- ✅ Se committeó con mensaje claro

