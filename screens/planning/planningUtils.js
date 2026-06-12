export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const isoDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const weekStartOf = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // Monday start
  date.setDate(date.getDate() - diff);
  return date;
};

export const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

export const weekDays = (weekStart) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, iso: isoDate(d), dayName: DAY_NAMES[i], dayNum: d.getDate() };
  });

export const fmtDisplayDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtUSD = (value) => `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
export const fmtNum = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const PLAN_STATUS_STYLE = {
  draft: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Draft' },
  submitted: { bg: '#DCFCE7', text: '#15803D', label: 'Submitted' },
  cancelled: { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelled' },
};
export const planStatusStyle = (status) => PLAN_STATUS_STYLE[status] || PLAN_STATUS_STYLE.draft;

export const isManagerRole = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());
