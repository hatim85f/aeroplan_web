import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { listSalesBatches, deleteSalesBatch } from '../../store/sales/salesActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD    = globalWidth('1.2%');

const BATCH_STATUS_STYLE = {
  completed:              { bg: '#DCFCE7', text: '#15803D' },
  completed_with_errors:  { bg: '#FEF3C7', text: '#92400E' },
  processing:             { bg: '#EFF6FF', text: '#1D4ED8' },
  failed:                 { bg: '#FEE2E2', text: '#DC2626' },
  pending:                { bg: '#F1F5F9', text: '#64748B' },
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');
const fmtNum  = (n) => (n == null ? '—' : Number(n).toLocaleString());
const cap     = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—';

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

const COLS = [
  { key: 'fileName',   label: 'File Name',    width: 180 },
  { key: 'period',     label: 'Month/Year',   width: 90  },
  { key: 'mapping',    label: 'Mapping',      width: 110 },
  { key: 'uploadedBy', label: 'Uploaded By',  width: 120 },
  { key: 'uploadDate', label: 'Upload Date',  width: 100 },
  { key: 'total',      label: 'Total',        width: 60  },
  { key: 'success',    label: 'Success',      width: 70  },
  { key: 'failed',     label: 'Failed',       width: 60  },
  { key: 'matched',    label: 'Matched',      width: 70  },
  { key: 'unmatched',  label: 'Unmatched',    width: 80  },
  { key: 'status',     label: 'Status',       width: 130 },
  { key: 'actions',    label: 'Actions',      width: 80  },
];

function Badge({ label, styleObj }) {
  return (
    <View style={[styles.badge, { backgroundColor: styleObj?.bg || '#F1F5F9' }]}>
      <Text style={[styles.badgeText, { color: styleObj?.text || '#64748B' }]}>{label}</Text>
    </View>
  );
}

function Pagination({ page, pages, total, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <View style={styles.pagination}>
      <Text style={styles.paginationInfo}>Page {page} of {pages} · {total} batches</Text>
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

export default function SalesBatchesScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user    = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const role    = user.role || '';
  const manager = isManager(role);

  const [batches,    setBatches]    = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [deleting,   setDeleting]   = useState('');

  const fetchBatches = useCallback(async (pg = 1) => {
    setLoading(true); setError('');
    try {
      const res = await listSalesBatches(token, { page: pg, limit: 20 });
      setBatches(res.batches);
      setPagination(res.pagination);
    } catch (e) {
      setError(e.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchBatches(1); }, [fetchBatches]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this upload batch and all its records?')) return;
    setDeleting(id);
    try {
      await deleteSalesBatch(token, id);
      setBatches((prev) => prev.filter((b) => (b._id || b.id) !== id));
    } catch (e) {
      alert(e.message || 'Delete failed');
    } finally {
      setDeleting('');
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesBatches" scrollable={false}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Upload Batches</Text>
            <Text style={styles.pageSubtitle}>History of all sales file uploads</Text>
          </View>
          {manager && (
            <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('SalesUpload')}>
              <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Upload Sales</Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={() => fetchBatches(1)}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Head */}
                <View style={styles.tblHead}>
                  {COLS.map((c) => (
                    <Text key={c.key} style={[styles.tblTh, { width: c.width }]}>{c.label}</Text>
                  ))}
                </View>
                {batches.length === 0 ? (
                  <View style={styles.emptyRow}>
                    <Ionicons name="albums-outline" size={32} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No upload batches yet</Text>
                    {manager && (
                      <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('SalesUpload')}>
                        <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                        <Text style={styles.btnPrimaryText}>Upload Sales</Text>
                      </Pressable>
                    )}
                  </View>
                ) : batches.map((b) => {
                  const id       = b._id || b.id;
                  const statusSty = BATCH_STATUS_STYLE[b.status] || BATCH_STATUS_STYLE.pending;
                  const mappingObj  = b.mappingId  || {};
                  return (
                    <View key={id} style={styles.tblRow}>
                      <Text style={[styles.tblTd, { width: COLS[0].width }]} numberOfLines={1}>{b.fileName || '—'}</Text>
                      <Text style={[styles.tblTd, { width: COLS[1].width }]}>
                        {b.month ? `${b.month}/${b.year || ''}` : b.year || '—'}
                      </Text>
                      <Text style={[styles.tblTd, { width: COLS[2].width }]} numberOfLines={1}>
                        {mappingObj.name || mappingObj.mappingName || b.mappingName || '—'}
                      </Text>
                      <Text style={[styles.tblTd, { width: COLS[3].width }]} numberOfLines={1}>
                        {uploaderDisplayName(b)}
                      </Text>
                      <Text style={[styles.tblTd, { width: COLS[4].width }]}>{fmtDate(b.uploadDate || b.createdAt || b.uploadedAt)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[5].width }]}>{fmtNum(b.totalRows   || b.total)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[6].width, color: '#15803D' }]}>{fmtNum(b.successfulRows ?? b.successRows ?? b.success)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[7].width, color: colors.danger }]}>{fmtNum(b.failedRows  || b.failed)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[8].width, color: '#1D4ED8' }]}>{fmtNum(b.matchedRows  || b.matched)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[9].width, color: '#92400E' }]}>{fmtNum(b.unmatchedRows || b.unmatched)}</Text>
                      <View style={[styles.tblTd, { width: COLS[10].width }]}>
                        <Badge label={cap(b.status || 'pending')} styleObj={statusSty} />
                      </View>
                      <View style={[styles.tblTd, styles.tblActions, { width: COLS[11].width }]}>
                        <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('SalesBatchDetail', { batchId: id })}>
                          <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                        </Pressable>
                        {manager && (
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() => handleDelete(id)}
                            disabled={deleting === id}
                          >
                            {deleting === id
                              ? <ActivityIndicator size={12} color={colors.danger} />
                              : <Ionicons name="trash-outline" size={14} color={colors.danger} />
                            }
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={fetchBatches} />
          </ScrollView>
        )}
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, padding: PAD, gap: 12, minHeight: 0 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
  },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  tblHead: {
    flexDirection: 'row', backgroundColor: colors.primary + '0C',
    paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6, marginBottom: 2,
  },
  tblTh: { fontSize: 11, fontWeight: '800', color: colors.primary },
  tblRow: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  tblTd:      { fontSize: 12, color: colors.textPrimary, paddingRight: 4 },
  tblActions: { flexDirection: 'row', gap: 4 },
  actionBtn:  { padding: 5, borderRadius: 5 },

  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },

  emptyRow: { padding: 48, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: colors.textMuted },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  paginationInfo: { fontSize: 12, color: colors.textSecondary },
  paginationBtns: { flexDirection: 'row', gap: 4 },
  pageBtn: {
    width: 30, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  pageBtnActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  pageBtnDisabled:  { opacity: 0.4 },
  pageBtnText:      { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  pageBtnTextActive:{ color: '#fff', fontWeight: '700' },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
