import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight } from '../../constants/globalWidth';
import { getMedicalRepProductAssignments } from '../../store/medicalRepProductAssignments/medicalRepProductAssignmentActions';

const getMedicalRepId = (user = {}) => {
  const rep = user.medicalRepId || user.medicalRep || user.repId;
  if (typeof rep === 'object' && rep) return rep._id || rep.id || rep.medicalRepId || '';
  return rep || user.medicalRepObjectId || user._id || user.id || user.userId || '';
};

const getProduct = (assignment = {}) =>
  typeof assignment.productId === 'object' && assignment.productId
    ? assignment.productId
    : assignment.product || {};

const getProductName = (assignment = {}) => {
  const product = getProduct(assignment);
  return product.productName || product.name || assignment.productName || '-';
};

const getProductNickname = (assignment = {}) => {
  const product = getProduct(assignment);
  return product.productNickname || product.nickname || assignment.productNickname || '';
};

const getAccountabilityPercentage = (assignment = {}) =>
  assignment.accountabilityPercentage ?? assignment.percentage ?? 100;

const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const isActiveAssignment = (assignment = {}) =>
  assignment.status !== 'inactive' && assignment.isActive !== false;

function StatCard({ label, value, icon, color }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

function ProductCard({ assignment }) {
  const product = getProduct(assignment);
  const productName = getProductName(assignment);
  const nickname = getProductNickname(assignment);
  const percentage = getAccountabilityPercentage(assignment);
  const status = isActiveAssignment(assignment) ? 'Active' : 'Inactive';
  const channelCount = Array.isArray(product.channelPricing) ? product.channelPricing.length : null;

  return (
    <View style={styles.productCard}>
      <View style={styles.productIcon}>
        <Ionicons name="cube-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.productBody}>
        <View style={styles.productTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
            {nickname ? <Text style={styles.productNick} numberOfLines={1}>{nickname}</Text> : null}
          </View>
          <View style={styles.percentBadge}>
            <Text style={styles.percentBadgeText}>{percentage}%</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Start</Text>
            <Text style={styles.metaValue}>{fmtDate(assignment.startDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>End</Text>
            <Text style={styles.metaValue}>{fmtDate(assignment.endDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={[styles.metaValue, status === 'Active' ? styles.activeText : styles.inactiveText]}>
              {status}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Channels</Text>
            <Text style={styles.metaValue}>{channelCount == null ? '-' : channelCount}</Text>
          </View>
        </View>

        {assignment.notes ? <Text style={styles.notes}>{assignment.notes}</Text> : null}
      </View>
    </View>
  );
}

export default function MyProductsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const medicalRepId = getMedicalRepId(user);

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    if (!medicalRepId) {
      setError('No medical rep ID found for your account.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getMedicalRepProductAssignments(token, medicalRepId);
      const sorted = (Array.isArray(data) ? data : [])
        .sort((a, b) => getProductName(a).localeCompare(getProductName(b)));
      setAssignments(sorted);
    } catch (e) {
      setError(e.message || 'Failed to load product accountability.');
    } finally {
      setLoading(false);
    }
  }, [token, medicalRepId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const stats = useMemo(() => {
    const active = assignments.filter(isActiveAssignment).length;
    const avg = assignments.length
      ? Math.round(assignments.reduce((sum, a) => sum + Number(getAccountabilityPercentage(a) || 0), 0) / assignments.length)
      : 0;
    return { active, inactive: assignments.length - active, avg };
  }, [assignments]);

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="MyProducts">
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>My Products</Text>
          <Text style={styles.pageSubtitle}>Your product accountability, period, and assignment percentage</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={fetchProducts}>
          <Ionicons name="refresh-outline" size={14} color={colors.primary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={30} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.refreshBtn} onPress={fetchProducts}>
            <Text style={styles.refreshText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.statsRow}>
            <StatCard label="Products" value={assignments.length} icon="cube-outline" color={colors.primary} />
            <StatCard label="Active" value={stats.active} icon="checkmark-circle-outline" color="#15803D" />
            <StatCard label="Inactive" value={stats.inactive} icon="pause-circle-outline" color="#64748B" />
            <StatCard label="Avg Accountability" value={`${stats.avg}%`} icon="pie-chart-outline" color="#7C3AED" />
          </View>

          {assignments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={30} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No products assigned</Text>
              <Text style={styles.emptyText}>Your product accountability assignments will appear here once your manager adds them.</Text>
            </View>
          ) : (
            <View style={styles.productList}>
              {assignments.map((assignment, index) => (
                <ProductCard key={assignment._id || assignment.id || index} assignment={assignment} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'), gap: 12, flexWrap: 'wrap',
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface,
  },
  refreshText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  errorText: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  scroll: { paddingBottom: globalHeight('4%'), gap: 16 },
  statsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 170, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, padding: 14, ...shadow,
  },
  statIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  statValue: { fontSize: 20, color: colors.textPrimary, fontWeight: '800', marginTop: 1 },
  productList: { gap: 10 },
  productCard: {
    flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, backgroundColor: colors.surface, padding: 14, ...shadow,
  },
  productIcon: {
    width: 38, height: 38, borderRadius: 8, backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  productBody: { flex: 1, gap: 10 },
  productTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  productName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  productNick: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '700' },
  percentBadge: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.primary + '14' },
  percentBadgeText: { fontSize: 12, color: colors.primary, fontWeight: '800' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaItem: { minWidth: 120, backgroundColor: colors.backgroundColor, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  metaLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '800', textTransform: 'uppercase' },
  metaValue: { fontSize: 12, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  activeText: { color: '#15803D' },
  inactiveText: { color: '#64748B' },
  notes: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  emptyBox: {
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, backgroundColor: colors.surface, padding: 36,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
