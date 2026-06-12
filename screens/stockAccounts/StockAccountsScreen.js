import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import { createStockAccount, deleteStockAccount, listStockAccounts } from '../../store/stockAccounts/stockAccountActions';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const fmtDate = (value) => (value ? String(value).slice(0, 10) : '—');
const getId = (item = {}) => String(item._id || item.id || '');
const getAccountName = (account = {}) => account.accountName || account.name || 'Account';

export const MOVEMENT_STYLES = {
  no_movement_yet: { bg: '#F1F5F9', text: '#64748B', label: 'No movement yet' },
  stable: { bg: '#F1F5F9', text: '#475569', label: 'Stable' },
  positive: { bg: '#DCFCE7', text: '#15803D', label: 'Positive movement' },
  negative: { bg: '#FEF2F2', text: '#DC2626', label: 'Negative movement' },
  needs_review: { bg: '#FFFBEB', text: '#B45309', label: 'Needs review' },
};

export function MovementBadge({ status }) {
  const s = MOVEMENT_STYLES[status] || MOVEMENT_STYLES.no_movement_yet;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: s.bg }]}>
      <Text style={[badgeStyles.badgeText, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

export default function StockAccountsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';

  const [stockAccounts, setStockAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Create modal */
  const [showCreate, setShowCreate] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [baseAccountId, setBaseAccountId] = useState('');
  const [customName, setCustomName] = useState('');
  const [linkedIds, setLinkedIds] = useState([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchList = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const data = await listStockAccounts(token, search ? { search } : {});
      setStockAccounts(data);
    } catch (err) {
      setError(err.message || 'Failed to load stock accounts.');
    } finally {
      setLoading(false);
    }
  }, [search, token]);

  useEffect(() => {
    const timer = setTimeout(fetchList, 350);
    return () => clearTimeout(timer);
  }, [fetchList]);

  useEffect(() => {
    if (!token) return;
    getAccounts(token, { page: 1, limit: 1000 })
      .then((result) => {
        const list = Array.isArray(result?.accounts) ? result.accounts
          : Array.isArray(result?.data) ? result.data
          : Array.isArray(result) ? result : [];
        setAccounts(list);
      })
      .catch(() => setAccounts([]));
  }, [token]);

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    return accounts
      .filter((account) => !query || getAccountName(account).toLowerCase().includes(query))
      .slice(0, 60);
  }, [accountSearch, accounts]);

  const handleDelete = async (entry, event) => {
    if (event?.stopPropagation) event.stopPropagation();
    if (!window.confirm(`Delete stock account "${entry.accountName}"? Its stock history is kept but it will no longer appear in the list.`)) return;
    try {
      await deleteStockAccount(token, String(entry.stockAccountId));
      await fetchList();
    } catch (err) {
      window.alert(err.message || 'Failed to delete stock account.');
    }
  };

  const toggleLinked = (id) => {
    setLinkedIds((current) => (
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    ));
  };

  const handleCreate = async () => {
    setFormError('');
    if (!baseAccountId && !customName.trim()) {
      setFormError('Select an existing account or enter a custom account name.');
      return;
    }
    try {
      setSaving(true);
      const created = await createStockAccount(token, {
        accountId: baseAccountId || undefined,
        accountName: customName.trim() || undefined,
        isCustomAccount: !baseAccountId,
        linkedAccountIds: linkedIds,
      });
      setShowCreate(false);
      setBaseAccountId('');
      setCustomName('');
      setLinkedIds([]);
      await fetchList();
      if (created?._id) navigation.navigate('StockAccountDetails', { stockAccountId: String(created._id) });
    } catch (err) {
      setFormError(err.message || 'Failed to create stock account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="StockAccounts">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Stock Accounts</Text>
            <Text style={styles.pageSubtitle}>Track stock for purchasing accounts — sales from linked accounts feed in automatically</Text>
          </View>
          <Pressable style={styles.btnPrimary} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={styles.btnPrimaryText}>Create Stock Account</Text>
          </Pressable>
        </View>

        {/* ── Search ── */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={14} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search stock accounts…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchList}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.tblHead}>
              <Text style={[styles.tblTh, { flex: 2 }]}>STOCK ACCOUNT</Text>
              <Text style={[styles.tblThNum, { flex: 0.9 }]}>LINKED</Text>
              <Text style={[styles.tblTh, { flex: 1 }]}>LAST UPDATED</Text>
              <Text style={[styles.tblTh, { flex: 1.2 }]}>UPDATED BY</Text>
              <Text style={[styles.tblThNum, { flex: 0.7 }]}>ITEMS</Text>
              <Text style={[styles.tblTh, { flex: 1.3 }]}>MOVEMENT</Text>
              <Text style={[styles.tblTh, { width: 80 }]}>ACTIONS</Text>
            </View>
            {!stockAccounts.length ? (
              <Text style={styles.emptyText}>No stock accounts yet. Create one to start tracking stock.</Text>
            ) : stockAccounts.map((entry, index) => (
              <Pressable
                key={String(entry.stockAccountId)}
                style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}
                onPress={() => navigation.navigate('StockAccountDetails', { stockAccountId: String(entry.stockAccountId) })}
              >
                <View style={{ flex: 2 }}>
                  <Text style={styles.tblTdStrong} numberOfLines={1}>{entry.accountName}</Text>
                  {entry.isCustomAccount ? <Text style={styles.customTag}>custom</Text> : null}
                </View>
                <Text style={[styles.tblTdNum, { flex: 0.9 }]}>{entry.linkedAccountsCount}</Text>
                <Text style={[styles.tblTd, { flex: 1 }]}>{fmtDate(entry.lastUpdatedAt)}</Text>
                <Text style={[styles.tblTd, { flex: 1.2 }]} numberOfLines={1}>{entry.lastUpdatedBy || '—'}</Text>
                <Text style={[styles.tblTdNum, { flex: 0.7 }]}>{entry.itemsCount}</Text>
                <View style={{ flex: 1.3 }}><MovementBadge status={entry.movementStatus} /></View>
                <View style={{ width: 80, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('StockAccountDetails', { stockAccountId: String(entry.stockAccountId) })}
                  >
                    <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={(event) => handleDelete(entry, event)}>
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Create modal ── */}
      {showCreate && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons name="cube-outline" size={22} color={colors.primary} />
              <Text style={styles.modalTitle}>Create Stock Account</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Custom account name (or pick an existing account below)</Text>
            <TextInput
              value={customName}
              onChangeText={(t) => { setCustomName(t); if (t) setBaseAccountId(''); }}
              placeholder="e.g. Burjeel Drugstore"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Search existing accounts — click once to use as MAIN account, again to LINK it</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={13} color={colors.textMuted} />
              <TextInput
                value={accountSearch}
                onChangeText={setAccountSearch}
                placeholder="Search accounts…"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>
            <ScrollView style={styles.accountList} nestedScrollEnabled>
              {filteredAccounts.map((account) => {
                const id = getId(account);
                const isBase = baseAccountId === id;
                const isLinked = linkedIds.includes(id);
                return (
                  <Pressable
                    key={id}
                    style={[styles.accountOpt, (isBase || isLinked) && styles.accountOptActive]}
                    onPress={() => {
                      if (isBase) setBaseAccountId('');
                      else if (isLinked) toggleLinked(id);
                      else if (!baseAccountId && !customName.trim()) setBaseAccountId(id);
                      else toggleLinked(id);
                    }}
                  >
                    <Text style={styles.accountOptText} numberOfLines={1}>{getAccountName(account)}</Text>
                    {isBase ? <Text style={styles.roleTagMain}>MAIN</Text> : null}
                    {isLinked ? <Text style={styles.roleTagLinked}>LINKED</Text> : null}
                  </Pressable>
                );
              })}
              {!filteredAccounts.length ? <Text style={styles.emptyText}>No accounts found.</Text> : null}
            </ScrollView>

            <Text style={styles.helperText}>
              {baseAccountId ? 'Main account selected. ' : customName ? `Custom name: "${customName.trim()}". ` : 'No main account yet. '}
              {linkedIds.length} linked account{linkedIds.length === 1 ? '' : 's'}.
            </Text>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.btnOutline} onPress={() => setShowCreate(false)} disabled={saving}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="checkmark" size={14} color="#fff" />}
                <Text style={styles.btnPrimaryText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },

  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, backgroundColor: colors.surface, minHeight: 38, maxWidth: 420,
  },
  searchInput: { flex: 1, fontSize: 12, color: colors.textPrimary, paddingVertical: 9 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 8, ...shadow,
  },
  tblHead: {
    flexDirection: 'row', backgroundColor: colors.primary + '0C',
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6, gap: 14, alignItems: 'center',
  },
  tblTh: { fontSize: 10, fontWeight: '800', color: colors.primary },
  tblThNum: { fontSize: 10, fontWeight: '800', color: colors.primary, textAlign: 'right' },
  tblRow: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 12, gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  tblRowAlt: { backgroundColor: colors.backgroundColor + '70' },
  tblTd: { fontSize: 12, color: colors.textPrimary },
  tblTdNum: { fontSize: 12, color: colors.textPrimary, textAlign: 'right' },
  tblTdStrong: { fontSize: 12.5, color: colors.textPrimary, fontWeight: '700' },
  customTag: { fontSize: 9, color: colors.textMuted, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  actionBtn: { padding: 5, borderRadius: 5 },

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

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,18,47,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 12,
    width: '100%', maxWidth: 560, maxHeight: '90%', ...shadow,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9, backgroundColor: colors.backgroundColor,
    fontSize: 12, color: colors.textPrimary,
  },
  accountList: { maxHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  accountOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border + '60',
  },
  accountOptActive: { backgroundColor: colors.primary + '0E' },
  accountOptText: { flex: 1, fontSize: 12.5, color: colors.textPrimary },
  roleTagMain: { fontSize: 9, fontWeight: '800', color: '#fff', backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  roleTagLinked: { fontSize: 9, fontWeight: '800', color: '#15803D', backgroundColor: '#DCFCE7', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  helperText: { fontSize: 11, color: colors.textMuted },
  formError: { fontSize: 12, color: colors.danger, fontWeight: '600' },

  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 14 },
  centered: { padding: 50, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
