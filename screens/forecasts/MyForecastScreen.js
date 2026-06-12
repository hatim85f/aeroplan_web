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
  addAccountForecast,
  deleteAccountForecast,
  getMyForecast,
  submitForecast,
  updateAccountForecast,
} from '../../store/forecasts/forecastActions';
import {
  MONTH_OPTIONS,
  coverageState,
  filterItemsByChannels,
  fmtCurrency,
  fmtNumber,
  forecastStatusColors,
  getAccountForecastName,
  getAccountForecastQuantity,
  getAccountForecastStatus,
  getAccountForecastValue,
  getAccountList,
  getAccountName,
  getChannelAccountForecasts,
  getChannelId,
  getChannelName,
  getChannelNamesFromItems,
  getCoverage,
  getCurrency,
  getDeficitUnits,
  getDeficitValue,
  getForecastFromResult,
  getForecastItems,
  getForecastStatus,
  getForecastUnits,
  getForecastValue,
  getId,
  getItemChannels,
  getItemProductId,
  getItemProductName,
  getItemProductNickname,
  getMonthLabel,
  getPortfolioSummary,
  getTargetUnits,
  getTargetValue,
  yearOptions,
} from './forecastUtils';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const EMPTY_FORM = { accountId: '', inputType: 'units', quantity: '', value: '', notes: '', editingId: '' };

function StatCard({ icon, iconColor, iconBg, label, value }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.statBody}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

function FilterItem({ icon, label, options, value, onChange, style, zIndex = 1 }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={[{ position: 'relative', zIndex: open ? 60 : zIndex }, style]}>
      <Pressable style={styles.filterItem} onPress={() => setOpen((v) => !v)}>
        {icon ? <Ionicons name={icon} size={13} color={colors.textSecondary} /> : null}
        <View style={{ flex: 1, minWidth: 50 }}>
          {label ? <Text style={styles.filterItemLabel}>{label}</Text> : null}
          <Text style={styles.filterItemValue} numberOfLines={1}>{selected?.label || 'All'}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.filterOpt, opt.value === value && styles.filterOptActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[styles.filterOptText, opt.value === value && styles.filterOptTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function AccountSelect({ accounts, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = accounts.find((account) => getId(account) === value);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) => getAccountName(account).toLowerCase().includes(query));
  }, [accounts, search]);

  return (
    <View style={{ position: 'relative', zIndex: open ? 1000 : 5, minWidth: 200, flex: 1 }}>
      <Pressable style={styles.input} onPress={() => setOpen((v) => !v)}>
        <Text style={selected ? styles.inputText : styles.inputPlaceholder} numberOfLines={1}>
          {selected ? getAccountName(selected) : 'Select account'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search accounts"
            placeholderTextColor={colors.textMuted}
            style={styles.dropdownSearch}
          />
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {filtered.map((account) => {
              const id = getId(account);
              return (
                <Pressable
                  key={id}
                  style={[styles.filterOpt, id === value && styles.filterOptActive]}
                  onPress={() => { onChange(id); setOpen(false); }}
                >
                  <Text style={[styles.filterOptText, id === value && styles.filterOptTextActive]}>
                    {getAccountName(account)}
                  </Text>
                </Pressable>
              );
            })}
            {!filtered.length ? <Text style={styles.emptyText}>No accounts found.</Text> : null}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function CoverageBadge({ coverage }) {
  const state = coverageState(coverage);
  return (
    <View style={[styles.badge, { backgroundColor: state.bg }]}>
      <Text style={[styles.badgeText, { color: state.text }]}>{fmtNumber(coverage)}%</Text>
    </View>
  );
}

export default function MyForecastScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManager(user.role || '');

  useEffect(() => {
    if (manager) navigation.replace('ForecastTeam');
  }, [manager, navigation]);

  const [year, setYear] = useState(String(THIS_YEAR));
  const [month, setMonth] = useState(String(THIS_MONTH));
  const [forecast, setForecast] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [expandedProductId, setExpandedProductId] = useState('');
  const [activeChannelId, setActiveChannelId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchForecast = useCallback(async () => {
    if (!token || manager) return;
    try {
      setLoading(true);
      setError('');
      const result = await getMyForecast(token, { year, month });
      setForecast(getForecastFromResult(result));
    } catch (err) {
      setForecast(null);
      setError(err.message || 'Failed to load forecast.');
    } finally {
      setLoading(false);
    }
  }, [manager, month, token, year]);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  useEffect(() => {
    if (!token || manager) return;
    getAccounts(token, { page: 1, limit: 500 })
      .then((result) => setAccounts(getAccountList(result)))
      .catch(() => setAccounts([]));
  }, [manager, token]);

  const forecastId = getId(forecast);
  const items = useMemo(() => getForecastItems(forecast || {}), [forecast]);
  const channelNames = useMemo(() => getChannelNamesFromItems(items), [items]);
  const filteredItems = useMemo(
    () => filterItemsByChannels(items, selectedChannels),
    [items, selectedChannels],
  );
  const summary = useMemo(
    () => (selectedChannels.length
      ? getPortfolioSummary(null, filteredItems)
      : getPortfolioSummary(forecast, items)),
    [filteredItems, forecast, items, selectedChannels],
  );
  const currency = getCurrency(forecast || {});
  const status = getForecastStatus(forecast || {});
  const statusColorsSet = forecastStatusColors(status);
  const summaryState = coverageState(summary.coverage);

  const toggleChannelFilter = (channelName) => {
    setSelectedChannels((current) => (
      current.includes(channelName)
        ? current.filter((name) => name !== channelName)
        : [...current, channelName]
    ));
  };

  const toggleProduct = (productId, channels) => {
    if (expandedProductId === productId) {
      setExpandedProductId('');
      setActiveChannelId('');
    } else {
      setExpandedProductId(productId);
      setActiveChannelId(getChannelId(channels[0] || {}));
    }
    setForm(EMPTY_FORM);
  };

  const startEdit = (row) => {
    const rowAccount = row.accountId || row.account;
    setForm({
      accountId: typeof rowAccount === 'object' ? getId(rowAccount) : rowAccount || '',
      inputType: row.inputType === 'value' ? 'value' : 'units',
      quantity: String(getAccountForecastQuantity(row) || ''),
      value: String(getAccountForecastValue(row) || ''),
      notes: row.notes || '',
      editingId: getId(row),
    });
  };

  const saveRow = async (productId) => {
    if (!form.editingId && !form.accountId) {
      window.alert('Please select an account.');
      return;
    }
    const raw = form.inputType === 'units' ? form.quantity : form.value;
    if (!String(raw).trim()) {
      window.alert(form.inputType === 'units' ? 'Please enter the forecast quantity.' : 'Please enter the forecast value.');
      return;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount)) {
      window.alert('Please enter a valid number.');
      return;
    }
    if (amount < 0) {
      window.alert('Cannot add a negative value.');
      return;
    }
    if (!forecastId || !activeChannelId) {
      window.alert('No forecast or channel found for this month.');
      return;
    }

    const payload = { inputType: form.inputType, notes: form.notes.trim() };
    if (form.accountId) payload.accountId = form.accountId;
    if (form.inputType === 'units') payload.forecastQuantity = amount;
    else payload.forecastValue = amount;

    try {
      setSaving(true);
      if (form.editingId) {
        await updateAccountForecast(token, forecastId, form.editingId, payload);
      } else {
        await addAccountForecast(token, forecastId, productId, activeChannelId, payload);
      }
      setForm(EMPTY_FORM);
      await fetchForecast();
    } catch (err) {
      window.alert(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row) => {
    if (!window.confirm(`Remove the forecast for ${getAccountForecastName(row)}?`)) return;
    try {
      setSaving(true);
      await deleteAccountForecast(token, forecastId, getId(row));
      if (form.editingId === getId(row)) setForm(EMPTY_FORM);
      await fetchForecast();
    } catch (err) {
      window.alert(err.message || 'Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!forecastId) {
      window.alert('No forecast found for this month.');
      return;
    }
    if (!window.confirm(`Submit your forecast for ${getMonthLabel(month)} ${year}?`)) return;
    try {
      setSaving(true);
      await submitForecast(token, forecastId);
      await fetchForecast();
      window.alert('Forecast submitted.');
    } catch (err) {
      window.alert(err.message || 'Submit failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="MyForecast">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>My Forecast</Text>
              <View style={[styles.badge, { backgroundColor: statusColorsSet.bg }]}>
                <Text style={[styles.badgeText, { color: statusColorsSet.text }]}>
                  {String(status).charAt(0).toUpperCase() + String(status).slice(1)}
                </Text>
              </View>
            </View>
            <Text style={styles.pageSubtitle}>Plan how you will achieve your {getMonthLabel(month)} {year} target</Text>
          </View>
          <View style={styles.headerRight}>
            <FilterItem icon="calendar-outline" label="Year" options={yearOptions(THIS_YEAR)} value={year} onChange={setYear} style={{ minWidth: 90 }} zIndex={31} />
            <FilterItem icon="calendar-outline" label="Month" options={MONTH_OPTIONS} value={month} onChange={setMonth} style={{ minWidth: 110 }} zIndex={30} />
            <Pressable style={[styles.btnPrimary, saving && styles.btnDisabled]} disabled={saving || loading} onPress={handleSubmit}>
              <Ionicons name="paper-plane-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Submit Forecast</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Stat Cards ── */}
        <View style={styles.statsRow}>
          <StatCard icon="flag-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Monthly Target Value" value={fmtCurrency(summary.targetValue, currency)} />
          <StatCard icon="trending-up-outline" iconColor="#15803D" iconBg="#F0FDF4" label="Forecasted Value" value={fmtCurrency(summary.forecastValue, currency)} />
          <StatCard icon="alert-circle-outline" iconColor="#DC2626" iconBg="#FEF2F2" label="Deficit Value" value={fmtCurrency(summary.deficitValue, currency)} />
          <StatCard icon="speedometer-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="Coverage" value={`${fmtNumber(summary.coverage)}%`} />
        </View>

        {/* ── Channel filter + progress ── */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardTitle}>Portfolio Progress{selectedChannels.length ? ` · ${selectedChannels.join(', ')}` : ''}</Text>
            <View style={[styles.badge, { backgroundColor: summaryState.bg }]}>
              <Text style={[styles.badgeText, { color: summaryState.text }]}>
                {summary.coverage > 100 ? 'Over Target' : summaryState.label}
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { backgroundColor: summaryState.bar, width: `${Math.min(summary.coverage, 100)}%` }]} />
          </View>
          {channelNames.length ? (
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, !selectedChannels.length && styles.chipActive]}
                onPress={() => setSelectedChannels([])}
              >
                <Text style={[styles.chipText, !selectedChannels.length && styles.chipTextActive]}>All Channels</Text>
              </Pressable>
              {channelNames.map((channelName) => {
                const selected = selectedChannels.includes(channelName);
                return (
                  <Pressable
                    key={channelName}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => toggleChannelFilter(channelName)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{channelName}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchForecast}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Products</Text>
              <Text style={styles.cardMeta}>{filteredItems.length} product{filteredItems.length === 1 ? '' : 's'}</Text>
            </View>

            {!items.length ? (
              <Text style={styles.emptyText}>No target found for this month.</Text>
            ) : !filteredItems.length ? (
              <Text style={styles.emptyText}>No products for the selected channels.</Text>
            ) : filteredItems.map((item) => {
              const productId = getItemProductId(item) || getItemProductName(item);
              const expanded = expandedProductId === productId;
              const itemCoverage = getCoverage(item);
              const itemState = coverageState(itemCoverage);
              const nickname = getItemProductNickname(item);
              const channels = getItemChannels(item);
              const activeChannel = channels.find((channel) => getChannelId(channel) === activeChannelId) || null;
              const accountRows = getChannelAccountForecasts(activeChannel || {});
              const channelCoverage = getCoverage(activeChannel || {});

              return (
                <View key={productId} style={[styles.productBlock, expanded && styles.productBlockActive]}>
                  <Pressable style={styles.productRow} onPress={() => toggleProduct(productId, channels)}>
                    <View style={styles.productNameWrap}>
                      <Text style={styles.productName} numberOfLines={1}>{nickname || getItemProductName(item)}</Text>
                      {nickname ? <Text style={styles.productNick} numberOfLines={1}>{getItemProductName(item)}</Text> : null}
                    </View>
                    <Text style={styles.productMetric}>{fmtNumber(getTargetUnits(item))} u</Text>
                    <Text style={styles.productMetric}>{fmtCurrency(getTargetValue(item), currency)}</Text>
                    <Text style={styles.productMetric}>{fmtCurrency(getForecastValue(item), currency)}</Text>
                    <Text style={styles.productMetric}>{fmtCurrency(getDeficitValue(item), currency)}</Text>
                    <View style={{ width: 70 }}><CoverageBadge coverage={itemCoverage} /></View>
                    <View style={styles.productBarWrap}>
                      <View style={styles.coverageTrack}>
                        <View style={[styles.coverageFill, { backgroundColor: itemState.bar, width: `${Math.min(itemCoverage, 100)}%` }]} />
                      </View>
                    </View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </Pressable>

                  {expanded ? (
                    <View style={styles.detailWrap}>
                      {/* 4 small metric cards */}
                      <View style={styles.miniCards}>
                        <View style={styles.miniCard}><Text style={styles.miniLabel}>Target Units</Text><Text style={styles.miniValue}>{fmtNumber(getTargetUnits(item))}</Text></View>
                        <View style={styles.miniCard}><Text style={styles.miniLabel}>Target Value</Text><Text style={styles.miniValue}>{fmtCurrency(getTargetValue(item), currency)}</Text></View>
                        <View style={styles.miniCard}><Text style={styles.miniLabel}>Deficit Units</Text><Text style={styles.miniValue}>{fmtNumber(getDeficitUnits(item))}</Text></View>
                        <View style={styles.miniCard}><Text style={styles.miniLabel}>Deficit Value</Text><Text style={styles.miniValue}>{fmtCurrency(getDeficitValue(item), currency)}</Text></View>
                      </View>

                      {/* Channel selector */}
                      <View style={styles.chipRow}>
                        {channels.map((channel) => {
                          const channelId = getChannelId(channel);
                          const active = channelId === activeChannelId;
                          return (
                            <Pressable
                              key={channelId || getChannelName(channel)}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() => { setActiveChannelId(channelId); setForm(EMPTY_FORM); }}
                            >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>{getChannelName(channel)}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {!channels.length ? <Text style={styles.emptyText}>No channels found for this product.</Text> : null}

                      {activeChannel ? (
                        <>
                          {/* Channel summary */}
                          <View style={styles.channelSummary}>
                            <View style={styles.channelSummaryHeader}>
                              <Text style={styles.channelName}>{getChannelName(activeChannel)}</Text>
                              <CoverageBadge coverage={channelCoverage} />
                            </View>
                            <View style={styles.channelMetrics}>
                              <Text style={styles.channelMetric}>Target: {fmtNumber(getTargetUnits(activeChannel))} u / {fmtCurrency(getTargetValue(activeChannel), currency)}</Text>
                              <Text style={styles.channelMetric}>Forecast: {fmtNumber(getForecastUnits(activeChannel))} u / {fmtCurrency(getForecastValue(activeChannel), currency)}</Text>
                              <Text style={styles.channelMetric}>Deficit: {fmtNumber(getDeficitUnits(activeChannel))} u / {fmtCurrency(getDeficitValue(activeChannel), currency)}</Text>
                            </View>
                            <View style={styles.coverageTrack}>
                              <View style={[styles.coverageFill, { backgroundColor: coverageState(channelCoverage).bar, width: `${Math.min(channelCoverage, 100)}%` }]} />
                            </View>
                          </View>

                          {/* Add / edit form */}
                          <View style={styles.formCard}>
                            <Text style={styles.formTitle}>{form.editingId ? 'Edit Account Forecast' : 'Add Account Forecast'}</Text>
                            <View style={styles.formRow}>
                              <AccountSelect
                                accounts={accounts}
                                value={form.accountId}
                                onChange={(accountId) => setForm((current) => ({ ...current, accountId }))}
                              />
                              <View style={styles.segment}>
                                {['units', 'value'].map((type) => {
                                  const active = form.inputType === type;
                                  return (
                                    <Pressable
                                      key={type}
                                      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                                      onPress={() => setForm((current) => ({ ...current, inputType: type }))}
                                    >
                                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                                        {type === 'units' ? 'Units' : 'Value'}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                              <TextInput
                                value={form.inputType === 'units' ? form.quantity : form.value}
                                onChangeText={(text) => setForm((current) => (
                                  current.inputType === 'units' ? { ...current, quantity: text } : { ...current, value: text }
                                ))}
                                placeholder={form.inputType === 'units' ? 'Quantity' : `Value (${currency})`}
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                                style={[styles.input, styles.inputBox, { maxWidth: 140 }]}
                              />
                              <TextInput
                                value={form.notes}
                                onChangeText={(text) => setForm((current) => ({ ...current, notes: text }))}
                                placeholder="Notes (optional)"
                                placeholderTextColor={colors.textMuted}
                                style={[styles.input, styles.inputBox, { flex: 1.4, minWidth: 160 }]}
                              />
                              <Pressable
                                style={[styles.btnPrimary, saving && styles.btnDisabled]}
                                disabled={saving}
                                onPress={() => saveRow(getItemProductId(item))}
                              >
                                <Ionicons name={form.editingId ? 'save-outline' : 'add'} size={14} color="#fff" />
                                <Text style={styles.btnPrimaryText}>{form.editingId ? 'Update' : 'Add'}</Text>
                              </Pressable>
                              {form.editingId ? (
                                <Pressable style={styles.btnOutline} onPress={() => setForm(EMPTY_FORM)}>
                                  <Text style={styles.btnOutlineText}>Cancel</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>

                          {/* Account rows */}
                          {accountRows.length ? (
                            <View>
                              <View style={styles.accHead}>
                                <Text style={[styles.accTh, { flex: 2 }]}>Account</Text>
                                <Text style={[styles.accTh, { width: 60 }]}>Type</Text>
                                <Text style={[styles.accTh, { width: 80 }]}>Qty</Text>
                                <Text style={[styles.accTh, { width: 100 }]}>Value</Text>
                                <Text style={[styles.accTh, { width: 80 }]}>Status</Text>
                                <Text style={[styles.accTh, { flex: 2 }]}>Notes</Text>
                                <Text style={[styles.accTh, { width: 70 }]}>Actions</Text>
                              </View>
                              {accountRows.map((row) => (
                                <View key={getId(row) || getAccountForecastName(row)} style={styles.accRow}>
                                  <Text style={[styles.accTd, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>{getAccountForecastName(row)}</Text>
                                  <Text style={[styles.accTd, { width: 60 }]}>{row.inputType === 'value' ? 'Value' : 'Units'}</Text>
                                  <Text style={[styles.accTd, { width: 80 }]}>{fmtNumber(getAccountForecastQuantity(row))}</Text>
                                  <Text style={[styles.accTd, { width: 100 }]}>{fmtCurrency(getAccountForecastValue(row), currency)}</Text>
                                  <Text style={[styles.accTd, { width: 80, textTransform: 'capitalize' }]}>{getAccountForecastStatus(row)}</Text>
                                  <Text style={[styles.accTd, { flex: 2 }]} numberOfLines={1}>{row.notes || '—'}</Text>
                                  <View style={[styles.accTd, styles.accActions, { width: 70 }]}>
                                    <Pressable style={styles.actionBtn} disabled={saving} onPress={() => startEdit(row)}>
                                      <Ionicons name="create-outline" size={14} color={colors.primary} />
                                    </Pressable>
                                    <Pressable style={styles.actionBtn} disabled={saving} onPress={() => removeRow(row)}>
                                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                                    </Pressable>
                                  </View>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.emptyText}>No forecast added yet.</Text>
                          )}
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 16, paddingBottom: 48 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, zIndex: 30,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, ...shadow,
  },
  statIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statBody: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 3 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  filterItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.backgroundColor,
  },
  filterItemLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  filterItemValue: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  filterDropdown: {
    position: 'absolute', top: 42, left: 0, minWidth: 180, right: 0,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, zIndex: 1000, elevation: 20,
    shadowColor: '#0B2B66', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '15' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },
  dropdownSearch: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.textPrimary,
  },

  progressCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 10, ...shadow, zIndex: 5,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { height: 8, backgroundColor: colors.border + '90', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.backgroundColor,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 10, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },

  productBlock: { borderBottomWidth: 1, borderBottomColor: colors.border },
  productBlockActive: { zIndex: 100 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  productNameWrap: { flex: 2, minWidth: 140 },
  productName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  productNick: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  productMetric: { width: 95, fontSize: 12, color: colors.textPrimary },
  productBarWrap: { flex: 1, minWidth: 80 },
  coverageTrack: { height: 5, backgroundColor: colors.border + '90', borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: 5, borderRadius: 3 },

  detailWrap: { paddingBottom: 14, gap: 12 },
  miniCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniCard: {
    flex: 1, minWidth: 120, backgroundColor: colors.surfaceSoft,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, gap: 4,
  },
  miniLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  miniValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },

  channelSummary: {
    backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, gap: 8,
  },
  channelSummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  channelName: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  channelMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  channelMetric: { fontSize: 12, color: colors.textSecondary },

  formCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, gap: 10,
    backgroundColor: colors.surface, zIndex: 100,
  },
  formTitle: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', zIndex: 100 },
  input: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.inputBackground,
    minHeight: 36,
  },
  inputBox: { fontSize: 12, color: colors.textPrimary },
  inputText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  inputPlaceholder: { fontSize: 12, color: colors.textMuted, flex: 1 },

  segment: {
    flexDirection: 'row', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, overflow: 'hidden', backgroundColor: colors.backgroundColor,
  },
  segmentBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  segmentTextActive: { color: '#fff' },

  accHead: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  accTh: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  accRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '70', alignItems: 'center' },
  accTd: { fontSize: 12, color: colors.textPrimary },
  accActions: { flexDirection: 'row', gap: 2 },
  actionBtn: { padding: 5, borderRadius: 5 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

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
  btnDisabled: { opacity: 0.5 },

  centered: { padding: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
