import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listSalesMappings,
  createSalesMapping,
  updateSalesMapping,
  updateSalesMappingStatus,
  deleteSalesMapping,
} from '../../store/sales/salesActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD    = globalWidth('1.2%');

const MAPPING_FIELDS = [
  { key: 'invoiceNumber',     label: 'Invoice Number',        required: false },
  { key: 'salesDate',         label: 'Sales Date',            required: true  },
  { key: 'accountName',       label: 'Account Name',          required: true  },
  { key: 'shipToAccountName', label: 'Ship-To Account',       required: false },
  { key: 'productName',       label: 'Product Name',          required: true  },
  { key: 'productNickname',   label: 'Product Nickname/Code', required: false },
  { key: 'quantity',          label: 'Quantity',              required: true  },
  { key: 'freeQuantity',      label: 'Free Quantity (FOC)',   required: false },
  { key: 'salesValue',        label: 'Sales Value',           required: false },
  { key: 'currency',          label: 'Currency',              required: false },
  { key: 'channelName',       label: 'Channel Name',          required: false },
  { key: 'channelKey',        label: 'Channel Key',           required: false },
];

const SOURCE_TYPE_OPTS = [
  { value: 'Excel', label: 'Excel (.xlsx / .xls)' },
  { value: 'CSV',   label: 'CSV (.csv)'            },
];

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');
const cap     = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';

const STATUS_STYLE = {
  active:   { bg: '#DCFCE7', text: '#15803D' },
  inactive: { bg: '#F1F5F9', text: '#64748B' },
};

function Badge({ label, styleObj }) {
  return (
    <View style={[styles.badge, { backgroundColor: styleObj?.bg || '#F1F5F9' }]}>
      <Text style={[styles.badgeText, { color: styleObj?.text || '#64748B' }]}>{label}</Text>
    </View>
  );
}

function SimpleDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ position: 'relative', zIndex: open ? 50 : 1 }}>
      <Pressable style={styles.dropBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.dropBtnText}>{selected?.label || '— select —'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.dropMenu}>
          {options.map((opt) => (
            <Pressable
              key={String(opt.value)}
              style={[styles.dropOpt, opt.value === value && styles.dropOptActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.dropOptText, opt.value === value && styles.dropOptTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function MappingForm({ initial, onSave, onCancel, saving }) {
  const [name,         setName]         = useState(initial?.name         || initial?.mappingName || '');
  const [description,  setDescription]  = useState(initial?.description  || '');
  const [sourceType,   setSourceType]   = useState(initial?.sourceType   || 'Excel');
  const [isDefault,    setIsDefault]    = useState(initial?.isDefault    || false);
  const [status,       setStatus]       = useState(initial?.status       || 'active');
  const [colMapping,   setColMapping]   = useState(() => {
    const base = {};
    MAPPING_FIELDS.forEach((f) => { base[f.key] = ''; });
    if (initial?.columnMapping) {
      Object.entries(initial.columnMapping).forEach(([k, v]) => { base[k] = v || ''; });
    }
    return base;
  });

  const setCol = (key, val) => setColMapping((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!name.trim()) { alert('Mapping name is required'); return; }
    const cleanCols = {};
    MAPPING_FIELDS.forEach((f) => { if (colMapping[f.key]?.trim()) cleanCols[f.key] = colMapping[f.key].trim(); });
    onSave({ name: name.trim(), description, sourceType, isDefault, status, columnMapping: cleanCols });
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>{initial ? 'Edit Mapping' : 'New Mapping'}</Text>

      <View style={styles.formRow}>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Mapping Name *</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Default Excel Mapping"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Source Type</Text>
          <SimpleDropdown options={SOURCE_TYPE_OPTS} value={sourceType} onChange={setSourceType} />
        </View>
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Description</Text>
        <TextInput
          style={[styles.textInput, { height: 60 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional description…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
      </View>

      <View style={styles.formRow}>
        <View style={styles.switchRow}>
          <Text style={styles.formLabel}>Is Default</Text>
          <Switch
            value={isDefault}
            onValueChange={setIsDefault}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={isDefault ? '#fff' : '#fff'}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.formLabel}>Active</Text>
          <Switch
            value={status === 'active'}
            onValueChange={(v) => setStatus(v ? 'active' : 'inactive')}
            trackColor={{ true: colors.success, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Column Mapping table */}
      <Text style={styles.formSectionLabel}>Column Mapping</Text>
      <Text style={styles.formSectionDesc}>Enter the exact column header name from your file for each internal field.</Text>

      <View style={styles.colMappingTable}>
        <View style={styles.colMappingHead}>
          <Text style={[styles.colMappingTh, { flex: 1.5 }]}>Internal Field</Text>
          <Text style={styles.colMappingTh}>Required</Text>
          <Text style={[styles.colMappingTh, { flex: 2 }]}>Excel Column Header</Text>
        </View>
        {MAPPING_FIELDS.map((field) => (
          <View key={field.key} style={styles.colMappingRow}>
            <Text style={[styles.colMappingTd, { flex: 1.5 }]} numberOfLines={1}>{field.label}</Text>
            <View style={styles.colMappingTd}>
              {field.required
                ? <View style={styles.reqBadge}><Text style={styles.reqBadgeText}>Required</Text></View>
                : <Text style={styles.optText}>Optional</Text>
              }
            </View>
            <View style={{ flex: 2 }}>
              <TextInput
                style={styles.colInput}
                value={colMapping[field.key] || ''}
                onChangeText={(v) => setCol(field.key, v)}
                placeholder={`e.g. ${field.label}`}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.formActions}>
        <Pressable style={styles.btnSecondary} onPress={onCancel}>
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size={13} color="#fff" />
            : <Ionicons name="checkmark-outline" size={14} color="#fff" />
          }
          <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Save Mapping'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const COLS = [
  { key: 'name',       label: 'Name',        width: 160 },
  { key: 'sourceType', label: 'Source Type', width: 100 },
  { key: 'isDefault',  label: 'Default',     width: 70  },
  { key: 'status',     label: 'Status',      width: 80  },
  { key: 'createdAt',  label: 'Created At',  width: 100 },
  { key: 'actions',    label: 'Actions',     width: 100 },
];

export default function SalesMappingsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user    = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const role    = user.role || '';
  const manager = isManager(role);

  const [mappings,   setMappings]   = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [showForm,    setShowForm]    = useState(false);
  const [editMapping, setEditMapping] = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [toggling,    setToggling]    = useState('');
  const [deleting,    setDeleting]    = useState('');

  const fetchMappings = useCallback(async (pg = 1) => {
    setLoading(true); setError('');
    try {
      const res = await listSalesMappings(token, { page: pg, limit: 20 });
      setMappings(res.mappings);
      setPagination(res.pagination);
    } catch (e) {
      setError(e.message || 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMappings(1); }, [fetchMappings]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editMapping) {
        const id = editMapping._id || editMapping.id;
        const updated = await updateSalesMapping(token, id, data);
        setMappings((prev) => prev.map((m) => (m._id || m.id) === id ? { ...m, ...updated } : m));
      } else {
        const created = await createSalesMapping(token, data);
        setMappings((prev) => [created, ...prev]);
      }
      setShowForm(false); setEditMapping(null);
    } catch (e) {
      alert(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (m) => {
    const id = m._id || m.id;
    const newStatus = m.status === 'active' ? 'inactive' : 'active';
    setToggling(id);
    try {
      const updated = await updateSalesMappingStatus(token, id, { status: newStatus });
      setMappings((prev) => prev.map((x) => (x._id || x.id) === id ? { ...x, ...updated } : x));
    } catch (e) {
      alert(e.message || 'Update failed');
    } finally {
      setToggling('');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this mapping?')) return;
    setDeleting(id);
    try {
      await deleteSalesMapping(token, id);
      setMappings((prev) => prev.filter((m) => (m._id || m.id) !== id));
    } catch (e) {
      alert(e.message || 'Delete failed');
    } finally {
      setDeleting('');
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesMappings" scrollable={false}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Sheet Mappings</Text>
            <Text style={styles.pageSubtitle}>Configure how Excel/CSV columns map to internal fields</Text>
          </View>
          {manager && !showForm && (
            <Pressable style={styles.btnPrimary} onPress={() => { setEditMapping(null); setShowForm(true); }}>
              <Ionicons name="add-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>New Mapping</Text>
            </Pressable>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>

          {/* Form panel */}
          {showForm && manager && (
            <MappingForm
              initial={editMapping}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditMapping(null); }}
              saving={saving}
            />
          )}

          {/* Table */}
          {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : error ? (
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.btnOutline} onPress={() => fetchMappings(1)}>
                <Text style={styles.btnOutlineText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.tableCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.tblHead}>
                    {COLS.map((c) => (
                      <Text key={c.key} style={[styles.tblTh, { width: c.width }]}>{c.label}</Text>
                    ))}
                  </View>
                  {mappings.length === 0 ? (
                    <View style={styles.emptyRow}>
                      <Ionicons name="git-merge-outline" size={32} color={colors.textMuted} />
                      <Text style={styles.emptyText}>No mappings yet</Text>
                      {manager && (
                        <Pressable style={styles.btnPrimary} onPress={() => { setEditMapping(null); setShowForm(true); }}>
                          <Text style={styles.btnPrimaryText}>Create First Mapping</Text>
                        </Pressable>
                      )}
                    </View>
                  ) : mappings.map((m) => {
                    const id       = m._id || m.id;
                    const statusSty = STATUS_STYLE[m.status] || STATUS_STYLE.inactive;
                    return (
                      <View key={id} style={styles.tblRow}>
                        <View style={[styles.tblTd, { width: COLS[0].width }]}>
                          <Text style={styles.mappingName} numberOfLines={1}>{m.name || m.mappingName || '—'}</Text>
                          {m.description ? <Text style={styles.mappingDesc} numberOfLines={1}>{m.description}</Text> : null}
                        </View>
                        <Text style={[styles.tblTd, { width: COLS[1].width }]}>{m.sourceType || '—'}</Text>
                        <View style={[styles.tblTd, { width: COLS[2].width }]}>
                          {m.isDefault
                            ? <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>
                            : <Text style={styles.noDefaultText}>—</Text>
                          }
                        </View>
                        <View style={[styles.tblTd, { width: COLS[3].width }]}>
                          <Badge label={cap(m.status || 'inactive')} styleObj={statusSty} />
                        </View>
                        <Text style={[styles.tblTd, { width: COLS[4].width }]}>{fmtDate(m.createdAt)}</Text>
                        <View style={[styles.tblTd, styles.tblActions, { width: COLS[5].width }]}>
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() => { setEditMapping(m); setShowForm(true); }}
                          >
                            <Ionicons name="create-outline" size={14} color={colors.primary} />
                          </Pressable>
                          {manager && (
                            <>
                              <Pressable
                                style={styles.actionBtn}
                                onPress={() => handleToggleStatus(m)}
                                disabled={toggling === id}
                              >
                                {toggling === id
                                  ? <ActivityIndicator size={12} color={colors.textSecondary} />
                                  : <Ionicons
                                      name={m.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                                      size={14}
                                      color={m.status === 'active' ? colors.warning : colors.success}
                                    />
                                }
                              </Pressable>
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
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

        </ScrollView>
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
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.surface,
  },
  btnSecondaryText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  /* Form */
  formCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary + '40',
    borderRadius: 12, padding: 20, gap: 16, ...shadow,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  formRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  formField: { flex: 1, minWidth: 180, gap: 6 },
  formLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13,
    color: colors.textPrimary, backgroundColor: colors.backgroundColor,
    outlineStyle: 'none',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 140 },

  formSectionLabel: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  formSectionDesc:  { fontSize: 12, color: colors.textSecondary, marginTop: -8 },

  colMappingTable: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  colMappingHead:  { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 8, paddingHorizontal: 10 },
  colMappingTh:    { flex: 1, fontSize: 11, fontWeight: '800', color: colors.primary },
  colMappingRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  colMappingTd:    { flex: 1, fontSize: 12, color: colors.textPrimary },
  colInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 6, fontSize: 12,
    color: colors.textPrimary, backgroundColor: colors.backgroundColor,
    outlineStyle: 'none',
  },
  reqBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FEE2E2', alignSelf: 'flex-start' },
  reqBadgeText: { fontSize: 10, fontWeight: '700', color: colors.danger },
  optText:      { fontSize: 11, color: colors.textMuted },
  formActions:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 8 },

  dropBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9, backgroundColor: colors.backgroundColor,
  },
  dropBtnText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  dropMenu: {
    position: 'absolute', top: 40, left: 0, right: 0,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  dropOpt:           { paddingHorizontal: 12, paddingVertical: 9 },
  dropOptActive:     { backgroundColor: colors.primary + '15' },
  dropOptText:       { fontSize: 13, color: colors.textPrimary },
  dropOptTextActive: { color: colors.primary, fontWeight: '700' },

  /* Table */
  tableCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, ...shadow,
  },
  tblHead: { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6, marginBottom: 2 },
  tblTh:   { fontSize: 11, fontWeight: '800', color: colors.primary },
  tblRow:  { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tblTd:   { fontSize: 12, color: colors.textPrimary, paddingRight: 4 },
  tblActions: { flexDirection: 'row', gap: 2 },
  actionBtn:  { padding: 5, borderRadius: 5 },

  mappingName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  mappingDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },

  defaultBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.primary + '15', alignSelf: 'flex-start' },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  noDefaultText: { fontSize: 12, color: colors.textMuted },

  emptyRow: { padding: 48, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: colors.textMuted },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
