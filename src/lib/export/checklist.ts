import type { EventRow } from '../../types';
import type { EventTask } from '../../data/tasks';
import { exportCsv } from './csv';
import { slug } from './download';

export interface ChecklistLabels {
  task: string;
  assignee: string;
  due: string;
  status: string;
  done: string;
  pending: string;
}

export function exportChecklistCsv(event: EventRow, tasks: EventTask[], L: ChecklistLabels) {
  const headers = [L.task, L.assignee, L.due, L.status];
  const rows = tasks.map((t) => [t.title, t.assignee ?? '', t.due_date ?? '', t.done ? L.done : L.pending]);
  exportCsv(`checklist-${slug(event.name)}.csv`, headers, rows);
}
