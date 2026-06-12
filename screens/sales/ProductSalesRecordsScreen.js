import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { listSalesRecords } from '../../store/sales/salesActions';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtN = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtUSD = (value) => `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtDate = (value) => (value ? String(value).slice(0, 10) : '—');

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

export default function ProductSalesRecordsScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const {
    accountId,
    channelId,
    channelName,
    itemName,
    month,
    productId,
    year,
  } = route?.params || {};

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecords = useCallback(async (page = 1) => {
    if (!token || !productId) return;
    try {
      setLoading(true);
      setError('');
      const params = { page, limit: 50, productId, status: 'active' };
      if (channelId) params.channelId = channelId;
      if (accountId) params.accountId = accountId;
      if (year) params.year = year;
      if (month) params.month = month;
      const result = await listSalesRecords(token, params);
      setRecords(Array.isArray(result?.records) ? result.records : []);
      setPagination(result?.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      setRecords([]);
      setError(err.message || 'Failed to load sales records.');
    } finally {
      setLoading(false);
    }
  }, [accountId, channelId, month, productId, token, year]);

  useEffect(() => { fetchRecords(1); }, [fetchRecords]);

  const totals = records.reduce(
    (acc, record) => {
      acc.qty += Number(record.quantity) || 0;
      acc.foc += Number(record.freeQuantity) || 0;
      acc.cif += Number(record.calculatedCifUsd) || 0;
      return acc;
    },
    { qty: 0, foc: 0, cif: 0 },
  );

  const periodLabel = [month ? MONTH_NAMES[Number(month) - 1] : null, year].filter(Boolean).join(' ');

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesTable" scrollable={false}>
      <View style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
            </Pressable>
            <View>
              <Text style={styles.pageTitle}>{itemName || 'Product Sales Records'}</Text>
              <Text style={styles.pageSubtitle}>
                {[channelName, periodLabel].filter(Boolean).join(' · ') || 'All records'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Stat cards ── */}
        <View style={styles.statsRow}>
          <StatCard icon="cube-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Quantity (page)" value={fmtN(totals.qty)} />
          <StatCard icon="gift-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="FOC Qty (page)" value={fmtN(totals.foc)} />
          <StatCard icon="cash-outline" iconColor="#15803D" iconBg="#F0FDF4" label="CIF USD (page)" value={fmtUSD(totals.cif)} />
          <StatCard icon="documents-outline" iconColor="#F59E0B" iconBg="#FFFBEB" label="Total Records" value={fmtN(pagination.total)} />
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={() => fetchRecords(1)}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, styles.cardFill]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sales Records</Text>
              <Text style={styles.cardMeta}>{pagination.total} record{pagination.total === 1 ? '' : 's'}</Text>
            </View>

            {/* Pinned head */}
            <View style={styles.tblHead}>
              <Text style={[styles.tblTh, styles.colAccount]}>ACCOUNT</Text>
              <Text style={[styles.tblThNum, styles.colNum]}>QTY</Text>
              <Text style={[styles.tblThNum, styles.colNum]}>FOC QTY</Text>
              <Text style={[styles.tblTh, styles.colDate]}>SALES DATE</Text>
              <Text style={[styles.tblTh, styles.colInvoice]}>INVOICE #</Text>
              <Text style={[styles.tblThNum, styles.colVal]}>CIF (USD)</Text>
              <Text style={[styles.tblThNum, styles.colVal]}>VALUE (AED)</Text>
            </View>

            {/* Scrollable rows */}
            <ScrollView style={styles.rowsScroll} showsVerticalScrollIndicator nestedScrollEnabled>
              {!records.length ? (
                <View style={styles.tblEmpty}><Text style={styles.emptyText}>No sales records found for this item.</Text></View>
              ) : records.map((record, index) => (
                <View key={String(record._id || record.id || index)} style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}>
                  <Text style={[styles.tblTd, styles.tblTdStrong, styles.colAccount]} numberOfLines={1}>
                    {record.accountName || record.shipToAccountName || '—'}
                  </Text>
                  <Text style={[styles.tblTdNum, styles.colNum]}>{fmtN(record.quantity)}</Text>
                  <Text style={[styles.tblTdNum, styles.colNum]}>{record.freeQuantity ? fmtN(record.freeQuantity) : '—'}</Text>
                  <Text style={[styles.tblTd, styles.colDate]}>{fmtDate(record.salesDate || record.invoiceDate)}</Text>
                  <Text style={[styles.tblTd, styles.colInvoice]} numberOfLines={1}>{record.invoiceNumber || '—'}</Text>
                  <Text style={[styles.tblTdNum, styles.colVal]}>{fmtUSD(record.calculatedCifUsd)}</Text>
                  <Text style={[styles.tblTdNum, styles.colVal]}>{fmtN(record.calculatedWholesaleAed)}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Pinned pagination footer */}
            <View style={styles.tblFooter}>
              <Text style={styles.tblFooterText}>
                Page {pagination.page} of {pagination.pages || 1} · {pagination.total} records
              </Text>
              <View style={styles.tblPagination}>
                <Pressable
                  style={[styles.pageBtn, pagination.page <= 1 && styles.pageBtnDisabled]}
                  disabled={pagination.page <= 1}
                  onPress={() => fetchRecords(pagination.page - 1)}
                >
                  <Ionicons name="chevron-back" size={13} color={pagination.page <= 1 ? colors.textMuted : colors.textPrimary} />
                </Pressable>
                <View style={styles.pageCurrent}>
                  <Text style={styles.pageCurrentText}>{pagination.page}</Text>
                </View>
                <Pressable
                  style={[styles.pageBtn, pagination.page >= pagination.pages && styles.pageBtnDisabled]}
                  disabled={pagination.page >= pagination.pages}
                  onPress={() => fetchRecords(pagination.page + 1)}
                >
                  <Ionicons name="chevron-forward" size={13} color={pagination.page >= pagination.pages ? colors.textMuted : colors.textPrimary} />
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
  page: { flex: 1, minHeight: 0, padding: PAD, gap: 14 },

  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

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

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 10, ...shadow,
  },
  cardFill: { flex: 1, minHeight: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },

  /* Flexible columns — table fills available width */
  colAccount: { flex: 2.4, minWidth: 180 },
  colNum: { flex: 0.9, minWidth: 90 },
  colDate: { flex: 1.1, minWidth: 110 },
  colInvoice: { flex: 1.3, minWidth: 120 },
  colVal: { flex: 1.1, minWidth: 100 },

  tblHead: {
    flexDirection: 'row', backgroundColor: colors.primary + '0C',
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 6, gap: 28,
  },
  tblTh: { fontSize: 11, fontWeight: '800', color: colors.primary },
  tblThNum: { fontSize: 11, fontWeight: '800', color: colors.primary, textAlign: 'right' },
  rowsScroll: { flex: 1, minHeight: 0 },
  tblRow: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14, gap: 28,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  tblRowAlt: { backgroundColor: colors.backgroundColor + '70' },
  tblTd: { fontSize: 12, color: colors.textPrimary },
  tblTdNum: { fontSize: 12, color: colors.textPrimary, textAlign: 'right' },
  tblTdStrong: { fontWeight: '700' },
  tblEmpty: { padding: 24, alignItems: 'center' },
  tblFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  tblFooterText: { fontSize: 12, color: colors.textSecondary },
  tblPagination: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  pageBtnDisabled: { opacity: 0.4 },
  pageCurrent: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  pageCurrentText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
