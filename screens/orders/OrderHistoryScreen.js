import React, { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listOrders, updateOrderStatus, deleteOrder, markOrderEmailSent, getCurrentUser,
} from '../../store/orders/orderActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtUSD(v) {
  if (v === undefined || v === null || v === '') return '—';
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtAED(v) {
  if (v === undefined || v === null || v === '') return '—';
  return `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtN(v) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('en-US');
}
function fmtDateLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CFG = {
  created:          { label: 'Created',         bg: '#EFF6FF', text: '#1D4ED8' },
  matched_in_sales: { label: 'Matched in Sales', bg: '#ECFDF5', text: '#059669' },
};
function getStatusCfg(s) {
  return STATUS_CFG[s] || { label: s || '—', bg: '#F3F4F6', text: '#6B7280' };
}

/* ─── Quick preset helpers ───────────────────────────────────────────────── */
const PRESETS = [
  { label: 'Last Month',   months: 1 },
  { label: 'Last 3 Months', months: 3 },
  { label: 'Last 6 Months', months: 6 },
  { label: 'This Year',    year: true },
];

function computePreset(preset) {
  const to  = new Date();
  let   from;
  if (preset.year) {
    from = new Date(to.getFullYear(), 0, 1);
  } else {
    from = new Date(to.getFullYear(), to.getMonth() - preset.months, 1);
  }
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  };
}

/* ─── Date picker input ──────────────────────────────────────────────────── */
function DatePicker({ label, value, onChange }) {
  return (
    <View style={styles.datePickerWrap}>
      <Text style={styles.datePickerLabel}>{label}</Text>
      <View style={styles.datePickerInput}>
        <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: globalWidth('0.68%'), color: value ? colors.textPrimary : colors.textMuted,
            fontFamily: 'inherit', cursor: 'pointer', minWidth: globalWidth('8%'),
          }}
        />
      </View>
    </View>
  );
}

/* ─── Filter Select ──────────────────────────────────────────────────────── */
function FilterSelect({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const lbl = options.find((o) => o.value === value)?.label || placeholder;
  return (
    <View style={styles.filterWrap}>
      <Pressable style={styles.filterTrigger} onPress={() => setOpen((o) => !o)}>
        <Text style={[styles.filterTriggerText, !value && { color: colors.textMuted }]}>{lbl}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.filterPanel}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.filterOpt, value === opt.value && styles.filterOptActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.filterOptText, value === opt.value && { color: colors.primary, fontWeight: '700' }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────────────── */
function StatCard({ icon, iconBg, iconColor, label, value, sub }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.statBody}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/* ─── Email Fallback Modal ───────────────────────────────────────────────── */
function EmailFallbackModal({ data, onClose }) {
  const [copied, setCopied] = useState('');
  const cp = (text, k) => {
    navigator?.clipboard?.writeText(text).catch(() => {});
    setCopied(k);
    setTimeout(() => setCopied(''), 2200);
  };
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalBox}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Ionicons name="mail-outline" size={20} color={data.missingEmail ? colors.danger : colors.primary} />
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>
            {data.missingEmail ? 'Manager email missing' : 'Email Draft'}
          </Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>
        </View>
        {data.missingEmail && (
          <View style={{ flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <Ionicons name="warning-outline" size={14} color="#92400E" />
            <Text style={{ flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 }}>
              Manager email is missing. The email client will open without a recipient.
            </Text>
          </View>
        )}
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 3 }}>
          To: <Text style={{ color: colors.textPrimary }}>{data.managerEmail || '(not set)'}</Text>
        </Text>
        {data.salesEmails?.length > 0 && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
            CC: <Text style={{ color: colors.textPrimary }}>{data.salesEmails.join(', ')}</Text>
          </Text>
        )}
        {[
          { key: 'subject', label: 'Subject', val: data.subject },
          { key: 'body',    label: 'Body',    val: data.body },
        ].map(({ key, label, val }) => (
          <View key={key} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.backgroundColor }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>{label}</Text>
              <Pressable onPress={() => cp(val, key)} style={{ flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Ionicons name={copied === key ? 'checkmark' : 'copy-outline'} size={12} color={copied === key ? colors.success : colors.primary} />
                <Text style={{ fontSize: 11, color: copied === key ? colors.success : colors.primary, fontWeight: '700' }}>
                  {copied === key ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </View>
            <Text style={{ padding: 12, fontSize: 12, color: colors.textPrimary, fontFamily: 'monospace', lineHeight: 18 }}>{val}</Text>
          </View>
        ))}
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10 }}
          onPress={() => cp(`To: ${data.managerEmail || ''}\nCC: ${data.salesEmails?.join(', ') || ''}\nSubject: ${data.subject}\n\n${data.body}`, 'all')}
        >
          <Ionicons name={copied === 'all' ? 'checkmark' : 'copy-outline'} size={14} color={colors.white} />
          <Text style={{ color: colors.white, fontSize: 13, fontWeight: '700' }}>{copied === 'all' ? 'Copied!' : 'Copy All'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function OrderHistoryScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user        = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token       = userDetails?.token || userDetails?.data?.token || '';
  const role        = user.role || '';
  const managerRole = isManager(role);

  // Default: first day of previous month → today
  const initPreset  = computePreset({ months: 1 });
  const [dateFrom,      setDateFrom]      = useState(initPreset.from);
  const [dateTo,        setDateTo]        = useState(initPreset.to);
  const [activePreset,  setActivePreset]  = useState(0); // index into PRESETS

  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterChan,    setFilterChan]    = useState('');

  const [orders,        setOrders]        = useState([]);
  const [pagination,    setPagination]    = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [summary,       setSummary]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [searched,      setSearched]      = useState(false);
  const [error,         setError]         = useState('');
  const [page,          setPage]          = useState(1);
  const [channels,      setChannels]      = useState([]);
  const [matching,      setMatching]      = useState(null);
  const [deleting,      setDeleting]      = useState(null);
  const [emailFallback, setEmailFallback] = useState(null);

  // Load channels once
  React.useEffect(() => {
    listSalesChannels(token, { limit: 50 })
      .then(({ channels: ch }) => setChannels(ch || []))
      .catch(() => {});
  }, [token]);

  const channelOptions = useMemo(() => [
    { value: '', label: 'All Channels' },
    ...channels.map((c) => ({ value: c._id || c.id, label: c.channelName || c.name })),
  ], [channels]);

  const STATUS_OPTIONS = [
    { value: '',                 label: 'All Statuses' },
    { value: 'created',          label: 'Created' },
    { value: 'matched_in_sales', label: 'Matched in Sales' },
  ];

  const fetchOrders = useCallback(async (pg = 1) => {
    if (!dateFrom || !dateTo) return;
    setLoading(true); setError(''); setSearched(true);
    try {
      const params = { page: pg, limit: 20, dateFrom, dateTo };
      if (search)       params.search    = search;
      if (filterStatus) params.status    = filterStatus;
      if (filterChan)   params.channelId = filterChan;
      const res = await listOrders(token, params);
      setOrders(Array.isArray(res.data) ? res.data : []);
      setPagination(res.pagination || { page: pg, limit: 20, total: 0, pages: 1 });
      setSummary(res.summary || null);
    } catch (e) {
      setError(e.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token, dateFrom, dateTo, search, filterStatus, filterChan]);

  const handleSearch = () => { setPage(1); fetchOrders(1); };

  const applyPreset = (idx) => {
    const p = computePreset(PRESETS[idx]);
    setDateFrom(p.from);
    setDateTo(p.to);
    setActivePreset(idx);
  };

  const handleMarkMatched = async (order) => {
    const id = order._id || order.id;
    if (!window.confirm('Mark this order as matched in sales?')) return;
    setMatching(id);
    try {
      await updateOrderStatus(token, id, { status: 'matched_in_sales' });
      fetchOrders(page);
    } catch (e) { alert(e.message || 'Failed'); }
    finally { setMatching(null); }
  };

  const handleDelete = async (order) => {
    const id  = order._id || order.id;
    const num = order.orderNumber || id;
    if (!window.confirm(`Delete order "${num}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteOrder(token, id);
      fetchOrders(page);
    } catch (e) { alert(e.message || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  const handleEmail = async (order) => {
    const accountObj  = (typeof order.accountId === 'object' ? order.accountId : null)
      || (typeof order.account === 'object' ? order.account : null);
    const accountName = accountObj?.accountName || accountObj?.name || order.accountName || '—';

    let managerEmail = '';
    let managerFirstName = 'Manager';
    try {
      const me = await getCurrentUser(token);
      managerEmail     = me?.managerEmail || '';
      const full       = me?.managerName || me?.name || '';
      managerFirstName = full.split(' ')[0] || 'Manager';
    } catch { /* silent */ }

    const salesEmails = (order.salesTeamSnapshot || []).map((m) => m.email).filter(Boolean);
    const subject     = `${accountName} order approval request`;
    const lines       = (order.items || []).map((item) => {
      const name   = item.productName
        || (typeof item.productId === 'object' ? item.productId?.productName : '')
        || 'Product';
      const qty    = item.quantity || 0;
      const focPct = item.focPercentage ?? 0;
      const focQty = Math.floor(qty * focPct / 100);
      return `${name} => ${qty} + ${focQty}`;
    });
    const body = [
      `Dear Dr. ${managerFirstName}`,
      '',
      `Kindly approved the below order for ${accountName}`,
      '',
      ...lines,
      '',
      'Regards',
    ].join('\n');

    const to  = managerEmail ? encodeURIComponent(managerEmail) : '';
    const cc  = salesEmails.length ? `&cc=${encodeURIComponent(salesEmails.join(','))}` : '';
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${cc}`;
    try { window.open(url, '_blank') || (window.location.href = url); } catch { /* ignore */ }

    if (!managerEmail) {
      setEmailFallback({ managerEmail, subject, body, salesEmails, accountName, missingEmail: true });
    }
    try { await markOrderEmailSent(token, order._id || order.id); } catch { /* silent */ }
  };

  const statsTotal   = summary?.totalOrders    ?? pagination.total;
  const statsCreated = summary?.createdCount   ?? orders.filter((o) => o.status === 'created').length;
  const statsMatched = summary?.matchedCount   ?? orders.filter((o) => o.status === 'matched_in_sales').length;
  const statsCifUSD  = summary?.totalCifUsd    ?? orders.reduce((s, o) => s + (o.totalCifUsd || 0), 0);
  const statsWhlAED  = summary?.totalWholesaleAed ?? orders.reduce((s, o) => s + (o.totalWholesaleAed || 0), 0);

  const rangeLabel = dateFrom && dateTo
    ? `${fmtDateLabel(dateFrom)} – ${fmtDateLabel(dateTo)}`
    : '';

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="OrderHistory">

      {emailFallback && (
        <EmailFallbackModal data={emailFallback} onClose={() => setEmailFallback(null)} />
      )}

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable style={styles.backBtn} onPress={() => navigation.navigate('Orders')}>
            <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
          </Pressable>
          <View>
            <Text style={styles.pageTitle}>Order History</Text>
            <Text style={styles.pageSubtitle}>Browse and filter past orders by date range</Text>
          </View>
        </View>
      </View>

      {/* ── Date range picker card ── */}
      <View style={styles.rangeCard}>
        {/* Preset buttons */}
        <View style={styles.presetRow}>
          {PRESETS.map((p, idx) => (
            <Pressable
              key={idx}
              style={[styles.presetBtn, activePreset === idx && styles.presetBtnActive]}
              onPress={() => applyPreset(idx)}
            >
              <Text style={[styles.presetText, activePreset === idx && styles.presetTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Date pickers + search */}
        <View style={styles.pickerRow}>
          <DatePicker label="From" value={dateFrom} onChange={(v) => { setDateFrom(v); setActivePreset(-1); }} />
          <View style={styles.pickerDivider}>
            <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
          </View>
          <DatePicker label="To"   value={dateTo}   onChange={(v) => { setDateTo(v);   setActivePreset(-1); }} />

          <Pressable
            style={[styles.searchBtn, (!dateFrom || !dateTo) && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!dateFrom || !dateTo}
          >
            <Ionicons name="search" size={14} color={colors.white} />
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </View>

        {rangeLabel && searched ? (
          <Text style={styles.rangeLabel}>
            <Ionicons name="time-outline" size={11} color={colors.textMuted} /> Showing orders from {rangeLabel}
          </Text>
        ) : null}
      </View>

      {/* Stats — only show after first search */}
      {searched && (
        <View style={styles.statsRow}>
          <StatCard icon="receipt-outline"          iconBg="#E8F0FF" iconColor="#0F6FFF" label="Total Orders"      value={fmtN(statsTotal)} />
          <StatCard icon="create-outline"           iconBg="#EFF6FF" iconColor="#1D4ED8" label="Created"           value={fmtN(statsCreated)}
            sub={statsTotal ? `${Math.round((statsCreated / statsTotal) * 100)}% of total` : ''} />
          <StatCard icon="checkmark-circle-outline" iconBg="#ECFDF5" iconColor="#059669" label="Matched in Sales"  value={fmtN(statsMatched)}
            sub={statsTotal ? `${Math.round((statsMatched / statsTotal) * 100)}% of total` : ''} />
          <StatCard icon="cash-outline"             iconBg="#FFF3E0" iconColor="#F97316" label="Total Value (USD)" value={fmtUSD(statsCifUSD)} />
          <StatCard icon="wallet-outline"           iconBg="#F0FFF4" iconColor="#059669" label="Total Value (AED)" value={fmtAED(statsWhlAED)} />
        </View>
      )}

      {/* Table */}
      {searched && (
        <View style={styles.tableCard}>

          {/* Inline filters */}
          <View style={styles.toolbar}>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={14} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by order #, account..."
                placeholderTextColor={colors.textSecondary}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={handleSearch}
              />
              {search ? (
                <Pressable onPress={() => { setSearch(''); }}>
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <FilterSelect value={filterStatus} options={STATUS_OPTIONS} onChange={(v) => { setFilterStatus(v); }} placeholder="All Statuses" />
            <FilterSelect value={filterChan}   options={channelOptions}  onChange={(v) => { setFilterChan(v);   }} placeholder="All Channels" />
            <Pressable style={styles.applyBtn} onPress={handleSearch}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </Pressable>
          </View>

          {/* Table head */}
          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 1.3 }]}>Order #</Text>
            <Text style={[styles.th, { flex: 2 }]}>Account</Text>
            <Text style={[styles.th, { flex: 1.4 }]}>Medical Rep</Text>
            <Text style={[styles.th, { flex: 1 }]}>Date</Text>
            <Text style={[styles.th, { flex: 1.1 }]}>Channel</Text>
            <Text style={[styles.th, { flex: 0.7, textAlign: 'right' }]}>Qty</Text>
            <Text style={[styles.th, { flex: 1.4, textAlign: 'right' }]}>CIF USD</Text>
            <Text style={[styles.th, { flex: 1.4, textAlign: 'right' }]}>Whl AED</Text>
            <Text style={[styles.th, { flex: 1 }]}>Status</Text>
            <Text style={[styles.th, { flex: 1.4 }]}>Actions</Text>
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => fetchOrders(page)}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={38} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptyText}>No orders matched the selected date range and filters.</Text>
            </View>
          ) : (
            orders.map((order, idx) => {
              const id      = order._id || order.id;
              const acct    = (typeof order.accountId === 'object' ? order.accountId : null)
                || (typeof order.account   === 'object' ? order.account   : null);
              const chan     = (typeof order.channelId === 'object' ? order.channelId : null)
                || (typeof order.channel   === 'object' ? order.channel   : null);
              const rep      = typeof order.medicalRepId === 'object' ? order.medicalRepId : null;
              const cby      = typeof order.createdBy    === 'object' ? order.createdBy    : null;
              const acctName = acct?.accountName || acct?.name || order.accountName || '—';
              const chanName = chan?.channelName  || chan?.name || order.channelName  || '—';
              const repName  = rep?.fullName  || rep?.name
                || cby?.fullName || cby?.name
                || order.repName || order.medicalRepName || '—';
              const cfg      = getStatusCfg(order.status);
              const even     = idx % 2 === 0;
              const isDel    = deleting === id;
              const isMat    = matching === id;

              return (
                <Pressable
                  key={id}
                  style={[styles.tableRow, even && styles.tableRowAlt]}
                  onPress={() => navigation.navigate('OrderDetails', { orderId: id })}
                >
                  <View style={{ flex: 1.3, minWidth: 0 }}>
                    <Text style={styles.tdLink} numberOfLines={1}>{order.orderNumber || id.slice(-8)}</Text>
                  </View>
                  <View style={{ flex: 2, minWidth: 0 }}>
                    <Text style={styles.tdText} numberOfLines={1}>{acctName}</Text>
                  </View>
                  <View style={{ flex: 1.4, minWidth: 0 }}>
                    <Text style={styles.tdText} numberOfLines={1}>{repName}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.tdMuted} numberOfLines={1}>{fmtDate(order.orderDate || order.createdAt)}</Text>
                  </View>
                  <View style={{ flex: 1.1, minWidth: 0 }}>
                    <Text style={styles.tdText} numberOfLines={1}>{chanName}</Text>
                  </View>
                  <View style={{ flex: 0.7, alignItems: 'flex-end' }}>
                    <Text style={styles.tdText}>{fmtN(order.totalQuantity)}</Text>
                  </View>
                  <View style={{ flex: 1.4, alignItems: 'flex-end', minWidth: 0 }}>
                    <Text style={styles.tdText} numberOfLines={1}>{fmtUSD(order.totalCifUsd)}</Text>
                  </View>
                  <View style={{ flex: 1.4, alignItems: 'flex-end', minWidth: 0 }}>
                    <Text style={styles.tdText} numberOfLines={1}>{fmtAED(order.totalWholesaleAed)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.statusPillText, { color: cfg.text }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1.4, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={(e) => { e.stopPropagation?.(); navigation.navigate('OrderDetails', { orderId: id }); }}
                    >
                      <Ionicons name="eye-outline" size={13} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={(e) => { e.stopPropagation?.(); handleEmail(order); }}
                    >
                      <Ionicons name="mail-outline" size={13} color="#0F6FFF" />
                    </Pressable>
                    {managerRole && order.status !== 'matched_in_sales' && (
                      <Pressable
                        style={[styles.iconBtn, isMat && { opacity: 0.5 }]}
                        onPress={(e) => { e.stopPropagation?.(); handleMarkMatched(order); }}
                        disabled={isMat}
                      >
                        {isMat
                          ? <ActivityIndicator size={11} color={colors.success} />
                          : <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />}
                      </Pressable>
                    )}
                    {managerRole && (
                      <Pressable
                        style={[styles.iconBtn, { borderColor: '#FCA5A5' }, isDel && { opacity: 0.5 }]}
                        onPress={(e) => { e.stopPropagation?.(); handleDelete(order); }}
                        disabled={isDel}
                      >
                        {isDel
                          ? <ActivityIndicator size={11} color={colors.danger} />
                          : <Ionicons name="trash-outline" size={13} color={colors.danger} />}
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}

          {/* Pagination */}
          {!loading && pagination.pages > 1 && (
            <View style={styles.pagination}>
              <Pressable
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                onPress={() => page > 1 && setPage(page - 1)}
                disabled={page <= 1}
              >
                <Ionicons name="chevron-back" size={13} color={page <= 1 ? colors.textMuted : colors.primary} />
                <Text style={[styles.pageBtnText, page <= 1 && { color: colors.textMuted }]}>Prev</Text>
              </Pressable>
              <Text style={styles.pageInfo}>
                Page {page} of {pagination.pages} · {fmtN(pagination.total)} orders
              </Text>
              <Pressable
                style={[styles.pageBtn, page >= pagination.pages && styles.pageBtnDisabled]}
                onPress={() => page < pagination.pages && setPage(page + 1)}
                disabled={page >= pagination.pages}
              >
                <Text style={[styles.pageBtnText, page >= pagination.pages && { color: colors.textMuted }]}>Next</Text>
                <Ionicons name="chevron-forward" size={13} color={page >= pagination.pages ? colors.textMuted : colors.primary} />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Prompt to search on first load */}
      {!searched && !loading && (
        <View style={styles.promptCard}>
          <Ionicons name="time-outline" size={44} color={colors.textMuted} />
          <Text style={styles.promptTitle}>Select a date range</Text>
          <Text style={styles.promptText}>
            Choose a start and end date above, then tap{' '}
            <Text style={{ fontWeight: '700', color: colors.primary }}>Search</Text>{' '}
            to load historical orders.
          </Text>
        </View>
      )}
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: globalHeight('1.8%'),
  },
  backBtn:     { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pageTitle:   { fontSize: globalWidth('1.4%'), fontWeight: '800', color: colors.textPrimary },
  pageSubtitle:{ fontSize: globalWidth('0.72%'), color: colors.textSecondary, marginTop: 2 },

  // ── Range picker card
  rangeCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: globalWidth('1.2%'),
    marginBottom: globalHeight('1.8%'), ...shadow,
  },
  presetRow: {
    flexDirection: 'row', gap: 8, marginBottom: globalHeight('1.2%'), flexWrap: 'wrap',
  },
  presetBtn: {
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.surface,
  },
  presetBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText:      { fontSize: globalWidth('0.65%'), fontWeight: '600', color: colors.textSecondary },
  presetTextActive:{ color: colors.white },

  pickerRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: globalWidth('1%'), flexWrap: 'wrap',
  },
  datePickerWrap:  { gap: 4 },
  datePickerLabel: { fontSize: globalWidth('0.58%'), fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  datePickerInput: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 9,
    paddingHorizontal: globalWidth('0.8%'), paddingVertical: globalHeight('0.9%'),
    backgroundColor: colors.backgroundColor,
  },
  pickerDivider: { paddingBottom: globalHeight('1%') },

  searchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 9,
    paddingHorizontal: globalWidth('1.2%'), paddingVertical: globalHeight('1.1%'),
  },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText:     { color: colors.white, fontSize: globalWidth('0.72%'), fontWeight: '700' },

  rangeLabel: { fontSize: globalWidth('0.6%'), color: colors.textMuted, marginTop: globalHeight('0.8%') },

  // ── Stats
  statsRow: {
    flexDirection: 'row', gap: globalWidth('1%'),
    marginBottom: globalHeight('1.8%'), flexWrap: 'wrap',
  },
  statCard: {
    flex: 1, minWidth: globalWidth('13%'),
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: globalWidth('0.9%'),
    flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.7%'), ...shadow,
  },
  statIcon:  { width: globalWidth('2.2%'), height: globalWidth('2.2%'), borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statBody:  { flex: 1 },
  statLabel: { fontSize: globalWidth('0.58%'), color: colors.textMuted, fontWeight: '600' },
  statValue: { fontSize: globalWidth('1.0%'), fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  statSub:   { fontSize: globalWidth('0.54%'), color: colors.textSecondary, marginTop: 1 },

  // ── Table
  tableCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, marginBottom: globalHeight('2%'), ...shadow,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.7%'),
    paddingHorizontal: globalWidth('1%'), paddingVertical: globalHeight('1.2%'),
    borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap',
  },
  searchWrap: {
    flex: 1, minWidth: globalWidth('16%'),
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundColor, borderRadius: 9, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: globalWidth('0.7%'),
    height: globalHeight('4.4%'), gap: globalWidth('0.4%'),
  },
  searchInput:  { flex: 1, fontSize: globalWidth('0.68%'), color: colors.textPrimary, outlineStyle: 'none' },
  applyBtn:     { borderRadius: 9, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 7 },
  applyBtnText: { fontSize: globalWidth('0.65%'), color: colors.primary, fontWeight: '700' },

  filterWrap: { position: 'relative', zIndex: 50 },
  filterTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 9, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: globalWidth('0.7%'), height: globalHeight('4.4%'),
    backgroundColor: colors.surface,
  },
  filterTriggerText: { fontSize: globalWidth('0.65%'), color: colors.textPrimary, fontWeight: '600' },
  filterPanel: {
    position: 'absolute', top: globalHeight('5%'), left: 0, zIndex: 200,
    backgroundColor: colors.surface, borderRadius: 9, borderWidth: 1,
    borderColor: colors.border, minWidth: 160,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  filterOpt:       { paddingHorizontal: 14, paddingVertical: 10 },
  filterOptActive: { backgroundColor: colors.surfaceSoft },
  filterOptText:   { fontSize: globalWidth('0.65%'), color: colors.textPrimary },

  tableHead: {
    flexDirection: 'row', paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('0.9%'), backgroundColor: colors.backgroundColor,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: { fontSize: globalWidth('0.58%'), fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  tableRow: {
    flexDirection: 'row', paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('1.1%'), alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border, cursor: 'pointer',
  },
  tableRowAlt: { backgroundColor: colors.backgroundColor },
  tdLink:  { fontSize: globalWidth('0.7%'), fontWeight: '700', color: colors.primary },
  tdText:  { fontSize: globalWidth('0.68%'), color: colors.textPrimary },
  tdMuted: { fontSize: globalWidth('0.65%'), color: colors.textSecondary },

  statusPill:    { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusPillText:{ fontSize: globalWidth('0.58%'), fontWeight: '700' },

  iconBtn: {
    width: 28, height: 28, borderRadius: 6,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  centered:    { alignItems: 'center', justifyContent: 'center', paddingVertical: globalHeight('4%'), gap: 8 },
  loadingText: { fontSize: globalWidth('0.7%'), color: colors.textSecondary },
  errorText:   { fontSize: globalWidth('0.7%'), color: colors.danger },
  retryBtn:    { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  retryText:   { color: colors.primary, fontWeight: '700', fontSize: globalWidth('0.7%') },
  emptyState:  { alignItems: 'center', paddingVertical: globalHeight('5%'), gap: 8 },
  emptyTitle:  { fontSize: globalWidth('0.85%'), fontWeight: '700', color: colors.textPrimary },
  emptyText:   { fontSize: globalWidth('0.7%'), color: colors.textSecondary, textAlign: 'center' },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: globalWidth('0.9%'), gap: globalWidth('0.7%'),
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  pageBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, borderWidth: 1, borderColor: colors.border, paddingHorizontal: globalWidth('0.7%'), paddingVertical: globalHeight('0.6%') },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText:     { fontSize: globalWidth('0.65%'), color: colors.primary, fontWeight: '700' },
  pageInfo:        { fontSize: globalWidth('0.65%'), color: colors.textSecondary, fontWeight: '600' },

  // ── First-load prompt
  promptCard: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, paddingVertical: globalHeight('8%'),
    gap: 10, ...shadow,
  },
  promptTitle: { fontSize: globalWidth('0.9%'), fontWeight: '800', color: colors.textPrimary },
  promptText:  { fontSize: globalWidth('0.72%'), color: colors.textSecondary, textAlign: 'center', maxWidth: globalWidth('36%') },

  // ── Email fallback modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  modalBox: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 24,
    width: globalWidth('42%'), maxWidth: 560, ...shadow, gap: 8,
  },
});
