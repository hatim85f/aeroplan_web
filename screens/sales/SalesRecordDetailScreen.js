import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  getSalesRecordById,
  updateSalesRecordStatus,
  deleteSalesRecord,
} from '../../store/sales/salesActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD    = globalWidth('1.2%');

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');
const fmtNum  = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtCur  = (v, cur = 'USD') => {
  if (v == null) return '—';
  const sym = cur === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—';

const MATCH_STATUS_STYLE = {
  matched:           { bg: '#DCFCE7', text: '#15803D' },
  partially_matched: { bg: '#DBEAFE', text: '#1D4ED8' },
  unmatched:         { bg: '#FEF3C7', text: '#92400E' },
  needs_review:      { bg: '#EFF6FF', text: '#1D4ED8' },
  ignored:           { bg: '#F1F5F9', text: '#64748B' },
  duplicate:         { bg: '#FEE2E2', text: '#DC2626' },
  error:             { bg: '#FEE2E2', text: '#DC2626' },
};
const STATUS_STYLE = {
  active:    { bg: '#DCFCE7', text: '#15803D' },
  ignored:   { bg: '#F1F5F9', text: '#64748B' },
  duplicate: { bg: '#FEF9C3', text: '#854D0E' },
  error:     { bg: '#FEE2E2', text: '#DC2626' },
};

function Badge({ label, styleObj }) {
  return (
    <View style={[styles.badge, { backgroundColor: styleObj?.bg || '#F1F5F9' }]}>
      <Text style={[styles.badgeText, { color: styleObj?.text || '#64748B' }]}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, icon, iconColor, iconBg, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBg || colors.primaryLight }]}>
          <Ionicons name={icon || 'document-outline'} size={16} color={iconColor || colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DetailRow({ label, value, children, mono }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      {children || (
        <Text style={[styles.detailValue, mono && styles.detailValueMono]}>{value ?? '—'}</Text>
      )}
    </View>
  );
}

function ConfidenceBar({ pct }) {
  if (pct == null) return null;
  const p = Math.min(100, Math.max(0, Number(pct)));
  const col = p >= 80 ? '#15803D' : p >= 50 ? '#F59E0B' : '#DC2626';
  return (
    <View style={styles.confRow}>
      <View style={styles.confTrack}>
        <View style={[styles.confFill, { width: `${p}%`, backgroundColor: col }]} />
      </View>
      <Text style={[styles.confPct, { color: col }]}>{p.toFixed(0)}%</Text>
    </View>
  );
}

const STATUS_OPTIONS = ['active', 'ignored', 'duplicate', 'error'];
const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');
const uploadedCurrency = (r) => pick(r.uploadedCurrency, r.currency);
const uploadedSalesValue = (r) => pick(r.uploadedSalesValue, r.salesValue);
const uploadedUnitValue = (r) => pick(r.uploadedUnitValue, r.unitValue);
const calculatedCifUsd = (r) => pick(r.calculatedCifUsd, r.cifValueUsd, r.cifUsd);
const calculatedWholesaleAed = (r) => pick(r.calculatedWholesaleAed, r.wholesaleValueAed, r.wholesaleAed);
const calculatedRetailAed = (r) => pick(r.calculatedRetailAed, r.retailValueAed, r.retailAed);

export default function SalesRecordDetailScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const salesId = route?.params?.salesId || route?.params?.recordId;
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const user    = userDetails?.user  || userDetails?.data?.user  || userDetails || {};
  const role    = user.role || '';
  const manager = isManager(role);

  const [record,   setRecord]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);

  const fetchRecord = useCallback(async () => {
    if (!salesId) { setError('No record ID provided'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await getSalesRecordById(token, salesId);
      setRecord(data);
    } catch (e) {
      setError(e.message || 'Failed to load record');
    } finally {
      setLoading(false);
    }
  }, [token, salesId]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  const handleChangeStatus = async (newStatus) => {
    setToggling(true);
    try {
      const updated = await updateSalesRecordStatus(token, salesId, { status: newStatus });
      setRecord((prev) => ({ ...prev, ...updated }));
      setShowStatusModal(false);
    } catch (e) {
      alert(e.message || 'Status update failed');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this sales record? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteSalesRecord(token, salesId);
      navigation.goBack();
    } catch (e) {
      alert(e.message || 'Delete failed');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesRecords">
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </AppShell>
    );
  }
  if (error) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesRecords">
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.btnOutline} onPress={fetchRecord}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
        </View>
      </AppShell>
    );
  }
  if (!record) return null;

  const matchSty  = MATCH_STATUS_STYLE[record.matchStatus] || MATCH_STATUS_STYLE.unmatched;
  const statusSty = STATUS_STYLE[record.status]            || STATUS_STYLE.active;
  const productObj  = record.productId       || {};
  const accountObj  = record.accountId       || {};
  const channelObj  = record.channelId       || {};
  const shipToObj   = record.shipToAccountId || {};
  const batchObj    = record.batchId         || {};

  /* Raw row data */
  const rawData = record.rawData || record.rawRow || {};

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesRecords">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <Pressable onPress={() => navigation.navigate('SalesRecords')}>
            <Text style={styles.breadcrumbLink}>Sales Records</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
          <Text style={styles.breadcrumbCurrent}>{record.invoiceNumber || salesId}</Text>
        </View>

        {/* Page header */}
        <View style={styles.pageHeader}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.pageTitle}>
              {record.invoiceNumber ? `Invoice: ${record.invoiceNumber}` : 'Sales Record'}
            </Text>
            <View style={styles.headerBadges}>
              <Badge label={cap(record.matchStatus || 'unmatched')} styleObj={matchSty} />
              <Badge label={cap(record.status || 'active')}          styleObj={statusSty} />
            </View>
          </View>
          {manager && (
            <View style={styles.headerActions}>
              <Pressable style={styles.btnOutline} onPress={() => setShowStatusModal(true)}>
                <Ionicons name="swap-horizontal-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.btnOutlineText}>Change Status</Text>
              </Pressable>
              <Pressable
                style={[styles.btnDanger, deleting && { opacity: 0.6 }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size={13} color="#fff" />
                  : <Ionicons name="trash-outline" size={14} color="#fff" />
                }
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.grid}>

          {/* ── 1. Record Summary ── */}
          <SectionCard title="Record Summary" icon="document-text-outline" iconColor="#1D4ED8" iconBg="#EFF6FF">
            <DetailRow label="Entry Source" value={cap(record.entrySource || 'upload')} />
            <DetailRow label="Sales Date"   value={fmtDate(record.salesDate)} />
            <DetailRow label="Invoice #"    value={record.invoiceNumber || '—'} />
            <DetailRow label="Batch">
              {batchObj._id || batchObj.id
                ? <Pressable onPress={() => navigation.navigate('SalesBatchDetail', { batchId: batchObj._id || batchObj.id })}>
                    <Text style={styles.linkText}>{batchObj.fileName || batchObj._id || 'View Batch'}</Text>
                  </Pressable>
                : <Text style={styles.detailValue}>—</Text>
              }
            </DetailRow>
            <DetailRow label="Month / Year"  value={`${record.month || '—'} / ${record.year || '—'}`} />
            <DetailRow label="Match Status">
              <Badge label={cap(record.matchStatus || 'unmatched')} styleObj={matchSty} />
            </DetailRow>
            <DetailRow label="Record Status">
              <Badge label={cap(record.status || 'active')} styleObj={statusSty} />
            </DetailRow>
          </SectionCard>

          <SectionCard title="Area Shares" icon="git-network-outline" iconColor="#8B5CF6" iconBg="#F5F3FF">
            {Array.isArray(record.areaShares) && record.areaShares.length > 0 ? record.areaShares.map((share, idx) => (
              <View key={share.ruleId || share.areaId || idx} style={styles.shareBox}>
                <DetailRow label="Area" value={share.areaName || share.area?.areaName || share.areaId?.areaName || share.areaId || '—'} />
                <DetailRow label="Share %" value={`${share.sharePercentage ?? share.share ?? 0}%`} />
                <DetailRow label="Shared Quantity" value={fmtNum(share.sharedQuantity)} />
                <DetailRow label="Shared Free Qty" value={fmtNum(share.sharedFreeQuantity)} />
                <DetailRow label="Shared CIF USD" value={fmtCur(share.sharedCalculatedCifUsd, 'USD')} />
                <DetailRow label="Shared Wholesale AED" value={fmtCur(share.sharedCalculatedWholesaleAed, 'AED')} />
                <DetailRow label="Shared Retail AED" value={fmtCur(share.sharedCalculatedRetailAed, 'AED')} />
                <DetailRow label="Rule ID" value={share.ruleId || share.sharedSalesRuleId || '—'} mono />
              </View>
            )) : (
              <Text style={styles.noMatchText}>No area shares applied to this record.</Text>
            )}
          </SectionCard>

          {/* ── 2. Account Matching ── */}
          <SectionCard title="Account Matching" icon="business-outline" iconColor="#7C3AED" iconBg="#F5F3FF">
            <DetailRow label="Uploaded Account Name" value={record.uploadedAccountName || record.accountName || '—'} />
            <DetailRow label="Matched Account" value={accountObj.accountName || accountObj.name || '—'} />
            {record.accountMatchConfidence != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Confidence</Text>
                <ConfidenceBar pct={record.accountMatchConfidence} />
              </View>
            )}
            <DetailRow label="Detection Method" value={cap(record.accountMatchMethod || '—')} />
          </SectionCard>

          {/* ── 3. Product Matching ── */}
          <SectionCard title="Product Matching" icon="cube-outline" iconColor="#16A34A" iconBg="#F0FDF4">
            <DetailRow label="Uploaded Product Name"     value={record.uploadedProductName || record.productName || '—'} />
            <DetailRow label="Uploaded Nickname/Code"    value={record.uploadedProductNickname || record.productNickname || '—'} />
            <DetailRow label="Matched Product"           value={productObj.productName || productObj.name || '—'} />
            <DetailRow label="Product Nickname"          value={productObj.productNickname || '—'} />
            {record.productMatchConfidence != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Confidence</Text>
                <ConfidenceBar pct={record.productMatchConfidence} />
              </View>
            )}
          </SectionCard>

          {/* ── 4. Channel Detection ── */}
          <SectionCard title="Channel Detection" icon="radio-button-on-outline" iconColor="#F59E0B" iconBg="#FFFBEB">
            <DetailRow label="Uploaded Channel Name" value={record.uploadedChannelName || record.channelName || '—'} />
            <DetailRow label="Uploaded Channel Key"  value={record.uploadedChannelKey  || record.channelKey  || '—'} />
            <DetailRow label="Matched Channel"       value={channelObj.channelName || channelObj.channelKey || '—'} />
            <DetailRow label="Detection Method"      value={cap(record.channelMatchMethod || '—')} />
          </SectionCard>

          {/* ── 5. Quantities & Values ── */}
          <SectionCard title="Quantities & Values" icon="calculator-outline" iconColor="#06B6D4" iconBg="#ECFEFF">
            <DetailRow label="Quantity"         value={fmtNum(record.quantity)} />
            <DetailRow label="Free Qty (FOC)"   value={fmtNum(record.freeQuantity)} />
            <DetailRow label="Total Quantity"   value={fmtNum((record.quantity || 0) + (record.freeQuantity || 0))} />
            <DetailRow label="Uploaded Sales Value" value={fmtCur(uploadedSalesValue(record), uploadedCurrency(record))} />
            <DetailRow label="Uploaded Currency" value={uploadedCurrency(record) || '—'} />
            <DetailRow label="Uploaded Unit Value" value={fmtNum(uploadedUnitValue(record))} />
            <DetailRow label="Ship-To Account"  value={shipToObj.accountName || shipToObj.name || record.shipToAccountName || '—'} />
          </SectionCard>

          {/* ── 6. Calculated Values ── */}
          <SectionCard title="Calculated Values" icon="cash-outline" iconColor="#16A34A" iconBg="#F0FDF4">
            <Text style={styles.sectionNote}>Values calculated from product pricing snapshots</Text>
            <DetailRow label="Detected Price Basis" value={cap(record.detectedPriceBasis || '—')} />
            <DetailRow label="Detected Price Currency" value={record.detectedPriceCurrency || '—'} />
            <DetailRow label="Calculated CIF USD"        value={fmtCur(calculatedCifUsd(record), 'USD')} />
            <DetailRow label="Calculated Wholesale AED"  value={fmtCur(calculatedWholesaleAed(record), 'AED')} />
            <DetailRow label="Calculated Retail AED"     value={fmtCur(calculatedRetailAed(record), 'AED')} />
            {record.pricingSnapshotDate && (
              <DetailRow label="Pricing Snapshot Date" value={fmtDate(record.pricingSnapshotDate)} />
            )}
          </SectionCard>

          {/* ── 7. Order Match ── */}
          <SectionCard title="Order Match" icon="receipt-outline" iconColor="#EF4444" iconBg="#FEF2F2">
            {record.matchedOrderId ? (
              <>
                <DetailRow label="Matched Order ID" value={record.matchedOrderId} />
                <DetailRow label="Order Number"      value={record.matchedOrderNumber || '—'} />
                <DetailRow label="Order Date"        value={fmtDate(record.matchedOrderDate)} />
                {record.orderMatchConfidence != null && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Match Confidence</Text>
                    <ConfidenceBar pct={record.orderMatchConfidence} />
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.noMatchText}>No order matched yet. Run "Match Orders" to attempt matching.</Text>
            )}
          </SectionCard>

          {/* ── 8. Target Match Preparation ── */}
          <SectionCard title="Target Match Preparation" icon="flag-outline" iconColor="#7C3AED" iconBg="#F5F3FF">
            <DetailRow label="Target Match Status" value={cap(record.targetMatchStatus || '—')} />
            {record.targetMatchStatus === 'within_target' && (
              <Text style={[styles.sectionNote, { color: '#15803D' }]}>Within assigned target range</Text>
            )}
            {record.targetMatchStatus === 'over_target' && (
              <Text style={[styles.sectionNote, { color: '#DC2626' }]}>Exceeds assigned target</Text>
            )}
            {!record.targetMatchStatus && (
              <Text style={styles.noMatchText}>Target matching not yet run.</Text>
            )}
          </SectionCard>

        </View>

        {/* ── 9. Raw Row Data ── */}
        {Object.keys(rawData).length > 0 && (
          <View style={styles.rawCard}>
            <Text style={styles.rawTitle}>Raw Uploaded Row Data</Text>
            <View style={styles.rawTable}>
              {Object.entries(rawData).map(([k, v]) => (
                <View key={k} style={styles.rawRow}>
                  <Text style={styles.rawKey}>{k}</Text>
                  <Text style={styles.rawVal}>{String(v ?? '')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Status Change Modal */}
      {showStatusModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Change Record Status</Text>
            <Text style={styles.modalSub}>Current: <Text style={{ fontWeight: '700' }}>{record.status || 'active'}</Text></Text>
            {STATUS_OPTIONS.map((s) => (
              <Pressable
                key={s}
                style={[styles.statusOpt, record.status === s && styles.statusOptActive]}
                onPress={() => handleChangeStatus(s)}
                disabled={toggling}
              >
                {toggling && record.status !== s
                  ? null
                  : <Text style={[styles.statusOptText, record.status === s && { color: colors.primary, fontWeight: '800' }]}>{cap(s)}</Text>
                }
                {toggling && <ActivityIndicator size={13} color={colors.primary} />}
              </Pressable>
            ))}
            <Pressable style={styles.modalCancel} onPress={() => setShowStatusModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 16, paddingBottom: 48 },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breadcrumbLink:    { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12, flexWrap: 'wrap',
  },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  headerBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  headerActions:{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },

  sectionCard: {
    flex: 1, minWidth: 280,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 10, ...shadow,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sectionIcon:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  sectionNote:   { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  shareBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingTop: 4, backgroundColor: colors.backgroundColor,
  },

  detailRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 12,
  },
  detailLabel:     { width: 160, fontSize: 12, color: colors.textSecondary, fontWeight: '600', flexShrink: 0 },
  detailValue:     { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  detailValueMono: { fontFamily: 'monospace', fontSize: 12 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  linkText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  noMatchText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

  confRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  confTrack: { flex: 1, height: 6, backgroundColor: colors.border + '90', borderRadius: 3, overflow: 'hidden' },
  confFill:  { height: 6, borderRadius: 3 },
  confPct:   { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  rawCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 10, ...shadow,
  },
  rawTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  rawTable: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  rawRow: {
    flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rawKey:  { width: 180, fontSize: 12, color: colors.textSecondary, fontWeight: '600', flexShrink: 0 },
  rawVal:  { flex: 1, fontSize: 12, color: colors.textPrimary, fontFamily: 'monospace' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  btnDangerText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  modal: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 24, gap: 10,
    minWidth: 280, maxWidth: 380, ...shadow,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  modalSub:   { fontSize: 13, color: colors.textSecondary },
  statusOpt: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.backgroundColor,
  },
  statusOptActive:  { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  statusOptText:    { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  modalCancel: {
    alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginTop: 4,
  },
  modalCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});
