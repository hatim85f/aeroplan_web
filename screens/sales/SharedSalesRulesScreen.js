import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import { listAreas } from '../../store/areas/areasActions';
import { listProducts } from '../../store/products/productActions';
import { recalculateSharedSales } from '../../store/sales/salesActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';
import {
  createSharedSalesRule,
  deleteSharedSalesRule,
  listSharedSalesRules,
  updateSharedSalesRule,
  updateSharedSalesRuleStatus,
} from '../../store/sharedSalesRules/sharedSalesRulesActions';

const PAD = globalWidth('1.2%');
const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const isManager = (role) => ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-');
const pickId = (item) => item?._id || item?.id || item?.productId || item?.channelId || '';
const pickRuleId = (rule) => rule?._id || rule?.id || rule?.ruleId || rule?.sharedSalesRuleId || '';
const labelOf = (obj, ...keys) => keys.map((k) => obj?.[k]).find(Boolean) || '-';
const productLabel = (product) => labelOf(product, 'productNickname', 'nickname', 'productName', 'name');
const CREATE_BATCH_SIZE = 10;
const makeEmptyForm = () => ({
  areaId: '', accountId: '', channelId: '', startDate: '', endDate: '', notes: '',
  status: 'active', applyChangeMode: 'future_only', effectiveFromDate: '',
});

function Badge({ status }) {
  const active = String(status || 'active') === 'active';
  return <View style={[styles.badge, { backgroundColor: active ? '#DCFCE7' : '#F1F5F9' }]}><Text style={[styles.badgeText, { color: active ? '#15803D' : '#64748B' }]}>{active ? 'Active' : 'Inactive'}</Text></View>;
}

function SelectBox({ label, value, options, onChange, placeholder, style }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.value) === String(value));
  return (
    <View style={[styles.selectWrap, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable style={styles.selectButton} onPress={() => setOpen((v) => !v)}>
        <Text style={[styles.selectText, !selected && styles.selectPlaceholder]} numberOfLines={1}>
          {selected?.label || placeholder || 'Select'}
        </Text>
        <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <ScrollView style={styles.selectList} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <Pressable
              key={String(opt.value)}
              style={[styles.selectOption, String(opt.value) === String(value) && styles.selectOptionSelected]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.selectOptionText, String(opt.value) === String(value) && styles.selectOptionActive]} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ProductMultiSelect({ products, selectedIds, onToggle, onSelectAll }) {
  const selected = new Set(selectedIds.map(String));
  const allSelected = products.length > 0 && selectedIds.length === products.length;
  return (
    <View style={styles.multiWrap}>
      <View style={styles.productListHeader}>
        <View>
          <Text style={styles.fieldLabel}>Products *</Text>
          <Text style={styles.productCountText}>{selectedIds.length} of {products.length} selected</Text>
        </View>
        <Pressable style={styles.btnMini} onPress={() => onSelectAll(!allSelected)}>
          <Ionicons name={allSelected ? 'remove-circle-outline' : 'checkmark-done-outline'} size={14} color={colors.primary} />
          <Text style={styles.btnMiniText}>{allSelected ? 'Clear All' : 'Select All'}</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.productScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {products.map((product) => {
          const id = pickId(product);
          const active = selected.has(String(id));
          return (
            <Pressable key={id} style={[styles.productListRow, active && styles.productListRowActive]} onPress={() => onToggle(id)}>
              <Ionicons name={active ? 'checkbox' : 'square-outline'} size={17} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.productListText, active && styles.productListTextActive]} numberOfLines={1}>{product.productName || product.name || product.productNickname || id}</Text>
              {product.productNickname ? <Text style={styles.productListMeta} numberOfLines={1}>{product.productNickname}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function SharedSalesRulesScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const manager = isManager(user.role);

  const [rules, setRules] = useState([]);
  const [areas, setAreas] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ areaId: '', accountId: '', productId: '', channelId: '', status: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formStep, setFormStep] = useState(1);
  const [form, setForm] = useState(makeEmptyForm());
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [itemShares, setItemShares] = useState({});
  const [saving, setSaving] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);
  const [selectedRules, setSelectedRules] = useState(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState('');
  const [saveProgress, setSaveProgress] = useState('');

  const areaOptions = [{ value: '', label: 'All areas' }, ...areas.map((a) => ({ value: pickId(a), label: a.areaName || a.name || a.areaCode || pickId(a) })).filter((o) => o.value)];
  const accountOptions = [{ value: '', label: 'All accounts' }, ...accounts.map((a) => ({ value: pickId(a), label: a.accountName || a.name || pickId(a) })).filter((o) => o.value)];
  const channelOptions = [{ value: '', label: 'No channel / all channels' }, ...channels.map((c) => ({ value: pickId(c), label: c.channelName || c.channelKey || c.name || pickId(c) })).filter((o) => o.value)];
  const productOptions = [{ value: '', label: 'All products' }, ...products.map((p) => ({ value: pickId(p), label: p.productName || p.name || p.productNickname || pickId(p) })).filter((o) => o.value)];

  const fetchRules = useCallback(async () => {
    setLoading(true); setError(''); setSelectedRules(new Set());
    try {
      const res = await listSharedSalesRules(token, { ...filters, page, limit: pagination.limit || 20 });
      setRules(res.rules);
      setPagination(res.pagination || { page, limit: pagination.limit || 20, total: res.rules.length, pages: 1 });
    } catch (e) {
      setError(e.message || 'Failed to load shared sales rules');
    } finally {
      setLoading(false);
    }
  }, [token, filters, page, pagination.limit]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  useEffect(() => {
    if (!token) return;
    listAreas(token, { status: 'active', limit: 500 }).then((r) => setAreas(r.areas || [])).catch(() => {});
    getAccounts(token, { limit: 1000 }).then((r) => setAccounts(r.accounts || r.data || [])).catch(() => {});
    listProducts(token, { limit: 1000, status: 'active' }).then((r) => setProducts(r.products || [])).catch(() => {});
    listSalesChannels(token, { status: 'active', limit: 500 }).then((r) => setChannels(r.channels || [])).catch(() => {});
  }, [token]);

  const openForm = (rule = null) => {
    const productId = rule?.productId?._id || rule?.productId || '';
    setEditing(rule);
    setForm(rule ? {
      areaId: rule.areaId?._id || rule.areaId || '',
      accountId: rule.accountId?._id || rule.accountId || '',
      channelId: rule.channelId?._id || rule.channelId || '',
      startDate: fmtDate(rule.startDate) === '-' ? '' : fmtDate(rule.startDate),
      endDate: fmtDate(rule.endDate) === '-' ? '' : fmtDate(rule.endDate),
      notes: rule.notes || '',
      status: rule.status || 'active',
      applyChangeMode: 'future_only',
      effectiveFromDate: '',
    } : makeEmptyForm());
    setSelectedProductIds(productId ? [productId] : []);
    setItemShares(productId ? { [productId]: { sharePercentage: String(rule?.sharePercentage ?? 0) } } : {});
    setFormStep(1);
    setShowForm(true);
  };

  const toggleProduct = (productId) => {
    setSelectedProductIds((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
      setItemShares((curr) => {
        const copy = { ...curr };
        if (exists) delete copy[productId];
        else copy[productId] = { sharePercentage: '0' };
        return copy;
      });
      return next;
    });
  };

  const setAllProductsSelected = (checked) => {
    if (!checked) {
      setSelectedProductIds([]);
      setItemShares({});
      return;
    }
    const ids = products.map(pickId).filter(Boolean);
    setSelectedProductIds(ids);
    setItemShares((prev) => ids.reduce((acc, id) => ({ ...acc, [id]: prev[id] || { sharePercentage: '0' } }), {}));
  };

  const updateItemShare = (productId, key, value) => {
    setItemShares((prev) => ({ ...prev, [productId]: { ...(prev[productId] || {}), [key]: value } }));
  };

  const goNext = () => {
    if (!form.areaId || !form.accountId) { alert('Area and account are required.'); return; }
    if (!editing && selectedProductIds.length === 0) { alert('Select at least one product.'); return; }
    setFormStep(2);
  };

  const saveRule = async () => {
    if (!form.areaId || !form.accountId) { alert('Area and account are required.'); return; }
    const ids = editing && selectedProductIds.length === 0 ? [''] : selectedProductIds;
    const invalid = ids.some((id) => {
      const pct = Number(itemShares[id]?.sharePercentage ?? 0);
      return Number.isNaN(pct) || pct < 0 || pct > 100;
    });
    if (invalid) { alert('Share percentages must be 0-100.'); return; }

    setSaving(true);
    setSaveProgress('');
    try {
      const base = {
        areaId: form.areaId,
        accountId: form.accountId,
        channelId: form.channelId || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        notes: form.notes.trim() || undefined,
        status: form.status,
        isActive: form.status === 'active',
        applyChangeMode: form.applyChangeMode,
        ...(editing && form.applyChangeMode === 'retrospective_from_date' ? { effectiveFromDate: form.effectiveFromDate } : {}),
      };
      const result = editing
        ? await updateSharedSalesRule(token, editing._id || editing.id, {
          ...base,
          productId: selectedProductIds[0] || undefined,
          channelId: base.channelId,
          sharePercentage: Number(itemShares[selectedProductIds[0]]?.sharePercentage ?? 0),
          notes: base.notes,
        })
        : await createRulesInBatches(base);
      if (result?.failedItems?.length || result?.summary || result?.recalculated != null || result?.updated != null) setRecalcResult(result);
      setShowForm(false);
      fetchRules();
    } catch (e) {
      alert(e.message || 'Save failed');
    } finally {
      setSaving(false);
      setSaveProgress('');
    }
  };

  const createRulesInBatches = async (base) => {
    const allItems = selectedProductIds.map((productId) => ({
      itemId: productId,
      sharePercentage: Number(itemShares[productId]?.sharePercentage ?? 0),
      channelId: form.channelId || undefined,
    }));
    const batches = [];
    for (let i = 0; i < allItems.length; i += CREATE_BATCH_SIZE) batches.push(allItems.slice(i, i + CREATE_BATCH_SIZE));

    const combined = { rules: [], failedItems: [], recalculations: [], summary: { total: allItems.length, createdCount: 0, failedCount: 0 } };
    for (let i = 0; i < batches.length; i += 1) {
      setSaveProgress(`Saving batch ${i + 1} of ${batches.length}...`);
      try {
        const result = await createSharedSalesRule(token, { ...base, items: batches[i] });
        if (Array.isArray(result?.rules)) combined.rules.push(...result.rules);
        if (Array.isArray(result?.failedItems)) combined.failedItems.push(...result.failedItems);
        if (Array.isArray(result?.recalculations)) combined.recalculations.push(...result.recalculations);
        combined.summary.createdCount += Number(result?.summary?.createdCount ?? result?.rules?.length ?? 0);
        combined.summary.failedCount += Number(result?.summary?.failedCount ?? result?.failedItems?.length ?? 0);
      } catch (e) {
        combined.failedItems.push(...batches[i].map((item) => ({ ...item, error: e.message || 'Request failed' })));
        combined.summary.failedCount += batches[i].length;
      }
    }
    return combined;
  };

  const allRuleIds = rules.map(pickRuleId).filter(Boolean);
  const allSelected = rules.length > 0 && selectedRules.size === rules.length;

  const toggleSelectAll = () => setSelectedRules(allSelected ? new Set() : new Set(allRuleIds));
  const toggleSelectRule = (id) => setSelectedRules((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const deleteRule = async (ruleId) => {
    if (!ruleId) { alert('Cannot delete: missing rule id'); return; }
    if (!window.confirm('Delete this rule?')) return;
    setDeletingBulk(true);
    setDeleteProgress('Deleting 1 rule...');
    try {
      await deleteSharedSalesRule(token, ruleId);
      setSelectedRules((prev) => {
        const next = new Set(prev);
        next.delete(ruleId);
        return next;
      });
      fetchRules();
    } catch (e) {
      alert(`Delete failed${e.status ? ` (${e.status})` : ''}: ${e.message || 'Unknown error'}`);
    } finally {
      setDeletingBulk(false);
      setDeleteProgress('');
    }
  };

  const deleteRuleIds = async (ids, label) => {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${label}? This will remove ${ids.length} rule${ids.length > 1 ? 's' : ''}.`)) return;
    setDeletingBulk(true);
    const failed = [];
    try {
      for (let i = 0; i < ids.length; i += 1) {
        setDeleteProgress(`Deleting ${i + 1} of ${ids.length}...`);
        try {
          await deleteSharedSalesRule(token, ids[i]);
        } catch (e) {
          failed.push({ id: ids[i], message: e.message || 'Delete failed', status: e.status });
        }
      }
      setSelectedRules(new Set());
      if (failed.length) alert(`${failed.length} delete request${failed.length > 1 ? 's' : ''} failed. First error: ${failed[0].status ? `(${failed[0].status}) ` : ''}${failed[0].message}`);
      fetchRules();
    } finally {
      setDeletingBulk(false);
      setDeleteProgress('');
    }
  };

  const deleteSelected = async () => deleteRuleIds([...selectedRules], 'selected rules');
  const deleteAllVisible = async () => deleteRuleIds(allRuleIds, 'all visible rules');

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setPage(1);
    fetchRules();
  };

  const toggleStatus = async (rule) => {
    const next = (rule.status || 'active') === 'active' ? 'inactive' : 'active';
    await updateSharedSalesRuleStatus(token, rule._id || rule.id, { status: next, isActive: next === 'active' });
    fetchRules();
  };

  const recalc = async () => {
    if (!window.confirm('This will recalculate area shares based on current shared sales rules. Continue?')) return;
    const result = await recalculateSharedSales(token, { areaId: filters.areaId || undefined });
    setRecalcResult(result);
  };

  if (!manager) {
    return <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesOverview"><View style={styles.centered}><Text style={styles.errorText}>Shared sales rules are manager/admin only.</Text></View></AppShell>;
  }

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SharedSalesRules" scrollable={false}>
      <View style={styles.container}>
        <View style={styles.pageHeader}>
          <View><Text style={styles.pageTitle}>Shared Sales Rules</Text><Text style={styles.pageSubtitle}>Define share percentages for shared accounts</Text></View>
          <View style={styles.headerActions}>
            {rules.length > 0 && (
              <Pressable style={styles.btnDangerOutline} onPress={deleteAllVisible} disabled={deletingBulk}>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.btnDangerOutlineText}>Delete All Visible</Text>
              </Pressable>
            )}
            {selectedRules.size > 0 && (
              <Pressable style={styles.btnDanger} onPress={deleteSelected} disabled={deletingBulk}>
                {deletingBulk ? <ActivityIndicator size={13} color="#fff" /> : <Ionicons name="trash-outline" size={14} color="#fff" />}
                <Text style={styles.btnDangerText}>Delete Selected ({selectedRules.size})</Text>
              </Pressable>
            )}
            <Pressable style={styles.btnOutline} onPress={recalc}><Ionicons name="refresh-outline" size={14} color={colors.primary} /><Text style={[styles.btnOutlineText, { color: colors.primary }]}>Recalculate</Text></Pressable>
            <Pressable style={styles.btnPrimary} onPress={() => openForm()}><Ionicons name="add-outline" size={14} color="#fff" /><Text style={styles.btnPrimaryText}>Add Rule</Text></Pressable>
          </View>
        </View>

        <View style={styles.toolbar}>
          <SelectBox value={filters.areaId}    onChange={(v) => updateFilter('areaId', v)}    options={areaOptions}    placeholder="All areas"    />
          <SelectBox value={filters.accountId} onChange={(v) => updateFilter('accountId', v)} options={accountOptions} placeholder="All accounts" />
          <SelectBox value={filters.productId} onChange={(v) => updateFilter('productId', v)} options={productOptions} placeholder="All products" />
          <SelectBox value={filters.channelId} onChange={(v) => updateFilter('channelId', v)} options={channelOptions} placeholder="All channels" />
          <Pressable style={styles.btnApply} onPress={applyFilters}><Text style={styles.btnApplyText}>Apply</Text></Pressable>
        </View>

        {recalcResult && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Result: {recalcResult.summary ? `${recalcResult.summary.createdCount ?? 0} created, ${recalcResult.summary.failedCount ?? 0} failed` : JSON.stringify(recalcResult)}
            </Text>
          </View>
        )}
        {deleteProgress ? <View style={styles.notice}><Text style={styles.noticeText}>{deleteProgress}</Text></View> : null}

        {showForm && (
          <View style={styles.formCard}>
            {/* Fixed header */}
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editing ? 'Edit Rule' : 'Add Rules'}</Text>
              <Text style={styles.stepPill}>Step {formStep} of 2</Text>
            </View>

            {/* Scrollable body */}
            <ScrollView style={styles.formBody} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {formStep === 1 ? (
                <View style={{ gap: 10 }}>
                  <View style={styles.formRow}>
                    <SelectBox label="Area *"          value={form.areaId}    onChange={(v) => setForm((p) => ({ ...p, areaId: v }))}    options={areaOptions.filter((o) => o.value)}    placeholder="Select area"      />
                    <SelectBox label="Account *"       value={form.accountId} onChange={(v) => setForm((p) => ({ ...p, accountId: v }))} options={accountOptions.filter((o) => o.value)} placeholder="Select account"   />
                    <SelectBox label="Default Channel" value={form.channelId} onChange={(v) => setForm((p) => ({ ...p, channelId: v }))} options={channelOptions}                        placeholder="Optional channel"  />
                  </View>
                  <View style={styles.formRow}>
                    <TextInput style={styles.input} value={form.startDate} onChangeText={(v) => setForm((p) => ({ ...p, startDate: v }))} placeholder="Start date YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
                    <TextInput style={styles.input} value={form.endDate} onChangeText={(v) => setForm((p) => ({ ...p, endDate: v }))} placeholder="End date YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
                  </View>
                  <TextInput style={styles.input} value={form.notes} onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))} placeholder="Notes" placeholderTextColor={colors.textMuted} />
                  {!editing && <ProductMultiSelect products={products} selectedIds={selectedProductIds} onToggle={toggleProduct} onSelectAll={setAllProductsSelected} />}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <View style={styles.shareIntroBox}>
                    <Text style={styles.helperText}>Enter the share percentage for each selected product.</Text>
                    <Text style={styles.shareIntroMeta}>Channel applied to all rules: {channelOptions.find((o) => String(o.value) === String(form.channelId))?.label || 'No channel / all channels'}</Text>
                  </View>
                  <View style={styles.shareTable}>
                    <View style={styles.shareTableHead}>
                      <Text style={[styles.shareTh, { flex: 3 }]}>Product</Text>
                      <Text style={[styles.shareTh, { flex: 1 }]}>Share %</Text>
                    </View>
                    {selectedProductIds.map((productId) => {
                      const product = products.find((p) => String(pickId(p)) === String(productId));
                      const item = itemShares[productId] || {};
                      return (
                        <View key={productId} style={styles.shareRow}>
                          <View style={{ flex: 3, paddingRight: 10 }}>
                            <Text style={styles.shareProductName} numberOfLines={1}>{product?.productName || product?.name || productId}</Text>
                            {product?.productNickname ? <Text style={styles.shareProductMeta} numberOfLines={1}>{product.productNickname}</Text> : null}
                          </View>
                          <View style={styles.shareInputWrap}>
                            <TextInput
                              style={styles.shareInput}
                              value={item.sharePercentage}
                              onChangeText={(v) => updateItemShare(productId, 'sharePercentage', v)}
                              placeholder="0"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numeric"
                            />
                            <Text style={styles.percentSymbol}>%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  {editing && (
                    <View style={styles.applyBox}>
                      <Text style={styles.formTitle}>Apply Change Mode</Text>
                      <Text style={styles.warnText}>Retrospective changes may recalculate previous sales records.</Text>
                      {['future_only', 'retrospective_from_date', 'all_existing'].map((mode) => (
                        <Pressable key={mode} style={styles.radioRow} onPress={() => setForm((p) => ({ ...p, applyChangeMode: mode }))}>
                          <View style={[styles.radio, form.applyChangeMode === mode && styles.radioOn]} />
                          <Text style={styles.radioText}>{mode.replace(/_/g, ' ')}</Text>
                        </Pressable>
                      ))}
                      {form.applyChangeMode === 'retrospective_from_date' && (
                        <TextInput style={styles.input} value={form.effectiveFromDate} onChangeText={(v) => setForm((p) => ({ ...p, effectiveFromDate: v }))} placeholder="Effective from date YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Fixed footer */}
            <View style={styles.formActions}>
              <Pressable style={styles.btnSecondary} onPress={() => { formStep === 1 ? setShowForm(false) : setFormStep(1); }}>
                <Text style={styles.btnSecondaryText}>{formStep === 1 ? 'Cancel' : 'Back'}</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={formStep === 1 ? goNext : saveRule} disabled={saving}>
                {saving ? <ActivityIndicator size={13} color="#fff" /> : null}
                <Text style={styles.btnPrimaryText}>{formStep === 1 ? 'Next' : 'Save Rules'}</Text>
              </Pressable>
            </View>
            {saveProgress ? <Text style={styles.progressText}>{saveProgress}</Text> : null}
          </View>
        )}

        {loading ? <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View> : error ? <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View> : (
          <View style={styles.tableWrap}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={styles.tblHead}>
                <Pressable style={styles.tblCheckCell} onPress={toggleSelectAll}>
                  <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={16} color={colors.primary} />
                </Pressable>
                <Text style={[styles.tblTh, styles.colArea]}>Area</Text>
                <Text style={[styles.tblTh, styles.colAccount]}>Account</Text>
                <Text style={[styles.tblTh, styles.colProduct]}>Product</Text>
                <Text style={[styles.tblTh, styles.colChannel]}>Channel</Text>
                <Text style={[styles.tblTh, styles.colShare]}>Share %</Text>
                <Text style={[styles.tblTh, styles.colDate]}>Start</Text>
                <Text style={[styles.tblTh, styles.colDate]}>End</Text>
                <Text style={[styles.tblTh, styles.colStatus]}>Status</Text>
                <Text style={[styles.tblTh, styles.colActions]}>Actions</Text>
              </View>
              {rules.map((r) => {
                const ruleId = pickRuleId(r);
                const checked = selectedRules.has(ruleId);
                return (
                  <View key={ruleId} style={[styles.tblRow, checked && styles.tblRowSelected]}>
                    <Pressable style={styles.tblCheckCell} onPress={() => toggleSelectRule(ruleId)}>
                      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={16} color={checked ? colors.primary : colors.textMuted} />
                    </Pressable>
                    <Text style={[styles.tblTd, styles.colArea]} numberOfLines={1}>{labelOf(r.areaId, 'areaName', 'name') || r.areaName}</Text>
                    <Text style={[styles.tblTd, styles.colAccount]} numberOfLines={1}>{labelOf(r.accountId, 'accountName', 'name') || r.accountName}</Text>
                    <Text style={[styles.tblTd, styles.colProduct, styles.productNickCell]} numberOfLines={1}>{productLabel(r.productId) || '-'}</Text>
                    <Text style={[styles.tblTd, styles.colChannel]} numberOfLines={1}>{labelOf(r.channelId, 'channelKey', 'channelName') || '-'}</Text>
                    <Text style={[styles.tblTd, styles.colShare]}>{r.sharePercentage ?? 0}%</Text>
                    <Text style={[styles.tblTd, styles.colDate]}>{fmtDate(r.startDate)}</Text>
                    <Text style={[styles.tblTd, styles.colDate]}>{fmtDate(r.endDate)}</Text>
                    <View style={[styles.tblTd, styles.colStatus]}><Badge status={r.status} /></View>
                    <View style={[styles.tblTd, styles.colActions, styles.actions]}>
                      <Pressable onPress={() => openForm(r)}><Ionicons name="create-outline" size={15} color={colors.primary} /></Pressable>
                      <Pressable onPress={() => toggleStatus(r)}><Ionicons name="swap-horizontal-outline" size={15} color={colors.textSecondary} /></Pressable>
                      <Pressable onPress={() => deleteRule(ruleId)} disabled={deletingBulk}><Ionicons name="trash-outline" size={15} color={colors.danger} /></Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.paginationBar}>
              <Text style={styles.paginationText}>
                Page {pagination.page || page} of {pagination.pages || 1} · {pagination.total || 0} rules
              </Text>
              <View style={styles.paginationActions}>
                <Pressable style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>Previous</Text>
                </Pressable>
                <Pressable style={[styles.pageBtn, page >= (pagination.pages || 1) && styles.pageBtnDisabled]} onPress={() => setPage((p) => Math.min(pagination.pages || 1, p + 1))} disabled={page >= (pagination.pages || 1)}>
                  <Text style={[styles.pageBtnText, page >= (pagination.pages || 1) && styles.pageBtnTextDisabled]}>Next</Text>
                </Pressable>
              </View>
            </View>
          </View>
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
  headerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toolbar: { flexDirection: 'row', gap: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, ...shadow },
  formCard: { maxHeight: '65%', borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, ...shadow, flexDirection: 'column' },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  formBody: { flex: 1, padding: 14 },
  formTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  stepPill: { fontSize: 11, fontWeight: '800', color: colors.primary, backgroundColor: colors.primary + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  formRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' },
  input: { flex: 1, minWidth: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: colors.textPrimary },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
  selectWrap: { flex: 1, minWidth: 180, gap: 4 },
  selectButton: { minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.surface },
  selectText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  selectPlaceholder: { color: colors.textMuted, fontWeight: '500' },
  selectList: { maxHeight: 200, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, ...shadow },
  selectOption: { paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  selectOptionSelected: { backgroundColor: colors.primary + '0D' },
  selectOptionText: { fontSize: 13, color: colors.textPrimary },
  selectOptionActive: { color: colors.primary, fontWeight: '800' },
  multiWrap: { gap: 8 },
  productListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  productCountText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  productScroll: { maxHeight: 260, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface },
  productListRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  productListRowActive: { backgroundColor: colors.primary + '0A' },
  productListText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  productListTextActive: { color: colors.primary, fontWeight: '800' },
  productListMeta: { maxWidth: 160, fontSize: 11, color: colors.textMuted },
  btnMini: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  btnMiniText: { fontSize: 12, color: colors.primary, fontWeight: '800' },
  helperText: { fontSize: 12, color: colors.textSecondary },
  shareIntroBox: { gap: 3, padding: 10, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, backgroundColor: '#EFF6FF' },
  shareIntroMeta: { fontSize: 12, color: '#1D4ED8', fontWeight: '700' },
  shareTable: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
  shareTableHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '0C', paddingHorizontal: 10, paddingVertical: 8 },
  shareTh: { fontSize: 11, color: colors.primary, fontWeight: '900', textTransform: 'uppercase' },
  shareRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  shareProductName: { fontSize: 13, color: colors.textPrimary, fontWeight: '700' },
  shareProductMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  shareInputWrap: { flex: 1, maxWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareInput: { flex: 1, minWidth: 70, borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7, color: colors.textPrimary, textAlign: 'right' },
  percentSymbol: { fontSize: 13, color: colors.textSecondary, fontWeight: '800' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  progressText: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 12, color: colors.primary, fontWeight: '700', textAlign: 'right' },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnSecondary: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnSecondaryText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  btnApply: { backgroundColor: colors.primary, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  btnApplyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  notice: { padding: 10, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  noticeText: { fontSize: 12, color: '#1D4ED8' },
  applyBox: { gap: 8, padding: 10, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', borderRadius: 8 },
  warnText: { fontSize: 12, color: '#92400E', fontWeight: '700' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  radioText: { fontSize: 13, color: colors.textPrimary },
  tableWrap: { flex: 1, minHeight: 0 },
  tblHead: { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center' },
  tblTh: { fontSize: 11, fontWeight: '800', color: colors.primary, paddingRight: 6 },
  tblRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tblRowSelected: { backgroundColor: colors.primary + '08' },
  tblTd: { fontSize: 12, color: colors.textPrimary, paddingRight: 6 },
  tblCheckCell: { width: 28, alignItems: 'center', justifyContent: 'center', paddingRight: 4 },
  colArea: { flex: 1.15, minWidth: 90 },
  colAccount: { flex: 1.5, minWidth: 130 },
  colProduct: { flex: 0.95, minWidth: 84 },
  colChannel: { flex: 0.8, minWidth: 76 },
  colShare: { flex: 0.55, minWidth: 58 },
  colDate: { flex: 0.75, minWidth: 74 },
  colStatus: { flex: 0.65, minWidth: 70 },
  colActions: { flex: 0.65, minWidth: 68 },
  productNickCell: { fontWeight: '800', color: colors.primary },
  actions: { flexDirection: 'row', gap: 10 },
  paginationBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 10, flexWrap: 'wrap' },
  paginationText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  paginationActions: { flexDirection: 'row', gap: 8 },
  pageBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.surface },
  pageBtnDisabled: { borderColor: colors.border, opacity: 0.55 },
  pageBtnText: { fontSize: 12, color: colors.primary, fontWeight: '800' },
  pageBtnTextDisabled: { color: colors.textMuted },
  btnDanger: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.danger, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnDangerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnDangerOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.danger, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnDangerOutlineText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errorText: { color: colors.danger, fontSize: 14 },
});
