import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  getFocOverridesByAccount,
  deleteFocOverrides,
  deleteFocEntry,
} from '../../store/focOverrides/focOverrideActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getFocStatus(startDate, endDate) {
  const today = new Date();
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (today < s) return { label: 'Upcoming', bg: '#EFF6FF', text: '#1D4ED8' };
  if (today > e) return { label: 'Expired',  bg: '#FEF2F2', text: '#DC2626' };
  return                { label: 'Active',   bg: '#ECFDF5', text: '#059669' };
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function InfoPair({ label, value, accent }) {
  return (
    <View style={styles.infoPair}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: colors.primary, fontWeight: '800' }]}>
        {value || '—'}
      </Text>
    </View>
  );
}

function StatusBadge({ startDate, endDate }) {
  const s = getFocStatus(startDate, endDate);
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusBadgeText, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function FocOverrideDetailsScreen({
  navigation, route, userDetails, appMetadata, onSignOut,
}) {
  const accountId   = route?.params?.accountId;
  const user        = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token       = userDetails?.token || userDetails?.data?.token || '';
  const role        = user.role || '';
  const managerRole = isManager(role);

  const [doc,       setDoc]       = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [deleting,  setDeleting]  = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(null);

  const fetchDoc = useCallback(async () => {
    if (!accountId) { setError('No account ID provided.'); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const data = await getFocOverridesByAccount(token, accountId);
      // API may return array or object — normalise to one document
      setDoc(Array.isArray(data) ? data[0] : data);
    } catch (e) {
      setError(e.message || 'Failed to load FOC override');
    } finally {
      setLoading(false);
    }
  }, [token, accountId]);

  useEffect(() => { fetchDoc(); }, [fetchDoc]);

  /* ── Delete entire document ── */
  const handleDeleteAll = async () => {
    if (!window.confirm(
      `Delete ALL FOC overrides for this account? This cannot be undone.`
    )) return;
    setDeleting(true);
    try {
      await deleteFocOverrides(token, accountId);
      navigation.navigate('FocOverridesList');
    } catch (e) {
      alert(e.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Delete a single entry ── */
  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Remove this product override entry?')) return;
    setDeletingEntry(entryId);
    try {
      await deleteFocEntry(token, accountId, entryId);
      fetchDoc();
    } catch (e) {
      alert(e.message || 'Failed to remove entry');
    } finally {
      setDeletingEntry(null);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────── */
  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="FOC Overrides"
    >
      {/* ── Back nav ────────────────────────────────────────────────────── */}
      <View style={styles.breadcrumb}>
        <Pressable style={styles.breadcrumbLink} onPress={() => navigation.navigate('FocOverridesList')}>
          <Ionicons name="arrow-back" size={14} color={colors.primary} />
          <Text style={styles.breadcrumbText}>FOC Overrides</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>Override Details</Text>
      </View>

      {/* ── Loading / error ──────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading override details...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchDoc}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : !doc ? (
        <View style={styles.centered}>
          <Ionicons name="document-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No FOC override found</Text>
          <Text style={styles.emptyText}>This account doesn't have an FOC override document yet.</Text>
          {managerRole && (
            <Pressable
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('FocOverrideForm', {
                mode: 'create',
                accountId,
              })}
            >
              <Ionicons name="add" size={14} color={colors.white} />
              <Text style={styles.btnPrimaryText}>Create Override</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {/* ── Header card ────────────────────────────────────────────── */}
          <View style={styles.headerCard}>
            <View style={styles.headerLeft}>
              <View style={styles.accountIcon}>
                <Ionicons name="business" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.accountName}>
                  {doc.accountId?.accountName || doc.accountId?.name || 'Unknown Account'}
                </Text>
                <Text style={styles.accountSub}>
                  ID: {doc.accountId?._id || doc.accountId || '—'}
                </Text>
              </View>
              <StatusBadge startDate={doc.startDate} endDate={doc.endDate} />
            </View>

            {managerRole && (
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.btnOutline}
                  onPress={() =>
                    navigation.navigate('FocOverrideForm', {
                      mode: 'edit',
                      accountId,
                      existingData: doc,
                    })
                  }
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.warning} />
                  <Text style={[styles.btnOutlineText, { color: colors.warning }]}>Edit Override</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnDanger, deleting && { opacity: 0.6 }]}
                  onPress={handleDeleteAll}
                  disabled={deleting}
                >
                  {deleting
                    ? <ActivityIndicator size={13} color={colors.white} />
                    : <Ionicons name="trash-outline" size={14} color={colors.white} />
                  }
                  <Text style={styles.btnDangerText}>
                    {deleting ? 'Deleting...' : 'Delete All'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Meta info ──────────────────────────────────────────────── */}
          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <View>
                <Text style={styles.metaLabel}>Valid From</Text>
                <Text style={styles.metaValue}>{fmtDate(doc.startDate)}</Text>
              </View>
            </View>
            <View style={styles.metaCard}>
              <Ionicons name="calendar" size={18} color={colors.danger} />
              <View>
                <Text style={styles.metaLabel}>Valid To</Text>
                <Text style={styles.metaValue}>{fmtDate(doc.endDate)}</Text>
              </View>
            </View>
            <View style={styles.metaCard}>
              <Ionicons name="cube-outline" size={18} color={colors.warning} />
              <View>
                <Text style={styles.metaLabel}>Product Overrides</Text>
                <Text style={styles.metaValue}>{doc.overrides?.length || 0}</Text>
              </View>
            </View>
            <View style={styles.metaCard}>
              <Ionicons name="document-text-outline" size={18} color={colors.success} />
              <View>
                <Text style={styles.metaLabel}>Document ID</Text>
                <Text style={[styles.metaValue, { fontFamily: 'monospace', fontSize: globalWidth('0.58%') }]}>
                  {doc._id || doc.id || '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Override entries table ──────────────────────────────────── */}
          <View style={styles.tableCard}>
            <View style={styles.tableCardHeader}>
              <Text style={styles.tableCardTitle}>Product Override Entries</Text>
              {managerRole && (
                <Pressable
                  style={styles.addEntryBtn}
                  onPress={() =>
                    navigation.navigate('FocOverrideForm', {
                      mode: 'edit',
                      accountId,
                      existingData: doc,
                    })
                  }
                >
                  <Ionicons name="pencil-outline" size={13} color={colors.primary} />
                  <Text style={styles.addEntryText}>Edit Entries</Text>
                </Pressable>
              )}
            </View>

            {/* Table head */}
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
              <Text style={[styles.th, { flex: 3 }]}>Product</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Override %</Text>
              <Text style={[styles.th, { flex: 2 }]}>Notes</Text>
              {managerRole && <Text style={[styles.th, { flex: 1 }]}>Actions</Text>}
            </View>

            {/* Rows */}
            {!doc.overrides || doc.overrides.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No entries</Text>
                <Text style={styles.emptyText}>This override document has no product entries.</Text>
              </View>
            ) : (
              doc.overrides.map((entry, idx) => {
                const entryId   = entry._id || entry.id;
                const prodName  = entry.productId?.productName || entry.productId?.name || '—';
                const pct       = entry.overridePercentage ?? '—';
                const even      = idx % 2 === 0;
                const isDelEntryLoading = deletingEntry === entryId;

                return (
                  <View
                    key={entryId || idx}
                    style={[styles.tableRow, even && styles.tableRowAlt]}
                  >
                    <Text style={[styles.tdMuted, { flex: 0.5 }]}>{idx + 1}</Text>
                    <View style={[styles.td, { flex: 3 }]}>
                      <Text style={styles.tdPrimary}>{prodName}</Text>
                      {entry.productId?._id && (
                        <Text style={styles.tdSub}>
                          ID: {entry.productId._id}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.td, { flex: 1.5 }]}>
                      <View style={styles.pctPill}>
                        <Text style={styles.pctPillText}>{pct}%</Text>
                      </View>
                    </View>
                    <Text style={[styles.tdMuted, { flex: 2 }]}>
                      {entry.notes || '—'}
                    </Text>
                    {managerRole && (
                      <View style={[styles.td, { flex: 1 }]}>
                        <Pressable
                          style={[styles.iconBtn, isDelEntryLoading && { opacity: 0.5 }]}
                          onPress={() => handleDeleteEntry(entryId)}
                          disabled={isDelEntryLoading}
                        >
                          {isDelEntryLoading
                            ? <ActivityIndicator size={12} color={colors.danger} />
                            : <Ionicons name="trash-outline" size={14} color={colors.danger} />
                          }
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: globalHeight('1.5%'),
  },
  breadcrumbLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbText: {
    fontSize: globalWidth('0.72%'),
    color: colors.primary,
    fontWeight: '600',
  },
  breadcrumbCurrent: {
    fontSize: globalWidth('0.72%'),
    color: colors.textSecondary,
  },

  /* Header card */
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: globalWidth('1.2%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'),
    flexWrap: 'wrap',
    gap: globalWidth('0.8%'),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.8%'),
    flex: 1,
  },
  accountIcon: {
    width: globalWidth('3.2%'),
    height: globalWidth('3.2%'),
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    fontSize: globalWidth('1%'),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  accountSub: {
    fontSize: globalWidth('0.6%'),
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: globalWidth('0.65%'),
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.6%'),
  },

  /* Meta row */
  metaRow: {
    flexDirection: 'row',
    gap: globalWidth('1%'),
    marginBottom: globalHeight('1.5%'),
    flexWrap: 'wrap',
  },
  metaCard: {
    flex: 1,
    minWidth: globalWidth('14%'),
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: globalWidth('0.9%'),
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.7%'),
  },
  metaLabel: {
    fontSize: globalWidth('0.6%'),
    color: colors.textMuted,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: globalWidth('0.78%'),
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },

  /* Table card */
  tableCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: globalHeight('2%'),
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: globalWidth('1%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCardTitle: {
    fontSize: globalWidth('0.8%'),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  addEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: globalWidth('0.7%'),
    paddingVertical: globalHeight('0.5%'),
  },
  addEntryText: {
    fontSize: globalWidth('0.65%'),
    fontWeight: '700',
    color: colors.primary,
  },

  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('0.8%'),
    backgroundColor: colors.backgroundColor,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: {
    fontSize: globalWidth('0.62%'),
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('1.2%'),
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: { backgroundColor: colors.backgroundColor },
  td: { justifyContent: 'center' },
  tdPrimary: {
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tdSub: {
    fontSize: globalWidth('0.58%'),
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  tdMuted: {
    fontSize: globalWidth('0.68%'),
    color: colors.textSecondary,
  },

  pctPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pctPillText: {
    fontSize: globalWidth('0.65%'),
    fontWeight: '800',
    color: '#059669',
  },

  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Info pair */
  infoPair: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: globalHeight('0.6%'),
    gap: globalWidth('0.6%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: globalWidth('0.65%'),
    color: colors.textSecondary,
    width: globalWidth('7%'),
  },
  infoValue: {
    flex: 1,
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
    fontWeight: '600',
  },

  /* Buttons */
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: globalWidth('1%'),
    height: globalHeight('4.4%'),
    marginTop: globalHeight('1%'),
  },
  btnPrimaryText: {
    color: colors.white,
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('0.9%'),
    height: globalHeight('4.2%'),
  },
  btnOutlineText: {
    fontSize: globalWidth('0.68%'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: globalWidth('0.9%'),
    height: globalHeight('4.2%'),
  },
  btnDangerText: {
    color: colors.white,
    fontSize: globalWidth('0.68%'),
    fontWeight: '700',
  },

  /* States */
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: globalHeight('6%'),
    gap: 10,
  },
  loadingText: { fontSize: globalWidth('0.72%'), color: colors.textSecondary },
  errorText: { fontSize: globalWidth('0.8%'), color: colors.danger, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  retryText: { color: colors.primary, fontWeight: '700', fontSize: globalWidth('0.72%') },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: globalHeight('4%'),
    gap: 8,
  },
  emptyTitle: {
    fontSize: globalWidth('0.85%'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: globalWidth('0.68%'),
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: globalWidth('30%'),
  },
});
