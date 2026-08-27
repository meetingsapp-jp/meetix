# MEETIX — Arquitectura de Sincronización en Tiempo Real

## ¿Cómo funciona el sync?

**ANTES (v1):** Datos se cargaban una sola vez. Si coordinador marcaba "llegó", owner no veía el cambio hasta refrescar.

**AHORA (v2):** Supabase **Realtime** (WebSocket) permite que cualquier usuario vea cambios **instantáneamente** (<100ms típico).

---

## Implementación

### 1. **Supabase Realtime activado**
```sql
-- Tablas con real-time habilitado:
- arrival_checkins     (coordinador marca llegadas)
- incidents            (coordinador registra problemas)
- passengers           (cambios en pasajeros)
- sessions             (cambios en agenda)
```

### 2. **React Hooks para sincronización**

**Archivo:** `src/lib/useRealtime.ts`

```typescript
useRealtimeList<T>(table, query, deps)
  // Escucha INSERT/UPDATE/DELETE en tabla
  // Auto-recarga los datos cuando hay cambios
  // Retorna: [data, loading, error]

useRealtimeValue<T>(table, selector, deps)
  // Para valores individuales (ej: contador de llegadas)
  // Retorna: [value, loading, error]
```

### 3. **Aplicación en CoordinatorPage**
```typescript
// Listener que recarga datos cuando hay cambios en:
- arrival_checkins (cuando coordinador marca "llegó")
- incidents (cuando coordinador registra problema)

useEffect(() => {
  const channel = supabase
    .channel(`coordinator:${eventId}`)
    .on('postgres_changes', { table: 'arrival_checkins' }, () => load())
    .on('postgres_changes', { table: 'incidents' }, () => load())
    .subscribe();
  
  return () => channel.unsubscribe();
}, [eventId, load]);
```

---

## Flujo de datos en tiempo real

### Escenario: Coordinador marca pasajero como "llegó"

```
1. COORDINADOR (en Recepción tab)
   └─ Click "Marcar llegó" en pasajero
   └─ Llama setArrived(agencyId, passengerId, true)

2. BASE DE DATOS (Supabase)
   └─ INSERT arrival_checkins (passenger_id, arrived_at)
   └─ Broadcast a TODOS los clientes suscritos

3. OWNER + OTROS DIRECTORES (en Dashboard, ven cambios)
   ├─ Listener recibe evento de INSERT en arrival_checkins
   ├─ Recarga datos automáticamente (listArrivedIds, etc.)
   └─ Estado actualiza: "Llegaron: 5/16" (antes era 4/16)

4. TIEMPO TOTAL: ~50-200ms
```

---

## Qué se sincroniza en tiempo real

| Tabla | Evento | Quién lo dispara | Quién ve |
|-------|--------|-----------------|----------|
| `arrival_checkins` | INSERT/DELETE | Coordinador marca "llegó" | Owner + directores ven contador actualizado |
| `incidents` | INSERT/UPDATE/DELETE | Coordinador registra problema | Owner ve badge rojo de incidencias, cuenta actualizada |
| `passengers` | UPDATE | Director edita pasajero | Coordinador ve cambios (hotel, room, dieta) |
| `sessions` | INSERT/UPDATE/DELETE | Director edita agenda | Coordinador ve cambios en Funciones tab |

---

## Latencia esperada

**Conexión local/mismo país:** <100ms  
**Conexión internacional:** 100-300ms  
**Supabase paused (free-tier):** Sin cambios (esperando activación)

### Nota: Region Supabase
Actual: `us-east-2` (Virginia, USA)  
Para Argentina: `us-east-1` o `sa-east-1` (Brasil) reduciría latencia pero requiere crear proyecto nuevo.  
Decision: post-demo, si Jimena lo necesita.

---

## Cómo probar

1. **2 pestañas del navegador:**
   - Pestaña 1: Director General en Dashboard
   - Pestaña 2: Coordinador en Recepción

2. **Acciones:**
   - En Recepción: Click "Marcar llegó" en primer pasajero
   - En Dashboard: Ver que contador "Llegaron" cambia **al instante**

3. **Incidencias:**
   - En Incidencias: Registrar problema
   - En Dashboard: Ver badge rojo con contador actualizado

---

## Limitaciones actuales

1. **Events y Sessions** — están en real-time pero CoordinatorPage solo recarga manualmente
   - Fix: Aplicar mismo patrón a FuncionesTab (TBD)

2. **Passenger list** — cambios en datos de pasajero no actualizan tab Pasajeros en vivo
   - Fix: Agregar listener a passengers table (TBD)

3. **No hay notificaciones visuales** — datos se actualizan silenciosamente
   - Fix: Toast/modal "Nueva llegada: Juan..." (TBD, próximo paso)

---

## Próximos pasos

1. ✅ Real-time en arrival_checkins + incidents (HECHO)
2. ⏳ Notificaciones visuales cuando hay cambios
3. ⏳ Real-time en passengers + sessions
4. ⏳ Dashboard: agregar listeners para que actualice sin recarga

