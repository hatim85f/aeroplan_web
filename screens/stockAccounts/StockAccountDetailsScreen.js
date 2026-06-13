import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import { listProducts } from '../../store/products/productActions';
import {
  addLinkedAccounts,
  createStockUpdate,
  deleteStockAccount,
  getStockAccountDetails,
  getStockHistory,
  recalculateSalesInflow,
  removeLinkedAccount,
} from '../../store/stockAccounts/stockAccountActions';
import { MovementBadge } from './StockAccountsScreen';

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const fmtN = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtSigned = (value) => {
  const n = Number(value) || 0;
  return `${n > 0 ? '+' : ''}${fmtN(n)}`;
};
const fmtDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const getId = (item = {}) => String(item._id || item.id || '');
const getAccountName = (account = {}) => account.accountName || account.name || 'Account';
const getProductLabel = (product = {}) => product.productNickname || product.productName || product.name || 'Product';

const movementColor = (qty) => {
  const n = Number(qty) || 0;
  if (n < 0) return '#DC2626';
  if (n > 0) return '#15803D';
  return colors.textMuted;
};

const EMPTY_ITEM = () => ({ productId: '', currentStock: '', adjustmentQuantity: '', adjustmentNote: '', notes: '', open: false, search: '' });

export default function StockAccountDetailsScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManager(user.role || '');
  const stockAccountId = route?.params?.stockAccountId;

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('latest'); // 'latest' | 'history'

  /* History */
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* Update stock modal */
  const [showUpdate, setShowUpdate] = useState(false);
  const [products, setProducts] = useState([]);
  const [updateItems, setUpdateItems] = useState([EMPTY_ITEM()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [recalculating, setRecalculating] = useState(false);

  /* Linked accounts modal */
  const [showLink, setShowLink] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkIds, setLinkIds] = useState([]);
  const [linkSaving, setLinkSaving] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!token || !stockAccountId) return;
    try {
      setLoading(true);
      setError('');
      const data = await getStockAccountDetails(token, stockAccountId);
      setDetails(data);
    } catch (err) {
      setError(err.message || 'Failed to load stock account.');
    } finally {
      setLoading(false);
    }
  }, [stockAccountId, token]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  useEffect(() => {
    if (!token) return;
    listProducts(token, { limit: 500 })
      .then((result) => {
        const list = Array.isArray(result?.products) ? result.products
          : Array.isArray(result?.data) ? result.data
          : Array.isArray(result) ? result : [];
        setProducts(list);
      })
      .catch(() => setProducts([]));
    getAccounts(token, { page: 1, limit: 1000 })
      .then((result) => {
        const list = Array.isArray(result?.accounts) ? result.accounts
          : Array.isArray(result?.data) ? result.data
          : Array.isArray(result) ? result : [];
        setAccounts(list);
      })
      .catch(() => setAccounts([]));
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token || !stockAccountId) return;
    try {
      setHistoryLoading(true);
      const data = await getStockHistory(token, stockAccountId);
      setHistory(data);
    } catch { /* surfaced via empty state */ } finally {
      setHistoryLoading(false);
    }
  }, [stockAccountId, token]);

  useEffect(() => { if (view === 'history') loadHistory(); }, [view, loadHistory]);

  const stockAccount = details?.stockAccount;
  const summary = details?.summary;
  const latest = useMemo(() => details?.latest || [], [details]);
  const linkedAccounts = stockAccount?.linkedAccounts || [];

  /* ── Update stock helpers ── */
  const setItem = (index, patch) => {
    setUpdateItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const productOptions = useMemo(() => products.map((product) => ({
    value: getId(product), label: getProductLabel(product),
  })), [products]);

  const saveUpdate = async () => {
    setFormError('');
    const rows = updateItems.filter((item) => item.productId || String(item.currentStock).trim());

    if (!rows.length) { setFormError('Add at least one product.'); return; }

    const seen = new Set();
    for (const row of rows) {
      if (!row.productId) { setFormError('Product is required for every row.'); return; }
      if (seen.has(row.productId)) { setFormError('Product already added in this update.'); return; }
      seen.add(row.productId);
      const stock = Number(row.currentStock);
      if (!String(row.currentStock).trim() || !Number.isFinite(stock)) { setFormError('Current stock is required for every row.'); return; }
      if (stock < 0) { setFormError('Current stock cannot be negative.'); return; }
      const adj = Number(row.adjustmentQuantity || 0);
      if (!Number.isFinite(adj)) { setFormError('Adjustment must be a number.'); return; }
      if (adj !== 0 && !row.adjustmentNote.trim()) { setFormError('Adjustment note is required when an adjustment is entered.'); return; }
    }

    try {
      setSaving(true);
      await createStockUpdate(token, stockAccountId, rows.map((row) => ({
        productId: row.productId,
        currentStock: Number(row.currentStock),
        adjustmentQuantity: Number(row.adjustmentQuantity || 0) || 0,
        adjustmentNote: row.adjustmentNote.trim() || undefined,
        notes: row.notes.trim() || undefined,
      })));
      setShowUpdate(false);
      setUpdateItems([EMPTY_ITEM()]);
      await fetchDetails();
      if (view === 'history') await loadHistory();
    } catch (err) {
      setFormError(err.message || 'Failed to save stock update.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Linked accounts helpers ── */
  const linkedIdSet = useMemo(() => new Set(linkedAccounts.map((entry) => String(entry.accountId))), [linkedAccounts]);
  const linkCandidates = useMemo(() => {
    const query = linkSearch.trim().toLowerCase();
    return accounts
      .filter((account) => !linkedIdSet.has(getId(account)))
      .filter((account) => !query || getAccountName(account).toLowerCase().includes(query))
      .slice(0, 60);
  }, [accounts, linkSearch, linkedIdSet]);

  const saveLinks = async () => {
    if (!linkIds.length) { setShowLink(false); return; }
    try {
      setLinkSaving(true);
      await addLinkedAccounts(token, stockAccountId, linkIds);
      setShowLink(false);
      setLinkIds([]);
      await fetchDetails();
    } catch (err) {
      window.alert(err.message || 'Failed to update linked accounts.');
    } finally {
      setLinkSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!window.confirm('Recalculate “Added from Sales” for the latest stock from uploaded sales? Use this after a monthly sales upload.')) return;
    try {
      setRecalculating(true);
      const result = await recalculateSalesInflow(token, stockAccountId);
      await fetchDetails();
      if (view === 'history') await loadHistory();
      window.alert(`Recalculation complete. ${result?.recalculated ?? 0} item(s) updated.`);
    } catch (err) {
      window.alert(err.message || 'Failed to recalculate sales inflow.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleDeleteStockAccount = async () => {
    if (!window.confirm(`Delete stock account "${stockAccount?.accountName}"? Its stock history is kept but it will no longer appear in the list.`)) return;
    try {
      await deleteStockAccount(token, stockAccountId);
      navigation.navigate('StockAccounts');
    } catch (err) {
      window.alert(err.message || 'Failed to delete stock account.');
    }
  };

  const unlink = async (accountId, accountName) => {
    if (!window.confirm(`Remove "${accountName}" from this stock account? Its sales will no longer feed this stock.`)) return;
    try {
      await removeLinkedAccount(token, stockAccountId, accountId);
      await fetchDetails();
    } catch (err) {
      window.alert(err.message || 'Failed to remove linked account.');
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="StockAccounts">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backBtn} onPress={() => navigation.navigate('StockAccounts')}>
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>{stockAccount?.accountName || 'Stock Account'}</Text>
              <Text style={styles.pageSubtitle}>
                {linkedAccounts.length
                  ? `${linkedAccounts.length} linked account${linkedAccounts.length === 1 ? '' : 's'} feeding this stock`
                  : 'No linked accounts yet'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {manager ? (
              <Pressable style={styles.btnOutline} onPress={() => { setLinkIds([]); setShowLink(true); }}>
                <Ionicons name="link-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.btnOutlineText}>Add Linked Account</Text>
              </Pressable>
            ) : null}
            {manager ? (
              <Pressable style={[styles.btnOutline, recalculating && { opacity: 0.6 }]} onPress={handleRecalculate} disabled={recalculating}>
                <Ionicons name={recalculating ? 'sync-outline' : 'refresh-outline'} size={14} color={colors.textSecondary} />
                <Text style={styles.btnOutlineText}>{recalculating ? 'Recalculating…' : 'Recalculate Sales Inflow'}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.btnOutline} onPress={() => setView(view === 'history' ? 'latest' : 'history')}>
              <Ionicons name={view === 'history' ? 'list-outline' : 'time-outline'} size={14} color={colors.textSecondary} />
              <Text style={styles.btnOutlineText}>{view === 'history' ? 'Latest Stock' : 'View History'}</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={() => { setUpdateItems([EMPTY_ITEM()]); setFormError(''); setShowUpdate(true); }}>
              <Ionicons name="create-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Update Stock</Text>
            </Pressable>
            {manager ? (
              <Pressable style={styles.btnDanger} onPress={handleDeleteStockAccount}>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchDetails}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
          </View>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <View style={styles.statsRow}>
              <SummaryCard icon="cube-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Items Tracked" value={fmtN(summary?.itemsCount)} accent={colors.accents.blue} />
              <SummaryCard icon="time-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="Last Updated" value={fmtDateTime(summary?.lastUpdatedAt)} small accent={colors.accents.teal} />
              <SummaryCard icon="person-outline" iconColor="#15803D" iconBg="#F0FDF4" label="Updated By" value={summary?.lastUpdatedBy || '—'} small accent={colors.accents.rose} />
              <SummaryCard icon="trending-down-outline" iconColor="#DC2626" iconBg="#FEF2F2" label="Negative Movement" value={fmtN(summary?.negativeMovementCount)} accent={colors.accents.amber} />
              <SummaryCard icon="cart-outline" iconColor="#B45309" iconBg="#FFFBEB" label="Added from Sales" value={fmtSigned(summary?.addedFromSalesTotal)} accent={colors.accents.purple} />
            </View>

            {/* ── Linked accounts ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="git-network-outline" size={15} color={colors.primary} />
                  <Text style={styles.cardTitle}>Linked Accounts</Text>
                  <View style={styles.countPill}><Text style={styles.countPillText}>{linkedAccounts.length}</Text></View>
                </View>
                {manager ? (
                  <Pressable style={styles.btnOutlineSm} onPress={() => { setLinkIds([]); setShowLink(true); }}>
                    <Ionicons name="add" size={13} color={colors.primary} />
                    <Text style={[styles.btnOutlineSmText, { color: colors.primary }]}>Add</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.linkHint}>Uploaded sales from these accounts feed this stock&apos;s “Added from Sales”.</Text>
              {linkedAccounts.length ? (
                <View style={styles.linkGrid}>
                  {linkedAccounts.map((entry) => (
                    <View key={String(entry.accountId)} style={styles.linkPill}>
                      <View style={styles.linkPillDot} />
                      <Text style={styles.linkPillText} numberOfLines={1}>{entry.accountName}</Text>
                      {manager ? (
                        <Pressable style={styles.linkPillRemove} onPress={() => unlink(entry.accountId, entry.accountName)}>
                          <Ionicons name="close" size={12} color={colors.textMuted} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.linkEmpty}>
                  <Ionicons name="link-outline" size={22} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No linked accounts yet.{manager ? ' Use “Add” to connect sales accounts.' : ''}</Text>
                </View>
              )}
            </View>

            {view === 'latest' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Latest Stock</Text>
                  <MovementBadge status={summary?.movementStatus || 'no_movement_yet'} />
                </View>
                <View style={styles.tblHead}>
                  <Text style={[styles.tblTh, { flex: 1.8 }]}>PRODUCT</Text>
                  <Text style={[styles.tblThNum, { flex: 0.9 }]}>CURRENT</Text>
                  <Text style={[styles.tblThNum, { flex: 1 }]}>ADDED FROM SALES</Text>
                  <Text style={[styles.tblThNum, { flex: 0.9 }]}>ADJUSTMENT</Text>
                  <Text style={[styles.tblThNum, { flex: 0.9 }]}>EXPECTED</Text>
                  <Text style={[styles.tblThNum, { flex: 0.9 }]}>MOVEMENT</Text>
                  <Text style={[styles.tblTh, { flex: 1.2 }]}>LAST UPDATED</Text>
                  <Text style={[styles.tblTh, { flex: 1.4 }]}>NOTES</Text>
                </View>
                {!latest.length ? (
                  <Text style={styles.emptyText}>No stock added yet. Use “Update Stock” to enter the first counts.</Text>
                ) : latest.map((item, index) => (
                  <View key={String(item.productId)} style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}>
                    <Text style={[styles.tblTdStrong, { flex: 1.8 }]} numberOfLines={1}>{item.productNickname || item.productName}</Text>
                    <Text style={[styles.tblTdNum, { flex: 0.9, fontWeight: '800' }]}>{fmtN(item.currentStock)}</Text>
                    <Text style={[styles.tblTdNum, { flex: 1, color: '#15803D' }]}>{fmtSigned(item.addedFromSales)}</Text>
                    <View style={[{ flex: 0.9, alignItems: 'flex-end' }]}>
                      <Text style={[styles.tblTdNum, item.adjustmentQuantity ? { color: '#B45309' } : null]}>{item.adjustmentQuantity ? fmtSigned(item.adjustmentQuantity) : '—'}</Text>
                      {item.adjustmentNote ? <Text style={styles.adjNote} numberOfLines={1}>{item.adjustmentNote}</Text> : null}
                    </View>
                    <Text style={[styles.tblTdNum, { flex: 0.9 }]}>{fmtN(item.expectedStock)}</Text>
                    <Text style={[styles.tblTdNum, { flex: 0.9, fontWeight: '800', color: movementColor(item.movementQty) }]}>{fmtSigned(item.movementQty)}</Text>
                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.tblTd}>{fmtDateTime(item.lastUpdatedAt)}</Text>
                      <Text style={styles.subText} numberOfLines={1}>{item.lastUpdatedBy}</Text>
                    </View>
                    <Text style={[styles.tblTd, { flex: 1.4 }]} numberOfLines={2}>{item.notes || '—'}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Stock History</Text>
                  <Text style={styles.cardMeta}>{history.length} update{history.length === 1 ? '' : 's'}</Text>
                </View>
                {historyLoading ? (
                  <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
                ) : !history.length ? (
                  <Text style={styles.emptyText}>No history yet.</Text>
                ) : history.map((update) => (
                  <View key={String(update.updateId)} style={styles.historyBlock}>
                    <View style={styles.historyHeader}>
                      <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.historyDate}>{fmtDateTime(update.updateDate)}</Text>
                      <Text style={styles.historyBy}>by {update.updatedByName || '—'}</Text>
                    </View>
                    {(update.items || []).map((item, index) => (
                      <View key={`${String(item.productId)}-${index}`} style={styles.historyRow}>
                        <Text style={[styles.tblTdStrong, { flex: 1.6 }]} numberOfLines={1}>{item.productNickname || item.productName}</Text>
                        <Text style={[styles.tblTdNum, { flex: 0.8 }]}>Cur {fmtN(item.currentStock)}</Text>
                        <Text style={[styles.tblTdNum, { flex: 0.8 }]}>Prev {fmtN(item.previousStock)}</Text>
                        <Text style={[styles.tblTdNum, { flex: 0.9, color: '#15803D' }]}>Sales {fmtSigned(item.addedFromSales)}</Text>
                        <Text style={[styles.tblTdNum, { flex: 0.8, color: '#B45309' }]}>{item.adjustmentQuantity ? `Adj ${fmtSigned(item.adjustmentQuantity)}` : '—'}</Text>
                        <Text style={[styles.tblTdNum, { flex: 0.9, fontWeight: '800', color: movementColor(item.movementQty) }]}>Mov {fmtSigned(item.movementQty)}</Text>
                        <Text style={[styles.tblTd, { flex: 1.4 }]} numberOfLines={1}>{item.adjustmentNote || item.notes || '—'}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Update Stock modal ── */}
      {showUpdate && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons name="create-outline" size={22} color={colors.primary} />
              <Text style={styles.modalTitle}>Update Stock — {stockAccount?.accountName}</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setShowUpdate(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.helperText}>Enter the current stock you count. “Added from Sales” and movement are calculated automatically.</Text>

            <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
              {updateItems.map((item, index) => {
                const selected = productOptions.find((option) => option.value === item.productId);
                const filtered = productOptions.filter((option) =>
                  !item.search || option.label.toLowerCase().includes(item.search.toLowerCase()));
                return (
                  <View key={index} style={[styles.updateRow, { zIndex: 50 - index }]}>
                    <View style={styles.updateRowTop}>
                      <View style={{ flex: 1.6, zIndex: 50 - index }}>
                        <Pressable style={styles.input} onPress={() => setItem(index, { open: !item.open })}>
                          <Text style={selected ? styles.inputText : styles.inputPlaceholder} numberOfLines={1}>
                            {selected ? selected.label : 'Select product'}
                          </Text>
                          <Ionicons name={item.open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
                        </Pressable>
                        {item.open && (
                          <View style={styles.dropdown}>
                            <TextInput
                              value={item.search}
                              onChangeText={(t) => setItem(index, { search: t })}
                              placeholder="Search products"
                              placeholderTextColor={colors.textMuted}
                              style={styles.dropdownSearch}
                            />
                            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                              {filtered.slice(0, 60).map((option) => (
                                <Pressable
                                  key={option.value}
                                  style={styles.dropdownOpt}
                                  onPress={() => setItem(index, { productId: option.value, open: false })}
                                >
                                  <Text style={styles.dropdownOptText}>{option.label}</Text>
                                </Pressable>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                      <TextInput
                        value={String(item.currentStock)}
                        onChangeText={(t) => setItem(index, { currentStock: t })}
                        placeholder="Current stock"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        style={[styles.input, styles.numInput]}
                      />
                      <TextInput
                        value={String(item.adjustmentQuantity)}
                        onChangeText={(t) => setItem(index, { adjustmentQuantity: t })}
                        placeholder="Adjustment ±"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        style={[styles.input, styles.numInput]}
                      />
                      <Pressable style={styles.removeRowBtn} onPress={() => setUpdateItems((cur) => cur.length === 1 ? [EMPTY_ITEM()] : cur.filter((_, i) => i !== index))}>
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      </Pressable>
                    </View>
                    {Number(item.adjustmentQuantity) ? (
                      <TextInput
                        value={item.adjustmentNote}
                        onChangeText={(t) => setItem(index, { adjustmentNote: t })}
                        placeholder="Adjustment note (required)"
                        placeholderTextColor="#B45309"
                        style={[styles.input, styles.noteInput, { borderColor: '#FDE68A' }]}
                      />
                    ) : null}
                    <TextInput
                      value={item.notes}
                      onChangeText={(t) => setItem(index, { notes: t })}
                      placeholder="Notes (optional)"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, styles.noteInput]}
                    />
                  </View>
                );
              })}
            </ScrollView>

            <Pressable style={[styles.btnOutline, { alignSelf: 'flex-start' }]} onPress={() => setUpdateItems((cur) => [...cur, EMPTY_ITEM()])}>
              <Ionicons name="add" size={13} color={colors.primary} />
              <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Add another product</Text>
            </Pressable>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.btnOutline} onPress={() => setShowUpdate(false)} disabled={saving}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={saveUpdate} disabled={saving}>
                {saving ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="checkmark" size={14} color="#fff" />}
                <Text style={styles.btnPrimaryText}>Save Stock Update</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ── Add Linked Accounts modal ── */}
      {showLink && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons name="link-outline" size={22} color={colors.primary} />
              <Text style={styles.modalTitle}>Add Linked Accounts</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setShowLink(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={13} color={colors.textMuted} />
              <TextInput
                value={linkSearch}
                onChangeText={setLinkSearch}
                placeholder="Search accounts…"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>
            <ScrollView style={styles.accountList} nestedScrollEnabled>
              {linkCandidates.map((account) => {
                const id = getId(account);
                const selected = linkIds.includes(id);
                return (
                  <Pressable
                    key={id}
                    style={[styles.dropdownOpt, selected && { backgroundColor: colors.primary + '0E' }]}
                    onPress={() => setLinkIds((cur) => (selected ? cur.filter((entry) => entry !== id) : [...cur, id]))}
                  >
                    <Ionicons name={selected ? 'checkbox-outline' : 'square-outline'} size={15} color={selected ? colors.primary : colors.textMuted} />
                    <Text style={[styles.dropdownOptText, { marginLeft: 8 }]}>{getAccountName(account)}</Text>
                  </Pressable>
                );
              })}
              {!linkCandidates.length ? <Text style={styles.emptyText}>No accounts found.</Text> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.btnOutline} onPress={() => setShowLink(false)} disabled={linkSaving}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btnPrimary, linkSaving && { opacity: 0.6 }]} onPress={saveLinks} disabled={linkSaving}>
                {linkSaving ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="checkmark" size={14} color="#fff" />}
                <Text style={styles.btnPrimaryText}>Save ({linkIds.length})</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}

function SummaryCard({ icon, iconColor, iconBg, label, value, small, accent }) {
  return (
    <View style={[styles.statCard, accent && { backgroundColor: accent.bg, borderColor: accent.border }]}>
      <View style={[styles.statIcon, accent ? { backgroundColor: accent.chip } : { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={17} color={accent ? colors.white : iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statLabel, accent && { color: accent.label }]}>{label}</Text>
        <Text style={[styles.statValue, small && { fontSize: 13 }, accent && { color: accent.value }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },

  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 280 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  backBtn: {
    width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },

  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countPill: { backgroundColor: colors.primary + '14', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1, minWidth: 22, alignItems: 'center' },
  countPillText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  btnOutlineSm: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface,
  },
  btnOutlineSmText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  linkHint: { fontSize: 11.5, color: colors.textMuted },
  linkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, paddingLeft: 11, paddingRight: 6, paddingVertical: 6, maxWidth: 260,
  },
  linkPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#15803D' },
  linkPillText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600', flexShrink: 1 },
  linkPillRemove: {
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  linkEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 13, ...shadow,
  },
  statIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 8, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textMuted },

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
  subText: { fontSize: 10, color: colors.textMuted },
  adjNote: { fontSize: 10, color: '#B45309', maxWidth: 110 },

  historyBlock: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, gap: 6, marginBottom: 8, backgroundColor: colors.surfaceSoft },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyDate: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
  historyBy: { fontSize: 11, color: colors.textMuted },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },

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
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#FCA5A5',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  btnDangerText: { fontSize: 12, color: colors.danger, fontWeight: '700' },

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,18,47,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 12,
    width: '100%', maxWidth: 720, maxHeight: '92%', ...shadow,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  helperText: { fontSize: 12, color: colors.textMuted },

  updateRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 8, marginBottom: 10, backgroundColor: colors.surfaceSoft },
  updateRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff',
    fontSize: 12, color: colors.textPrimary, minHeight: 36,
  },
  inputText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  inputPlaceholder: { fontSize: 12, color: colors.textMuted, flex: 1 },
  numInput: { width: 110 },
  noteInput: { width: '100%' },
  removeRowBtn: { padding: 6 },

  dropdown: {
    position: 'absolute', top: 40, left: 0, right: 0,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, zIndex: 1000, elevation: 20,
    shadowColor: '#0B2B66', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  dropdownSearch: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, color: colors.textPrimary },
  dropdownOpt: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  dropdownOptText: { fontSize: 12.5, color: colors.textPrimary },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, backgroundColor: colors.backgroundColor, minHeight: 38,
  },
  searchInput: { flex: 1, fontSize: 12, color: colors.textPrimary, paddingVertical: 9 },
  accountList: { maxHeight: 260, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },

  formError: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 14 },
  centered: { padding: 50, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
