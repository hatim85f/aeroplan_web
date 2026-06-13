import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  getOrderById, updateOrderStatus, deleteOrder, markOrderEmailSent, getCurrentUser,
} from '../../store/orders/orderActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function fmtUSD(v) {
  if (v === undefined || v === null) return '—';
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtAED(v) {
  if (v === undefined || v === null) return '—';
  return `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtN(v) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('en-US');
}

const STATUS_CFG = {
  created:          { label: 'Created',          bg: '#EFF6FF', text: '#1D4ED8' },
  matched_in_sales: { label: 'Matched in Sales',  bg: '#ECFDF5', text: '#059669' },
};
function getStatusCfg(s) {
  return STATUS_CFG[s] || { label: s || '—', bg: '#F3F4F6', text: '#6B7280' };
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}
function InfoRow({ label, value, children }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {children
        ? <View style={styles.infoValue}>{children}</View>
        : <Text style={styles.infoValue}>{value ?? '—'}</Text>}
    </View>
  );
}

/* ─── Email Fallback Modal ───────────────────────────────────────────────── */
function EmailFallbackModal({ data, onClose }) {
  const [copiedWhat, setCopiedWhat] = useState('');
  const copy = (text, what) => {
    navigator?.clipboard?.writeText(text).catch(() => {});
    setCopiedWhat(what);
    setTimeout(() => setCopiedWhat(''), 2200);
  };
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalBox}>
        <View style={styles.modalHeader}>
          <Ionicons name="mail-outline" size={20} color={data.missingEmail ? colors.danger : colors.primary} />
          <Text style={styles.modalTitle}>
            {data.missingEmail ? 'Manager email is missing' : 'Email draft ready'}
          </Text>
          <Pressable onPress={onClose} style={{ marginLeft: 'auto' }}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        {data.missingEmail && (
          <View style={styles.warnBanner}>
            <Ionicons name="warning-outline" size={14} color="#92400E" />
            <Text style={styles.warnText}>
              Manager email is missing. The email client will open without a recipient — you can add it manually.
            </Text>
          </View>
        )}
        <View style={styles.emailMeta}>
          <Text style={styles.emailMetaLabel}>To:</Text>
          <Text style={styles.emailMetaVal}>{data.managerEmail || '(not set)'}</Text>
        </View>
        {data.salesEmails?.length > 0 && (
          <View style={styles.emailMeta}>
            <Text style={styles.emailMetaLabel}>CC:</Text>
            <Text style={styles.emailMetaVal}>{data.salesEmails.join(', ')}</Text>
          </View>
        )}
        {[
          { key: 'subject', label: 'Subject', val: data.subject },
          { key: 'body',    label: 'Body',    val: data.body },
        ].map(({ key, label, val }) => (
          <View key={key} style={styles.emailBlock}>
            <View style={styles.emailBlockHeader}>
              <Text style={styles.emailBlockLabel}>{label}</Text>
              <Pressable style={styles.copyBtn} onPress={() => copy(val, key)}>
                <Ionicons name={copiedWhat === key ? 'checkmark' : 'copy-outline'} size={13} color={copiedWhat === key ? colors.success : colors.primary} />
                <Text style={[styles.copyBtnText, copiedWhat === key && { color: colors.success }]}>
                  {copiedWhat === key ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.emailBlockText}>{val}</Text>
          </View>
        ))}
        <Pressable
          style={styles.copyAllBtn}
          onPress={() => copy(`To: ${data.managerEmail || ''}\nCC: ${data.salesEmails?.join(', ') || ''}\nSubject: ${data.subject}\n\n${data.body}`, 'all')}
        >
          <Ionicons name={copiedWhat === 'all' ? 'checkmark' : 'copy-outline'} size={14} color={colors.white} />
          <Text style={styles.copyAllBtnText}>{copiedWhat === 'all' ? 'Copied!' : 'Copy All'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function OrderDetailsScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const orderId     = route?.params?.orderId;
  const user        = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token       = userDetails?.token || userDetails?.data?.token || '';
  const role        = user.role || '';
  const managerRole = isManager(role);

  const [order,        setOrder]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [matching,     setMatching]     = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [emailFallback,setEmailFallback]= useState(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) { setError('No order ID'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await getOrderById(token, orderId);
      setOrder(data);
    } catch (e) {
      setError(e.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleMarkMatched = async () => {
    if (!window.confirm('Mark this order as matched in sales sheet?')) return;
    setMatching(true);
    try {
      await updateOrderStatus(token, orderId, { status: 'matched_in_sales' });
      fetchOrder();
    } catch (e) { alert(e.message || 'Failed'); }
    finally { setMatching(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this order? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteOrder(token, orderId);
      navigation.navigate('Orders');
    } catch (e) { alert(e.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const handleEmail = async () => {
    if (!order) return;

    const acctObj     = (typeof order.accountId === 'object' ? order.accountId : null)
      || (typeof order.account === 'object' ? order.account : null);
    const accountName = acctObj?.accountName || acctObj?.name || order.accountName || order.account_name || '—';

    // Refresh manager info from profile
    let managerEmail    = '';
    let managerFirstName = 'Manager';
    try {
      const me = await getCurrentUser(token);
      managerEmail = me?.managerEmail || '';
      const full   = me?.managerName || me?.name || '';
      managerFirstName = full.split(' ')[0] || 'Manager';
    } catch { /* silent */ }

    const salesEmails = (order.salesTeamSnapshot || []).map((m) => m.email).filter(Boolean);
    const subject     = `${accountName} order approval request`;

    const lines = (order.items || []).map((item) => {
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

    // Always attempt to open mail client
    const to  = managerEmail ? encodeURIComponent(managerEmail) : '';
    const cc  = salesEmails.length ? `&cc=${encodeURIComponent(salesEmails.join(','))}` : '';
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${cc}`;
    try { window.open(url, '_blank') || (window.location.href = url); } catch { /* ignore */ }

    if (!managerEmail) {
      setEmailFallback({ managerEmail, subject, body, salesEmails, accountName, missingEmail: true });
    }

    try { await markOrderEmailSent(token, orderId); } catch { /* silent */ }
  };

  /* Loading / error states */
  if (loading) return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Orders">
      <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
    </AppShell>
  );
  if (error || !order) return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Orders">
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
        <Text style={styles.errorText}>{error || 'Order not found'}</Text>
        <Pressable style={styles.retryBtn} onPress={fetchOrder}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    </AppShell>
  );

  const account   = (typeof order.accountId === 'object' ? order.accountId : null)
    || (typeof order.account === 'object' ? order.account : null);
  const channel   = (typeof order.channelId === 'object' ? order.channelId : null)
    || (typeof order.channel === 'object' ? order.channel : null);
  const rep       = typeof order.medicalRepId === 'object' ? order.medicalRepId : null;
  const cby       = typeof order.createdBy    === 'object' ? order.createdBy    : null;
  const accName   = account?.accountName || account?.name || order.accountName  || order.account_name  || '—';
  const chanName  = channel?.channelName  || channel?.name || order.channelName || order.channel_name  || '—';
  const repName   = rep?.fullName  || rep?.name
    || cby?.fullName || cby?.name
    || order.repName || order.medicalRepName || order.repFullName || '—';
  const cfg       = getStatusCfg(order.status);
  const isMatched = order.status === 'matched_in_sales';

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Orders">

      {emailFallback && (
        <EmailFallbackModal data={emailFallback} onClose={() => setEmailFallback(null)} />
      )}

      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.breadLink}>Orders</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadCurrent}>{order.orderNumber || orderId}</Text>
      </View>

      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          <View style={styles.orderIcon}>
            <Ionicons name="receipt-outline" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.orderNum}>{order.orderNumber || '—'}</Text>
            <Text style={styles.orderDate}>{fmtDate(order.orderDate || order.createdAt)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusPillText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.btnEmail} onPress={handleEmail}>
            <Ionicons name="mail-outline" size={14} color={colors.primary} />
            <Text style={styles.btnEmailText}>Email Draft</Text>
          </Pressable>
          {managerRole && !isMatched && (
            <Pressable
              style={[styles.btnMatched, matching && { opacity: 0.6 }]}
              onPress={handleMarkMatched}
              disabled={matching}
            >
              {matching
                ? <ActivityIndicator size={13} color={colors.white} />
                : <Ionicons name="checkmark-circle-outline" size={14} color={colors.white} />}
              <Text style={styles.btnMatchedText}>{matching ? '...' : 'Mark as Matched'}</Text>
            </Pressable>
          )}
          {managerRole && (
            <Pressable
              style={[styles.btnDanger, deleting && { opacity: 0.6 }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator size={13} color={colors.white} />
                : <Ionicons name="trash-outline" size={14} color={colors.white} />}
            </Pressable>
          )}
        </View>
      </View>

      {/* Two-column layout */}
      <View style={styles.twoCol}>
        {/* Left column */}
        <View style={styles.leftCol}>

          <SectionCard title="Order Information">
            <InfoRow label="Account"       value={accName} />
            <InfoRow label="Medical Rep"   value={repName} />
            <InfoRow label="Sales Channel" value={chanName} />
            <InfoRow label="Order Date"    value={fmtDate(order.orderDate)} />
            <InfoRow label="CC Sales Team" value={order.ccSalesTeam ? 'Yes' : 'No'} />
            {order.notes ? <InfoRow label="Notes" value={order.notes} /> : null}
          </SectionCard>

          {/* Items Table — simplified columns */}
          <SectionCard title={`Order Items (${(order.items || []).length})`}>
            <View style={styles.itemsHead}>
              <Text style={[styles.ith, { flex: 2.5, textAlign: 'left' }]}>Product</Text>
              <Text style={[styles.ith, { flex: 0.8, textAlign: 'right' }]}>QTY</Text>
              <Text style={[styles.ith, { flex: 0.8, textAlign: 'right' }]}>FOC %</Text>
              <Text style={[styles.ith, { flex: 0.9, textAlign: 'right' }]}>FOC QTY</Text>
              <Text style={[styles.ith, { flex: 1.5, textAlign: 'right' }]}>Total CIF</Text>
              <Text style={[styles.ith, { flex: 1.6, textAlign: 'right' }]}>Total WS</Text>
            </View>

            {(order.items || []).length === 0 ? (
              <View style={styles.emptyItems}>
                <Text style={styles.emptyItemsText}>No items found</Text>
              </View>
            ) : (
              (order.items || []).map((item, idx) => {
                const prod  = typeof item.productId === 'object' ? item.productId : null;
                const pName = item.productName || prod?.productName || '—';
                const pNick = item.productNickname || prod?.productNickname || '';
                return (
                  <View key={item._id || idx} style={[styles.itemRow, idx % 2 === 0 && styles.itemRowAlt]}>
                    <View style={{ flex: 2.5 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{pName}</Text>
                      {pNick ? <Text style={styles.itemNick} numberOfLines={1}>{pNick}</Text> : null}
                    </View>
                    <Text style={[styles.itd, { flex: 0.8 }]}>{fmtN(item.quantity)}</Text>
                    <Text style={[styles.itd, { flex: 0.8 }]}>
                      {item.focPercentage !== undefined ? `${item.focPercentage}%` : '—'}
                    </Text>
                    <Text style={[styles.itd, { flex: 0.9 }]}>{fmtN(item.focQuantity)}</Text>
                    <Text style={[styles.itd, { flex: 1.5, fontWeight: '700' }]}>{fmtUSD(item.totalCifUsd)}</Text>
                    <Text style={[styles.itd, { flex: 1.6, fontWeight: '700' }]}>{fmtAED(item.totalWholesaleAed)}</Text>
                  </View>
                );
              })
            )}

            {/* Totals row */}
            {(order.items || []).length > 0 && (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalLabel, { flex: 2.5 }]}>Totals</Text>
                <Text style={[styles.totalVal, { flex: 0.8 }]}>{fmtN(order.totalQuantity)}</Text>
                <Text style={[styles.totalVal, { flex: 0.8 }]}>—</Text>
                <Text style={[styles.totalVal, { flex: 0.9 }]}>{fmtN(order.totalFocQuantity)}</Text>
                <Text style={[styles.totalVal, { flex: 1.5 }]}>{fmtUSD(order.totalCifUsd)}</Text>
                <Text style={[styles.totalVal, { flex: 1.6 }]}>{fmtAED(order.totalWholesaleAed)}</Text>
              </View>
            )}
          </SectionCard>
        </View>

        {/* Right column */}
        <View style={styles.rightCol}>

          {/* Account card */}
          <SectionCard title="Account">
            {account ? (
              <Pressable
                style={styles.acctCard}
                onPress={() => navigation.navigate('AccountDetail', { accountId: account._id || account.id })}
              >
                <View style={styles.acctIcon}>
                  <Ionicons name="business-outline" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.acctName}>{accName}</Text>
                  {account.phoneNumber ? <Text style={styles.acctSub}>📞 {account.phoneNumber}</Text> : null}
                  {account.location?.address ? <Text style={styles.acctSub}>📍 {account.location.address}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Text style={styles.mutedVal}>{accName}</Text>
            )}
          </SectionCard>

          {/* Order Totals — QTY, FOC QTY, Total CIF, Total WS */}
          <SectionCard title="Order Totals">
            <View style={styles.totalsGrid}>
              <View style={styles.totalGridItem}>
                <Text style={styles.totalGridLabel}>Total Qty</Text>
                <Text style={styles.totalGridVal}>{fmtN(order.totalQuantity)}</Text>
              </View>
              <View style={styles.totalGridItem}>
                <Text style={styles.totalGridLabel}>FOC Qty</Text>
                <Text style={styles.totalGridVal}>{fmtN(order.totalFocQuantity)}</Text>
              </View>
              <View style={[styles.totalGridItem, { flex: 2 }]}>
                <Text style={styles.totalGridLabel}>Total CIF (USD)</Text>
                <Text style={[styles.totalGridVal, { color: colors.primary }]}>{fmtUSD(order.totalCifUsd)}</Text>
              </View>
              <View style={[styles.totalGridItem, { flex: 2 }]}>
                <Text style={styles.totalGridLabel}>Total Wholesale (AED)</Text>
                <Text style={[styles.totalGridVal, { color: colors.primary }]}>{fmtAED(order.totalWholesaleAed)}</Text>
              </View>
            </View>
          </SectionCard>

          {/* Status Timeline */}
          <SectionCard title="Status Timeline">
            {[
              { key: 'created',          label: 'Created',          date: order.createdAt },
              { key: 'matched_in_sales', label: 'Matched in Sales', date: order.matchedAt },
            ].map((s, idx) => {
              const done   = s.key === 'created' || order.status === s.key;
              const active = order.status === s.key;
              return (
                <View key={s.key} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, done && styles.timelineDotDone, active && styles.timelineDotActive]} />
                    {idx < 1 && <View style={[styles.timelineLine, done && styles.timelineLineDone]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 16 }}>
                    <Text style={[styles.timelineLabel, active && { color: colors.primary, fontWeight: '800' }]}>
                      {s.label}
                    </Text>
                    {s.date
                      ? <Text style={styles.timelineDate}>{fmtDateTime(s.date)}</Text>
                      : <Text style={styles.timelinePending}>—</Text>}
                  </View>
                </View>
              );
            })}
          </SectionCard>
        </View>
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  retryBtn:  { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  breadcrumb:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadLink:    { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadCurrent: { fontSize: 13, color: colors.textSecondary },

  headerCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: globalWidth('1%'),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'), flexWrap: 'wrap', gap: 12, ...shadow,
  },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderIcon:     { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  orderNum:      { fontSize: globalWidth('1.0%'), fontWeight: '800', color: colors.textPrimary },
  orderDate:     { fontSize: globalWidth('0.68%'), color: colors.textSecondary, marginTop: 2 },
  statusPill:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  statusPillText:{ fontSize: globalWidth('0.62%'), fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  btnEmail:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  btnEmailText:  { color: colors.primary, fontSize: globalWidth('0.68%'), fontWeight: '700' },
  btnMatched:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  btnMatchedText:{ color: colors.white, fontSize: globalWidth('0.68%'), fontWeight: '700' },
  btnDanger:     { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderRadius: 8 },

  twoCol:   { flexDirection: 'row', gap: globalWidth('1.5%'), alignItems: 'flex-start' },
  leftCol:  { flex: 0.62, gap: globalHeight('1.2%'), minWidth: 0 },
  rightCol: { flex: 0.38, gap: globalHeight('1.2%') },

  card:      { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 18, ...shadow },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },

  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { width: 130, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary },
  mutedVal:  { fontSize: 13, color: colors.textSecondary },

  // Items table — simplified
  itemsHead: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 9,
    backgroundColor: colors.backgroundColor, borderRadius: 6, marginBottom: 4,
  },
  ith:       { fontSize: globalWidth('0.57%'), fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  itemRow:   { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  itemRowAlt:{ backgroundColor: colors.backgroundColor },
  itemName:  { fontSize: globalWidth('0.68%'), fontWeight: '700', color: colors.textPrimary },
  itemNick:  { fontSize: globalWidth('0.6%'), color: colors.textSecondary, marginTop: 1 },
  itd:       { fontSize: globalWidth('0.65%'), color: colors.textPrimary, textAlign: 'right' },
  emptyItems:{ padding: 20, alignItems: 'center' },
  emptyItemsText: { color: colors.textMuted, fontSize: 13 },

  totalsRow: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: colors.primaryLight, borderRadius: 6, marginTop: 4,
  },
  totalLabel: { fontSize: globalWidth('0.65%'), fontWeight: '800', color: colors.primary },
  totalVal:   { fontSize: globalWidth('0.65%'), fontWeight: '700', color: colors.primary, textAlign: 'right' },

  // Account card
  acctCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  acctIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  acctName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  acctSub:  { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Totals grid (4 items: Qty, FOC Qty, CIF, WS)
  totalsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  totalGridItem:  { flex: 1, minWidth: globalWidth('8%'), backgroundColor: colors.backgroundColor, borderRadius: 8, padding: 12 },
  totalGridLabel: { fontSize: globalWidth('0.58%'), color: colors.textMuted, fontWeight: '600', marginBottom: 4 },
  totalGridVal:   { fontSize: globalWidth('0.9%'), fontWeight: '800', color: colors.textPrimary },

  // Timeline
  timelineRow:       { flexDirection: 'row', gap: 12 },
  timelineLeft:      { alignItems: 'center', width: 20 },
  timelineDot:       { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  timelineDotDone:   { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  timelineDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  timelineLine:      { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 },
  timelineLineDone:  { backgroundColor: colors.primary },
  timelineLabel:     { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  timelineDate:      { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  timelinePending:   { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Email fallback modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  modalBox: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 24,
    width: globalWidth('44%'), maxWidth: 580, gap: 10, ...shadow,
  },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle:      { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  warnBanner:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10 },
  warnText:        { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  emailMeta:       { flexDirection: 'row', gap: 8, marginBottom: 2 },
  emailMetaLabel:  { fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 32 },
  emailMetaVal:    { flex: 1, fontSize: 12, color: colors.textPrimary },
  emailBlock:      { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  emailBlockHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.backgroundColor, borderBottomWidth: 1, borderBottomColor: colors.border },
  emailBlockLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  emailBlockText:  { padding: 12, fontSize: 12, color: colors.textPrimary, fontFamily: 'monospace', lineHeight: 18 },
  copyBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 5, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 7, paddingVertical: 3 },
  copyBtnText:     { fontSize: 11, color: colors.primary, fontWeight: '700' },
  copyAllBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, marginTop: 4 },
  copyAllBtnText:  { color: colors.white, fontSize: 13, fontWeight: '700' },
});
