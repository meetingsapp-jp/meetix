# MEETIX — TODO FINAL (Antes de Demo Jimena Viernes 28/8)

## 🔴 CRÍTICO HOY (6-8 horas)

### 1. Password Reset Fix (5 min — MANUAL)
**Acción:** En Supabase Console
```
https://supabase.com/dashboard/project/rkrtoozowhahymrzpfkn/settings/auth
→ Authentication > URL Configuration
→ Site URL: Cambiar a https://meetixapp.pages.dev
→ Guardar
```

### 2. Team Edit + Create User (2-3 horas)

**Qué agregar en TeamPage:**

```typescript
// Tabla con 4 columnas:
// - Nombre
// - Email
// - Rol (editable via dropdown)
// - Acciones (Editar rol, Enviar invitación, Eliminar)

// Dos modales:
// 1. EditRoleModal - cambiar rol de usuario existente
// 2. SendInviteModal - enviar invitación por WhatsApp/Email/Copy link
```

**Funcionalidad:**

A) **Editar rol de usuario existente**
- Click en dropdown "Rol" o botón "Editar"
- Modal con opciones de rol
- Save → actualiza `app_users.role`
- Notificación: "Rol actualizado para Juan"

B) **Enviar invitación a usuario existente**
- Botón "Enviar invitación" en cada fila
- Modal con 3 opciones:
  - 📋 Copiar link (existente)
  - 📱 WhatsApp: `Hola Juan, tu invitación a MEETIX: https://...`
  - 📧 Email: "Te invitamos a MEETIX. Acceso aquí: https://..."
- Usa Supabase Auth `generateLink()` para generar link fresco

**Archivos:**
- Editar: `src/features/team/TeamPage.tsx`
- Agregar: `src/lib/sendInvite.ts` (helper para WhatsApp/Email)

---

### 3. Traslados Modal — Click pasajero (1-1.5 horas)

**Qué agregar:**
- En CoordinatorPage, tabs "Recepción" + "Despacho"
- Click en nombre pasajero → Modal con:
  - Foto/datos pasajero
  - Vuelo + terminal + hora
  - Hotel + room
  - Dieta/alergias/especiales
  - **Proveedor asignado**
  - **Botón llamar proveedor** + WhatsApp
  - Botón "Editar traslado"

**Archivos:**
- Crear: `src/features/coordinator/PassengerTransportModal.tsx`
- Editar: `src/features/coordinator/CoordinatorPage.tsx` (RecepcionTab + DespachoTab)

---

### 4. Horarios Scheduled vs Actual (1.5-2 horas)

**DB Changes:**
```sql
-- Agregar a tabla flights:
ALTER TABLE flights ADD COLUMN scheduled_datetime timestamp;
ALTER TABLE flights ADD COLUMN actual_datetime timestamp;
ALTER TABLE flights RENAME COLUMN flight_datetime TO scheduled_datetime;

-- Crear trigger para llenar actual_datetime cuando coordinador marca "llegó"
```

**UI Changes:**
- RecepcionTab: mostrar "Programado: 14:30 → Llegó: 14:45"
- DespachoTab: mostrar "Vuelo: 20:15" vs "Despega: 20:20"
- DashboardPage: mostrar próximos vuelos con horarios

---

### 5. Pasajeros Locales (2-2.5 horas)

**DB Changes:**
```sql
-- Agregar a passengers:
ALTER TABLE passengers ADD COLUMN is_local_transfer boolean DEFAULT false;
ALTER TABLE passengers ADD COLUMN origin_address text;
ALTER TABLE passengers ADD COLUMN destination_address text;

-- Crear tabla local_terminals:
CREATE TABLE local_terminals (
  id uuid PRIMARY KEY,
  agency_id uuid REFERENCES agencies,
  name text,
  address text,
  city text,
  coordinates point
);
```

**UI Changes:**
- PassengerForm: checkbox "¿Transporte local?" → mostrar origin/destination
- Traslados tab: diferenciar entre vuelos y locales
- Coordinador Recepción: mostrar "Llegada local de [dirección]"

---

### 6. Google Maps Integration (3 horas)

**Lo mínimo:**
- Embed Maps en modal de traslado para ver dirección
- Validar dirección con Google Geocoding API
- Mostrar terminal en mapa antes de enviar

**Archivos:**
- Crear: `src/lib/maps.ts` (helper para Google Maps)
- Editar: PassengerTransportModal (agregar mapa)

---

## 📊 TIMELINE ESTIMADO

| Tarea | Horas | Prioridad | Para viernes? |
|-------|-------|-----------|--------------|
| Password reset fix | 0.1 | P0 | ✅ SÍ |
| Team edit + create | 2.5 | P0 | ✅ SÍ |
| Traslados modal | 1.5 | P0 | ✅ SÍ |
| Horarios scheduled | 1.5 | P1 | ❓ Si hay tiempo |
| Pasajeros locales | 2.5 | P1 | ❓ Post-demo |
| Google Maps | 3 | P2 | ❌ POST-DEMO |
| **TOTAL** | **10.6h** | | |

**Si trabaja 1 persona:** 1.5 días (HOY + mañana)  
**Si trabajan 2 personas:** 7 horas (HOY solo)

---

## 🎯 MÍNIMO VIABLE PARA VIERNES

✅ Password reset fix (manual)  
✅ Team edit + create users  
✅ Traslados modal con proveedor  
⏳ Horarios (opcional, si hay tiempo)  
❌ Pasajeros locales (post-demo)  
❌ Maps (post-demo)

**Este stack ya es COMPLETO para que Jimena vea que:**
- Owner controla equipo
- Coordinador gestiona en terreno
- Traslados tienen contacto proveedor
- Todo en tiempo real

---

## 🚀 PRÓXIMOS PASOS

**Hoy:**
1. Password reset: 5 min (manual en Supabase)
2. Team edit: 2.5h (code)
3. Traslados modal: 1.5h (code)

**Mañana (si queda):**
4. Horarios: 1.5h
5. Deploy final

**Post-viernes:**
6. Pasajeros locales
7. Google Maps
8. Notificaciones toast
9. People Directory
10. QR Scanner

