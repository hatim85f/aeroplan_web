import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import {
  createAccountAssignments,
  deleteAccountAssignment,
  listAccountAssignments,
  listCoverageReps,
  updateAccountAssignment,
} from '../../store/accountAssignments/accountAssignmentActions';
import { getTeamForecasts } from '../../store/forecasts/forecastActions';
import { getForecastUserId, getForecastUserName, getTeamForecastList } from '../forecasts/forecastUtils';

// Rep Coverage is for admin/manager only — senior managers are excluded.
const isManager = (role) =>
  ['admin', 'manager'].includes(String(role).toLowerCase());

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const fmtDate = (value) => (value ? String(value).slice(0, 10) : 'Ongoing');
const today = () => new Date().toISOString().slice(0, 10);

const getAccountName = (account = {}) => account.accountName || account.name || 'Account';
const getAccountArea = (account = {}) => String(account.area || account.territory || '').trim();
const getId = (item = {}) => String(item._id || item.id || '');

export default function RepCoverageScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManager(user.role || '');

  const [assignments, setAssignments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Form state */
  const [selectedAccountIds, setSelectedAccountIds] = useState([]); // [accountId]
  const [selectedReps, setSelectedReps] = useState([]); // [userId]
  const [accountSearch, setAccountSearch] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [districtFilters, setDistrictFilters] = useState([]); // multi-select (lowercase keys)
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  /* List filters */
  const [repFilter, setRepFilter] = useState('');

  const accountsById = useMemo(() => new Map(accounts.map((account) => [getId(account), account])), [accounts]);

  const fetchAssignments = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const data = await listAccountAssignments(token, repFilter ? { userId: repFilter } : {});
      setAssignments(data);
    } catch (err) {
      setError(err.message || 'Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  }, [repFilter, token]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

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

    const loadReps = async () => {
      try {
        const list = await listCoverageReps(token);
        if (list.length) {
          setReps(list.map((rep) => ({
            value: String(rep._id),
            label: rep.fullName || rep.userName || rep.email || 'Representative',
            inactive: rep.isActive === false || (rep.status && String(rep.status).toLowerCase() !== 'active'),
          })));
          return;
        }
        throw new Error('empty');
      } catch {
        // Fallback (e.g. backend not redeployed yet): active reps from team forecasts.
        try {
          const now = new Date();
          const result = await getTeamForecasts(token, { year: now.getFullYear(), month: now.getMonth() + 1 });
          const list = getTeamForecastList(result);
          setReps(list.map((entry) => ({
            value: String(getForecastUserId(entry)),
            label: getForecastUserName(entry),
            inactive: false,
          })).filter((option) => option.value));
        } catch {
          setReps([]);
        }
      }
    };

    loadReps();
  }, [token]);

  /* Districts derived from account.area — deduped case-insensitively */
  const districts = useMemo(() => {
    const byKey = new Map();
    accounts.forEach((account) => {
      const area = getAccountArea(account);
      if (!area) return;
      const key = area.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, area);
    });
    return [...byKey.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
  }, [accounts]);

  const toggleDistrict = (key) => {
    setDistrictFilters((current) => (
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    ));
  };

  /* Accounts matching selected districts + search (full list, not yet selected) */
  const matchingAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    const selected = new Set(selectedAccountIds);
    const districtSet = new Set(districtFilters);
    return accounts
      .filter((account) => !selected.has(getId(account)))
      .filter((account) => !districtSet.size || districtSet.has(getAccountArea(account).toLowerCase()))
      .filter((account) => !query || getAccountName(account).toLowerCase().includes(query));
  }, [accountSearch, accounts, districtFilters, selectedAccountIds]);

  const toggleRep = (value) => {
    setSelectedReps((current) => (
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
    ));
  };

  const selectAllMatching = () => {
    setSelectedAccountIds((current) => [...current, ...matchingAccounts.map(getId)]);
  };

  const handleCreate = async () => {
    setFormError('');
    if (!selectedAccountIds.length) { setFormError('Select at least one account.'); return; }
    if (!selectedReps.length) { setFormError('Select at least one medical rep.'); return; }
    if (!startDate.trim()) { setFormError('Start date is required (YYYY-MM-DD).'); return; }

    try {
      setSaving(true);
      await createAccountAssignments(token, {
        accountIds: selectedAccountIds,
        userIds: selectedReps,
        startDate: startDate.trim(),
        endDate: endDate.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSelectedAccountIds([]);
      setSelectedReps([]);
      setEndDate('');
      setNotes('');
      await fetchAssignments();
    } catch (err) {
      setFormError(err.message || 'Failed to create assignments.');
    } finally {
      setSaving(false);
    }
  };

  const endNow = async (assignment) => {
    if (!window.confirm(`End ${assignment.userName}'s coverage of ${assignment.accountName} today?`)) return;
    try {
      await updateAccountAssignment(token, getId(assignment), { endDate: today() });
      await fetchAssignments();
    } catch (err) {
      window.alert(err.message || 'Failed to update assignment.');
    }
  };

  const removeAssignment = async (assignment) => {
    if (!window.confirm(`Remove ${assignment.userName}'s coverage of ${assignment.accountName}? Attribution will fall back to other rules.`)) return;
    try {
      await deleteAccountAssignment(token, getId(assignment));
      await fetchAssignments();
    } catch (err) {
      window.alert(err.message || 'Failed to remove assignment.');
    }
  };

  if (!manager) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="RepCoverage">
        <View style={styles.centered}><Text style={styles.errorText}>Only managers can manage rep coverage.</Text></View>
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="RepCoverage">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Rep Coverage</Text>
            <Text style={styles.pageSubtitle}>Who is responsible for which accounts, and when — drives sales attribution in Achievement</Text>
          </View>
        </View>

        {/* ── New assignment form ── */}
        <View style={[styles.card, { zIndex: 30 }]}>
          <Text style={styles.cardTitle}>New Coverage Assignment</Text>

          {/* Step 1 — pick accounts */}
          <Text style={styles.fieldLabel}>1 · Accounts</Text>

          {/* District filter + search + bulk actions */}
          <View style={styles.pickerBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ flex: 1 }}>
              <Pressable style={[styles.chip, !districtFilters.length && styles.chipActive]} onPress={() => setDistrictFilters([])}>
                <Text style={[styles.chipText, !districtFilters.length && styles.chipTextActive]}>All Districts</Text>
              </Pressable>
              {districts.map((district) => {
                const selected = districtFilters.includes(district.key);
                return (
                  <Pressable key={district.key} style={[styles.chip, selected && styles.chipActive]} onPress={() => toggleDistrict(district.key)}>
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{district.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.pickerBar}>
            <View style={[styles.input, { flex: 1 }]}>
              <Ionicons name="search-outline" size={13} color={colors.textMuted} />
              <TextInput
                value={accountSearch}
                onChangeText={(t) => { setAccountSearch(t); setAccountOpen(true); }}
                onFocus={() => setAccountOpen(true)}
                placeholder={`Search accounts${districtFilters.length ? ` in ${districtFilters.length} district${districtFilters.length === 1 ? '' : 's'}` : ''}…`}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>
            <Pressable
              style={[styles.btnOutlineSm, !matchingAccounts.length && { opacity: 0.5 }]}
              disabled={!matchingAccounts.length}
              onPress={selectAllMatching}
            >
              <Ionicons name="checkmark-done-outline" size={13} color={colors.primary} />
              <Text style={[styles.btnOutlineSmText, { color: colors.primary }]}>
                Select all ({matchingAccounts.length})
              </Text>
            </Pressable>
            <Pressable style={styles.btnOutlineSm} onPress={() => setAccountOpen((v) => !v)}>
              <Ionicons name={accountOpen ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
              <Text style={styles.btnOutlineSmText}>{accountOpen ? 'Hide list' : 'Browse'}</Text>
            </Pressable>
          </View>

          {/* Browsable list */}
          {accountOpen ? (
            <View style={styles.accountList}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {matchingAccounts.slice(0, 100).map((account) => (
                  <Pressable
                    key={getId(account)}
                    style={styles.accountOpt}
                    onPress={() => setSelectedAccountIds((cur) => [...cur, getId(account)])}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                    <Text style={styles.accountOptText} numberOfLines={1}>{getAccountName(account)}</Text>
                    {getAccountArea(account) ? <Text style={styles.accountOptArea}>{getAccountArea(account)}</Text> : null}
                  </Pressable>
                ))}
                {!matchingAccounts.length ? <Text style={styles.emptyText}>No accounts match.</Text> : null}
                {matchingAccounts.length > 100 ? (
                  <Text style={styles.emptyText}>+{matchingAccounts.length - 100} more — refine the search or use Select all.</Text>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          {/* Compact selection summary */}
          {selectedAccountIds.length ? (
            <View style={styles.selectionBox}>
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionTitle}>
                  {selectedAccountIds.length} account{selectedAccountIds.length === 1 ? '' : 's'} selected
                </Text>
                <Pressable onPress={() => setSelectedAccountIds([])}>
                  <Text style={styles.selectionClear}>Clear all</Text>
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 92 }} nestedScrollEnabled>
                <View style={styles.miniChipWrap}>
                  {selectedAccountIds.map((accountId) => (
                    <Pressable
                      key={accountId}
                      style={styles.miniChip}
                      onPress={() => setSelectedAccountIds((cur) => cur.filter((id) => id !== accountId))}
                    >
                      <Text style={styles.miniChipText} numberOfLines={1}>
                        {getAccountName(accountsById.get(accountId) || {})}
                      </Text>
                      <Ionicons name="close" size={10} color={colors.textSecondary} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {/* Step 2 — reps */}
          <Text style={styles.fieldLabel}>2 · Medical Reps</Text>
          <View style={styles.chipRow}>
            {reps.map((rep) => {
              const selected = selectedReps.includes(rep.value);
              return (
                <Pressable
                  key={rep.value}
                  style={[styles.chip, rep.inactive && styles.chipInactive, selected && styles.chipActive]}
                  onPress={() => toggleRep(rep.value)}
                >
                  <Text style={[styles.chipText, rep.inactive && styles.chipInactiveText, selected && styles.chipTextActive]}>
                    {rep.label}{rep.inactive ? ' (inactive)' : ''}
                  </Text>
                </Pressable>
              );
            })}
            {!reps.length ? <Text style={styles.emptyText}>No medical reps found.</Text> : null}
          </View>

          {/* Step 3 — period + notes */}
          <Text style={styles.fieldLabel}>3 · Period</Text>
          <View style={styles.formRow}>
            <View style={styles.field}>
              <Text style={styles.fieldHint}>Start Date</Text>
              <TextInput style={styles.dateInput} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldHint}>End Date (empty = ongoing)</Text>
              <TextInput style={styles.dateInput} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.fieldHint}>Notes</Text>
              <TextInput style={styles.dateInput} value={notes} onChangeText={setNotes} placeholder="e.g. Al Ain district Jan–Mar" placeholderTextColor={colors.textMuted} />
            </View>
            <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="add" size={14} color="#fff" />}
              <Text style={styles.btnPrimaryText}>Create</Text>
            </Pressable>
          </View>
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        </View>

        {/* ── Assignments table ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Coverage Assignments</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Pressable style={[styles.chip, !repFilter && styles.chipActive]} onPress={() => setRepFilter('')}>
                <Text style={[styles.chipText, !repFilter && styles.chipTextActive]}>All Reps</Text>
              </Pressable>
              {reps.map((rep) => {
                const selected = repFilter === rep.value;
                return (
                  <Pressable key={rep.value} style={[styles.chip, selected && styles.chipActive]} onPress={() => setRepFilter(selected ? '' : rep.value)}>
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{rep.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.btnOutline} onPress={fetchAssignments}>
                <Text style={styles.btnOutlineText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.tblHead}>
                <Text style={[styles.tblTh, { flex: 2 }]}>ACCOUNT</Text>
                <Text style={[styles.tblTh, { flex: 1.4 }]}>REP</Text>
                <Text style={[styles.tblTh, { flex: 0.9 }]}>FROM</Text>
                <Text style={[styles.tblTh, { flex: 0.9 }]}>TO</Text>
                <Text style={[styles.tblTh, { flex: 1.6 }]}>NOTES</Text>
                <Text style={[styles.tblTh, { width: 80 }]}>ACTIONS</Text>
              </View>
              {!assignments.length ? (
                <Text style={styles.emptyText}>No coverage assignments yet. Achievement falls back to the accounts&apos; static rep assignments.</Text>
              ) : assignments.map((assignment, index) => (
                <View key={getId(assignment)} style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}>
                  <Text style={[styles.tblTdStrong, { flex: 2 }]} numberOfLines={1}>{assignment.accountName || '—'}</Text>
                  <Text style={[styles.tblTd, { flex: 1.4 }]} numberOfLines={1}>{assignment.userName || '—'}</Text>
                  <Text style={[styles.tblTd, { flex: 0.9 }]}>{fmtDate(assignment.startDate)}</Text>
                  <Text style={[styles.tblTd, { flex: 0.9 }]}>{fmtDate(assignment.endDate)}</Text>
                  <Text style={[styles.tblTd, { flex: 1.6 }]} numberOfLines={1}>{assignment.notes || '—'}</Text>
                  <View style={[styles.tblTd, { width: 80, flexDirection: 'row', gap: 2 }]}>
                    {!assignment.endDate ? (
                      <Pressable style={styles.actionBtn} onPress={() => endNow(assignment)}>
                        <Ionicons name="stop-circle-outline" size={15} color="#B45309" />
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.actionBtn} onPress={() => removeAssignment(assignment)}>
                      <Ionicons name="trash-outline" size={15} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },

  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 12, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  fieldLabel: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  field: { flex: 1, minWidth: 150, gap: 5 },
  formError: { fontSize: 12, color: colors.danger, fontWeight: '600' },

  pickerBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, backgroundColor: colors.backgroundColor, minHeight: 38,
  },
  searchInput: { flex: 1, fontSize: 12, color: colors.textPrimary, paddingVertical: 9 },
  dateInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9, backgroundColor: colors.backgroundColor,
    fontSize: 12, color: colors.textPrimary, minHeight: 38,
  },

  accountList: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  accountOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: colors.border + '60',
  },
  accountOptText: { flex: 1, fontSize: 12.5, color: colors.textPrimary },
  accountOptArea: { fontSize: 10, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },

  selectionBox: {
    backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 10, gap: 8,
  },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
  selectionClear: { fontSize: 12, fontWeight: '700', color: colors.danger },
  miniChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 220,
  },
  miniChipText: { fontSize: 11, color: colors.textPrimary, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.backgroundColor,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipInactive: { borderStyle: 'dashed' },
  chipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  chipInactiveText: { color: colors.textMuted },
  chipTextActive: { color: '#fff' },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnOutlineSm: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineSmText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },

  tblHead: {
    flexDirection: 'row', backgroundColor: colors.primary + '0C',
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6, gap: 14, alignItems: 'center',
  },
  tblTh: { fontSize: 10, fontWeight: '800', color: colors.primary },
  tblRow: {
    flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 12, gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  tblRowAlt: { backgroundColor: colors.backgroundColor + '70' },
  tblTd: { fontSize: 12, color: colors.textPrimary },
  tblTdStrong: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
  actionBtn: { padding: 5, borderRadius: 5 },

  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  centered: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
