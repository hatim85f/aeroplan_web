import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getAccountById, createAccount, updateAccount, bulkCreateAccounts } from '../../store/accounts/accountActions';
import { getMyTeams, getTeamMembers } from '../../store/teams/teamsActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const ACCOUNT_TYPES = ['Clinic', 'Hospital', 'Healthcare', 'Pharmacy'];

const TYPE_ICONS = {
  Clinic: 'briefcase-outline',
  Hospital: 'business-outline',
  Healthcare: 'heart-circle-outline',
  Pharmacy: 'flask-outline',
};

const EXCEL_COLUMNS = [
  'accountName', 'keyContact', 'contactPersonEmail', 'phoneNumber',
  'accountType', 'area', 'territory', 'address', 'googleMapsLink',
  'assignedMedicalRepIds', 'planId', 'visitDate',
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function Field({ label, required, error, hint, children, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function TypeButtonGroup({ value, onChange }) {
  return (
    <View style={styles.typeButtons}>
      {ACCOUNT_TYPES.map((t) => {
        const active = value === t;
        return (
          <Pressable key={t} style={[styles.typeBtn, active && styles.typeBtnActive]} onPress={() => onChange(t)}>
            <Ionicons name={TYPE_ICONS[t]} size={15} color={active ? colors.white : colors.textSecondary} />
            <Text style={[styles.typeBtnText, active && styles.typeBtnTextActive]}>{t}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RepDropdown({ value, teamMembers, onChange }) {
  const [open, setOpen] = useState(false);

  const getName = (id) => {
    const m = teamMembers.find((x) => (x._id || x.id || x.userId) === id);
    return m ? (m.displayName || m.fullName || m.name || m.userName || 'Rep') : id;
  };

  const label = value.length
    ? value.map(getName).join(', ')
    : 'Select assigned reps';

  return (
    <View style={{ zIndex: 10 }}>
      <Pressable style={styles.input} onPress={() => setOpen((v) => !v)}>
        <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.repDropLabel, !value.length && { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          {teamMembers.length === 0 ? (
            <View style={styles.dropOpt}>
              <Text style={[styles.dropOptText, { color: colors.textMuted }]}>No team members found</Text>
            </View>
          ) : (
            teamMembers.map((m) => {
              const mid = m._id || m.id || m.userId;
              const mname = m.displayName || m.fullName || m.name || m.userName || 'Rep';
              const sel = value.includes(mid);
              return (
                <Pressable
                  key={mid}
                  style={[styles.dropOpt, styles.dropOptRow, sel && styles.dropOptActive]}
                  onPress={() => onChange(sel ? value.filter((x) => x !== mid) : [...value, mid])}
                >
                  <View style={[styles.repCheckbox, sel && styles.repCheckboxChecked]}>
                    {sel && <Ionicons name="checkmark" size={10} color={colors.white} />}
                  </View>
                  <Text style={[styles.dropOptText, sel && styles.dropOptTextActive]}>{mname}</Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

/* ─── Excel helpers ──────────────────────────────────────────────────────── */
function downloadTemplate() {
  const XLSX = require('xlsx');
  const example = [{
    accountName: 'City Hospital',
    keyContact: 'Dr. Ahmed Hassan',
    contactPersonEmail: 'doctor@example.com',
    phoneNumber: '+971500000000',
    accountType: 'Hospital',
    area: 'Downtown',
    territory: 'Dubai North',
    address: 'Dubai Healthcare City, Dubai',
    googleMapsLink: 'https://maps.app.goo.gl/example',
    assignedMedicalRepIds: 'repUserId1,repUserId2',
    planId: 'visit-plan-id',
    visitDate: '2026-05-30T09:00:00.000Z',
  }];
  const ws = XLSX.utils.json_to_sheet(example, { header: EXCEL_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
  XLSX.writeFile(wb, 'aeroplan_accounts_template.xlsx');
}

function parseExcelFile(file, callback) {
  const XLSX = require('xlsx');
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      callback(null, rows);
    } catch (err) {
      callback(err, null);
    }
  };
  reader.readAsArrayBuffer(file);
}

function validateAndTransformRow(row, idx) {
  const errors = [];
  if (!String(row.accountName || '').trim()) errors.push('accountName is required');
  if (!String(row.keyContact || '').trim()) errors.push('keyContact is required');
  if (!String(row.phoneNumber || '').trim()) errors.push('phoneNumber is required');
  if (!String(row.address || '').trim()) errors.push('address is required');

  const repIds = row.assignedMedicalRepIds
    ? String(row.assignedMedicalRepIds).split(',').map((id) => id.trim()).filter(Boolean)
    : [];

  const payload = {
    accountName: String(row.accountName || '').trim(),
    keyContact: String(row.keyContact || '').trim(),
    contactPersonEmail: String(row.contactPersonEmail || '').trim(),
    phoneNumber: String(row.phoneNumber || '').trim(),
    accountType: row.accountType || 'Clinic',
    ...(row.area ? { area: String(row.area).trim() } : {}),
    ...(row.territory ? { territory: String(row.territory).trim() } : {}),
    location: {
      address: String(row.address || '').trim(),
      googleMapsLink: String(row.googleMapsLink || '').trim(),
    },
    assignedMedicalRepIds: repIds,
    userId: repIds[0] || '',
    ...(row.planId || row.visitDate ? {
      lastPlannedVisit: {
        planId: String(row.planId || '').trim(),
        date: String(row.visitDate || '').trim(),
      },
    } : {}),
  };

  return { row: idx + 2, payload, errors };
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function AccountFormScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const mode = route?.params?.mode || 'create';
  const accountId = route?.params?.accountId;
  const isEdit = mode === 'edit' && !!accountId;

  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const userId = user._id || user.id || '';
  const managerRole = isManager(role);

  const [activeMode, setActiveMode] = useState('single');
  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const [teamMembers, setTeamMembers] = useState([]);

  const [form, setForm] = useState({
    accountName: '', keyContact: '', contactPersonEmail: '', phoneNumber: '',
    accountType: 'Clinic', area: '', territory: '', address: '', googleMapsLink: '',
    assignedMedicalRepIds: [], planId: '', visitDate: '',
  });
  const [errors, setErrors] = useState({});

  // Bulk state
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    if (!managerRole) return;
    getMyTeams(token)
      .then(async (teams) => {
        const list = Array.isArray(teams) ? teams : [];
        if (!list.length) return;
        const firstTeamId = list[0]._id || list[0].id || list[0].teamId;
        const members = await getTeamMembers(token, firstTeamId).catch(() => []);
        setTeamMembers(Array.isArray(members) ? members : []);
      })
      .catch(() => {});
  }, [token, managerRole]);

  useEffect(() => {
    if (!isEdit) return;
    setLoadingInit(true);
    getAccountById(token, accountId)
      .then((data) => {
        setForm({
          accountName: data?.accountName || data?.name || '',
          keyContact: data?.keyContact || data?.contactPerson || '',
          contactPersonEmail: data?.contactPersonEmail || data?.email || '',
          phoneNumber: data?.phoneNumber || data?.phone || '',
          accountType: data?.accountType || data?.type || 'Clinic',
          area: data?.area || '',
          territory: data?.territory || '',
          address: data?.location?.address || data?.address || '',
          googleMapsLink: data?.location?.googleMapsLink || data?.googleMapsLink || '',
          assignedMedicalRepIds: (data?.assignedMedicalRepIds || data?.assignedReps || []).map((r) =>
            typeof r === 'string' ? r : (r?._id || r?.userId || r?.id || '')
          ).filter(Boolean),
          planId: data?.lastPlannedVisit?.planId || '',
          visitDate: data?.lastPlannedVisit?.date || '',
        });
      })
      .catch((e) => setLoadError(e.message || 'Failed to load account'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, accountId, token]);

  const validate = () => {
    const errs = {};
    if (!form.accountName.trim()) errs.accountName = 'Account name is required';
    if (!form.keyContact.trim()) errs.keyContact = 'Contact person is required';
    if (!form.phoneNumber.trim()) errs.phoneNumber = 'Phone number is required';
    if (!form.address.trim()) errs.address = 'Address is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const reps = managerRole ? form.assignedMedicalRepIds : [userId];
      const body = {
        accountName: form.accountName.trim(),
        keyContact: form.keyContact.trim(),
        contactPersonEmail: form.contactPersonEmail.trim(),
        phoneNumber: form.phoneNumber.trim(),
        accountType: form.accountType,
        ...(form.area.trim() ? { area: form.area.trim() } : {}),
        ...(form.territory.trim() ? { territory: form.territory.trim() } : {}),
        location: {
          address: form.address.trim(),
          googleMapsLink: form.googleMapsLink.trim(),
        },
        userId: reps[0] || (managerRole ? '' : userId),
        assignedMedicalRepIds: reps,
        ...(form.planId || form.visitDate ? {
          lastPlannedVisit: { planId: form.planId.trim(), date: form.visitDate.trim() },
        } : {}),
      };
      if (isEdit) {
        await updateAccount(token, accountId, body);
        setSaveMessage('Account updated successfully.');
      } else {
        await createAccount(token, body);
        setSaveMessage('Account created successfully.');
      }
      setTimeout(() => navigation.navigate('Accounts'), 1000);
    } catch (e) {
      setSaveError(e.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkParsing(true);
    setBulkErrors([]);
    setBulkRows([]);
    setBulkResult(null);
    parseExcelFile(file, (err, rows) => {
      setBulkParsing(false);
      if (err) { setBulkErrors([{ row: 0, message: 'Failed to parse file: ' + err.message }]); return; }
      const results = rows.map((row, idx) => validateAndTransformRow(row, idx));
      setBulkRows(results);
    });
  };

  const handleBulkSubmit = async () => {
    const validRows = bulkRows.filter((r) => r.errors.length === 0);
    if (!validRows.length) { alert('No valid rows to submit.'); return; }
    setBulkSubmitting(true);
    try {
      const result = await bulkCreateAccounts(token, validRows.map((r) => r.payload));
      setBulkResult(result);
    } catch (e) {
      setSaveError(e.message || 'Bulk upload failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Accounts">
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Accounts')}>
          <Text style={styles.breadcrumbLink}>Accounts</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{isEdit ? 'Edit Account' : 'Add Account'}</Text>
      </View>

      {/* Mode tabs (create only) */}
      {!isEdit && (
        <View style={styles.modeTabs}>
          {[{ key: 'single', label: 'Single Account', icon: 'person-add-outline' },
            { key: 'bulk', label: 'Bulk Excel Upload', icon: 'cloud-upload-outline' }].map(({ key, label, icon }) => (
            <Pressable key={key} style={[styles.modeTab, activeMode === key && styles.modeTabActive]} onPress={() => setActiveMode(key)}>
              <Ionicons name={icon} size={15} color={activeMode === key ? colors.primary : colors.textSecondary} />
              <Text style={[styles.modeTabText, activeMode === key && styles.modeTabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {loadingInit ? (
        <View style={styles.centered}><ActivityIndicator size="small" color={colors.primary} /></View>
      ) : loadError ? (
        <View style={styles.centered}><Text style={styles.errorText}>{loadError}</Text></View>
      ) : activeMode === 'single' ? (

        /* ── Single form ── */
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>{isEdit ? 'Edit Account' : 'Account Information'}</Text>
          <Text style={styles.cardSubtitle}>
            {isEdit ? 'Update the account details below.' : 'Fill in the details to create a new account.'}
          </Text>

          <View style={styles.twoColForm}>

            {/* Left column */}
            <View style={[styles.formCol, { zIndex: 2 }]}>
              <Field label="Account Name" required error={errors.accountName}>
                <TextInput
                  style={[styles.input, errors.accountName && styles.inputError]}
                  value={form.accountName}
                  onChangeText={set('accountName')}
                  placeholder="Enter account name"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Contact Person" required error={errors.keyContact}>
                <TextInput
                  style={[styles.input, errors.keyContact && styles.inputError]}
                  value={form.keyContact}
                  onChangeText={set('keyContact')}
                  placeholder="Dr. Ahmed Hassan"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Contact Person Email">
                <TextInput
                  style={styles.input}
                  value={form.contactPersonEmail}
                  onChangeText={set('contactPersonEmail')}
                  placeholder="doctor@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                />
              </Field>

              <Field label="Phone Number" required error={errors.phoneNumber}>
                <TextInput
                  style={[styles.input, errors.phoneNumber && styles.inputError]}
                  value={form.phoneNumber}
                  onChangeText={set('phoneNumber')}
                  placeholder="e.g. +971500000000"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Account Type" required>
                <TypeButtonGroup value={form.accountType} onChange={set('accountType')} />
              </Field>

              <Field label="Area">
                <TextInput
                  style={styles.input}
                  value={form.area}
                  onChangeText={set('area')}
                  placeholder="e.g. Downtown"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Territory">
                <TextInput
                  style={styles.input}
                  value={form.territory}
                  onChangeText={set('territory')}
                  placeholder="e.g. Dubai North"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>
            </View>

            {/* Right column */}
            <View style={[styles.formCol, { zIndex: 1 }]}>

              <SectionHeader title="Location" />

              <Field label="Location Address" required error={errors.address}>
                <TextInput
                  style={[styles.input, styles.inputMulti, errors.address && styles.inputError]}
                  value={form.address}
                  onChangeText={set('address')}
                  placeholder="Dubai Healthcare City, Dubai"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Field>

              <Field label="Google Maps Link">
                <TextInput
                  style={styles.input}
                  value={form.googleMapsLink}
                  onChangeText={set('googleMapsLink')}
                  placeholder="https://maps.app.goo.gl/..."
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              {managerRole && (
                <>
                  <SectionHeader title="Assigned Reps" />
                  <Field
                    style={{ zIndex: 20 }}
                    hint={
                      form.assignedMedicalRepIds.length === 0
                        ? 'No reps selected. This sends userId as an empty string.'
                        : `${form.assignedMedicalRepIds.length} rep${form.assignedMedicalRepIds.length !== 1 ? 's' : ''} selected`
                    }
                  >
                    <RepDropdown
                      value={form.assignedMedicalRepIds}
                      teamMembers={teamMembers}
                      onChange={set('assignedMedicalRepIds')}
                    />
                  </Field>
                </>
              )}

              <SectionHeader title="Last Planned Visit" />

              <Field label="Plan ID">
                <TextInput
                  style={styles.input}
                  value={form.planId}
                  onChangeText={set('planId')}
                  placeholder="visit-plan-id"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Visit Date">
                <TextInput
                  style={styles.input}
                  value={form.visitDate}
                  onChangeText={set('visitDate')}
                  placeholder="2026-05-30T09:00:00.000Z"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
              {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

              <View style={styles.actionRow}>
                <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
                  {saving && <ActivityIndicator size={14} color={colors.white} />}
                  <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : isEdit ? 'Update Account' : 'Save Account'}</Text>
                </Pressable>
              </View>
            </View>

          </View>
        </View>

      ) : (

        /* ── Bulk Excel upload ── */
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Bulk Excel Upload</Text>
          <Text style={styles.cardSubtitle}>Download the template, fill in your accounts, then upload and submit.</Text>

          {/* Step 1 */}
          <View style={styles.bulkStep}>
            <View style={styles.bulkStepNum}><Text style={styles.bulkStepNumText}>1</Text></View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.bulkStepTitle}>Download Excel Template</Text>
              <Pressable style={styles.btnOutline} onPress={downloadTemplate}>
                <Ionicons name="download-outline" size={14} color={colors.primary} />
                <Text style={styles.btnOutlineText}>Download Template</Text>
              </Pressable>
              <Text style={styles.fieldHint}>
                Required columns: accountName, keyContact, phoneNumber, address{'\n'}
                Optional: contactPersonEmail, accountType, area, territory, googleMapsLink, assignedMedicalRepIds (comma-separated IDs), planId, visitDate
              </Text>
            </View>
          </View>

          {/* Step 2 */}
          <View style={styles.bulkStep}>
            <View style={styles.bulkStepNum}><Text style={styles.bulkStepNumText}>2</Text></View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.bulkStepTitle}>Upload Excel File</Text>
              <label style={{ cursor: 'pointer' }}>
                <View style={styles.uploadBox}>
                  <Ionicons name="cloud-upload-outline" size={32} color={colors.textMuted} />
                  <Text style={styles.uploadBoxText}>Click to choose .xlsx or .xls file</Text>
                  <Text style={styles.fieldHint}>File should match the downloaded template format.</Text>
                </View>
                <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
              </label>
              {bulkParsing && (
                <View style={styles.centered}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Parsing file...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Step 3 */}
          {bulkRows.length > 0 && (
            <View style={styles.bulkStep}>
              <View style={styles.bulkStepNum}><Text style={styles.bulkStepNumText}>3</Text></View>
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={styles.bulkStepTitle}>
                  Preview — {bulkRows.filter((r) => r.errors.length === 0).length} valid / {bulkRows.filter((r) => r.errors.length > 0).length} with errors
                </Text>

                <View style={styles.previewTable}>
                  <View style={styles.previewHead}>
                    <Text style={[styles.previewTh, { flex: 0.5 }]}>Row</Text>
                    <Text style={[styles.previewTh, { flex: 2 }]}>Account Name</Text>
                    <Text style={[styles.previewTh, { flex: 1.5 }]}>Contact</Text>
                    <Text style={[styles.previewTh, { flex: 1.5 }]}>Phone</Text>
                    <Text style={[styles.previewTh, { flex: 1 }]}>Type</Text>
                    <Text style={[styles.previewTh, { flex: 1 }]}>Status</Text>
                  </View>
                  {bulkRows.map(({ row, payload, errors: rowErrors }) => (
                    <View key={row} style={[styles.previewRow, rowErrors.length > 0 && styles.previewRowError]}>
                      <Text style={[styles.previewTd, { flex: 0.5 }]}>{row}</Text>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.cellPrimary} numberOfLines={1}>{payload.accountName || '—'}</Text>
                        {rowErrors.length > 0 && <Text style={styles.rowErrorText} numberOfLines={2}>{rowErrors.join(', ')}</Text>}
                      </View>
                      <Text style={[styles.previewTd, { flex: 1.5 }]} numberOfLines={1}>{payload.keyContact || '—'}</Text>
                      <Text style={[styles.previewTd, { flex: 1.5 }]}>{payload.phoneNumber || '—'}</Text>
                      <Text style={[styles.previewTd, { flex: 1 }]}>{payload.accountType}</Text>
                      <View style={{ flex: 1 }}>
                        {rowErrors.length === 0
                          ? <View style={styles.validBadge}><Text style={styles.validBadgeText}>Valid</Text></View>
                          : <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>Error</Text></View>}
                      </View>
                    </View>
                  ))}
                </View>

                {bulkResult ? (
                  <View style={styles.bulkResultBox}>
                    <Text style={styles.successText}>
                      ✓ {bulkResult.createdCount || 0} accounts created
                      {bulkResult.failedCount ? `, ${bulkResult.failedCount} failed` : ''}
                    </Text>
                    {bulkResult.errors?.map((e, i) => (
                      <Text key={i} style={styles.errorText}>Row {e.row}: {e.message}</Text>
                    ))}
                    <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('Accounts')}>
                      <Text style={styles.btnPrimaryText}>View Accounts</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.bulkActions}>
                    <Pressable style={styles.btnCancel} onPress={() => { setBulkRows([]); setBulkResult(null); }}>
                      <Text style={styles.btnCancelText}>Clear</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btnPrimary, bulkRows.filter((r) => r.errors.length === 0).length === 0 && { opacity: 0.5 }]}
                      onPress={handleBulkSubmit}
                      disabled={bulkSubmitting || bulkRows.filter((r) => r.errors.length === 0).length === 0}
                    >
                      {bulkSubmitting && <ActivityIndicator size={14} color={colors.white} />}
                      <Text style={styles.btnPrimaryText}>
                        {bulkSubmitting ? 'Submitting...' : `Submit ${bulkRows.filter((r) => r.errors.length === 0).length} Accounts`}
                      </Text>
                    </Pressable>
                  </View>
                )}
                {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
              </View>
            </View>
          )}
        </View>
      )}
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  centered: { alignItems: 'center', padding: 32, gap: 10 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13, fontWeight: '700' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  modeTabs: {
    flexDirection: 'row', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start',
    marginBottom: globalHeight('1.5%'), ...shadow,
  },
  modeTab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 11 },
  modeTabActive: { backgroundColor: colors.primary + '12' },
  modeTabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  modeTabTextActive: { color: colors.primary, fontWeight: '700' },

  formCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 24, ...shadow },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },

  twoColForm: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  formCol: { flex: 1, gap: 16, minWidth: 0 },

  sectionHeader: {
    fontSize: 15, fontWeight: '800', color: colors.textPrimary,
    marginTop: 4, marginBottom: -4,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  required: { color: colors.danger },
  fieldError: { fontSize: 12, color: colors.danger },
  fieldHint: { fontSize: 11, color: colors.textMuted },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.surface, outlineStyle: 'none',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  inputError: { borderColor: colors.danger },
  inputMulti: { height: 90, paddingTop: 10 },

  typeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  typeBtnTextActive: { color: colors.white, fontWeight: '700' },

  repDropLabel: { flex: 1, fontSize: 13, color: colors.textPrimary },

  dropdown: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, marginTop: 2, ...shadow,
    zIndex: 100, position: 'absolute', left: 0, right: 0,
  },
  dropOpt: { paddingHorizontal: 12, paddingVertical: 10 },
  dropOptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropOptActive: { backgroundColor: colors.primary + '15' },
  dropOptText: { fontSize: 13, color: colors.textPrimary },
  dropOptTextActive: { color: colors.primary, fontWeight: '700' },

  repCheckbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 2,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  repCheckboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnCancel: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  bulkStep: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  bulkStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  bulkStepNumText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  bulkStepTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },

  uploadBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 8, padding: 32, alignItems: 'center', gap: 8, backgroundColor: colors.backgroundColor, cursor: 'pointer' },
  uploadBoxText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

  previewTable: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  previewHead: { flexDirection: 'row', backgroundColor: colors.backgroundColor, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewTh: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewRowError: { backgroundColor: '#FEF2F2' },
  previewTd: { fontSize: 12, color: colors.textPrimary },
  cellPrimary: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  rowErrorText: { fontSize: 11, color: colors.danger, marginTop: 2 },

  validBadge: { alignSelf: 'flex-start', backgroundColor: '#E7F8EF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  validBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },
  errorBadge: { alignSelf: 'flex-start', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  errorBadgeText: { fontSize: 11, fontWeight: '700', color: colors.danger },

  bulkActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  bulkResultBox: { gap: 8, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundColor },
});
