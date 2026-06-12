export const isManagerRole = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

export const PRIORITY_STYLE = {
  low: { bg: '#F1F5F9', text: '#64748B', label: 'Low' },
  medium: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Medium' },
  high: { bg: '#FFFBEB', text: '#B45309', label: 'High' },
  urgent: { bg: '#FEF2F2', text: '#DC2626', label: 'Urgent' },
};
export const priorityStyle = (p) => PRIORITY_STYLE[p] || PRIORITY_STYLE.medium;

export const STATUS_STYLE = {
  active: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Active' },
  completed: { bg: '#DCFCE7', text: '#15803D', label: 'Completed' },
  cancelled: { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelled' },
  archived: { bg: '#F1F5F9', text: '#64748B', label: 'Archived' },
};
export const statusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE.active;

export const typeStyle = (t) => (t === 'recurring'
  ? { bg: '#F5F3FF', text: '#7C3AED', label: 'Recurring', icon: 'repeat-outline' }
  : { bg: '#ECFEFF', text: '#0E7490', label: 'Checklist', icon: 'checkbox-outline' });

export const occStatusStyle = (s) => {
  if (s === 'completed') return { bg: '#DCFCE7', text: '#15803D', label: 'Completed' };
  if (s === 'partially_completed') return { bg: '#FFFBEB', text: '#B45309', label: 'Partial' };
  if (s === 'overdue') return { bg: '#FEF2F2', text: '#DC2626', label: 'Overdue' };
  return { bg: '#F1F5F9', text: '#64748B', label: 'Pending' };
};

export const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
export const fmtDateTime = (value) => `${fmtDate(value)} ${fmtTime(value)}`;

export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export const dueLabel = (daysRemaining) => {
  if (daysRemaining == null) return '';
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d overdue`;
  if (daysRemaining === 0) return 'Due today';
  return `${daysRemaining}d left`;
};
