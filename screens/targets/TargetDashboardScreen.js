import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getTargetOverview } from '../../store/targets/targetAssignmentActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1];

function StatCard({ icon, iconColor, iconBg, label, value, sub }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.statBody}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action || null}
      </View>
      {children}
    </View>
  );
}

function BarRow({ label, value, total, color, sub }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color || colors.primary }]} />
      </View>
      <Text style={styles.barValue}>{sub || fmtNum(value)}</Text>
    </View>
  );
}

const fmtNum = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const fmtCurrency = (v, currency = 'USD') => {
  if (v == null) return '—';
  const sym = currency === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

function FilterDropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ position: 'relative', zIndex: open ? 30 : 1 }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.filterBtnText}>{selected?.label || label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
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
        </View>
      )}
    </View>
  );
}

export default function TargetDashboardScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user    = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const role    = user.role || '';
  const manager = isManager(role);

  /* All hooks must be called unconditionally — redirect happens in useEffect */
  const [overview, setOverview] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [year, setYear]         = useState(String(THIS_YEAR));

  useEffect(() => {
    if (!manager) navigation.replace('MyTargetDashboard');
  }, [manager]);

  const fetch = useCallback(async () => {
    if (!manager) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTargetOverview(token, { year });
      setOverview(data);
    } catch (e) {
      setError(e.message || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [token, year, manager]);

  useEffect(() => { fetch(); }, [fetch]);

  if (!manager) return null;

  const yearOpts = YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }));

  const totalUnits = overview?.totalTargetUnits ?? 0;
  const totalValue = overview?.totalTargetValue ?? 0;
  const active     = overview?.activeAssignmentsCount ?? 0;
  const upcoming   = overview?.upcomingAssignmentsCount ?? 0;
  const expired    = overview?.expiredAssignmentsCount ?? 0;

  const byRep      = Array.isArray(overview?.targetByRep)     ? overview.targetByRep     : [];
  const byProduct  = Array.isArray(overview?.targetByProduct)  ? overview.targetByProduct  : [];
  const byChannel  = Array.isArray(overview?.targetByChannel)  ? overview.targetByChannel  : [];

  const maxRepVal     = byRep.reduce((m, r) => Math.max(m, r.totalTargetValue || 0), 0);
  const maxProdVal    = byProduct.reduce((m, r) => Math.max(m, r.totalTargetValue || 0), 0);
  const maxChanVal    = byChannel.reduce((m, r) => Math.max(m, r.totalTargetValue || 0), 0);

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetDashboard">
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Target Dashboard</Text>
          <Text style={styles.pageSubtitle}>Overview of all sales rep targets and assignments</Text>
        </View>
        <View style={styles.pageHeaderActions}>
          <FilterDropdown
            label="Year"
            options={yearOpts}
            value={year}
            onChange={setYear}
          />
          <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('TargetAssignments')}>
            <Ionicons name="flag-outline" size={14} color={colors.white} />
            <Text style={styles.btnPrimaryText}>Assignments</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.btnOutline} onPress={fetch}>
            <Text style={styles.btnOutlineText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatCard
              icon="trending-up-outline"
              iconColor="#1D4ED8"
              iconBg="#EFF6FF"
              label="Total Target Units"
              value={fmtNum(totalUnits)}
              sub={`${year} period`}
            />
            <StatCard
              icon="cash-outline"
              iconColor="#15803D"
              iconBg="#F0FDF4"
              label="Total Target Value"
              value={fmtCurrency(totalValue)}
              sub={`${year} period`}
            />
            <StatCard
              icon="checkmark-circle-outline"
              iconColor="#15803D"
              iconBg="#DCFCE7"
              label="Active Assignments"
              value={active}
            />
            <StatCard
              icon="time-outline"
              iconColor="#C2410C"
              iconBg="#FFF7ED"
              label="Upcoming"
              value={upcoming}
            />
            <StatCard
              icon="archive-outline"
              iconColor="#64748B"
              iconBg="#F1F5F9"
              label="Expired"
              value={expired}
            />
          </View>

          {/* Breakdown rows */}
          <View style={styles.breakdownGrid}>
            {/* By Rep */}
            <SectionCard
              title="Target by Rep"
              action={
                <Pressable onPress={() => navigation.navigate('TargetAssignments')}>
                  <Text style={styles.linkText}>View All</Text>
                </Pressable>
              }
            >
              {byRep.length === 0 ? (
                <Text style={styles.emptyText}>No rep data available</Text>
              ) : (
                byRep.slice(0, 8).map((r, i) => (
                  <BarRow
                    key={r.userId || i}
                    label={r.repName || r.fullName || 'Unknown'}
                    value={r.totalTargetValue || 0}
                    total={maxRepVal}
                    color={colors.primary}
                    sub={fmtCurrency(r.totalTargetValue)}
                  />
                ))
              )}
            </SectionCard>

            {/* By Product */}
            <SectionCard title="Target by Product">
              {byProduct.length === 0 ? (
                <Text style={styles.emptyText}>No product data available</Text>
              ) : (
                byProduct.slice(0, 8).map((p, i) => (
                  <BarRow
                    key={p.productId || i}
                    label={p.productName || p.productNickname || 'Unknown'}
                    value={p.totalTargetValue || 0}
                    total={maxProdVal}
                    color="#15803D"
                    sub={fmtCurrency(p.totalTargetValue)}
                  />
                ))
              )}
            </SectionCard>

            {/* By Channel */}
            <SectionCard title="Target by Channel">
              {byChannel.length === 0 ? (
                <Text style={styles.emptyText}>No channel data available</Text>
              ) : (
                byChannel.slice(0, 8).map((c, i) => (
                  <BarRow
                    key={c.channelId || i}
                    label={c.channelName || c.channelKey || 'Unknown'}
                    value={c.totalTargetValue || 0}
                    total={maxChanVal}
                    color="#7C3AED"
                    sub={fmtCurrency(c.totalTargetValue)}
                  />
                ))
              )}
            </SectionCard>
          </View>

        </ScrollView>
      )}
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'), flexWrap: 'wrap', gap: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  pageHeaderActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  scroll: { paddingBottom: globalHeight('4%'), gap: 20 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 16, ...shadow,
  },
  statIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statBody: { flex: 1, gap: 2 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statSub: { fontSize: 11, color: colors.textMuted },

  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  sectionCard: {
    flex: 1, minWidth: 280,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 18, gap: 12, ...shadow,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  linkText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 16 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel: { width: 100, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barValue: { width: 72, fontSize: 12, color: colors.textPrimary, fontWeight: '700', textAlign: 'right' },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface,
  },
  filterBtnText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  filterDropdown: {
    position: 'absolute', top: 40, left: 0, right: 0, minWidth: 120,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '15' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: {
    borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
