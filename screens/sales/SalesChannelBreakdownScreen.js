import React, { useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getSalesChannelBreakdown } from '../../store/sales/salesActions';
import { getAccounts } from '../../store/accounts/accountActions';

const THIS_YEAR  = new Date().getFullYear();
const THIS_MONTH = String(new Date().getMonth() + 1);
const YEAR_OPTS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ value: String(y), label: String(y) }));
const MONTH_OPTS = [
  { value: '1',  label: 'January'   }, { value: '2',  label: 'February'  },
  { value: '3',  label: 'March'     }, { value: '4',  label: 'April'     },
  { value: '5',  label: 'May'       }, { value: '6',  label: 'June'      },
  { value: '7',  label: 'July'      }, { value: '8',  label: 'August'    },
  { value: '9',  label: 'September' }, { value: '10', label: 'October'   },
  { value: '11', label: 'November'  }, { value: '12', label: 'December'  },
];

const CHANNEL_COLORS = ['#1D4ED8', '#7C3AED', '#16A34A', '#F59E0B', '#06B6D4', '#EF4444', '#EC4899', '#8B5CF6'];
const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const fmtNum = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};
const fmtFull = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const fmtCurrency = (v, cur = 'USD') => {
  if (v == null) return '—';
  const sym = cur === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');

/* ── FilterDropdown ── */
function FilterDropdown({ label, options, value, onChange, zIndex = 1 }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ position: 'relative', zIndex: open ? 60 : zIndex }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        {label ? <Text style={styles.filterBtnLabel}>{label}</Text> : null}
        <Text style={styles.filterBtnValue} numberOfLines={1}>{selected?.label || 'All'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable
                key={String(opt.value)}
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

/* ── SearchableDropdown — for large lists like accounts ── */
function SearchableDropdown({ label, options, value, onChange, zIndex = 1, placeholder = 'Search…' }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, search]);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={{ position: 'relative', zIndex: open ? 80 : zIndex }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        {label ? <Text style={styles.filterBtnLabel}>{label}</Text> : null}
        <Text style={[styles.filterBtnValue, value && { color: colors.primary, fontWeight: '700' }]} numberOfLines={1}>
          {selected?.label || 'All Accounts'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.searchDropdown}>
          {/* Search input */}
          <View style={styles.searchInputRow}>
            <Ionicons name="search-outline" size={13} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={14} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Count badge */}
          <View style={styles.searchCount}>
            <Text style={styles.searchCountText}>
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <View style={styles.filterOpt}>
                <Text style={[styles.filterOptText, { color: colors.textMuted, fontStyle: 'italic' }]}>
                  No matches found
                </Text>
              </View>
            ) : (
              filtered.map((opt) => (
                <Pressable
                  key={String(opt.value)}
                  style={[styles.filterOpt, opt.value === value && styles.filterOptActive]}
                  onPress={() => handleSelect(opt)}
                >
                  <Text style={[styles.filterOptText, opt.value === value && styles.filterOptTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ── Main screen ── */
export default function SalesChannelBreakdownScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';

  const initFilters = route?.params?.filters || {};

  // pending = what's shown in dropdowns; applied = what was last fetched
  const [pendingYear,    setPendingYear]    = useState(initFilters.year  || String(THIS_YEAR));
  const [pendingMonth,   setPendingMonth]   = useState(initFilters.month || THIS_MONTH);
  const [pendingAccount, setPendingAccount] = useState('');

  // appliedParams drives the fetch — null means "not yet loaded"
  const [appliedParams,  setAppliedParams]  = useState(null);
  const [refreshKey,     setRefreshKey]     = useState(0);

  const [channels,    setChannels]    = useState([]);
  const [accounts,    setAccounts]    = useState([]);
  const [overview,    setOverview]    = useState(null);
  const [channelData, setChannelData] = useState({});
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Convenience aliases for render — fall back to pending while nothing applied yet
  const year    = appliedParams?.year    ?? pendingYear;
  const month   = appliedParams?.month   ?? pendingMonth;
  const account = appliedParams?.account ?? '';

  /* Load ALL accounts by paginating through every page */
  useEffect(() => {
    (async () => {
      try {
        const PAGE_SIZE = 200;
        const first = await getAccounts(token, { limit: PAGE_SIZE, page: 1 });
        const totalPages = first.pagination?.pages || 1;
        let all = Array.isArray(first.accounts) ? first.accounts : [];

        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              getAccounts(token, { limit: PAGE_SIZE, page: i + 2 })
            )
          );
          rest.forEach(({ accounts: a }) => {
            if (Array.isArray(a)) all = [...all, ...a];
          });
        }

        setAccounts(all);
      } catch {
        // silently ignore — accounts list is optional
      }
    })();
  }, [token]);

  /* Fetch whenever appliedParams or refreshKey changes */
  useEffect(() => {
    if (!appliedParams) return; // don't auto-load on mount

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      setChannelData({});
      try {
        const { year: yr, month: mo, account: acc } = appliedParams;
        const params = {};
        if (yr)  params.year      = yr;
        if (mo)  params.month     = mo;
        if (acc) params.accountId = acc;

        const rows = await getSalesChannelBreakdown(token, params);
        if (cancelled) return;

        const flat = Array.isArray(rows) ? rows : [];

        // Group flat rows by channelId
        const channelAgg = {};
        flat.forEach((row) => {
          const chId = String(row.channelId || '');
          if (!chId) return;

          if (!channelAgg[chId]) {
            channelAgg[chId] = {
              _id: chId,
              channelName: row.channelName || '—',
              totalQuantity: 0, totalFocQuantity: 0,
              totalCalculatedCifUsd: 0, totalCalculatedWholesaleAed: 0,
              totalRecords: 0, byProduct: [],
            };
          }

          const ch = channelAgg[chId];
          ch.totalQuantity               += row.quantity               ?? 0;
          ch.totalFocQuantity            += row.focQuantity            ?? 0;
          ch.totalCalculatedCifUsd       += row.totalCalculatedCifUsd  ?? 0;
          ch.totalCalculatedWholesaleAed += row.totalCalculatedWholesaleAed ?? 0;
          ch.totalRecords                += row.totalRecords           ?? 0;
          ch.byProduct.push({
            name:                        row.name || '—',
            productId:                   row.productId,
            quantity:                    row.quantity               ?? 0,
            focQuantity:                 row.focQuantity            ?? 0,
            totalCalculatedCifUsd:       row.totalCalculatedCifUsd  ?? 0,
            totalCalculatedWholesaleAed: row.totalCalculatedWholesaleAed ?? 0,
          });
        });

        const chList  = Object.values(channelAgg).map((ch) => ({ _id: ch._id, channelName: ch.channelName }));
        const dataMap = {};
        Object.values(channelAgg).forEach((ch) => { dataMap[ch._id] = ch; });

        // Grand totals
        const totals = { totalQuantity: 0, totalFocQuantity: 0, totalCalculatedCifUsd: 0, totalCalculatedWholesaleAed: 0, totalRecords: 0 };
        flat.forEach((row) => {
          totals.totalQuantity               += row.quantity               ?? 0;
          totals.totalFocQuantity            += row.focQuantity            ?? 0;
          totals.totalCalculatedCifUsd       += row.totalCalculatedCifUsd  ?? 0;
          totals.totalCalculatedWholesaleAed += row.totalCalculatedWholesaleAed ?? 0;
          totals.totalRecords               += row.totalRecords            ?? 0;
        });

        setChannels(chList);
        setChannelData(dataMap);
        setOverview(totals);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load channel breakdown');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [appliedParams, refreshKey, token]);

  const handleApply = () => {
    setAppliedParams({ year: pendingYear, month: pendingMonth, account: pendingAccount });
  };

  /* Grand totals */
  const totalQty     = overview?.totalQuantity ?? 0;
  const totalFoc     = pick(overview?.totalFocQuantity, overview?.totalFreeQuantity) ?? 0;
  const totalCif     = pick(overview?.totalCalculatedCifUsd,    overview?.totalCifUsd)         ?? 0;
  const totalWs      = pick(overview?.totalCalculatedWholesaleAed, overview?.totalWholesaleAed) ?? 0;
  const totalRecords = pick(overview?.totalRecords, overview?.recordsCount) ?? 0;

  const periodLabel = [
    year,
    month ? MONTH_OPTS.find((m) => m.value === month)?.label : '',
  ].filter(Boolean).join(' · ');

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="SalesOverview"
      scrollable={false}
    >
      <View style={styles.shell}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back-outline" size={14} color={colors.primary} />
              <Text style={styles.backText}>Sales Overview</Text>
            </Pressable>
            <Text style={styles.pageTitle}>Sales by Channel</Text>
            <Text style={styles.pageSubtitle}>
              Full breakdown across all sales channels{periodLabel ? ` · ${periodLabel}` : ''}
            {account ? ` · ${accounts.find((a) => (a._id || a.id) === account)?.accountName || accounts.find((a) => (a._id || a.id) === account)?.name || 'Account'}` : ''}
            </Text>
            {/* DEBUG — remove after testing */}
            {(() => {
              const dbgAcc = accounts.find((a) => (a._id || a.id || a.accountId) === pendingAccount);
              return (
                <Text style={{ fontSize: 10, color: '#c00', fontFamily: 'monospace', marginTop: 2 }}>
                  {`applied: ${account || '—'}\npending: ${pendingAccount || '—'}\n_id: ${dbgAcc?._id || '—'} | id: ${dbgAcc?.id || '—'} | accountId: ${dbgAcc?.accountId || '—'}`}
                </Text>
              );
            })()}
          </View>
          <View style={styles.filtersRow}>
            <FilterDropdown label="YEAR"    options={YEAR_OPTS}     value={pendingYear}    onChange={setPendingYear}    zIndex={27} />
            <FilterDropdown label="MONTH"   options={MONTH_OPTS}    value={pendingMonth}   onChange={setPendingMonth}   zIndex={26} />
            <SearchableDropdown
              label="ACCOUNT"
              options={[
                { value: '', label: 'All Accounts' },
                ...accounts.map((a) => ({
                  value: a._id || a.id || '',
                  label: a.accountName || a.name || '—',
                })),
              ]}
              value={pendingAccount}
              onChange={setPendingAccount}
              zIndex={25}
              placeholder="Search accounts…"
            />
            {pendingAccount && (
              <Pressable style={styles.btnClear} onPress={() => { setPendingAccount(''); setAppliedParams((p) => p ? { ...p, account: '' } : p); }}>
                <Ionicons name="close-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.btnClearText}>Clear</Text>
              </Pressable>
            )}
            <Pressable style={styles.btnApply} onPress={handleApply}>
              <Ionicons name="options-outline" size={13} color="#fff" />
              <Text style={styles.btnApplyText}>Apply</Text>
            </Pressable>
            <Pressable style={styles.btnIcon} onPress={() => setRefreshKey((k) => k + 1)}>
              <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* ── Summary strip ── */}
        <View style={styles.summaryStrip}>
          {[
            { label: 'CHANNELS', value: String(account ? Object.keys(channelData).length : channels.length) },
            { label: 'TOTAL RECORDS',  value: fmtNum(totalRecords) },
            { label: 'TOTAL QTY',      value: fmtFull(totalQty) },
            { label: 'FOC QTY',        value: fmtFull(totalFoc) },
            { label: 'CIF VALUE (USD)',  value: fmtCurrency(totalCif) },
            { label: 'WHOLESALE (AED)', value: fmtCurrency(totalWs, 'AED') },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryLabel}>{s.label}</Text>
                <Text style={styles.summaryValue}>{s.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.summaryDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Body ── */}
        {!appliedParams && !loading ? (
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <Ionicons name="options-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Select your filters</Text>
            <Text style={styles.stateText}>Choose a year, month, or account then tap Apply.</Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateText}>Loading sales data…</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
            <Text style={[styles.stateText, { color: colors.danger }]}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : channels.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bar-chart-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No sales data</Text>
            <Text style={styles.stateText}>No records found for the selected filters.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* When account is filtered and no channel data found */}
            {account && Object.keys(channelData).length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', gap: 14, padding: 64 }}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="business-outline" size={32} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No sales found</Text>
                <Text style={styles.stateText}>
                  No records match this account for the selected period.
                </Text>
              </View>
            ) : null}
            {channels.filter((ch) => {
              if (!account) return true;
              const id = String(ch._id || ch.channelId || '');
              return !!channelData[id];
            }).map((ch, idx) => {
              const id    = String(ch._id || ch.channelId || '');
              const name  = ch.channelName || ch.channelKey || '—';
              const data  = channelData[id];
              const color = CHANNEL_COLORS[idx % CHANNEL_COLORS.length];

              const chQty = data?.totalQuantity ?? 0;
              const chFoc = pick(data?.totalFocQuantity, data?.totalFreeQuantity)           ?? 0;
              const chCif = pick(data?.totalCalculatedCifUsd, data?.totalCifUsd)             ?? 0;
              const chWs  = pick(data?.totalCalculatedWholesaleAed, data?.totalWholesaleAed) ?? 0;
              const chRec = pick(data?.totalRecords, data?.recordsCount)                     ?? 0;

              const rawProducts = [
                ...(Array.isArray(data?.byProduct)      ? data.byProduct      : []),
                ...(Array.isArray(data?.salesByProduct)  ? data.salesByProduct : []),
              ];
              const products = rawProducts.filter(
                (v, i, arr) => arr.findIndex((x) => x.name === v.name) === i
              );

              return (
                <View key={id} style={styles.channelSection}>

                  {/* Channel header */}
                  <View style={[styles.channelHeader, { borderLeftColor: color }]}>
                    <View style={[styles.channelBadge, { backgroundColor: color + '18' }]}>
                      <View style={[styles.channelDot, { backgroundColor: color }]} />
                    </View>
                    <View style={styles.channelTitleGroup}>
                      <Text style={[styles.channelName, { color }]}>{name}</Text>
                      <Text style={styles.channelMeta}>
                        {fmtNum(chRec)} records · {fmtFull(chQty)} units
                        {chFoc > 0 ? ` · ${fmtNum(chFoc)} FOC` : ''}
                      </Text>
                    </View>
                    <View style={styles.channelHeaderRight}>
                      <Text style={styles.channelHeaderStatLabel}>CIF (USD)</Text>
                      <Text style={[styles.channelHeaderStatValue, { color }]}>{fmtCurrency(chCif)}</Text>
                    </View>
                    <View style={styles.channelHeaderRight}>
                      <Text style={styles.channelHeaderStatLabel}>WHOLESALE (AED)</Text>
                      <Text style={[styles.channelHeaderStatValue, { color }]}>{fmtCurrency(chWs, 'AED')}</Text>
                    </View>
                  </View>

                  {/* Table */}
                  <View style={styles.table}>

                    {/* Table header */}
                    <View style={[styles.tableRow, styles.tableHeaderRow]}>
                      <View style={styles.colIndex}>
                        <Text style={styles.th}>#</Text>
                      </View>
                      <View style={styles.colName}>
                        <Text style={styles.th}>ITEM NAME</Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.th, styles.thRight]}>TOTAL QTY</Text>
                      </View>
                      <View style={styles.colNum}>
                        <Text style={[styles.th, styles.thRight]}>FOC QTY</Text>
                      </View>
                      <View style={styles.colVal}>
                        <Text style={[styles.th, styles.thRight]}>TOTAL CIF (USD)</Text>
                      </View>
                      <View style={styles.colVal}>
                        <Text style={[styles.th, styles.thRight]}>TOTAL VALUE (AED)</Text>
                      </View>
                    </View>

                    {/* Item rows */}
                    {products.length === 0 ? (
                      <View style={styles.tableRow}>
                        <View style={{ flex: 1, padding: 16 }}>
                          <Text style={styles.noItemsText}>No item breakdown available for this channel</Text>
                        </View>
                      </View>
                    ) : (
                      products.map((p, pi) => {
                        const pQty = pick(p?.quantity, p?.totalQuantity)     ?? 0;
                        const pFoc = pick(p?.focQuantity, p?.freeQuantity)   ?? 0;
                        const pCif = pick(p?.totalCalculatedCifUsd, p?.cifUsd, p?.calculatedCifUsd) ?? 0;
                        const pVal = pick(
                          p?.totalCalculatedWholesaleAed,
                          p?.wholesaleAed,
                          p?.calculatedWholesaleAed,
                          p?.totalCalculatedRetailAed,
                          p?.value,
                        ) ?? 0;

                        return (
                          <View
                            key={pi}
                            style={[styles.tableRow, styles.dataRow, pi % 2 !== 0 && styles.rowAlt]}
                          >
                            <View style={styles.colIndex}>
                              <Text style={styles.indexText}>{pi + 1}</Text>
                            </View>
                            <View style={styles.colName}>
                              <Text style={styles.itemName} numberOfLines={2}>{p.name || '—'}</Text>
                            </View>
                            <View style={styles.colNum}>
                              <Text style={styles.tdRight}>{fmtFull(pQty)}</Text>
                            </View>
                            <View style={styles.colNum}>
                              <Text style={styles.tdRight}>{pFoc > 0 ? fmtNum(pFoc) : '—'}</Text>
                            </View>
                            <View style={styles.colVal}>
                              <Text style={styles.tdRight}>{pCif > 0 ? fmtCurrency(pCif) : '—'}</Text>
                            </View>
                            <View style={styles.colVal}>
                              <Text style={styles.tdRight}>{pVal > 0 ? fmtCurrency(pVal, 'AED') : '—'}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}

                    {/* Channel total row */}
                    {products.length > 0 && (
                      <View style={[styles.tableRow, styles.channelTotalRow, { borderTopColor: color + '40' }]}>
                        <View style={styles.colIndex} />
                        <View style={styles.colName}>
                          <Text style={[styles.totalLabel, { color }]}>
                            {name} — Total ({products.length} items)
                          </Text>
                        </View>
                        <View style={styles.colNum}>
                          <Text style={[styles.totalVal, { color }]}>{fmtFull(chQty)}</Text>
                        </View>
                        <View style={styles.colNum}>
                          <Text style={[styles.totalVal, { color }]}>{chFoc > 0 ? fmtNum(chFoc) : '—'}</Text>
                        </View>
                        <View style={styles.colVal}>
                          <Text style={[styles.totalVal, { color }]}>{fmtCurrency(chCif)}</Text>
                        </View>
                        <View style={styles.colVal}>
                          <Text style={[styles.totalVal, { color }]}>{fmtCurrency(chWs, 'AED')}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* ── Grand total ── */}
            <View style={styles.grandTotalSection}>
              <View style={styles.grandTotalHeader}>
                <Ionicons name="calculator-outline" size={16} color={colors.primary} />
                <Text style={styles.grandTotalTitle}>Grand Total — All Channels</Text>
              </View>
              <View style={styles.grandTotalGrid}>
                <View style={styles.grandTotalCard}>
                  <Text style={styles.grandTotalCardLabel}>Total Records</Text>
                  <Text style={styles.grandTotalCardValue}>{fmtNum(totalRecords)}</Text>
                </View>
                <View style={styles.grandTotalCard}>
                  <Text style={styles.grandTotalCardLabel}>Total QTY (Units)</Text>
                  <Text style={styles.grandTotalCardValue}>{fmtFull(totalQty)}</Text>
                </View>
                <View style={styles.grandTotalCard}>
                  <Text style={styles.grandTotalCardLabel}>FOC QTY</Text>
                  <Text style={styles.grandTotalCardValue}>{fmtFull(totalFoc)}</Text>
                </View>
                <View style={styles.grandTotalCard}>
                  <Text style={styles.grandTotalCardLabel}>Total CIF (USD)</Text>
                  <Text style={styles.grandTotalCardValue}>{fmtCurrency(totalCif)}</Text>
                </View>
                <View style={styles.grandTotalCard}>
                  <Text style={styles.grandTotalCardLabel}>Total Value (AED)</Text>
                  <Text style={styles.grandTotalCardValue}>{fmtCurrency(totalWs, 'AED')}</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: 0, backgroundColor: colors.backgroundColor },

  /* Header */
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: PAD,
    paddingVertical: globalHeight('1.4%'),
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 50,
  },
  headerLeft:   { gap: 3 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  backText:     { fontSize: 12, color: colors.primary, fontWeight: '600' },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.backgroundColor,
  },
  filterBtnLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.3 },
  filterBtnValue: { fontSize: 12, color: colors.textPrimary, fontWeight: '600', maxWidth: 110 },
  filterDropdown: {
    position: 'absolute', top: 38, left: 0, minWidth: 160,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt:           { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive:     { backgroundColor: colors.primary + '15' },
  filterOptText:       { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  /* Searchable dropdown */
  searchDropdown: {
    position: 'absolute', top: 38, left: 0, minWidth: 240,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  searchInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: colors.textPrimary,
    outlineStyle: 'none',
  },
  searchCount: {
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: colors.backgroundColor,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchCountText: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },

  btnApply: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  btnApplyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnIcon: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnClear: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: colors.backgroundColor,
  },
  btnClearText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  /* Summary strip */
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: PAD,
  },
  summaryStat:    { flex: 1, minWidth: 110, paddingVertical: globalHeight('1.1%'), paddingHorizontal: 10 },
  summaryDivider: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch', marginVertical: globalHeight('0.8%') },
  summaryLabel:   { fontSize: 9, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: 5 },
  summaryValue:   { fontSize: 17, fontWeight: '800', color: colors.textPrimary },

  /* Body */
  body:        { flex: 1 },
  bodyContent: { padding: PAD, gap: 20, paddingBottom: 48 },

  /* Channel section */
  channelSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow,
  },

  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderLeftWidth: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  channelBadge:     { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  channelDot:       { width: 10, height: 10, borderRadius: 5 },
  channelTitleGroup:{ flex: 1, gap: 2 },
  channelName:      { fontSize: 15, fontWeight: '800' },
  channelMeta:      { fontSize: 11, color: colors.textMuted },
  channelHeaderRight:{ alignItems: 'flex-end', gap: 2, marginLeft: 16 },
  channelHeaderStatLabel:{ fontSize: 9, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.4 },
  channelHeaderStatValue:{ fontSize: 14, fontWeight: '800' },

  /* Table */
  table: { flex: 1 },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tableHeaderRow: {
    backgroundColor: colors.primary + '07',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary + '20',
    paddingVertical: 10,
  },

  dataRow: {
    paddingVertical: 11,
    backgroundColor: colors.surface,
  },
  rowAlt: { backgroundColor: colors.backgroundColor },

  channelTotalRow: {
    paddingVertical: 11,
    backgroundColor: colors.primary + '05',
    borderTopWidth: 2,
    borderBottomWidth: 0,
  },

  /* Columns */
  colIndex: { width: 44, alignItems: 'center' },
  colName:  { flex: 1, paddingHorizontal: 12 },
  colNum:   { width: 120, paddingRight: 18 },
  colVal:   { width: 160, paddingRight: 18 },

  /* Header cells */
  th:      { fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  thRight: { textAlign: 'right' },

  /* Data cells */
  indexText: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  itemName:  { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  tdRight:   { fontSize: 13, color: colors.textPrimary, textAlign: 'right' },

  /* Channel total row */
  totalLabel: { fontSize: 12, fontWeight: '800' },
  totalVal:   { fontSize: 13, fontWeight: '800', textAlign: 'right' },

  noItemsText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },

  /* Grand total */
  grandTotalSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    padding: 18,
    gap: 14,
    ...shadow,
  },
  grandTotalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12,
  },
  grandTotalTitle: { fontSize: 14, fontWeight: '800', color: colors.primary },
  grandTotalGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grandTotalCard: {
    flex: 1, minWidth: 130,
    backgroundColor: colors.primary + '07',
    borderRadius: 8, padding: 12, gap: 4,
    borderWidth: 1, borderColor: colors.primary + '20',
  },
  grandTotalCardLabel: { fontSize: 10, color: colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  grandTotalCardValue: { fontSize: 18, fontWeight: '800', color: colors.primary },

  /* States */
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 48 },
  stateText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  retryBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  retryText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  emptyIcon: { width: 68, height: 68, borderRadius: 16, backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:{ fontSize: 16, fontWeight: '800', color: colors.textPrimary },
});
