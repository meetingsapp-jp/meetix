// Role model for the single agency (tenant) in this MVP.
// Real Supabase Auth sign-up is intentionally NOT wired yet (per project rules) —
// this is a simple role-based access setup for building and testing views.

export type Role =
  | 'director_general'
  | 'director_eventos'
  | 'planificador'
  | 'guia_coordinador';

export const ROLES: { id: Role; label: string }[] = [
  { id: 'director_general', label: 'Director General' },
  { id: 'director_eventos', label: 'Director de Eventos' },
  { id: 'planificador', label: 'Planificador' },
  { id: 'guia_coordinador', label: 'Guía / Coordinador' },
];

// Coarse permission map used to gate UI. Refined per module as we build.
export const PERMISSIONS: Record<Role, { manageEvents: boolean; managePassengers: boolean; exportData: boolean }> = {
  director_general:  { manageEvents: true,  managePassengers: true,  exportData: true },
  director_eventos:  { manageEvents: true,  managePassengers: true,  exportData: true },
  planificador:      { manageEvents: false, managePassengers: true,  exportData: true },
  guia_coordinador:  { manageEvents: false, managePassengers: false, exportData: true },
};
