import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { createArea, deleteArea, listAreas, updateArea, updateAreaStatus } from '../../store/areas/areasActions';
import { getMyTeams } from '../../store/teams/teamsActions';

const PAD = globalWidth('1.2%');
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const isManagerRole = (role) => ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());
const makeEmptyForm = () => ({ areaName: '', areaCode: '', teamId: '', managerId: '', userIds: [], description: '', status: 'active', isActive: true });
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-');
const pickId = (item) => item?._id || item?.id || '';
const pickTeamLabel = (team) => team?.teamName || team?.name || '';
const pickUserLabel = (user) => user?.fullName || user?.name || user?.email || '';

function SimpleDropdown({ label, value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <View style={styles.selectWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable style={styles.selectButton} onPress={() => setOpen((v) => !v)}>
        <Text style={[styles.selectText, !selected && styles.selectPlaceholder]} numberOfLines={1}>{selected?.label || placeholder}</Text>
        <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={15} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.selectMenu}>
          <Pressable style={styles.selectOption} onPress={() => { onChange(''); setOpen(false); }}>
            <Text style={styles.selectOptionText}>{placeholder}</Text>
          </Pressable>
          {options.map((option) => (
            <Pressable key={String(option.value)} style={styles.selectOption} onPress={() => { onChange(option.value); setOpen(false); }}>
              <Text style={[styles.selectOptionText, String(option.value) === String(value) && styles.selectOptionActive]} numberOfLines={1}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* Searchable multi-select dropdown for medical reps */
function RepDropdown({ label, values, options, onToggle, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = new Set((values || []).map(String));
  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;
  const selectedLabels = options.filter((o) => selected.has(String(o.value))).map((o) => o.label).join(', ');

  return (
    <View style={[styles.selectWrap, { zIndex: open ? 50 : 1 }]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        style={[styles.selectButton, disabled && { opacity: 0.5 }]}
        onPress={() => { if (!disabled) { setOpen((v) => !v); setSearch(''); } }}
      >
        <Text style={[styles.selectText, !selected.size && styles.selectPlaceholder]} numberOfLines={1}>
          {disabled ? 'Select a team first' : selected.size ? selectedLabels : options.length ? 'Select medical reps' : 'No reps in this team'}
        </Text>
        <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={15} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={[styles.selectMenu, { position: 'absolute', top: label ? 60 : 44, left: 0, right: 0, zIndex: 100, maxHeight: 260 }]}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={13} color={colors.textMuted} />
            <TextInput
              style={styles.searchInDrop}
              value={search}
              onChangeText={setSearch}
              placeholder="Search reps..."
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
          </View>
          <ScrollView style={{ maxHeight: 210 }} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <View style={styles.selectOption}>
                <Text style={[styles.selectOptionText, { color: colors.textMuted }]}>No medical reps found</Text>
              </View>
            ) : (
              filtered.map((option) => {
                const active = selected.has(String(option.value));
                return (
                  <Pressable key={String(option.value)} style={[styles.selectOption, styles.repOption]} onPress={() => onToggle(option.value)}>
                    <View style={[styles.repCheck, active && styles.repCheckActive]}>
                      {active && <Ionicons name="checkmark" size={10} color={colors.white} />}
                    </View>
                    <Text style={[styles.selectOptionText, active && styles.selectOptionActive]} numberOfLines={1}>{option.label}</Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Badge({ value }) {
  const active = String(value || 'active') === 'active' || value === true;
  return (
    <View style={[styles.badge, { backgroundColor: active ? '#DCFCE7' : '#F1F5F9' }]}>
      <Text style={[styles.badgeText, { color: active ? '#15803D' : '#64748B' }]}>{active ? 'Active' : 'Inactive'}</Text>
    </View>
  );
}

export default function SalesAreasScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const manager = isManagerRole(user.role);

  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(makeEmptyForm());
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState([]);

  const fetchAreas = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await listAreas(token, { search, status });
      setAreas(res.areas);
    } catch (e) {
      setError(e.message || 'Failed to load areas');
    } finally {
      setLoading(false);
    }
  }, [token, search, status]);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  /* Load Medical Rep Teams — members and managerId are already embedded in each team object */
  useEffect(() => {
    let alive = true;
    getMyTeams(token)
      .then((data) => { if (alive) setTeams(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [token]);

  /* Teams dropdown */
  const teamOptions = teams
    .map((t) => ({ value: pickId(t), label: pickTeamLabel(t) }))
    .filter((o) => o.value);

  /* Medical reps: members embedded in the selected team, filtered by role === 'representative' */
  const selectedTeam = teams.find((t) => pickId(t) === form.teamId);
  const repOptions = (selectedTeam?.members || [])
    .filter((m) => String(m.role || '').toLowerCase() === 'representative')
    .map((m) => ({ value: m._id, label: `${m.fullName || m.email || '—'}${m.email ? ` — ${m.email}` : ''}` }))
    .filter((o) => o.value);

  /* Managers: deduplicated from the populated managerId objects embedded in each team */
  const managerOptions = Object.values(
    teams.reduce((acc, t) => {
      const m = t.managerId;
      if (m && m._id) acc[m._id] = { value: m._id, label: m.fullName || m.email || '—' };
      return acc;
    }, {})
  );

  const openForm = (area = null) => {
    setEditing(area);
    setForm(area ? {
      areaName: area.areaName || area.name || '',
      areaCode: area.areaCode || area.code || '',
      teamId: area.teamId?._id || area.teamId || '',
      managerId: area.managerId?._id || area.managerId || '',
      userIds: Array.isArray(area.userIds) ? area.userIds.map((u) => pickId(u) || u).filter(Boolean) : [],
      description: area.description || '',
      status: area.status || (area.isActive === false ? 'inactive' : 'active'),
      isActive: area.isActive !== false,
    } : makeEmptyForm());
    setShowForm(true);
  };

  const toggleUser = (userId) => {
    setForm((prev) => {
      const ids = new Set((prev.userIds || []).map(String));
      if (ids.has(String(userId))) ids.delete(String(userId));
      else ids.add(String(userId));
      return { ...prev, userIds: Array.from(ids) };
    });
  };

  const saveArea = async () => {
    if (!form.areaName.trim()) { alert('Area name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        areaName: form.areaName.trim(),
        areaCode: form.areaCode.trim() || undefined,
        teamId: form.teamId || undefined,
        managerId: form.managerId || undefined,
        userIds: Array.isArray(form.userIds) ? form.userIds : [],
        description: form.description.trim() || undefined,
        status: form.status,
        isActive: form.status === 'active',
      };
      if (editing) await updateArea(token, editing._id || editing.id, payload);
      else await createArea(token, payload);
      setShowForm(false);
      await fetchAreas();
    } catch (e) {
      alert(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (area) => {
    const id = area._id || area.id;
    const next = (area.status || 'active') === 'active' ? 'inactive' : 'active';
    await updateAreaStatus(token, id, { status: next, isActive: next === 'active' });
    fetchAreas();
  };

  const removeArea = async (area) => {
    if (!window.confirm('Delete this area?')) return;
    await deleteArea(token, area._id || area.id);
    fetchAreas();
  };

  if (!manager) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesOverview">
        <View style={styles.centered}><Text style={styles.errorText}>Areas management is manager/admin only.</Text></View>
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesAreas" scrollable={false}>
      <View style={styles.container}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Areas</Text>
            <Text style={styles.pageSubtitle}>Manage sales areas used for shared sales rules</Text>
          </View>
          <Pressable style={styles.btnPrimary} onPress={() => openForm()}>
            <Ionicons name="add-outline" size={14} color="#fff" />
            <Text style={styles.btnPrimaryText}>Add Area</Text>
          </Pressable>
        </View>

        <View style={styles.toolbar}>
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search areas..." placeholderTextColor={colors.textMuted} />
          <Pressable style={styles.filterBtn} onPress={() => setStatus(status === 'active' ? 'inactive' : status === 'inactive' ? '' : 'active')}>
            <Text style={styles.filterText}>{status || 'All Status'}</Text>
          </Pressable>
          <Pressable style={styles.btnApply} onPress={fetchAreas}><Text style={styles.btnApplyText}>Apply</Text></Pressable>
        </View>

        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editing ? 'Edit Area' : 'Add Area'}</Text>

            {/* Name + Code */}
            <View style={styles.formRow}>
              <TextInput style={styles.input} value={form.areaName} onChangeText={(v) => setForm((p) => ({ ...p, areaName: v }))} placeholder="Area name *" placeholderTextColor={colors.textMuted} />
              <TextInput style={styles.input} value={form.areaCode} onChangeText={(v) => setForm((p) => ({ ...p, areaCode: v }))} placeholder="Area code" placeholderTextColor={colors.textMuted} />
            </View>

            {/* Medical Rep Team + Manager */}
            <View style={[styles.formRow, { zIndex: 20 }]}>
              <SimpleDropdown
                label="Medical Rep Team"
                value={form.teamId}
                options={teamOptions}
                placeholder={teamOptions.length ? 'Select Medical Rep Team' : 'Loading teams...'}
                onChange={(v) => setForm((p) => ({ ...p, teamId: v, userIds: [] }))}
              />
              <SimpleDropdown
                label="Manager"
                value={form.managerId}
                options={managerOptions}
                placeholder={managerOptions.length ? 'Select manager' : 'Loading managers...'}
                onChange={(v) => setForm((p) => ({ ...p, managerId: v }))}
              />
            </View>

            {/* Medical Reps multi-select dropdown */}
            <View style={{ zIndex: 10 }}>
              <RepDropdown
                label="Medical Reps"
                values={form.userIds}
                options={repOptions}
                onToggle={toggleUser}
                disabled={!form.teamId}
              />
            </View>

            <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Description" placeholderTextColor={colors.textMuted} />

            <View style={styles.formActions}>
              <Pressable style={styles.btnSecondary} onPress={() => setShowForm(false)}><Text style={styles.btnSecondaryText}>Cancel</Text></Pressable>
              <Pressable style={styles.btnPrimary} onPress={saveArea} disabled={saving}>
                {saving ? <ActivityIndicator size={13} color="#fff" /> : null}
                <Text style={styles.btnPrimaryText}>Save Area</Text>
              </Pressable>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>
        ) : (
          <ScrollView style={{ flex: 1 }}>
            <View style={styles.tblHead}>
              {['Area Name', 'Area Code', 'Medical Rep Team', 'Manager', 'Reps', 'Status', 'Created At', 'Actions'].map((h) => (
                <Text key={h} style={styles.tblTh}>{h}</Text>
              ))}
            </View>
            {areas.map((a) => (
              <View key={a._id || a.id} style={styles.tblRow}>
                <Text style={styles.tblTd} numberOfLines={1}>{a.areaName || a.name || '-'}</Text>
                <Text style={styles.tblTd}>{a.areaCode || a.code || '-'}</Text>
                <Text style={styles.tblTd} numberOfLines={1}>{a.teamId?.teamName || a.teamId?.name || a.teamName || '-'}</Text>
                <Text style={styles.tblTd} numberOfLines={1}>{a.managerId?.fullName || a.managerId?.name || a.managerName || '-'}</Text>
                <Text style={styles.tblTd}>{Array.isArray(a.userIds) ? a.userIds.length : 0}</Text>
                <View style={styles.tblTd}><Badge value={a.status || a.isActive} /></View>
                <Text style={styles.tblTd}>{fmtDate(a.createdAt)}</Text>
                <View style={[styles.tblTd, styles.actions]}>
                  <Pressable onPress={() => openForm(a)}><Ionicons name="create-outline" size={15} color={colors.primary} /></Pressable>
                  <Pressable onPress={() => toggleStatus(a)}><Ionicons name="swap-horizontal-outline" size={15} color={colors.textSecondary} /></Pressable>
                  <Pressable onPress={() => removeArea(a)}><Ionicons name="trash-outline" size={15} color={colors.danger} /></Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: PAD, gap: 12, minHeight: 0 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  toolbar: { flexDirection: 'row', gap: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, ...shadow },
  searchInput: { flex: 1, minWidth: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, color: colors.textPrimary },
  filterBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' },
  filterText: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
  formCard: { gap: 10, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, ...shadow },
  formTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  formRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: colors.textPrimary },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, marginBottom: 5, textTransform: 'uppercase' },
  selectWrap: { flex: 1, minWidth: 220 },
  selectButton: { minHeight: 39, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.surface },
  selectText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  selectPlaceholder: { color: colors.textMuted, fontWeight: '500' },
  selectMenu: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, overflow: 'hidden', ...shadow },
  selectOption: { paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  selectOptionText: { fontSize: 13, color: colors.textSecondary },
  selectOptionActive: { color: colors.primary, fontWeight: '800' },
  repOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repCheck: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  repCheckActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInDrop: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnSecondary: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnSecondaryText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  btnApply: { backgroundColor: colors.primary, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  btnApplyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tblHead: { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6 },
  tblTh: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.primary },
  tblRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tblTd: { flex: 1, fontSize: 12, color: colors.textPrimary, paddingRight: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errorText: { color: colors.danger, fontSize: 14 },
});
