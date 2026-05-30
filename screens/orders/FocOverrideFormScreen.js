import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import { listProducts } from '../../store/products/productActions';
import {
  createFocOverrides,
  replaceFocOverrides,
} from '../../store/focOverrides/focOverrideActions';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STEPS = ['Select Account', 'Products & FOC %', 'Review & Save'];

/* ─── Date input ─────────────────────────────────────────────────────────── */
function DateInput({ value, onChange, placeholder }) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        height: globalHeight('7.5%'),
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: colors.border,
        paddingLeft: 14,
        paddingRight: 14,
        fontSize: globalWidth('0.85%'),
        color: value ? colors.textPrimary : colors.textSecondary,
        backgroundColor: colors.inputBackground,
        outline: 'none',
        flex: 1,
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    />
  );
}

/* ─── Step indicator ─────────────────────────────────────────────────────── */
function StepBar({ step }) {
  return (
    <View style={styles.stepBar}>
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done    = step > num;
        const current = step === num;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                done    && styles.stepCircleDone,
                current && styles.stepCircleCurrent,
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color={colors.white} />
                  : <Text style={[styles.stepNum, current && styles.stepNumCurrent]}>{num}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, current && styles.stepLabelCurrent]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/* ─── Inline Product Picker ──────────────────────────────────────────────── */
function ProductPickerDropdown({ value, products, onSelect, placeholder }) {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);

  const filtered = products.filter((p) => {
    const name = p.productName || p.name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const selected = products.find((p) => (p._id || p.id) === value);
  const displayName = selected
    ? (selected.productName || selected.name)
    : '';

  return (
    <View>
      <Pressable
        style={styles.dropTrigger}
        onPress={() => { setOpen((o) => !o); setSearch(''); }}
      >
        <Text style={[styles.dropTriggerText, !displayName && styles.dropTriggerPlaceholder]}>
          {displayName || placeholder || 'Select product...'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View style={styles.dropPanel}>
          <View style={styles.dropSearch}>
            <Ionicons name="search" size={13} color={colors.textSecondary} />
            <TextInput
              style={styles.dropSearchInput}
              placeholder="Search product..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <ScrollView style={styles.dropList} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <Text style={styles.dropEmpty}>No products match</Text>
            ) : (
              filtered.map((p) => {
                const pid = p._id || p.id;
                const name = p.productName || p.name || '—';
                const isSelected = pid === value;
                return (
                  <Pressable
                    key={pid}
                    style={[styles.dropItem, isSelected && styles.dropItemSelected]}
                    onPress={() => { onSelect(pid); setOpen(false); setSearch(''); }}
                  >
                    <Text style={[styles.dropItemText, isSelected && styles.dropItemTextSelected]}>
                      {name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={13} color={colors.primary} />
                    )}
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

/* ─── Account Picker Dropdown ────────────────────────────────────────────── */
function AccountPickerDropdown({ value, token, onSelect }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search accounts as user types inside the open panel
  useEffect(() => {
    if (!open) return;
    if (!search || search.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    getAccounts(token, { search, page: 1, limit: 15 })
      .then((res) => { if (!cancelled) setResults(res.accounts || []); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, open, token]);

  const displayName = value?.accountName || '';

  const handleOpen = () => {
    setOpen(true);
    setSearch('');
    setResults([]);
  };

  const handleSelect = (account) => {
    onSelect({ _id: account._id || account.id, accountName: account.accountName || account.name || '' });
    setOpen(false);
    setSearch('');
    setResults([]);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
    setSearch('');
    setResults([]);
  };

  return (
    <View>
      {/* Trigger */}
      <Pressable
        style={[styles.dropTrigger, styles.dropTriggerLarge]}
        onPress={handleOpen}
      >
        <Ionicons
          name={displayName ? 'business' : 'business-outline'}
          size={15}
          color={displayName ? colors.primary : colors.textSecondary}
        />
        <Text style={[styles.dropTriggerText, !displayName && styles.dropTriggerPlaceholder, { flex: 1 }]}>
          {displayName || 'Click to select an account...'}
        </Text>
        {displayName ? (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        )}
      </Pressable>

      {/* Open panel */}
      {open && (
        <View style={styles.dropPanel}>
          {/* Search row */}
          <View style={styles.dropSearch}>
            <Ionicons name="search" size={13} color={colors.textSecondary} />
            <TextInput
              style={styles.dropSearchInput}
              placeholder="Type at least 2 characters to search..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {loading && <ActivityIndicator size={12} color={colors.primary} />}
            <Pressable onPress={() => { setOpen(false); setSearch(''); }}>
              <Ionicons name="close" size={15} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Results */}
          <ScrollView style={styles.dropList} keyboardShouldPersistTaps="handled">
            {search.length < 2 ? (
              <View style={styles.dropHint}>
                <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
                <Text style={styles.dropHintText}>Type at least 2 characters</Text>
              </View>
            ) : loading ? (
              <View style={styles.dropHint}>
                <ActivityIndicator size={13} color={colors.primary} />
                <Text style={styles.dropHintText}>Searching...</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.dropHint}>
                <Ionicons name="search-outline" size={15} color={colors.textMuted} />
                <Text style={styles.dropHintText}>No accounts found for "{search}"</Text>
              </View>
            ) : (
              results.map((a) => {
                const aid  = a._id || a.id;
                const name = a.accountName || a.name || '—';
                const type = a.accountType || '';
                const city = a.area || a.city || '';
                const isSelected = aid === value?._id;
                return (
                  <Pressable
                    key={aid}
                    style={[styles.dropItem, isSelected && styles.dropItemSelected]}
                    onPress={() => handleSelect(a)}
                  >
                    <View style={styles.acctDropIcon}>
                      <Ionicons name="business-outline" size={13} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dropItemText, isSelected && styles.dropItemTextSelected]}>
                        {name}
                      </Text>
                      {(type || city) ? (
                        <Text style={styles.dropItemSub}>
                          {[type, city].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={13} color={colors.primary} />}
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

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function FocOverrideFormScreen({
  navigation, route, userDetails, appMetadata, onSignOut,
}) {
  const mode         = route?.params?.mode || 'create';
  const existingData = route?.params?.existingData || null;
  const prefillAccId = route?.params?.accountId || null;

  const user  = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';

  /* ── Wizard step ── */
  const [step, setStep] = useState(1);

  /* ── Step 1: account ── */
  const [selectedAccount, setSelectedAccount] = useState(null); // { _id, accountName }

  /* ── Step 2: dates + entries ── */
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [entries,    setEntries]    = useState([
    { productId: '', overridePercentage: '', notes: '' },
  ]);
  const [products,        setProducts]        = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  /* ── Save state ── */
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');

  /* ── Validation errors ── */
  const [stepErrors, setStepErrors] = useState({});

  /* ── Prefill for edit mode ── */
  useEffect(() => {
    if (mode === 'edit' && existingData) {
      const acctId   = existingData.accountId?._id || existingData.accountId;
      const acctName = existingData.accountId?.accountName || '';
      setSelectedAccount({ _id: acctId, accountName: acctName });
      setStartDate(existingData.startDate ? existingData.startDate.slice(0, 10) : '');
      setEndDate(existingData.endDate   ? existingData.endDate.slice(0, 10)   : '');
      if (Array.isArray(existingData.overrides) && existingData.overrides.length > 0) {
        setEntries(existingData.overrides.map((e) => ({
          productId:          e.productId?._id || e.productId || '',
          overridePercentage: String(e.overridePercentage ?? ''),
          notes:              e.notes || '',
          _entryId:           e._id || e.id || '',
        })));
      }
    }
    // prefill account from AccountFormScreen shortcut
    if (prefillAccId && mode === 'create') {
      // We only have the ID; name resolved after accounts load
      setSelectedAccount({ _id: prefillAccId, accountName: '' });
    }
  }, []);

  /* ── Fetch products once ── */
  useEffect(() => {
    setProductsLoading(true);
    listProducts(token, { page: 1, limit: 200 })
      .then((res) => setProducts(res.products || []))
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, [token]);

  /* ── Entry helpers ── */
  const addEntry = () =>
    setEntries((prev) => [...prev, { productId: '', overridePercentage: '', notes: '' }]);

  const removeEntry = (i) =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const updateEntry = (i, field, value) =>
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  /* ── Validation ── */
  const validateStep1 = () => {
    if (!selectedAccount?._id) {
      setStepErrors({ account: 'Please select an account.' });
      return false;
    }
    setStepErrors({});
    return true;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!startDate) errs.startDate = 'Start date is required';
    if (!endDate)   errs.endDate   = 'End date is required';
    if (startDate && endDate && new Date(startDate) >= new Date(endDate))
      errs.endDate = 'End date must be after start date';
    const entryErrs = entries.map((e) => {
      const eErr = {};
      if (!e.productId)         eErr.productId = 'Select a product';
      if (!e.overridePercentage || isNaN(Number(e.overridePercentage)))
        eErr.overridePercentage = 'Valid % required';
      if (Number(e.overridePercentage) < 0)
        eErr.overridePercentage = 'Must be 0 or greater';
      return eErr;
    });
    const hasEntryErr = entryErrs.some((e) => Object.keys(e).length > 0);
    if (hasEntryErr) errs.entries = entryErrs;
    if (entries.length === 0) errs.noEntries = 'Add at least one product override.';
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Navigation between steps ── */
  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => s - 1);

  /* ── Save ── */
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const accountId = selectedAccount._id;
      const overrides = entries.map((e) => ({
        productId:          e.productId,
        overridePercentage: Number(e.overridePercentage),
        notes:              e.notes || undefined,
      }));

      if (mode === 'edit') {
        await replaceFocOverrides(token, accountId, startDate, endDate, overrides);
      } else {
        await createFocOverrides(token, accountId, startDate, endDate, overrides);
      }

      navigation.navigate('FocOverridesList');
    } catch (e) {
      setSaveError(e.message || 'Failed to save FOC override. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Product name helper ── */
  const productName = (pid) => {
    const p = products.find((x) => (x._id || x.id) === pid);
    return p ? (p.productName || p.name || '—') : '—';
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
      {/* ── Back + Title ─────────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <Pressable style={styles.backBtn} onPress={() => navigation.navigate('FocOverridesList')}>
          <Ionicons name="arrow-back" size={16} color={colors.primary} />
          <Text style={styles.backText}>FOC Overrides</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Text style={styles.pageTitle}>
            {mode === 'edit' ? 'Edit FOC Override' : 'New FOC Override'}
          </Text>
          <Text style={styles.pageSubtitle}>
            {mode === 'edit'
              ? 'Update validity period and product override entries'
              : 'Set up a free-of-charge discount override for an account'}
          </Text>
        </View>
      </View>

      {/* ── Step bar ─────────────────────────────────────────────────────── */}
      <StepBar step={step} />

      {/* ── Form card ────────────────────────────────────────────────────── */}
      <View style={styles.formCard}>

        {/* ════════════════════════ STEP 1 ══════════════════════════════ */}
        {step === 1 && (
          <View>
            <Text style={styles.sectionTitle}>Select Account</Text>
            <Text style={styles.sectionHint}>
              Search for the customer account this override applies to.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Account <Text style={styles.required}>*</Text></Text>

              <AccountPickerDropdown
                value={selectedAccount}
                token={token}
                onSelect={setSelectedAccount}
              />

              {/* Selected confirmation card */}
              {selectedAccount && (
                <View style={styles.selectedAcctCard}>
                  <Ionicons name="business" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedAcctName}>{selectedAccount.accountName}</Text>
                    <Text style={styles.selectedAcctId}>ID: {selectedAccount._id}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                </View>
              )}

              {stepErrors.account && (
                <Text style={styles.fieldError}>{stepErrors.account}</Text>
              )}
            </View>
          </View>
        )}

        {/* ════════════════════════ STEP 2 ══════════════════════════════ */}
        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>Products & FOC Percentages</Text>
            <Text style={styles.sectionHint}>
              Set the validity period and add one row per product override.
            </Text>

            {/* Validity period */}
            <View style={styles.validityCard}>
              <View style={styles.validityHeader}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={styles.validityTitle}>Validity Period</Text>
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>
                    Start Date <Text style={styles.required}>*</Text>
                  </Text>
                  <DateInput value={startDate} onChange={setStartDate} placeholder="YYYY-MM-DD" />
                  {stepErrors.startDate && (
                    <Text style={styles.fieldError}>{stepErrors.startDate}</Text>
                  )}
                </View>
                <View style={styles.dateSep}>
                  <Text style={styles.dateSepText}>→</Text>
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>
                    End Date <Text style={styles.required}>*</Text>
                  </Text>
                  <DateInput value={endDate} onChange={setEndDate} placeholder="YYYY-MM-DD" />
                  {stepErrors.endDate && (
                    <Text style={styles.fieldError}>{stepErrors.endDate}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Product entries */}
            <View style={styles.entriesSection}>
              <View style={styles.entriesHeader}>
                <Text style={styles.fieldLabel}>Product Override Entries</Text>
                <Pressable style={styles.addEntryBtn} onPress={addEntry}>
                  <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
                  <Text style={styles.addEntryText}>Add Product</Text>
                </Pressable>
              </View>

              {stepErrors.noEntries && (
                <Text style={styles.fieldError}>{stepErrors.noEntries}</Text>
              )}

              {/* Entry header row */}
              {entries.length > 0 && (
                <View style={styles.entryHeadRow}>
                  <Text style={[styles.entryHead, { flex: 3 }]}>Product</Text>
                  <Text style={[styles.entryHead, { flex: 1.5 }]}>FOC Override %</Text>
                  <Text style={[styles.entryHead, { flex: 2 }]}>Notes (optional)</Text>
                  <View style={{ width: 32 }} />
                </View>
              )}

              {productsLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading products...</Text>
                </View>
              ) : (
                entries.map((entry, i) => {
                  const entryErr = stepErrors.entries?.[i] || {};
                  return (
                    <View key={i} style={styles.entryRow}>
                      {/* Product picker */}
                      <View style={{ flex: 3, marginRight: 8 }}>
                        <ProductPickerDropdown
                          value={entry.productId}
                          products={products}
                          onSelect={(pid) => updateEntry(i, 'productId', pid)}
                          placeholder="Select product..."
                        />
                        {entryErr.productId && (
                          <Text style={styles.fieldError}>{entryErr.productId}</Text>
                        )}
                      </View>

                      {/* Override % */}
                      <View style={{ flex: 1.5, marginRight: 8 }}>
                        <View style={styles.percentWrap}>
                          <TextInput
                            style={styles.percentInput}
                            placeholder="e.g. 12.5"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={entry.overridePercentage}
                            onChangeText={(v) => updateEntry(i, 'overridePercentage', v)}
                          />
                          <Text style={styles.percentSuffix}>%</Text>
                        </View>
                        {entryErr.overridePercentage && (
                          <Text style={styles.fieldError}>{entryErr.overridePercentage}</Text>
                        )}
                      </View>

                      {/* Notes */}
                      <View style={{ flex: 2, marginRight: 8 }}>
                        <TextInput
                          style={styles.notesInput}
                          placeholder="Optional note..."
                          placeholderTextColor={colors.textMuted}
                          value={entry.notes}
                          onChangeText={(v) => updateEntry(i, 'notes', v)}
                        />
                      </View>

                      {/* Remove */}
                      <Pressable
                        style={styles.removeEntryBtn}
                        onPress={() => removeEntry(i)}
                        disabled={entries.length === 1}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={18}
                          color={entries.length === 1 ? colors.textMuted : colors.danger}
                        />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* ════════════════════════ STEP 3 ══════════════════════════════ */}
        {step === 3 && (
          <View>
            <Text style={styles.sectionTitle}>Review & Save</Text>
            <Text style={styles.sectionHint}>
              Confirm the details below before saving.
            </Text>

            {/* Summary card */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Ionicons name="business-outline" size={16} color={colors.primary} />
                <Text style={styles.reviewLabel}>Account</Text>
                <Text style={styles.reviewValue}>{selectedAccount?.accountName || '—'}</Text>
              </View>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.success} />
                <Text style={styles.reviewLabel}>Validity</Text>
                <Text style={styles.reviewValue}>
                  {fmtDate(startDate)} → {fmtDate(endDate)}
                </Text>
              </View>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewRow}>
                <Ionicons name="cube-outline" size={16} color={colors.warning} />
                <Text style={styles.reviewLabel}>Products</Text>
                <Text style={styles.reviewValue}>{entries.length} override{entries.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>

            {/* Entries table */}
            <View style={styles.reviewTable}>
              <View style={styles.reviewTableHead}>
                <Text style={[styles.reviewTh, { flex: 3 }]}>Product</Text>
                <Text style={[styles.reviewTh, { flex: 1.5 }]}>Override %</Text>
                <Text style={[styles.reviewTh, { flex: 2 }]}>Notes</Text>
              </View>
              {entries.map((e, i) => (
                <View key={i} style={[styles.reviewTableRow, i % 2 === 0 && { backgroundColor: colors.backgroundColor }]}>
                  <Text style={[styles.reviewTd, { flex: 3 }]}>{productName(e.productId)}</Text>
                  <View style={{ flex: 1.5 }}>
                    <View style={styles.overridePill}>
                      <Text style={styles.overridePillText}>{e.overridePercentage}%</Text>
                    </View>
                  </View>
                  <Text style={[styles.reviewTdMuted, { flex: 2 }]}>{e.notes || '—'}</Text>
                </View>
              ))}
            </View>

            {saveError ? (
              <View style={styles.saveErrorBanner}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                <Text style={styles.saveErrorText}>{saveError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Step navigation ────────────────────────────────────────────── */}
        <View style={styles.stepNav}>
          {step > 1 && (
            <Pressable style={styles.btnSecondary} onPress={goBack}>
              <Ionicons name="arrow-back" size={14} color={colors.textPrimary} />
              <Text style={styles.btnSecondaryText}>Back</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {step < 3 ? (
            <Pressable style={styles.btnPrimary} onPress={goNext}>
              <Text style={styles.btnPrimaryText}>Continue</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.white} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.btnPrimary, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size={14} color={colors.white} />
                : <Ionicons name="checkmark" size={14} color={colors.white} />
              }
              <Text style={styles.btnPrimaryText}>
                {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Override'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: globalHeight('1.5%'),
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: globalHeight('0.8%'),
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.primary,
    fontSize: globalWidth('0.72%'),
    fontWeight: '600',
  },
  headerRight: {},
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

  /* Step bar */
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: globalWidth('1.2%'),
    marginBottom: globalHeight('2%'),
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.5%'),
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepCircleCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stepCircleDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  stepNum: {
    fontSize: globalWidth('0.65%'),
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepNumCurrent: { color: colors.white },
  stepLabel: {
    fontSize: globalWidth('0.72%'),
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stepLabelCurrent: { color: colors.primary, fontWeight: '800' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: globalWidth('0.6%'),
  },
  stepLineDone: { backgroundColor: colors.success },

  /* Form card */
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: globalWidth('1.5%'),
    marginBottom: globalHeight('2%'),
  },
  sectionTitle: {
    fontSize: globalWidth('0.9%'),
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: globalHeight('0.5%'),
  },
  sectionHint: {
    fontSize: globalWidth('0.68%'),
    color: colors.textSecondary,
    marginBottom: globalHeight('1.5%'),
  },

  /* Account search */
  fieldGroup: { marginBottom: globalHeight('1.5%') },
  fieldLabel: {
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: globalHeight('0.5%'),
  },
  required: { color: colors.danger },
  fieldError: {
    fontSize: globalWidth('0.62%'),
    color: colors.danger,
    marginTop: 3,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.4%'),
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('0.6%'),
    height: globalHeight('4.4%'),
  },
  searchInput: {
    flex: 1,
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
    outlineStyle: 'none',
  },

  /* Dropdown */
  dropPanel: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: globalWidth('0.5%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropSearchInput: {
    flex: 1,
    fontSize: globalWidth('0.68%'),
    color: colors.textPrimary,
    outlineStyle: 'none',
  },
  dropList: { maxHeight: 200 },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: globalWidth('0.8%'),
    paddingVertical: globalHeight('1%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropItemSelected: { backgroundColor: colors.surfaceSoft },
  dropItemText: {
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
    fontWeight: '600',
  },
  dropItemTextSelected: { color: colors.primary },
  dropItemSub: {
    fontSize: globalWidth('0.6%'),
    color: colors.textSecondary,
    marginTop: 2,
  },
  dropEmpty: {
    fontSize: globalWidth('0.68%'),
    color: colors.textMuted,
    textAlign: 'center',
    padding: globalWidth('1%'),
  },

  /* Trigger for product dropdown */
  dropTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('0.6%'),
    height: globalHeight('4.4%'),
  },
  dropTriggerLarge: {
    height: globalHeight('5.6%'),
    paddingHorizontal: globalWidth('0.8%'),
    gap: globalWidth('0.5%'),
  },
  acctDropIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  dropHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: globalWidth('0.8%'),
    paddingVertical: globalHeight('1.2%'),
  },
  dropHintText: {
    fontSize: globalWidth('0.68%'),
    color: colors.textMuted,
  },
  dropTriggerText: {
    flex: 1,
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
  },
  dropTriggerPlaceholder: { color: colors.textMuted },

  /* Selected account card */
  selectedAcctCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.6%'),
    backgroundColor: colors.surfaceSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: globalWidth('0.8%'),
    marginTop: globalHeight('0.8%'),
  },
  selectedAcctName: {
    fontSize: globalWidth('0.78%'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectedAcctId: {
    fontSize: globalWidth('0.58%'),
    color: colors.textSecondary,
    marginTop: 2,
  },

  /* Validity card */
  validityCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: globalWidth('1%'),
    marginBottom: globalHeight('1.5%'),
  },
  validityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: globalHeight('1%'),
  },
  validityTitle: {
    fontSize: globalWidth('0.75%'),
    fontWeight: '700',
    color: colors.primary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: globalWidth('0.8%'),
  },
  dateField: { flex: 1 },
  dateSep: { paddingBottom: globalHeight('0.8%') },
  dateSepText: {
    fontSize: globalWidth('1%'),
    color: colors.textMuted,
    fontWeight: '800',
  },

  /* Entries section */
  entriesSection: { marginTop: globalHeight('0.5%') },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: globalHeight('0.8%'),
  },
  addEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addEntryText: {
    fontSize: globalWidth('0.68%'),
    fontWeight: '700',
    color: colors.primary,
  },
  entryHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: globalHeight('0.6%'),
    marginBottom: globalHeight('0.4%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryHead: {
    fontSize: globalWidth('0.6%'),
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: globalHeight('0.8%'),
  },
  percentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    height: globalHeight('4.4%'),
    paddingHorizontal: globalWidth('0.6%'),
  },
  percentInput: {
    flex: 1,
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
    outlineStyle: 'none',
  },
  percentSuffix: {
    fontSize: globalWidth('0.72%'),
    color: colors.textSecondary,
    fontWeight: '700',
  },
  notesInput: {
    height: globalHeight('4.4%'),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('0.6%'),
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
    backgroundColor: colors.inputBackground,
    outlineStyle: 'none',
  },
  removeEntryBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Review */
  reviewCard: {
    backgroundColor: colors.backgroundColor,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: globalWidth('1%'),
    marginBottom: globalHeight('1.5%'),
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.6%'),
    paddingVertical: globalHeight('0.6%'),
  },
  reviewLabel: {
    fontSize: globalWidth('0.68%'),
    color: colors.textSecondary,
    fontWeight: '600',
    width: globalWidth('6%'),
  },
  reviewValue: {
    flex: 1,
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
    fontWeight: '700',
  },
  reviewDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  reviewTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: globalHeight('1.5%'),
  },
  reviewTableHead: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundColor,
    paddingHorizontal: globalWidth('0.8%'),
    paddingVertical: globalHeight('0.8%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewTh: {
    fontSize: globalWidth('0.6%'),
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  reviewTableRow: {
    flexDirection: 'row',
    paddingHorizontal: globalWidth('0.8%'),
    paddingVertical: globalHeight('0.8%'),
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewTd: {
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
    fontWeight: '600',
  },
  reviewTdMuted: {
    fontSize: globalWidth('0.68%'),
    color: colors.textSecondary,
  },
  overridePill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  overridePillText: {
    fontSize: globalWidth('0.65%'),
    fontWeight: '800',
    color: '#059669',
  },

  /* Save error */
  saveErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: globalWidth('0.8%'),
  },
  saveErrorText: {
    flex: 1,
    fontSize: globalWidth('0.68%'),
    color: colors.danger,
  },

  /* Step navigation */
  stepNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: globalHeight('2%'),
    paddingTop: globalHeight('1.5%'),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: globalWidth('1.2%'),
    height: globalHeight('4.4%'),
  },
  btnPrimaryText: {
    color: colors.white,
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('1%'),
    height: globalHeight('4.4%'),
  },
  btnSecondaryText: {
    color: colors.textPrimary,
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
  },

  /* Misc */
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: globalHeight('2%'),
    gap: 8,
  },
  loadingText: {
    fontSize: globalWidth('0.72%'),
    color: colors.textSecondary,
  },
});
