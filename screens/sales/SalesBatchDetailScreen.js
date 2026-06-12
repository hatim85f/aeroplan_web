import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  getSalesBatchById,
  getSalesBatchRecords,
  matchSalesOrders,
  matchSalesTargets,
} from '../../store/sales/salesActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD    = globalWidth('1.2%');

const BATCH_STATUS_STYLE = {
  completed:             { bg: '#DCFCE7', text: '#15803D' },
  completed_with_errors: { bg: '#FEF3C7', text: '#92400E' },
  processing:            { bg: '#EFF6FF', text: '#1D4ED8' },
  failed:                { bg: '#FEE2E2', text: '#DC2626' },
  pending:               { bg: '#F1F5F9', text: '#64748B' },
};
const MATCH_STATUS_STYLE = {
  matched:           { bg: '#DCFCE7', text: '#15803D' },
  partially_matched: { bg: '#DBEAFE', text: '#1D4ED8' },
  unmatched:         { bg: '#FEF3C7', text: '#92400E' },
  needs_review:      { bg: '#EFF6FF', text: '#1D4ED8' },
  ignored:           { bg: '#F1F5F9', text: '#64748B' },
  duplicate:         { bg: '#FEE2E2', text: '#DC2626' },
  error:             { bg: '#FEE2E2', text: '#DC2626' },
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');
const fmtNum  = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtCur  = (v, cur = 'USD') => {
  if (v == null) return '—';
  const sym = cur === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—';
const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');
const uploadedCurrency = (r) => pick(r.uploadedCurrency, r.currency);
const uploadedSalesValue = (r) => pick(r.uploadedSalesValue, r.salesValue);
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());
const uploaderName = (batch = {}) => {
  if (batch.uploadedByName) return batch.uploadedByName;
  if (batch.uploaderName) return batch.uploaderName;
  const uploadedBy = batch.uploadedBy || batch.userId || batch.user || {};
  if (typeof uploadedBy === 'string') return isObjectId(uploadedBy) ? 'â€”' : uploadedBy;
  return uploadedBy.fullName || uploadedBy.name || uploadedBy.displayName || uploadedBy.email || 'â€”';
};

const uploaderDisplayName = (batch = {}) => {
  if (batch.uploadedByName) return batch.uploadedByName;
  if (batch.uploaderName) return batch.uploaderName;
  const uploadedBy = batch.uploadedBy || batch.userId || batch.user || {};
  if (typeof uploadedBy === 'string') return isObjectId(uploadedBy) ? '-' : uploadedBy;
  return uploadedBy.fullName || uploadedBy.name || uploadedBy.displayName || uploadedBy.email || '-';
};

function Badge({ label, styleObj }) {
  return (
    <View style={[styles.badge, { backgroundColor: styleObj?.bg || '#F1F5F9' }]}>
      <Text style={[styles.badgeText, { color: styleObj?.text || '#64748B' }]}>{label}</Text>
    </View>
  );
}

function StatCard({ icon, iconColor, iconBg, label, value, valueColor }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value ?? '—'}</Text>
    </View>
  );
}

const RECORD_COLS = [
  { key: 'salesDate',  label: 'Date',    width: 90  },
  { key: 'invoice',    label: 'Invoice', width: 110 },
  { key: 'account',    label: 'Account', width: 130 },
  { key: 'product',    label: 'Product', width: 130 },
  { key: 'qty',        label: 'Qty',     width: 60  },
  { key: 'value',      label: 'Value',   width: 90  },
  { key: 'matchStatus',label: 'Match',   width: 100 },
  { key: 'status',     label: 'Status',  width: 80  },
];

function Pagination({ page, pages, total, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <View style={styles.pagination}>
      <Text style={styles.paginationInfo}>Page {page} of {pages} · {total} records</Text>
      <View style={styles.paginationBtns}>
        <Pressable style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={() => page > 1 && onPage(page - 1)} disabled={page <= 1}>
          <Ionicons name="chevron-back" size={13} color={page <= 1 ? colors.textMuted : colors.textPrimary} />
        </Pressable>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const pg = page <= 3 ? i + 1 : page - 2 + i;
          if (pg < 1 || pg > pages) return null;
          return (
            <Pressable key={pg} style={[styles.pageBtn, pg === page && styles.pageBtnActive]} onPress={() => onPage(pg)}>
              <Text style={[styles.pageBtnText, pg === page && styles.pageBtnTextActive]}>{pg}</Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.pageBtn, page >= pages && styles.pageBtnDisabled]} onPress={() => page < pages && onPage(page + 1)} disabled={page >= pages}>
          <Ionicons name="chevron-forward" size={13} color={page >= pages ? colors.textMuted : colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

export default function SalesBatchDetailScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const batchId = route?.params?.batchId;
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const user    = userDetails?.user  || userDetails?.data?.user  || userDetails || {};
  const role    = user.role || '';
  const manager = isManager(role);

  const [batch,      setBatch]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [activeTab,  setActiveTab]  = useState('records');

  const [records,    setRecords]    = useState([]);
  const [recPagination, setRecPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [recLoading, setRecLoading] = useState(false);

  const [matching,   setMatching]   = useState(false);
  const [matchResult,setMatchResult]= useState(null);
  const [matchError, setMatchError] = useState('');

  const fetchBatch = useCallback(async () => {
    if (!batchId) { setError('No batch ID'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await getSalesBatchById(token, batchId);
      setBatch(data);
    } catch (e) {
      setError(e.message || 'Failed to load batch');
    } finally {
      setLoading(false);
    }
  }, [token, batchId]);

  const fetchRecords = useCallback(async (pg = 1) => {
    if (!batchId) return;
    setRecLoading(true);
    try {
      const res = await getSalesBatchRecords(token, batchId, { page: pg, limit: 20 });
      setRecords(res.records);
      setRecPagination(res.pagination);
    } catch { /* silent */ }
    finally { setRecLoading(false); }
  }, [token, batchId]);

  useEffect(() => { fetchBatch(); }, [fetchBatch]);
  useEffect(() => { if (activeTab === 'records') fetchRecords(1); }, [activeTab, fetchRecords]);

  const handleMatchOrders = async () => {
    setMatching(true); setMatchResult(null); setMatchError('');
    try {
      const res = await matchSalesOrders(token, { batchId });
      setMatchResult({ ...res, type: 'orders' });
      fetchRecords(1);
    } catch (e) {
      setMatchError(e.message || 'Failed');
    } finally {
      setMatching(false);
    }
  };

  const handleMatchTargets = async () => {
    setMatching(true); setMatchResult(null); setMatchError('');
    try {
      const res = await matchSalesTargets(token, { batchId });
      setMatchResult({ ...res, type: 'targets' });
    } catch (e) {
      setMatchError(e.message || 'Failed');
    } finally {
      setMatching(false);
    }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesBatches">
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </AppShell>
    );
  }
  if (error) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesBatches">
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.btnOutline} onPress={fetchBatch}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
        </View>
      </AppShell>
    );
  }
  if (!batch) return null;

  const statusSty   = BATCH_STATUS_STYLE[batch.status] || BATCH_STATUS_STYLE.pending;
  const mappingObj  = batch.mappingId  || {};
  const errors      = Array.isArray(batch.errors)   ? batch.errors   : [];
  const warnings    = Array.isArray(batch.warnings) ? batch.warnings : [];
  const messages    = [...errors, ...warnings];

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesBatches">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <Pressable onPress={() => navigation.navigate('SalesBatches')}>
            <Text style={styles.breadcrumbLink}>Upload Batches</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
          <Text style={styles.breadcrumbCurrent}>{batch.fileName || batchId}</Text>
        </View>

        {/* Page header */}
        <View style={styles.pageHeader}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.pageTitle}>{batch.fileName || 'Batch Detail'}</Text>
            <Badge label={cap(batch.status || 'pending')} styleObj={statusSty} />
          </View>
          {manager && (
            <View style={styles.headerActions}>
              <Pressable
                style={[styles.btnOutline, matching && { opacity: 0.6 }]}
                onPress={handleMatchOrders}
                disabled={matching}
              >
                {matching ? <ActivityIndicator size={13} color={colors.primary} /> : <Ionicons name="git-compare-outline" size={14} color={colors.primary} />}
                <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Match Orders</Text>
              </Pressable>
              <Pressable
                style={[styles.btnOutline, matching && { opacity: 0.6 }]}
                onPress={handleMatchTargets}
                disabled={matching}
              >
                <Ionicons name="flag-outline" size={14} color="#7C3AED" />
                <Text style={[styles.btnOutlineText, { color: '#7C3AED' }]}>Match Targets</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Match result / error */}
        {matchResult && (
          <View style={[styles.alertBox, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#15803D" />
            <Text style={{ fontSize: 13, color: '#15803D', fontWeight: '600' }}>
              {matchResult.type === 'orders' ? 'Orders' : 'Targets'} Matching Complete — {matchResult.matched ?? 0} matched, {matchResult.unmatched ?? 0} unmatched
            </Text>
          </View>
        )}
        {matchError && (
          <View style={[styles.alertBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={{ fontSize: 13, color: colors.danger, fontWeight: '600' }}>{matchError}</Text>
          </View>
        )}

        {/* ── 1. Batch Summary ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Batch Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>File Name</Text>
              <Text style={styles.summaryValue}>{batch.fileName || '—'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Period</Text>
              <Text style={styles.summaryValue}>{batch.month ? `${batch.month} / ${batch.year}` : batch.year || '—'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Mapping</Text>
              <Text style={styles.summaryValue}>{mappingObj.name || mappingObj.mappingName || batch.mappingName || '—'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Uploaded By</Text>
              <Text style={styles.summaryValue}>{uploaderDisplayName(batch)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Upload Date</Text>
              <Text style={styles.summaryValue}>{fmtDate(batch.createdAt || batch.uploadedAt)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Status</Text>
              <Badge label={cap(batch.status || 'pending')} styleObj={statusSty} />
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Upload Mode</Text>
              <Text style={styles.summaryValue}>{cap(batch.uploadMode || '—')}</Text>
            </View>
            {(batch.notes || batch.overrideNote) && (
              <View style={[styles.summaryItem, { minWidth: 260 }]}>
                <Text style={styles.summaryLabel}>Notes</Text>
                <Text style={styles.summaryValue}>{batch.notes || batch.overrideNote}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── 2. Stats Cards ── */}
        <View style={styles.statsRow}>
          <StatCard icon="list-outline"             iconColor="#1D4ED8" iconBg="#EFF6FF" label="Total Rows"   value={fmtNum(batch.totalRows   || batch.total)} />
          <StatCard icon="checkmark-circle-outline" iconColor="#15803D" iconBg="#DCFCE7" label="Successful"  value={fmtNum(batch.successRows || batch.success)} valueColor="#15803D" />
          <StatCard icon="close-circle-outline"     iconColor={colors.danger} iconBg="#FEE2E2" label="Failed"       value={fmtNum(batch.failedRows  || batch.failed)} valueColor={colors.danger} />
          <StatCard icon="git-compare-outline"      iconColor="#1D4ED8" iconBg="#EFF6FF" label="Matched"     value={fmtNum(batch.matchedRows  || batch.matched)} valueColor="#1D4ED8" />
          <StatCard icon="alert-circle-outline"     iconColor="#92400E" iconBg="#FEF3C7" label="Unmatched"   value={fmtNum(batch.unmatchedRows || batch.unmatched)} valueColor="#92400E" />
          <StatCard icon="copy-outline"             iconColor="#64748B" iconBg="#F1F5F9" label="Duplicates"  value={fmtNum(batch.duplicateRows || batch.duplicates)} />
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, activeTab === 'records' && styles.tabActive]} onPress={() => setActiveTab('records')}>
            <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>Records</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'errors' && styles.tabActive]} onPress={() => setActiveTab('errors')}>
            <Text style={[styles.tabText, activeTab === 'errors' && styles.tabTextActive]}>
              Errors & Warnings {messages.length > 0 ? `(${messages.length})` : ''}
            </Text>
          </Pressable>
        </View>

        {/* ── Tab: Errors ── */}
        {activeTab === 'errors' && (
          <View style={styles.errorsCard}>
            {messages.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="checkmark-circle-outline" size={28} color={colors.success} />
                <Text style={styles.emptyText}>No errors or warnings</Text>
              </View>
            ) : messages.map((msg, i) => (
              <View key={i} style={styles.msgRow}>
                <Ionicons
                  name={i < errors.length ? 'close-circle-outline' : 'warning-outline'}
                  size={15}
                  color={i < errors.length ? colors.danger : colors.warning}
                />
                <Text style={[styles.msgText, { color: i < errors.length ? colors.danger : '#92400E' }]}>
                  {typeof msg === 'string' ? msg : msg.message || JSON.stringify(msg)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Tab: Records ── */}
        {activeTab === 'records' && (
          <View style={styles.recordsCard}>
            {recLoading ? (
              <View style={styles.centered}><ActivityIndicator size="small" color={colors.primary} /></View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={styles.tblHead}>
                      {RECORD_COLS.map((c) => (
                        <Text key={c.key} style={[styles.tblTh, { width: c.width }]}>{c.label}</Text>
                      ))}
                    </View>
                    {records.length === 0 ? (
                      <View style={styles.emptyBox}><Text style={styles.emptyText}>No records in this batch</Text></View>
                    ) : records.map((r) => {
                      const id       = r._id || r.id;
                      const matchSty = MATCH_STATUS_STYLE[r.matchStatus] || MATCH_STATUS_STYLE.unmatched;
                      const statSty  = { bg: '#F1F5F9', text: '#64748B' };
                      const productObj = r.productId || {};
                      const accountObj = r.accountId || {};
                      return (
                        <Pressable key={id} style={styles.tblRow} onPress={() => navigation.navigate('SalesRecordDetail', { salesId: id })}>
                          <Text style={[styles.tblTd, { width: RECORD_COLS[0].width }]}>{fmtDate(r.salesDate)}</Text>
                          <Text style={[styles.tblTd, { width: RECORD_COLS[1].width }]} numberOfLines={1}>{r.invoiceNumber || '—'}</Text>
                          <Text style={[styles.tblTd, { width: RECORD_COLS[2].width }]} numberOfLines={1}>
                            {accountObj.accountName || accountObj.name || r.accountName || r.uploadedAccountName || '—'}
                          </Text>
                          <Text style={[styles.tblTd, { width: RECORD_COLS[3].width }]} numberOfLines={1}>
                            {productObj.productName || productObj.name || r.productName || r.uploadedProductName || '—'}
                          </Text>
                          <Text style={[styles.tblTd, { width: RECORD_COLS[4].width }]}>{fmtNum(r.quantity)}</Text>
                          <Text style={[styles.tblTd, { width: RECORD_COLS[5].width }]}>{fmtCur(uploadedSalesValue(r), uploadedCurrency(r))}</Text>
                          <View style={[styles.tblTd, { width: RECORD_COLS[6].width }]}>
                            <Badge label={cap(r.matchStatus || 'unmatched')} styleObj={matchSty} />
                          </View>
                          <View style={[styles.tblTd, { width: RECORD_COLS[7].width }]}>
                            <Badge label={cap(r.status || 'active')} styleObj={statSty} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                <Pagination page={recPagination.page} pages={recPagination.pages} total={recPagination.total} onPage={fetchRecords} />
              </>
            )}
          </View>
        )}

      </ScrollView>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 16, paddingBottom: 48 },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breadcrumbLink:    { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  pageHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  headerActions:{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },

  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, borderWidth: 1 },

  summaryCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 12, ...shadow,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  summaryGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  summaryItem:  { minWidth: 140, gap: 4 },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  summaryValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '700' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: 100, alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, ...shadow,
  },
  statIcon:  { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },

  tabs: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border },
  tab: { paddingHorizontal: 16, paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary, marginBottom: -2 },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '800' },

  errorsCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 4, ...shadow,
  },
  msgRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  msgText: { flex: 1, fontSize: 13, lineHeight: 18 },

  recordsCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 8, ...shadow,
  },
  tblHead: { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 4, marginBottom: 2 },
  tblTh: { fontSize: 11, fontWeight: '800', color: colors.primary },
  tblRow: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tblTd: { fontSize: 12, color: colors.textPrimary, paddingRight: 4 },

  emptyBox:  { padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: colors.textMuted },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  paginationInfo: { fontSize: 12, color: colors.textSecondary },
  paginationBtns: { flexDirection: 'row', gap: 4 },
  pageBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  pageBtnActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  pageBtnDisabled:  { opacity: 0.4 },
  pageBtnText:      { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  pageBtnTextActive:{ color: '#fff', fontWeight: '700' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
