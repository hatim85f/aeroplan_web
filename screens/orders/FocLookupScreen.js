import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import { getFocOverridesByAccount } from '../../store/focOverrides/focOverrideActions';

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

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function FocLookupScreen({
  navigation, userDetails, appMetadata, onSignOut,
}) {
  const user  = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role  = user.role || '';
  const managerRole = isManager(role);

  /* ── Account search ── */
  const [search,          setSearch]          = useState('');
  const [searchResults,   setSearchResults]   = useState([]);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [showDrop,        setShowDrop]        = useState(false);

  /* ── Selected account + result ── */
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [focDoc,          setFocDoc]          = useState(null);
  const [focLoading,      setFocLoading]      = useState(false);
  const [focError,        setFocError]        = useState('');

  /* ── Account search debounce ── */
  const searchAccounts = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); setShowDrop(false); return; }
    setSearchLoading(true);
    try {
      const res = await getAccounts(token, { search: q, page: 1, limit: 10 });
      setSearchResults(res.accounts || []);
      setShowDrop(true);
    } catch { setSearchResults([]); }
    finally  { setSearchLoading(false); }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => searchAccounts(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Fetch FOC after account selected ── */
  const fetchFoc = useCallback(async (accountId) => {
    setFocLoading(true);
    setFocError('');
    setFocDoc(null);
    try {
      const data = await getFocOverridesByAccount(token, accountId);
      // Normalise: may be array or object
      const doc = Array.isArray(data) ? data[0] : data;
      setFocDoc(doc || null);
    } catch (e) {
      if (e.message?.includes('404') || e.message?.includes('not found')) {
        setFocDoc(null); // treat as no override
      } else {
        setFocError(e.message || 'Failed to fetch FOC data');
      }
    } finally {
      setFocLoading(false);
    }
  }, [token]);

  const selectAccount = (account) => {
    const id   = account._id || account.id;
    const name = account.accountName || account.name;
    setSelectedAccount({ _id: id, name });
    setSearch(name);
    setShowDrop(false);
    fetchFoc(id);
  };

  const clearLookup = () => {
    setSelectedAccount(null);
    setFocDoc(null);
    setFocError('');
    setSearch('');
    setSearchResults([]);
    setShowDrop(false);
  };

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="FOC Lookup"
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>FOC Lookup</Text>
          <Text style={styles.pageSubtitle}>
            Quickly look up any account's FOC override details
          </Text>
        </View>
        <Pressable
          style={styles.btnOutline}
          onPress={() => navigation.navigate('FocOverridesList')}
        >
          <Ionicons name="list-outline" size={14} color={colors.primary} />
          <Text style={styles.btnOutlineText}>All Overrides</Text>
        </Pressable>
      </View>

      {/* ── Search card ─────────────────────────────────────────────────── */}
      <View style={styles.searchCard}>
        <View style={styles.searchCardHeader}>
          <Ionicons name="search-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.searchCardTitle}>Search Account</Text>
        </View>
        <Text style={styles.searchCardHint}>
          Type the account name to look up their FOC override configuration.
        </Text>

        {/* Search input */}
        <View style={styles.searchWrap}>
          <Ionicons name="business-outline" size={15} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Start typing account name..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              if (selectedAccount) clearLookup();
            }}
            onFocus={() => { if (searchResults.length) setShowDrop(true); }}
          />
          {searchLoading && <ActivityIndicator size={13} color={colors.primary} />}
          {(search || selectedAccount) && (
            <Pressable onPress={clearLookup}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Dropdown */}
        {showDrop && !selectedAccount && searchResults.length > 0 && (
          <View style={styles.dropPanel}>
            <ScrollView style={styles.dropList} keyboardShouldPersistTaps="handled">
              {searchResults.map((a) => {
                const aid  = a._id || a.id;
                const name = a.accountName || a.name || '—';
                const type = a.accountType || '';
                const city = a.area || a.city || '';
                return (
                  <Pressable
                    key={aid}
                    style={styles.dropItem}
                    onPress={() => selectAccount(a)}
                  >
                    <View style={styles.dropItemIcon}>
                      <Ionicons name="business-outline" size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropItemText}>{name}</Text>
                      {(type || city) ? (
                        <Text style={styles.dropItemSub}>
                          {[type, city].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {showDrop && !selectedAccount && searchResults.length === 0 && !searchLoading && search.length >= 2 && (
          <View style={styles.dropPanel}>
            <View style={styles.dropEmpty}>
              <Ionicons name="business-outline" size={20} color={colors.textMuted} />
              <Text style={styles.dropEmptyText}>No accounts found for "{search}"</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {selectedAccount && (
        <>
          {focLoading ? (
            <View style={styles.resultCard}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Looking up FOC overrides...</Text>
            </View>
          ) : focError ? (
            <View style={[styles.resultCard, styles.errorCard]}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{focError}</Text>
              <Pressable style={styles.retryBtn} onPress={() => fetchFoc(selectedAccount._id)}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : !focDoc ? (
            <View style={[styles.resultCard, styles.noDataCard]}>
              <Ionicons name="document-outline" size={32} color={colors.textMuted} />
              <Text style={styles.noDataTitle}>No FOC Override Set</Text>
              <Text style={styles.noDataText}>
                <Text style={{ fontWeight: '800' }}>{selectedAccount.name}</Text>
                {' '}does not have any FOC override configured.
              </Text>
              {managerRole && (
                <Pressable
                  style={styles.btnPrimary}
                  onPress={() =>
                    navigation.navigate('FocOverrideForm', {
                      mode: 'create',
                      accountId: selectedAccount._id,
                    })
                  }
                >
                  <Ionicons name="add" size={14} color={colors.white} />
                  <Text style={styles.btnPrimaryText}>Create Override</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.resultDoc}>
              {/* Account + status header */}
              <View style={styles.docHeader}>
                <View style={styles.docHeaderLeft}>
                  <View style={styles.accountIcon}>
                    <Ionicons name="business" size={20} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.docAccountName}>{selectedAccount.name}</Text>
                    <Text style={styles.docSub}>
                      Valid: {fmtDate(focDoc.startDate)} → {fmtDate(focDoc.endDate)}
                    </Text>
                  </View>
                </View>
                <View style={styles.docHeaderRight}>
                  {(() => {
                    const s = getFocStatus(focDoc.startDate, focDoc.endDate);
                    return (
                      <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                        <Text style={[styles.statusPillText, { color: s.text }]}>{s.label}</Text>
                      </View>
                    );
                  })()}
                  {managerRole && (
                    <Pressable
                      style={styles.viewBtn}
                      onPress={() =>
                        navigation.navigate('FocOverrideDetails', {
                          accountId: selectedAccount._id,
                        })
                      }
                    >
                      <Ionicons name="eye-outline" size={13} color={colors.primary} />
                      <Text style={styles.viewBtnText}>Full Details</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Override entries */}
              <View style={styles.entriesTable}>
                <View style={styles.entriesHead}>
                  <Text style={[styles.entryTh, { flex: 3 }]}>Product</Text>
                  <Text style={[styles.entryTh, { flex: 1.5 }]}>FOC Override %</Text>
                  <Text style={[styles.entryTh, { flex: 2 }]}>Notes</Text>
                </View>

                {(!focDoc.overrides || focDoc.overrides.length === 0) ? (
                  <View style={styles.entryEmpty}>
                    <Text style={styles.entryEmptyText}>No product entries in this override.</Text>
                  </View>
                ) : (
                  focDoc.overrides.map((entry, idx) => {
                    const pid      = entry._id || entry.id || idx;
                    const prodName = entry.productId?.productName || entry.productId?.name || '—';
                    const pct      = entry.overridePercentage ?? '—';
                    return (
                      <View
                        key={pid}
                        style={[styles.entryRow, idx % 2 === 0 && { backgroundColor: colors.backgroundColor }]}
                      >
                        <Text style={[styles.entryTd, { flex: 3 }]}>{prodName}</Text>
                        <View style={{ flex: 1.5 }}>
                          <View style={styles.pctPill}>
                            <Text style={styles.pctPillText}>{pct}%</Text>
                          </View>
                        </View>
                        <Text style={[styles.entryTdMuted, { flex: 2 }]}>
                          {entry.notes || '—'}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Summary row */}
              <View style={styles.docSummaryRow}>
                <Ionicons name="cube-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.docSummaryText}>
                  {focDoc.overrides?.length || 0} product override
                  {(focDoc.overrides?.length || 0) !== 1 ? 's' : ''} configured
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* ── Placeholder when nothing selected ───────────────────────────── */}
      {!selectedAccount && (
        <View style={styles.placeholder}>
          <Ionicons name="search-circle-outline" size={52} color={colors.border} />
          <Text style={styles.placeholderTitle}>Ready to look up</Text>
          <Text style={styles.placeholderText}>
            Search for an account above to view their FOC override settings
          </Text>
        </View>
      )}
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: globalHeight('2%'),
  },
  pageTitle: {
    fontSize: globalWidth('1.4%'),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: globalWidth('0.75%'),
    color: colors.textSecondary,
    marginTop: globalHeight('0.4%'),
  },

  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: globalWidth('1%'),
    height: globalHeight('4.4%'),
  },
  btnOutlineText: {
    color: colors.primary,
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
  },
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

  /* Search card */
  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: globalWidth('1.5%'),
    marginBottom: globalHeight('2%'),
  },
  searchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.5%'),
    marginBottom: globalHeight('0.6%'),
  },
  searchCardTitle: {
    fontSize: globalWidth('0.9%'),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  searchCardHint: {
    fontSize: globalWidth('0.68%'),
    color: colors.textSecondary,
    marginBottom: globalHeight('1.2%'),
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.5%'),
    backgroundColor: colors.backgroundColor,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('0.8%'),
    height: globalHeight('5.2%'),
  },
  searchInput: {
    flex: 1,
    fontSize: globalWidth('0.85%'),
    color: colors.textPrimary,
    outlineStyle: 'none',
  },

  /* Dropdown */
  dropPanel: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropList: { maxHeight: 240 },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: globalWidth('0.8%'),
    paddingVertical: globalHeight('1.1%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: globalWidth('0.5%'),
  },
  dropItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropItemText: {
    fontSize: globalWidth('0.75%'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dropItemSub: {
    fontSize: globalWidth('0.6%'),
    color: colors.textSecondary,
    marginTop: 2,
  },
  dropEmpty: {
    alignItems: 'center',
    padding: globalWidth('1.2%'),
    gap: 8,
  },
  dropEmptyText: {
    fontSize: globalWidth('0.68%'),
    color: colors.textSecondary,
    textAlign: 'center',
  },

  /* Result states */
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: globalWidth('2%'),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: globalHeight('2%'),
  },
  loadingText: {
    fontSize: globalWidth('0.75%'),
    color: colors.textSecondary,
  },
  errorCard: { borderColor: '#FCA5A5' },
  errorText: { fontSize: globalWidth('0.72%'), color: colors.danger, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  retryText: { color: colors.primary, fontWeight: '700', fontSize: globalWidth('0.68%') },

  noDataCard: { borderStyle: 'dashed', paddingVertical: globalHeight('4%') },
  noDataTitle: {
    fontSize: globalWidth('0.9%'),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  noDataText: {
    fontSize: globalWidth('0.72%'),
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: globalWidth('30%'),
  },

  /* Result doc */
  resultDoc: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: globalHeight('2%'),
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: globalWidth('1.2%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    flexWrap: 'wrap',
    gap: globalWidth('0.8%'),
  },
  docHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.8%'),
    flex: 1,
  },
  docHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.6%'),
  },
  accountIcon: {
    width: globalWidth('2.8%'),
    height: globalWidth('2.8%'),
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docAccountName: {
    fontSize: globalWidth('0.85%'),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  docSub: {
    fontSize: globalWidth('0.62%'),
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: globalWidth('0.62%'),
    fontWeight: '700',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: globalWidth('0.6%'),
    paddingVertical: globalHeight('0.5%'),
  },
  viewBtnText: {
    fontSize: globalWidth('0.62%'),
    fontWeight: '700',
    color: colors.primary,
  },

  /* Entries table */
  entriesTable: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entriesHead: {
    flexDirection: 'row',
    paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('0.8%'),
    backgroundColor: colors.backgroundColor,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryTh: {
    fontSize: globalWidth('0.6%'),
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  entryRow: {
    flexDirection: 'row',
    paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('1.1%'),
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryTd: {
    fontSize: globalWidth('0.72%'),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  entryTdMuted: {
    fontSize: globalWidth('0.68%'),
    color: colors.textSecondary,
  },
  entryEmpty: {
    padding: globalWidth('1.2%'),
    alignItems: 'center',
  },
  entryEmptyText: {
    fontSize: globalWidth('0.68%'),
    color: colors.textMuted,
  },

  pctPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pctPillText: {
    fontSize: globalWidth('0.65%'),
    fontWeight: '800',
    color: '#059669',
  },

  docSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: globalWidth('0.8%'),
    paddingHorizontal: globalWidth('1%'),
  },
  docSummaryText: {
    fontSize: globalWidth('0.65%'),
    color: colors.textSecondary,
  },

  /* Placeholder */
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: globalHeight('8%'),
    gap: 12,
  },
  placeholderTitle: {
    fontSize: globalWidth('1%'),
    fontWeight: '800',
    color: colors.textMuted,
  },
  placeholderText: {
    fontSize: globalWidth('0.72%'),
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: globalWidth('28%'),
  },
});
