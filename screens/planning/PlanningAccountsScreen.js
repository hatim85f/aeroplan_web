import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import {
  createPlanningAccount,
  deletePlanningAccount,
  getAccountSource,
  listPlanningAccounts,
} from '../../store/planning/planningActions';
import { fmtDisplayDate } from './planningUtils';

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');
const ACCOUNT_TYPES = ['clinic', 'hospital', 'pharmacy', 'drugstore', 'other'];

export default function PlanningAccountsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';

  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState('main'); // 'main' | 'custom'
  const [sourceAccounts, setSourceAccounts] = useState([]);
  const [sourceSearch, setSourceSearch] = useState('');
  const [pickedAccountIds, setPickedAccountIds] = useState([]);
  const [custom, setCustom] = useState({ accountName: '', accountType: 'clinic', area: '', territory: '', keyContact: '', phoneNumber: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchList = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      setAccounts(await listPlanningAccounts(token, search ? { search } : {}));
    } catch (err) {
      setError(err.message || 'Failed to load planning accounts.');
    } finally {
      setLoading(false);
    }
  }, [search, token]);

  useEffect(() => {
    const timer = setTimeout(fetchList, 350);
    return () => clearTimeout(timer);
  }, [fetchList]);

  useEffect(() => {
    if (!token || !showAdd) return;
    getAccountSource(token, sourceSearch ? { search: sourceSearch } : {})
      .then(setSourceAccounts)
      .catch(() => setSourceAccounts([]));
  }, [showAdd, sourceSearch, token]);

  const resetForm = () => {
    setMode('main');
    setPickedAccountIds([]);
    setSourceSearch('');
    setCustom({ accountName: '', accountType: 'clinic', area: '', territory: '', keyContact: '', phoneNumber: '', notes: '' });
    setFormError('');
  };

  const togglePicked = (id) => {
    setPickedAccountIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const handleAdd = async () => {
    setFormError('');
    try {
      setSaving(true);
      if (mode === 'main') {
        if (!pickedAccountIds.length) { setFormError('Select at least one account.'); setSaving(false); return; }
        await createPlanningAccount(token, { accountIds: pickedAccountIds });
      } else {
        if (!custom.accountName.trim()) { setFormError('Account name is required.'); setSaving(false); return; }
        await createPlanningAccount(token, { ...custom, accountName: custom.accountName.trim(), isCustomAccount: true });
      }
      setShowAdd(false);
      resetForm();
      await fetchList();
    } catch (err) {
      setFormError(err.message || 'Failed to add planning account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Remove "${entry.accountName}" from planning accounts?`)) return;
    try {
      await deletePlanningAccount(token, String(entry._id));
      await fetchList();
    } catch (err) {
      window.alert(err.message || 'Failed to remove planning account.');
    }
  };

  const filteredSource = useMemo(() => sourceAccounts.slice(0, 60), [sourceAccounts]);

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="PlanningAccounts">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Planning Accounts</Text>
            <Text style={styles.pageSubtitle}>Accounts available to place on your visit calendar</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.btnOutline} onPress={() => navigation.navigate('PlanningCalendar')}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.btnOutlineText}>Open Calendar</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={() => { resetForm(); setShowAdd(true); }}>
              <Ionicons name="add" size={15} color="#fff" />
              <Text style={styles.btnPrimaryText}>Add Planning Account</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={14} color={colors.textMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search planning accounts…" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
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
              <Text style={[styles.tblTh, { flex: 2 }]}>ACCOUNT</Text>
              <Text style={[styles.tblTh, { flex: 1 }]}>TYPE</Text>
              <Text style={[styles.tblTh, { flex: 1 }]}>AREA</Text>
              <Text style={[styles.tblTh, { flex: 1 }]}>SOURCE</Text>
              <Text style={[styles.tblTh, { flex: 1.2 }]}>LAST PLANNED</Text>
              <Text style={[styles.tblThNum, { flex: 0.8 }]}>VISITS</Text>
              <Text style={[styles.tblTh, { width: 50 }]} />
            </View>
            {!accounts.length ? (
              <Text style={styles.emptyText}>No planning accounts yet. Add one to start planning visits.</Text>
            ) : accounts.map((entry, index) => (
              <View key={String(entry._id)} style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}>
                <Text style={[styles.tblTdStrong, { flex: 2 }]} numberOfLines={1}>{entry.accountName}</Text>
                <Text style={[styles.tblTd, { flex: 1, textTransform: 'capitalize' }]}>{entry.accountType || '—'}</Text>
                <Text style={[styles.tblTd, { flex: 1 }]} numberOfLines={1}>{entry.area || '—'}</Text>
                <View style={{ flex: 1 }}>
                  <View style={[styles.srcChip, entry.isCustomAccount ? styles.srcCustom : styles.srcMain]}>
                    <Text style={[styles.srcChipText, { color: entry.isCustomAccount ? '#B45309' : '#1D4ED8' }]}>{entry.isCustomAccount ? 'Custom' : 'Main'}</Text>
                  </View>
                </View>
                <Text style={[styles.tblTd, { flex: 1.2 }]}>{fmtDisplayDate(entry.lastPlannedVisit?.date || entry.lastPlannedVisit)}</Text>
                <Text style={[styles.tblTdNum, { flex: 0.8 }]}>{entry.plannedVisitsCount}</Text>
                <View style={{ width: 50, alignItems: 'center' }}>
                  <Pressable style={styles.actionBtn} onPress={() => handleDelete(entry)}>
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add modal */}
      {showAdd && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons name="business-outline" size={22} color={colors.primary} />
              <Text style={styles.modalTitle}>Add Planning Account</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setShowAdd(false)}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
            </View>

            <View style={styles.segment}>
              {[{ key: 'main', label: 'From Main Accounts' }, { key: 'custom', label: 'Custom Account' }].map((opt) => {
                const active = mode === opt.key;
                return (
                  <Pressable key={opt.key} style={[styles.segmentBtn, active && styles.segmentBtnActive]} onPress={() => setMode(opt.key)}>
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === 'main' ? (
              <>
                <View style={styles.sourceBar}>
                  <View style={[styles.searchBox, { flex: 1 }]}>
                    <Ionicons name="search-outline" size={13} color={colors.textMuted} />
                    <TextInput value={sourceSearch} onChangeText={setSourceSearch} placeholder="Search accounts…" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
                  </View>
                  <Text style={styles.pickedCount}>{pickedAccountIds.length} selected</Text>
                </View>
                <ScrollView style={styles.sourceList} nestedScrollEnabled>
                  {filteredSource.map((account) => {
                    const id = String(account.accountId);
                    const picked = pickedAccountIds.includes(id);
                    return (
                      <Pressable key={id} style={[styles.sourceOpt, picked && styles.sourceOptActive]} onPress={() => togglePicked(id)}>
                        <Ionicons name={picked ? 'checkbox' : 'square-outline'} size={16} color={picked ? colors.primary : colors.textMuted} />
                        <Text style={styles.sourceOptText} numberOfLines={1}>{account.accountName}</Text>
                        {account.area ? <Text style={styles.sourceOptArea}>{account.area}</Text> : null}
                      </Pressable>
                    );
                  })}
                  {!filteredSource.length ? <Text style={styles.emptyText}>No accounts found.</Text> : null}
                </ScrollView>
              </>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                <Field label="Account Name *"><TextInput style={styles.input} value={custom.accountName} onChangeText={(t) => setCustom((c) => ({ ...c, accountName: t }))} placeholder="e.g. New Clinic" placeholderTextColor={colors.textMuted} /></Field>
                <Field label="Type">
                  <View style={styles.chipRow}>
                    {ACCOUNT_TYPES.map((type) => {
                      const active = custom.accountType === type;
                      return (
                        <Pressable key={type} style={[styles.chip, active && styles.chipActive]} onPress={() => setCustom((c) => ({ ...c, accountType: type }))}>
                          <Text style={[styles.chipText, active && styles.chipTextActive, { textTransform: 'capitalize' }]}>{type}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>
                <View style={styles.formRow}>
                  <Field label="Area" flex><TextInput style={styles.input} value={custom.area} onChangeText={(t) => setCustom((c) => ({ ...c, area: t }))} placeholderTextColor={colors.textMuted} /></Field>
                  <Field label="Territory" flex><TextInput style={styles.input} value={custom.territory} onChangeText={(t) => setCustom((c) => ({ ...c, territory: t }))} placeholderTextColor={colors.textMuted} /></Field>
                </View>
                <View style={styles.formRow}>
                  <Field label="Key Contact" flex><TextInput style={styles.input} value={custom.keyContact} onChangeText={(t) => setCustom((c) => ({ ...c, keyContact: t }))} placeholderTextColor={colors.textMuted} /></Field>
                  <Field label="Phone" flex><TextInput style={styles.input} value={custom.phoneNumber} onChangeText={(t) => setCustom((c) => ({ ...c, phoneNumber: t }))} placeholderTextColor={colors.textMuted} /></Field>
                </View>
                <Field label="Notes"><TextInput style={styles.input} value={custom.notes} onChangeText={(t) => setCustom((c) => ({ ...c, notes: t }))} placeholderTextColor={colors.textMuted} /></Field>
              </ScrollView>
            )}

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.btnOutline} onPress={() => setShowAdd(false)} disabled={saving}><Text style={styles.btnOutlineText}>Cancel</Text></Pressable>
              <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
                {saving ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="checkmark" size={14} color="#fff" />}
                <Text style={styles.btnPrimaryText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}

function Field({ label, children, flex }) {
  return (
    <View style={[{ gap: 5, marginBottom: 10 }, flex && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, backgroundColor: colors.surface, minHeight: 38, maxWidth: 420 },
  searchInput: { flex: 1, fontSize: 12, color: colors.textPrimary, paddingVertical: 9 },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8, ...shadow },
  tblHead: { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6, gap: 14, alignItems: 'center' },
  tblTh: { fontSize: 10, fontWeight: '800', color: colors.primary },
  tblThNum: { fontSize: 10, fontWeight: '800', color: colors.primary, textAlign: 'right' },
  tblRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 12, gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tblRowAlt: { backgroundColor: colors.backgroundColor + '70' },
  tblTd: { fontSize: 12, color: colors.textPrimary },
  tblTdNum: { fontSize: 12, color: colors.textPrimary, textAlign: 'right' },
  tblTdStrong: { fontSize: 12.5, color: colors.textPrimary, fontWeight: '700' },
  srcChip: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  srcMain: { backgroundColor: '#EFF6FF' },
  srcCustom: { backgroundColor: '#FFFBEB' },
  srcChipText: { fontSize: 10, fontWeight: '800' },
  actionBtn: { padding: 5, borderRadius: 5 },

  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7,18,47,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 12, width: '100%', maxWidth: 560, maxHeight: '92%', ...shadow },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },

  segment: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.backgroundColor },
  segmentBtn: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  segmentTextActive: { color: '#fff' },

  sourceBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickedCount: { fontSize: 11, fontWeight: '800', color: colors.primary },
  sourceList: { maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  sourceOpt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  sourceOptActive: { backgroundColor: colors.primary + '0E' },
  sourceOptText: { flex: 1, fontSize: 12.5, color: colors.textPrimary },
  sourceOptArea: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: colors.backgroundColor, fontSize: 12, color: colors.textPrimary },
  formRow: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: colors.backgroundColor },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  formError: { fontSize: 12, color: colors.danger, fontWeight: '600' },

  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 14 },
  centered: { padding: 50, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
