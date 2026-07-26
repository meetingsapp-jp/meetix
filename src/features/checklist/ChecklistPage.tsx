import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import { inputClass } from '../../components/ui/Field';
import { getEvent } from '../../data/passengers';
import { createTask, deleteTask, listTasks, toggleTask, type EventTask } from '../../data/tasks';
import type { EventRow } from '../../types';

export default function ChecklistPage() {
  const { eventId = '' } = useParams();
  const { t } = useTranslation();
  const { agency, can } = useAuth();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ev, ts] = await Promise.all([getEvent(eventId), listTasks(eventId)]);
      setEvent(ev);
      setTasks(ts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) refresh();
  }, [eventId, refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !agency) return;
    setAdding(true);
    try {
      const created = await createTask(agency.id, eventId, {
        title: title.trim(),
        assignee: assignee.trim() || null,
        due_date: dueDate || null,
      });
      setTasks((prev) => [...prev, created]);
      setTitle('');
      setAssignee('');
      setDueDate('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function toggle(task: EventTask) {
    try {
      await toggleTask(task.id, !task.done);
      setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, done: !task.done } : x)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(task: EventTask) {
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((x) => x.id !== task.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const doneCount = tasks.filter((x) => x.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-3xl">
      <div className="mb-1 text-sm text-slate-500">
        <Link to="/events" className="hover:underline">{t('nav.events')}</Link>
        <span> / {event?.name ?? '…'}</span>
      </div>
      <h1 className="mb-3 text-2xl font-semibold">{t('checklist.title')}</h1>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tasks.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{t('checklist.progress', { done: doneCount, total: tasks.length })}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {can.managePassengers && (
        <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <label className="flex-1 min-w-[180px]">
            <span className="mb-1 block text-xs font-medium text-slate-600">{t('checklist.task')}</span>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t('checklist.taskPlaceholder')} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">{t('checklist.assignee')}</span>
            <input className={`${inputClass} max-w-[150px]`} value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">{t('checklist.due')}</span>
            <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <Button type="submit" disabled={adding}>{t('checklist.add')}</Button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : tasks.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">{t('checklist.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {tasks.map((task) => {
            const overdue = task.due_date && !task.done && task.due_date < today;
            return (
              <li key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggle(task)}
                  disabled={!can.managePassengers}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${task.done ? 'text-slate-400 line-through' : ''}`}>{task.title}</div>
                  <div className="text-xs text-slate-400">
                    {task.assignee && <span>{task.assignee}</span>}
                    {task.assignee && task.due_date && <span> · </span>}
                    {task.due_date && (
                      <span className={overdue ? 'font-medium text-red-600' : ''}>
                        {t('checklist.due')}: {task.due_date}
                      </span>
                    )}
                  </div>
                </div>
                {can.managePassengers && (
                  <Button variant="ghost" className="text-red-600" onClick={() => remove(task)}>
                    {t('common.delete')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
