import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  getRepProductAssignments,
  createRepProductAssignment,
  updateRepProductAssignment,
  closeRepAssignments,
  todayISO,
} from '../../store/teams/repProductAssignmentActions';
import { listProducts } from '../../store/products/productActions';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

function fmtShortDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

/* ── shared UI ───────────────────────────────────────────────────────────── */
function InfoRow({ label, value, mono }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && { fontFamily: 'monospace', fontSize: 12 }]}>
        {value || '—'}
      </Text>
    </View>
  );
}

/* ── Native date picker ──────────────────────────────────────────────────── */
function DatePicker({ value, onChange }) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 13,
          color: value ? colors.textPrimary : colors.textMuted,
          backgroundColor: colors.inputBackground,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      />
    );
  }
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
    />
  );
}

/* ── Edit Assignment Modal ───────────────────────────────────────────────── */
function EditAssignmentModal({ visible, assignment, onClose, onSave }) {
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (!assignment) return;
    setStartDate(assignment.startDate ? assignment.startDate.slice(0, 10) : '');
    setEndDate(assignment.endDate   ? assignment.endDate.slice(0, 10)   : '');
    setNotes(assignment.notes || '');
    setError('');
  }, [assignment]);

  const handleSave = async () => {
    if (!startDate) { setError('Start date is required.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        startDate,
        ...(endDate ? { endDate } : {}),
        ...(notes   ? { notes  } : {}),
      });
    } catch (e) {
      setError(e.message || 'Failed to update.');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Assignment</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>
            Start Date <Text style={{ color: colors.danger }}>*</Text>
          </Text>
          <DatePicker value={startDate} onChange={setStartDate} />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>End Date (optional)</Text>
          <DatePicker value={endDate} onChange={setEndDate} />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add notes…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size={14} color={colors.white} />
                : <Ionicons name="save-outline" size={14} color={colors.white} />
              }
              <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Products Tab ────────────────────────────────────────────────────────── */
function ProductsTab({ token, repId, isActive, managerRole }) {

  /* list */
  const [assignments,   setAssignments]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [listError,     setListError]     = useState('');
  const [editingAssign, setEditingAssign] = useState(null);
  const [closing,       setClosing]       = useState(false);

  /* inline assign-form visibility */
  const [showForm,  setShowForm]  = useState(false);

  /* product catalogue */
  const [allProducts,     setAllProducts]     = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [filterText,      setFilterText]      = useState('');

  /* form fields */
  const [selected,  setSelected]  = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [notes,     setNotes]     = useState('');
  const [assigning, setAssigning] = useState(false);
  const [formError, setFormError] = useState('');

  /* ── fetch assigned list ── */
  const fetchAssignments = useCallback(async () => {
    setLoading(true); setListError('');
    try {
      const data = await getRepProductAssignments(token, repId, { activeOn: todayISO() });
      setAssignments(Array.isArray(data) ? data : []);
    } catch (e) {
      setListError(e.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [token, repId]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  /* ── load all products when form opens ── */
  useEffect(() => {
    if (!showForm || allProducts.length > 0) return;
    setProductsLoading(true);
    listProducts(token, { limit: 500 })
      .then((r) => setAllProducts(r.products || []))
      .catch(() => setAllProducts([]))
      .finally(() => setProductsLoading(false));
  }, [showForm, token]);

  /* ── product selection ── */
  const toggleProduct = (p) => {
    const pid = p._id || p.id;
    setSelected((prev) =>
      prev.some((s) => (s._id || s.id) === pid)
        ? prev.filter((s) => (s._id || s.id) !== pid)
        : [...prev, p],
    );
  };

  const filteredProducts = allProducts.filter((p) => {
    if (!filterText.trim()) return true;
    return (p.productName || p.name || '').toLowerCase().includes(filterText.toLowerCase());
  });

  /* ── form reset / toggle ── */
  const resetForm = () => {
    setSelected([]); setStartDate(''); setEndDate('');
    setNotes(''); setFormError(''); setFilterText('');
  };

  const toggleForm = () => {
    if (showForm) resetForm();
    setShowForm((v) => !v);
  };

  /* ── assign submit ── */
  const handleAssign = async () => {
    if (selected.length === 0) { setFormError('Select at least one product.'); return; }
    if (!startDate)             { setFormError('Start date is required.'); return; }
    setAssigning(true); setFormError('');
    try {
      await createRepProductAssignment(token, {
        medicalRepId: repId,
        productIds:   selected.map((p) => p._id || p.id),
        startDate,
        ...(endDate ? { endDate } : {}),
        ...(notes   ? { notes  } : {}),
      });
      resetForm();
      setAssigning(false);
      setShowForm(false);
      fetchAssignments();
    } catch (e) {
      setFormError(e.message || 'Failed to assign products.');
      setAssigning(false);
    }
  };

  /* ── edit save ── */
  const handleEditSave = async (payload) => {
    await updateRepProductAssignment(token, editingAssign._id || editingAssign.id, payload);
    setEditingAssign(null);
    fetchAssignments();
  };

  /* ── close all ── */
  const handleCloseAll = async () => {
    if (!window.confirm('Close all active assignments for this rep? This cannot be undone.')) return;
    setClosing(true);
    try {
      await closeRepAssignments(token, repId);
      fetchAssignments();
    } catch (e) {
      alert(e.message || 'Failed to close assignments');
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.tabCentered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (listError) {
    return (
      <View style={styles.tabCentered}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
        <Text style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{listError}</Text>
        <Pressable style={styles.retryBtn} onPress={fetchAssignments}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.productsTab}>

      {/* Edit modal */}
      <EditAssignmentModal
        visible={!!editingAssign}
        assignment={editingAssign}
        onClose={() => setEditingAssign(null)}
        onSave={handleEditSave}
      />

      {/* ── Main card ── */}
      <View style={styles.card}>

        {/* Card header */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            Active Assignments ({assignments.length})
          </Text>
          {managerRole && (
            <Pressable
              style={showForm ? styles.btnOutline : styles.btnPrimary}
              onPress={toggleForm}
            >
              <Ionicons
                name={showForm ? 'close' : 'add'}
                size={14}
                color={showForm ? colors.primary : colors.white}
              />
              <Text style={showForm ? styles.btnOutlineText : styles.btnPrimaryText}>
                {showForm ? 'Cancel' : 'Assign Products'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Inline assign form ── */}
        {showForm && managerRole && (
          <View style={styles.assignForm}>

            {/* Products */}
            <Text style={styles.fieldLabel}>
              Products{' '}
              <Text style={{ color: colors.danger }}>*</Text>
              {selected.length > 0 && (
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {'  '}({selected.length} selected)
                </Text>
              )}
            </Text>

            <View style={styles.filterRow}>
              <Ionicons name="search-outline" size={14} color={colors.textMuted} />
              <TextInput
                style={styles.filterInput}
                placeholder="Filter products…"
                value={filterText}
                onChangeText={setFilterText}
              />
              {filterText.length > 0 && (
                <Pressable onPress={() => setFilterText('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            <View style={styles.productListBox}>
              {productsLoading ? (
                <View style={styles.productListLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.productListLoaderText}>Loading products…</Text>
                </View>
              ) : filteredProducts.length === 0 ? (
                <View style={styles.productListLoader}>
                  <Text style={styles.productListLoaderText}>No products found</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                  {filteredProducts.map((p) => {
                    const pid     = p._id || p.id;
                    const checked = selected.some((s) => (s._id || s.id) === pid);
                    return (
                      <Pressable
                        key={pid}
                        style={[styles.productRow, checked && styles.productRowChecked]}
                        onPress={() => toggleProduct(p)}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked && <Ionicons name="checkmark" size={11} color={colors.white} />}
                        </View>
                        <Text
                          style={[styles.productRowText, checked && styles.productRowTextChecked]}
                          numberOfLines={1}
                        >
                          {p.productName || p.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Date pickers side-by-side */}
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>
                  Start Date <Text style={{ color: colors.danger }}>*</Text>
                </Text>
                <DatePicker value={startDate} onChange={setStartDate} />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>End Date (optional)</Text>
                <DatePicker value={endDate} onChange={setEndDate} />
              </View>
            </View>

            {/* Notes */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add notes…"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            {/* Submit */}
            <View style={styles.formSubmitRow}>
              <Pressable
                style={[styles.btnPrimary, (assigning || selected.length === 0) && { opacity: 0.5 }]}
                onPress={handleAssign}
                disabled={assigning || selected.length === 0}
              >
                {assigning
                  ? <ActivityIndicator size={14} color={colors.white} />
                  : <Ionicons name="checkmark" size={14} color={colors.white} />
                }
                <Text style={styles.btnPrimaryText}>
                  {assigning
                    ? 'Assigning…'
                    : selected.length > 0
                      ? `Assign ${selected.length} Product${selected.length > 1 ? 's' : ''}`
                      : 'Assign'
                  }
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Divider */}
        {showForm && assignments.length > 0 && <View style={styles.formDivider} />}

        {/* Assignment list */}
        {assignments.length === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="cube-outline" size={24} color={colors.textMuted} />
            <Text style={styles.emptySectionText}>No active product assignments</Text>
          </View>
        ) : (
          assignments.map((a) => {
            const aid = a._id || a.id;
            const productName =
              typeof a.productId === 'object'
                ? (a.productId?.productName || a.productId?.name || '—')
                : (a.productName || a.product?.productName || '—');
            return (
              <View key={aid} style={styles.assignRow}>
                <View style={styles.assignIcon}>
                  <Ionicons name="cube-outline" size={14} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignProductName}>{productName}</Text>
                  <Text style={styles.assignDates}>
                    {fmtShortDate(a.startDate)} → {fmtShortDate(a.endDate)}
                  </Text>
                  {a.notes ? <Text style={styles.assignNotes}>{a.notes}</Text> : null}
                </View>
                {managerRole && (
                  <Pressable style={styles.editBtn} onPress={() => setEditingAssign(a)}>
                    <Ionicons name="pencil-outline" size={13} color={colors.primary} />
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Close all — only for inactive reps */}
      {!isActive && managerRole && (
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Resigned Rep</Text>
          <Text style={styles.dangerDesc}>
            Close all active product assignments for this rep.
          </Text>
          <Pressable
            style={[styles.btnDanger, closing && { opacity: 0.6 }]}
            onPress={handleCloseAll}
            disabled={closing}
          >
            {closing
              ? <ActivityIndicator size={13} color={colors.white} />
              : <Ionicons name="close-circle-outline" size={14} color={colors.white} />
            }
            <Text style={styles.btnDangerText}>
              {closing ? 'Closing…' : 'Close All Assignments'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ── Main Screen ─────────────────────────────────────────────────────────── */
export default function RepDetailScreen({
  navigation, route, userDetails, appMetadata, onSignOut,
}) {
  const repId    = route?.params?.repId;
  const member   = route?.params?.member || {};
  const teamId   = route?.params?.teamId;
  const teamName = route?.params?.teamName || 'Team';

  const user        = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token       = userDetails?.token || userDetails?.data?.token || '';
  const role        = user.role || '';
  const managerRole = isManager(role);

  const name     = member.fullName || member.name || member.displayName || 'Unknown Rep';
  const appId    = member.appId || member.representativeId || '';
  const position = member.role || member.title || member.position || '';
  const isActive = member.isActive !== false && member.status !== 'inactive';

  const [activeTab, setActiveTab] = useState('overview');

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Teams"
    >
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Teams')}>
          <Text style={styles.breadcrumbLink}>Teams</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Pressable onPress={() => navigation.navigate('TeamDetail', { teamId })}>
          <Text style={styles.breadcrumbLink}>{teamName}</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{name}</Text>
      </View>

      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{getInitials(name)}</Text>
          </View>
          <View>
            <Text style={styles.repName}>{name}</Text>
            {position ? <Text style={styles.repPosition}>{position}</Text> : null}
            {appId ? <Text style={styles.repAppId}>ID: {appId}</Text> : null}
            <View style={[
              styles.statusPill,
              { backgroundColor: isActive ? '#ECFDF5' : '#FEF2F2', marginTop: 4 },
            ]}>
              <Text style={[styles.statusPillText, { color: isActive ? '#059669' : '#DC2626' }]}>
                {isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'overview', icon: 'person-outline', label: 'Overview' },
          { key: 'products', icon: 'cube-outline',   label: 'Products' },
        ].map(({ key, icon, label }) => (
          <Pressable
            key={key}
            style={[styles.tabBtn, activeTab === key && styles.tabBtnActive]}
            onPress={() => setActiveTab(key)}
          >
            <Ionicons
              name={icon}
              size={14}
              color={activeTab === key ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabBtnText, activeTab === key && styles.tabBtnTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rep Info</Text>
          <View style={{ marginTop: 12 }}>
            <InfoRow label="Full Name" value={name} />
            {appId ? <InfoRow label="App ID" value={appId} mono /> : null}
            {position ? <InfoRow label="Position" value={position} /> : null}
            <InfoRow label="Status" value={isActive ? 'Active' : 'Inactive'} />
          </View>
        </View>
      )}

      {/* Products tab */}
      {activeTab === 'products' && (
        <ProductsTab
          token={token}
          repId={repId}
          isActive={isActive}
          managerRole={managerRole}
        />
      )}
    </AppShell>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const shadow = {
  shadowColor: '#0B2B66', shadowOpacity: 0.06,
  shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  breadcrumb:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink:    { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  headerCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: globalWidth('1.2%'),
    flexDirection: 'row', alignItems: 'center',
    marginBottom: globalHeight('1%'), ...shadow,
  },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.9%') },
  bigAvatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bigAvatarText: { fontSize: globalWidth('1%'), fontWeight: '800', color: colors.primary },
  repName:       { fontSize: globalWidth('1.05%'), fontWeight: '800', color: colors.textPrimary },
  repPosition:   { fontSize: globalWidth('0.7%'), color: colors.textSecondary, marginTop: 1 },
  repAppId:      { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  statusPill:    { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  statusPillText:{ fontSize: 11, fontWeight: '700' },

  tabBar: {
    flexDirection: 'row', gap: 4, marginBottom: globalHeight('1.2%'),
    backgroundColor: colors.surface, borderRadius: 8, padding: 4,
    borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start', ...shadow,
  },
  tabBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  tabBtnActive:    { backgroundColor: colors.primaryLight },
  tabBtnText:      { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabBtnTextActive:{ color: colors.primary },

  card:       { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 18, ...shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle:  { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { width: 120, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary },

  productsTab: { gap: globalHeight('1.2%') },
  tabCentered: { alignItems: 'center', padding: 40, gap: 10 },
  retryBtn:    { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText:   { color: colors.primary, fontSize: 13, fontWeight: '700' },

  /* inline assign form */
  assignForm:    { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginBottom: 4 },
  formDivider:   { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  formSubmitRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  formError:     { fontSize: 12, color: colors.danger, marginTop: 8, fontWeight: '600' },
  fieldLabel:    { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },

  /* filter row */
  filterRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, height: 40, backgroundColor: colors.inputBackground, marginBottom: 8 },
  filterInput:{ flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },

  /* product checkbox list */
  productListBox:       { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', marginBottom: 4 },
  productListLoader:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  productListLoaderText:{ fontSize: 13, color: colors.textMuted },
  productRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  productRowChecked: { backgroundColor: '#F0F7FF' },
  productRowText:    { flex: 1, fontSize: 13, color: colors.textPrimary },
  productRowTextChecked: { color: colors.primary, fontWeight: '700' },
  checkbox:        { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },

  /* date pickers */
  dateRow:   { flexDirection: 'row', gap: 12, marginTop: 14 },
  dateField: { flex: 1 },

  /* text inputs */
  input:    { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.textPrimary, backgroundColor: colors.inputBackground },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },

  /* assignments list */
  emptySection:      { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptySectionText:  { fontSize: 13, color: colors.textMuted },
  assignRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  assignIcon:        { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  assignProductName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  assignDates:       { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  assignNotes:       { fontSize: 11, color: colors.textMuted, marginTop: 3, fontStyle: 'italic' },
  editBtn:           { width: 30, height: 30, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },

  /* danger zone */
  dangerZone:  { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, padding: 16, backgroundColor: '#FEF2F2' },
  dangerTitle: { fontSize: 13, fontWeight: '800', color: colors.danger, marginBottom: 6 },
  dangerDesc:  { fontSize: 12, color: colors.textSecondary, marginBottom: 12 },

  /* buttons */
  btnPrimary:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8 },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  btnCancel:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8 },
  btnCancelText:  { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  btnDanger:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  btnDangerText:  { color: colors.white, fontSize: 13, fontWeight: '700' },

  /* edit modal */
  overlay:      { flex: 1, backgroundColor: 'rgba(7,18,47,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalBox:     { backgroundColor: colors.surface, borderRadius: 12, padding: 24, width: 460, maxWidth: '90%', borderWidth: 1, borderColor: colors.border, ...shadow },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
});
