import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getAccountsReport } from '../../store/planning/planningActions';
import { fmtDisplayDate, fmtNum, fmtUSD, isManagerRole, isoDate } from './planningUtils';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const startOfYear = () => isoDate(new Date(new Date().getFullYear(), 0, 1));

function StatCard({ icon, iconColor, iconBg, label, value }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}><Ionicons name={icon} size={18} color={iconColor} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

export default function PlanningReportsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManagerRole(user.role || '');

  const [dateFrom, setDateFrom] = useState(startOfYear());
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [applied, setApplied] = useState({ dateFrom: startOfYear(), dateTo: isoDate(new Date()) });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState('');

  const fetchReport = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      setData(await getAccountsReport(token, applied));
    } catch (err) {
      setError(err.message || 'Failed to load planning report.');
    } finally {
      setLoading(false);
    }
  }, [applied, token]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const cards = data?.summaryCards || {};
  const accounts = data?.accounts || [];

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="PlanningReports">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Planning Reports</Text>
            <Text style={styles.pageSubtitle}>Visits planned and business value from assigned items</Text>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>From</Text>
              <TextInput style={styles.input} value={dateFrom} onChangeText={setDateFrom} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>To</Text>
              <TextInput style={styles.input} value={dateTo} onChangeText={setDateTo} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
            </View>
            <Pressable style={styles.btnPrimary} onPress={() => setApplied({ dateFrom, dateTo })}>
              <Ionicons name="options-outline" size={13} color="#fff" />
              <Text style={styles.btnPrimaryText}>Apply</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard icon="business-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Accounts Planned" value={fmtNum(cards.totalAccountsPlanned)} />
          <StatCard icon="navigate-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="Planned Visits" value={fmtNum(cards.totalPlannedVisits)} />
          <StatCard icon="checkmark-done-outline" iconColor="#15803D" iconBg="#F0FDF4" label="Submitted Visits" value={fmtNum(cards.totalSubmittedVisits)} />
          <StatCard icon="cash-outline" iconColor="#15803D" iconBg="#DCFCE7" label="Business Value" value={fmtUSD(cards.totalBusinessValue)} />
          <StatCard icon="cube-outline" iconColor="#F59E0B" iconBg="#FFFBEB" label="Business Units" value={fmtNum(cards.totalBusinessUnits)} />
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchReport}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>By Account</Text>
              <Text style={styles.cardMeta}>{accounts.length} account{accounts.length === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.tblHead}>
              <Text style={[styles.tblTh, { flex: 2 }]}>ACCOUNT</Text>
              {manager ? <Text style={[styles.tblTh, { flex: 1.2 }]}>REP</Text> : null}
              <Text style={[styles.tblThNum, { flex: 0.9 }]}>PLANNED</Text>
              <Text style={[styles.tblThNum, { flex: 0.9 }]}>SUBMITTED</Text>
              <Text style={[styles.tblTh, { flex: 1.2 }]}>LAST PLANNED</Text>
              <Text style={[styles.tblThNum, { flex: 1 }]}>UNITS</Text>
              <Text style={[styles.tblThNum, { flex: 1.1 }]}>VALUE</Text>
              <Text style={[styles.tblTh, { width: 36 }]} />
            </View>
            {!accounts.length ? (
              <Text style={styles.emptyText}>No report data for the selected period.</Text>
            ) : accounts.map((account, index) => {
              const key = String(account.planningAccountId);
              const open = expanded === key;
              return (
                <View key={key}>
                  <Pressable style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]} onPress={() => setExpanded(open ? '' : key)}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tblTdStrong} numberOfLines={1}>{account.accountName}</Text>
                      {account.needsReview ? <Text style={styles.reviewTag}>custom · value not matched</Text> : null}
                    </View>
                    {manager ? <Text style={[styles.tblTd, { flex: 1.2 }]} numberOfLines={1}>{account.userName}</Text> : null}
                    <Text style={[styles.tblTdNum, { flex: 0.9 }]}>{account.plannedVisitsCount}</Text>
                    <Text style={[styles.tblTdNum, { flex: 0.9 }]}>{account.submittedVisitsCount}</Text>
                    <Text style={[styles.tblTd, { flex: 1.2 }]}>{fmtDisplayDate(account.lastPlannedVisit)}</Text>
                    <Text style={[styles.tblTdNum, { flex: 1 }]}>{fmtNum(account.assignedProductsSalesUnits)}</Text>
                    <Text style={[styles.tblTdNum, { flex: 1.1, fontWeight: '800' }]}>{fmtUSD(account.assignedProductsSalesValue)}</Text>
                    <View style={{ width: 36, alignItems: 'center' }}>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textMuted} />
                    </View>
                  </Pressable>
                  {open ? (
                    <View style={styles.productWrap}>
                      {account.products.length ? (
                        <>
                          <View style={styles.prodHead}>
                            <Text style={[styles.prodTh, { flex: 2 }]}>PRODUCT</Text>
                            <Text style={[styles.prodThNum, { flex: 1 }]}>SALES UNITS</Text>
                            <Text style={[styles.prodThNum, { flex: 1 }]}>SALES VALUE</Text>
                          </View>
                          {account.products.map((product) => (
                            <View key={String(product.productId)} style={styles.prodRow}>
                              <Text style={[styles.prodTd, { flex: 2 }]} numberOfLines={1}>{product.productNickname || product.productName}</Text>
                              <Text style={[styles.prodTdNum, { flex: 1 }]}>{fmtNum(product.salesUnits)}</Text>
                              <Text style={[styles.prodTdNum, { flex: 1 }]}>{fmtUSD(product.salesValue)}</Text>
                            </View>
                          ))}
                        </>
                      ) : (
                        <Text style={styles.emptyText}>No business from assigned items in this period.</Text>
                      )}
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
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  filterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dateField: { gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surface, fontSize: 12, color: colors.textPrimary, minWidth: 120 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: 140, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, ...shadow },
  statIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8, ...shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textMuted },

  tblHead: { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6, gap: 12, alignItems: 'center' },
  tblTh: { fontSize: 10, fontWeight: '800', color: colors.primary },
  tblThNum: { fontSize: 10, fontWeight: '800', color: colors.primary, textAlign: 'right' },
  tblRow: { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tblRowAlt: { backgroundColor: colors.backgroundColor + '70' },
  tblTd: { fontSize: 12, color: colors.textPrimary },
  tblTdNum: { fontSize: 12, color: colors.textPrimary, textAlign: 'right' },
  tblTdStrong: { fontSize: 12.5, color: colors.textPrimary, fontWeight: '700' },
  reviewTag: { fontSize: 9.5, color: '#B45309', fontWeight: '700', marginTop: 2 },

  productWrap: { backgroundColor: colors.surfaceSoft, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  prodHead: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  prodTh: { fontSize: 9.5, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' },
  prodThNum: { fontSize: 9.5, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', textAlign: 'right' },
  prodRow: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border + '60' },
  prodTd: { fontSize: 12, color: colors.textPrimary },
  prodTdNum: { fontSize: 12, color: colors.textPrimary, textAlign: 'right' },

  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 14 },
  centered: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
