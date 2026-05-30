import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch,
  Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import {
  createSalesTeamMember,
  updateSalesTeamMember,
  getSalesTeamMemberById,
  listSalesTeamMembers,
} from '../../store/salesTeam/salesTeamActions';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function getInitials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}
function isValidEmail(e) { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ─── Section card ───────────────────────────────────────────────────────── */
function Section({ num, title, icon, open, onToggle, children }) {
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <View style={styles.sectionNum}>
          <Text style={styles.sectionNumText}>{num}</Text>
        </View>
        <Ionicons name={icon} size={16} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

/* ─── Field wrapper ──────────────────────────────────────────────────────── */
function Field({ label, required, error, hint, children, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={{ color: colors.danger }}> *</Text>}
      </Text>
      {children}
      {hint  && <Text style={styles.fieldHint}>{hint}</Text>}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

/* ─── Searchable single-select dropdown ─────────────────────────────────── */
function SearchDropdown({ value, token, fetcher, onSelect, placeholder, getLabel, getKey, getSub, disabled }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!search || search.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    fetcher(search)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, open]);

  const displayLabel = value ? getLabel(value) : '';

  return (
    <View>
      <Pressable
        style={[styles.dropTrigger, disabled && { opacity: 0.5 }]}
        onPress={() => { if (!disabled) { setOpen((o) => !o); setSearch(''); setResults([]); } }}
      >
        <Text style={[styles.dropTriggerText, !displayLabel && styles.dropPlaceholder]}>
          {displayLabel || placeholder}
        </Text>
        {value ? (
          <Pressable onPress={() => { onSelect(null); setOpen(false); }} hitSlop={8}>
            <Ionicons name="close-circle" size={15} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
        )}
      </Pressable>
      {open && (
        <View style={styles.dropPanel}>
          <View style={styles.dropSearch}>
            <Ionicons name="search" size={12} color={colors.textSecondary} />
            <TextInput
              style={styles.dropSearchInput}
              placeholder="Type at least 2 characters..."
              placeholderTextColor={colors.textMuted}
              value={search} onChangeText={setSearch} autoFocus
            />
            {loading && <ActivityIndicator size={11} color={colors.primary} />}
            <Pressable onPress={() => setOpen(false)}>
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
            {search.length < 2 ? (
              <View style={styles.dropHint}><Text style={styles.dropHintText}>Type at least 2 characters</Text></View>
            ) : loading ? (
              <View style={styles.dropHint}><Text style={styles.dropHintText}>Searching...</Text></View>
            ) : results.length === 0 ? (
              <View style={styles.dropHint}><Text style={styles.dropHintText}>No results found</Text></View>
            ) : results.map((item) => {
              const key  = getKey(item);
              const label = getLabel(item);
              const sub   = getSub ? getSub(item) : null;
              const sel   = getKey(value) === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.dropItem, sel && styles.dropItemSelected]}
                  onPress={() => { onSelect(item); setOpen(false); setSearch(''); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropItemText, sel && { color: colors.primary }]}>{label}</Text>
                    {sub ? <Text style={styles.dropItemSub}>{sub}</Text> : null}
                  </View>
                  {sel && <Ionicons name="checkmark" size={13} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ─── Multi-select searchable dropdown ──────────────────────────────────── */
function MultiSelectDropdown({ values, token, fetcher, onToggle, placeholder, getLabel, getKey, getSub }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!search || search.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    fetcher(search)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, open]);

  const selectedKeys = new Set(values.map(getKey));

  return (
    <View>
      {/* Pills of selected */}
      {values.length > 0 && (
        <View style={styles.pillsRow}>
          {values.map((item) => {
            const key   = getKey(item);
            const label = getLabel(item);
            return (
              <View key={key} style={styles.pill}>
                <Text style={styles.pillText}>{label}</Text>
                <Pressable onPress={() => onToggle(item)} hitSlop={6}>
                  <Ionicons name="close" size={12} color={colors.primary} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* Trigger */}
      <Pressable style={styles.dropTrigger} onPress={() => { setOpen((o) => !o); setSearch(''); setResults([]); }}>
        <Text style={styles.dropPlaceholder}>
          {values.length === 0 ? placeholder : `${values.length} selected — click to add more`}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
      </Pressable>

      {/* Panel */}
      {open && (
        <View style={styles.dropPanel}>
          <View style={styles.dropSearch}>
            <Ionicons name="search" size={12} color={colors.textSecondary} />
            <TextInput
              style={styles.dropSearchInput}
              placeholder="Type at least 2 characters..."
              placeholderTextColor={colors.textMuted}
              value={search} onChangeText={setSearch} autoFocus
            />
            {loading && <ActivityIndicator size={11} color={colors.primary} />}
            <Pressable onPress={() => setOpen(false)}>
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
            {search.length < 2 ? (
              <View style={styles.dropHint}><Text style={styles.dropHintText}>Type at least 2 characters</Text></View>
            ) : loading ? (
              <View style={styles.dropHint}><Text style={styles.dropHintText}>Searching...</Text></View>
            ) : results.length === 0 ? (
              <View style={styles.dropHint}><Text style={styles.dropHintText}>No results found</Text></View>
            ) : results.map((item) => {
              const key   = getKey(item);
              const label = getLabel(item);
              const sub   = getSub ? getSub(item) : null;
              const sel   = selectedKeys.has(key);
              return (
                <Pressable
                  key={key}
                  style={[styles.dropItem, sel && styles.dropItemSelected]}
                  onPress={() => onToggle(item)}
                >
                  <View style={styles.checkIcon}>
                    {sel
                      ? <Ionicons name="checkbox" size={16} color={colors.primary} />
                      : <Ionicons name="square-outline" size={16} color={colors.textMuted} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropItemText, sel && { color: colors.primary }]}>{label}</Text>
                    {sub ? <Text style={styles.dropItemSub}>{sub}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function SalesTeamFormScreen({
  navigation, route, userDetails, appMetadata, onSignOut,
}) {
  const mode     = route?.params?.mode || 'create';
  const memberId = route?.params?.memberId || null;
  const isEdit   = mode === 'edit' && !!memberId;

  const user  = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';

  /* ── Sections open state ── */
  const [openSections, setOpenSections] = useState({ basic: true, accounts: false, hierarchy: false, status: false });
  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  /* ── Form state ── */
  const [form, setForm] = useState({
    fullName:  '',
    phone:     '',
    email:     '',
    position:  '',
    notes:     '',
    isActive:  true,
  });
  const [selectedAccounts,  setSelectedAccounts]  = useState([]); // array of account objects
  const [selectedManager,   setSelectedManager]   = useState(null); // single member object
  const [selectedTeamManaged, setSelectedTeamManaged] = useState([]); // array of member objects

  /* ── Load / save state ── */
  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [loadError,   setLoadError]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [errors,      setErrors]      = useState({});

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  /* ── Prefill for edit ── */
  useEffect(() => {
    if (!isEdit) return;
    setLoadingInit(true);
    getSalesTeamMemberById(token, memberId)
      .then((data) => {
        setForm({
          fullName:  data.fullName || data.name || '',
          phone:     data.phone || data.phoneNumber || '',
          email:     data.email || '',
          position:  data.position || '',
          notes:     data.notes || '',
          isActive:  data.isActive !== false,
        });
        // Prefill selected accounts as minimal objects
        const accts = (data.accountIds || data.assignedAccounts || []).map((a) =>
          typeof a === 'string'
            ? { _id: a, accountName: a }
            : { _id: a._id || a.id, accountName: a.accountName || a.name || '' }
        );
        setSelectedAccounts(accts);
        // Prefill manager
        if (data.managerId) {
          const mgr = typeof data.managerId === 'string'
            ? { _id: data.managerId, fullName: data.managerId }
            : { _id: data.managerId._id || data.managerId.id, fullName: data.managerId.fullName || data.managerId.name || '' };
          setSelectedManager(mgr);
        }
        // Prefill team managed
        const tm = (data.teamManaged || []).map((m) =>
          typeof m === 'string'
            ? { _id: m, fullName: m }
            : { _id: m._id || m.id, fullName: m.fullName || m.name || '' }
        );
        setSelectedTeamManaged(tm);
      })
      .catch((e) => setLoadError(e.message || 'Failed to load member'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, memberId, token]);

  /* ── Fetchers for dropdowns ── */
  const fetchAccounts = useCallback(async (q) => {
    const res = await getAccounts(token, { search: q, page: 1, limit: 15 });
    return res.accounts || [];
  }, [token]);

  const fetchMembers = useCallback(async (q) => {
    const res = await listSalesTeamMembers(token, { search: q, page: 1, limit: 15 });
    return (res.data || []).filter((m) => (m._id || m.id) !== memberId); // exclude self in edit
  }, [token, memberId]);

  /* ── Toggle helpers ── */
  const toggleAccount = (acct) => {
    const key = acct._id || acct.id;
    setSelectedAccounts((prev) =>
      prev.some((a) => (a._id || a.id) === key)
        ? prev.filter((a) => (a._id || a.id) !== key)
        : [...prev, acct]
    );
  };

  const toggleTeamManaged = (member) => {
    const key = member._id || member.id;
    setSelectedTeamManaged((prev) =>
      prev.some((m) => (m._id || m.id) === key)
        ? prev.filter((m) => (m._id || m.id) !== key)
        : [...prev, member]
    );
  };

  /* ── Validation ── */
  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required';
    if (!isValidEmail(form.email)) errs.email = 'Invalid email address';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!validate()) {
      setOpenSections((s) => ({ ...s, basic: true }));
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        fullName:    form.fullName.trim(),
        phone:       form.phone.trim() || undefined,
        email:       form.email.trim() || undefined,
        position:    form.position.trim() || undefined,
        notes:       form.notes.trim() || undefined,
        isActive:    form.isActive,
        status:      form.isActive ? 'active' : 'inactive',
        accountIds:  selectedAccounts.map((a) => a._id || a.id),
        managerId:   selectedManager ? (selectedManager._id || selectedManager.id) : undefined,
        teamManaged: selectedTeamManaged.map((m) => m._id || m.id),
      };

      if (isEdit) {
        await updateSalesTeamMember(token, memberId, payload);
      } else {
        await createSalesTeamMember(token, payload);
      }
      navigation.navigate('SalesTeam');
    } catch (e) {
      setSaveError(e.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ── */
  if (loadingInit) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Sales Team">
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Sales Team">
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable style={styles.retryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Sales Team"
    >
      {/* ── Breadcrumb ── */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('SalesTeam')}>
          <Text style={styles.breadcrumbLink}>Sales Team</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{isEdit ? 'Edit Salesperson' : 'Add Salesperson'}</Text>
      </View>

      <Text style={styles.pageTitle}>{isEdit ? 'Edit Salesperson' : 'Add Salesperson'}</Text>
      <Text style={styles.pageSubtitle}>
        {isEdit ? 'Update the salesperson details below.' : 'Fill in the details to add a new salesperson to your team.'}
      </Text>

      {/* ── Sections ── */}
      <View style={styles.formCard}>

        {/* ① Basic Info */}
        <Section num={1} title="Basic Info" icon="person-outline" open={openSections.basic} onToggle={() => toggleSection('basic')}>
          <View style={styles.twoCol}>
            <Field label="Full Name" required error={errors.fullName} style={styles.colHalf}>
              <TextInput
                style={[styles.input, errors.fullName && styles.inputError]}
                value={form.fullName}
                onChangeText={set('fullName')}
                placeholder="e.g. Jessica Martinez"
                placeholderTextColor={colors.textMuted}
              />
            </Field>
            <Field label="Position" style={styles.colHalf}>
              <TextInput
                style={styles.input}
                value={form.position}
                onChangeText={set('position')}
                placeholder="e.g. Senior Medical Representative"
                placeholderTextColor={colors.textMuted}
              />
            </Field>
          </View>
          <View style={styles.twoCol}>
            <Field label="Phone Number" style={styles.colHalf}>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={set('phone')}
                placeholder="+1 (617) 555-0122"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </Field>
            <Field label="Email" error={errors.email} style={styles.colHalf}>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={form.email}
                onChangeText={set('email')}
                placeholder="jessica.martinez@medicare.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
          </View>
        </Section>

        <View style={styles.sectionDivider} />

        {/* ② Account Assignment */}
        <Section num={2} title="Account Assignment" icon="business-outline" open={openSections.accounts} onToggle={() => toggleSection('accounts')}>
          <Field
            label="Assign Accounts"
            hint="Search and select accounts this salesperson is responsible for."
          >
            <MultiSelectDropdown
              values={selectedAccounts}
              token={token}
              fetcher={fetchAccounts}
              onToggle={toggleAccount}
              placeholder="Search accounts by name, city..."
              getLabel={(a) => a.accountName || a.name || '—'}
              getKey={(a) => a._id || a.id || ''}
              getSub={(a) => [a.accountType, a.area].filter(Boolean).join(' · ')}
            />
          </Field>
          {selectedAccounts.length > 0 && (
            <Text style={styles.selectionCount}>
              {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''} selected
            </Text>
          )}
        </Section>

        <View style={styles.sectionDivider} />

        {/* ③ Hierarchy */}
        <Section num={3} title="Hierarchy" icon="git-merge-outline" open={openSections.hierarchy} onToggle={() => toggleSection('hierarchy')}>
          <Field label="Manager / KAM" hint="The sales manager or KAM overseeing this salesperson.">
            <SearchDropdown
              value={selectedManager}
              token={token}
              fetcher={fetchMembers}
              onSelect={setSelectedManager}
              placeholder="Search team members by name..."
              getLabel={(m) => m.fullName || m.name || '—'}
              getKey={(m) => m?._id || m?.id || ''}
              getSub={(m) => m.position || ''}
            />
          </Field>
          <Field
            label="Team Managed"
            hint="Salespeople that this person manages (multi-select)."
          >
            <MultiSelectDropdown
              values={selectedTeamManaged}
              token={token}
              fetcher={fetchMembers}
              onToggle={toggleTeamManaged}
              placeholder="Search team members..."
              getLabel={(m) => m.fullName || m.name || '—'}
              getKey={(m) => m._id || m.id || ''}
              getSub={(m) => m.position || ''}
            />
          </Field>
        </Section>

        <View style={styles.sectionDivider} />

        {/* ④ Status & Notes */}
        <Section num={4} title="Status & Notes" icon="document-text-outline" open={openSections.status} onToggle={() => toggleSection('status')}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.fieldLabel}>Status</Text>
              <Text style={styles.fieldHint}>Toggle to activate or deactivate this salesperson.</Text>
            </View>
            <View style={styles.statusToggleRow}>
              <Text style={[styles.statusLabel, { color: form.isActive ? colors.success : colors.textMuted }]}>
                {form.isActive ? 'Active' : 'Inactive'}
              </Text>
              <Switch
                value={form.isActive}
                onValueChange={set('isActive')}
                thumbColor={colors.white}
                trackColor={{ false: colors.textMuted, true: colors.success }}
              />
            </View>
          </View>
          <Field label="Notes">
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={form.notes}
              onChangeText={set('notes')}
              placeholder="Optional internal notes about this salesperson..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Field>
        </Section>

        {/* ── Info banner ── */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={15} color="#1D4ED8" />
          <Text style={styles.infoBannerText}>
            These salespeople will support assigned accounts and can be used later for order email CC.
          </Text>
        </View>

        {/* ── Errors ── */}
        {saveError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={styles.errorBannerText}>{saveError}</Text>
          </View>
        ) : null}

        {/* ── Action row ── */}
        <View style={styles.actionRow}>
          <Pressable style={styles.btnCancel} onPress={() => navigation.navigate('SalesTeam')}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.btnPrimary, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving && <ActivityIndicator size={14} color={colors.white} />}
            <Text style={styles.btnPrimaryText}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Salesperson'}
            </Text>
          </Pressable>
        </View>
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  errorText: { color: colors.danger, fontSize: 13 },
  retryBtn:  { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  breadcrumb:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink:    { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },
  pageTitle:    { fontSize: globalWidth('1.4%'), fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: globalWidth('0.75%'), color: colors.textSecondary, marginTop: 4, marginBottom: globalHeight('1.5%') },

  formCard: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', marginBottom: globalHeight('2%'),
  },

  section:       { },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: globalWidth('1.2%'), paddingVertical: globalHeight('1.6%'),
  },
  sectionNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sectionNumText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  sectionTitle:   { flex: 1, fontSize: globalWidth('0.82%'), fontWeight: '800', color: colors.textPrimary },
  sectionBody:    { paddingHorizontal: globalWidth('1.5%'), paddingBottom: globalHeight('1.5%') },
  sectionDivider: { height: 1, backgroundColor: colors.border },

  twoCol:  { flexDirection: 'row', gap: globalWidth('1.2%') },
  colHalf: { flex: 1 },

  field:      { marginBottom: globalHeight('1.2%') },
  fieldLabel: { fontSize: globalWidth('0.72%'), fontWeight: '700', color: colors.textPrimary, marginBottom: globalHeight('0.4%') },
  fieldHint:  { fontSize: globalWidth('0.6%'), color: colors.textSecondary, marginTop: 3 },
  fieldError: { fontSize: globalWidth('0.6%'), color: colors.danger, marginTop: 3 },

  input: {
    height: globalHeight('4.4%'), borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: globalWidth('0.7%'),
    fontSize: globalWidth('0.72%'), color: colors.textPrimary,
    backgroundColor: colors.inputBackground, outlineStyle: 'none',
  },
  inputMulti: {
    height: undefined, minHeight: globalHeight('10%'),
    paddingVertical: globalHeight('0.8%'),
  },
  inputError: { borderColor: colors.danger },

  /* Dropdown */
  dropTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: globalHeight('4.4%'), borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: globalWidth('0.7%'),
    backgroundColor: colors.inputBackground, gap: 6,
  },
  dropTriggerText: { flex: 1, fontSize: globalWidth('0.72%'), color: colors.textPrimary },
  dropPlaceholder: { color: colors.textMuted },
  dropPanel: {
    backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, marginTop: 4,
    shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
    zIndex: 100,
  },
  dropSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: globalWidth('0.5%'), borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dropSearchInput: { flex: 1, fontSize: globalWidth('0.68%'), color: colors.textPrimary, outlineStyle: 'none' },
  dropHint:     { padding: globalWidth('0.8%'), paddingVertical: globalHeight('1.2%') },
  dropHintText: { fontSize: globalWidth('0.65%'), color: colors.textMuted, textAlign: 'center' },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: globalWidth('0.8%'), paddingVertical: globalHeight('1%'),
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dropItemSelected: { backgroundColor: colors.surfaceSoft },
  dropItemText:     { fontSize: globalWidth('0.72%'), color: colors.textPrimary, fontWeight: '600' },
  dropItemSub:      { fontSize: globalWidth('0.6%'), color: colors.textSecondary, marginTop: 2 },
  checkIcon:        { width: 20, alignItems: 'center' },

  /* Pills */
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontSize: globalWidth('0.65%'), fontWeight: '700', color: colors.primary },

  selectionCount: {
    fontSize: globalWidth('0.6%'), color: colors.textSecondary,
    marginTop: 6, fontStyle: 'italic',
  },

  /* Status row */
  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: globalHeight('0.8%'), marginBottom: globalHeight('1.2%'),
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLabel: { fontSize: globalWidth('0.72%'), fontWeight: '700' },

  /* Info banner */
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#EFF6FF', borderTopWidth: 1, borderTopColor: '#BFDBFE',
    padding: globalWidth('1.2%'),
  },
  infoBannerText: { flex: 1, fontSize: globalWidth('0.65%'), color: '#1D4ED8', lineHeight: 18 },

  /* Error banner */
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF2F2', borderTopWidth: 1, borderTopColor: '#FCA5A5',
    padding: globalWidth('1.2%'),
  },
  errorBannerText: { flex: 1, fontSize: globalWidth('0.68%'), color: colors.danger },

  /* Action row */
  actionRow: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: globalWidth('0.7%'),
    padding: globalWidth('1.2%'), borderTopWidth: 1, borderTopColor: colors.border,
  },
  btnCancel: {
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: globalWidth('1.2%'), height: globalHeight('4.4%'),
    alignItems: 'center', justifyContent: 'center',
  },
  btnCancelText: { fontSize: globalWidth('0.72%'), color: colors.textPrimary, fontWeight: '700' },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: globalWidth('1.4%'), height: globalHeight('4.4%'),
  },
  btnPrimaryText: { color: colors.white, fontSize: globalWidth('0.72%'), fontWeight: '700' },
});
