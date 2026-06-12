import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';
import { getMyForecast } from '../../store/forecasts/forecastActions';
import {
  coverageState,
  fmtCurrency,
  fmtNumber,
  getChannelId,
  getForecastFromResult,
  getForecastItems,
  getItemChannels,
  getItemProductId,
  getMonthLabel,
} from '../forecasts/forecastUtils';

/**
 * Live progress of how much the order being created contributes to the rep's
 * monthly target. Only items with an active target assignment (present in the
 * rep's monthly forecast for the selected channel) count toward the bar;
 * unassigned items can still be ordered but are excluded.
 */
export default function OrderTargetProgress({ channelId, items, token, userDetails }) {
  const role = String(userDetails?.user?.role || userDetails?.data?.user?.role || '').toLowerCase();
  const isRep = role === 'representative';
  const [forecast, setForecast] = useState(null);
  const now = new Date();

  useEffect(() => {
    if (!token || !isRep) return;
    getMyForecast(token, { year: now.getFullYear(), month: now.getMonth() + 1 })
      .then((result) => setForecast(getForecastFromResult(result)))
      .catch(() => setForecast(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRep, token]);

  const result = useMemo(() => {
    if (!forecast) return null;
    const forecastItems = getForecastItems(forecast);
    const targetValue = Number(forecast.totalMonthlyTargetValue) || 0;
    if (!forecastItems.length || targetValue <= 0) return null;

    const byProduct = new Map();
    forecastItems.forEach((item) => byProduct.set(String(getItemProductId(item)), getItemChannels(item)));

    let assignedValue = 0;
    let assignedCount = 0;
    let totalCount = 0;

    (items || []).forEach((entry) => {
      totalCount += 1;
      const channels = byProduct.get(String(entry.productId));
      if (!channels || !channels.length) return;
      const channel = channelId
        ? channels.find((candidate) => String(getChannelId(candidate)) === String(channelId))
        : channels[0];
      if (!channel) return;
      const basis = channel.targetValueBasis || 'cifUsd';
      const value = basis === 'wholesaleAed'
        ? entry.wholesaleAed
        : basis === 'retailAed'
          ? entry.retailAed
          : entry.cifUsd;
      assignedValue += Number(value) || 0;
      assignedCount += 1;
    });

    return {
      assignedCount,
      assignedValue,
      percentage: (assignedValue / targetValue) * 100,
      targetValue,
      totalCount,
    };
  }, [channelId, forecast, items]);

  if (!isRep || !result) return null;

  const state = coverageState(result.percentage);
  const monthLabel = `${getMonthLabel(now.getMonth() + 1)} ${now.getFullYear()}`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="flag-outline" size={15} color={colors.primary} />
          <Text style={styles.title}>Target Contribution</Text>
        </View>
        <Text style={[styles.percentage, { color: state.bar }]}>{fmtNumber(result.percentage)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { backgroundColor: state.bar, width: `${Math.min(result.percentage, 100)}%` }]} />
      </View>
      <Text style={styles.meta}>
        This order adds {fmtCurrency(result.assignedValue)} toward your {monthLabel} target of {fmtCurrency(result.targetValue)}.
      </Text>
      {result.totalCount > result.assignedCount ? (
        <Text style={styles.note}>
          {result.assignedCount} of {result.totalCount} products count toward your target (assigned items only).
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, gap: 9,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  percentage: { fontSize: 15, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: colors.border + '90', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  meta: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  note: { fontSize: 11, color: '#B45309', fontWeight: '600' },
});
