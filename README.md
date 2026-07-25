# EventOps

Event / MICE (Meetings & Incentives) management platform — MVP.

A standalone, independent project. It reuses **architecture patterns** (multi-tenant
structure, role-based access, RLS approach, PWA setup, reusable UI components) from a
reference codebase, but shares **no** code, data, or backend with it.

## Tech stack
- React 18 + Vite + TypeScript
- Tailwind CSS
- Supabase (a **new, separate** project — credentials supplied via `.env`, never committed)
- PWA via `vite-plugin-pwa`
- Exports: SheetJS (Excel/CSV), jsPDF (VIP transport PDF)

## Getting started
```bash
npm install
cp .env.example .env   # then fill with your own Supabase URL + anon key
npm run dev
```

Without a `.env`, the app runs in **demo mode** (no database calls).

## MVP scope
1. Multi-tenant structure (one agency; roles: Director General, Director de Eventos, Planificador, Guía/Coordinador)
2. Events module
3. Passengers/attendees per event
4. Ground transportation view (VIP vs group) + VIP export
5. Basic dashboard
6. Export passenger list to Excel/CSV
7. Responsive PWA

## Status
Scaffold + role-based access stub. Database schema pending approval before any
migration is applied.
