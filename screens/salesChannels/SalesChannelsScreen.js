import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listSalesChannels,
  updateSalesChannelStatus,
  deleteSalesChannel,
} from '../../store/salesChannels/salesChannelActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

/* ─── Status badge ──────────────────────────────────────────────────────── */
function StatusBadge({ active }) {
  return (
    <View style={[styles.statusBadge, active ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
      <View style={[styles.statusDot, { backgroundColor: active ? colors.success : colors.danger }]} />
      <Text style={[styles.statusBadgeText, { color: active ? colors.success : colors.danger }]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

/* ─── FOC badge ─────────────────────────────────────────────────────────── */
function FocBadge({ enabled }) {
  return (
    <View style={[styles.focBadge, enabled ? styles.focBadgeOn : styles.focBadgeOff]}>
      <Ionicons
        name={enabled ? 'checkmark-circle' : 'close-circle'}
        size={13}
        color={enabled ? colors.success : colors.textMuted}
      />
      <Text style={[styles.focBadgeText, { color: enabled ? colors.success : colors.textMuted }]}>
        {enabled ? 'Enabled' : 'Disabled'}
      </Text>
    </View>
  );
}

/* ─── Status filter ─────────────────────────────────────────────────────── */
function StatusFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const opts = [
    { key: '', label: 'All Status' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
  ];
  const sel = opts.find((o) => o.key === value) || opts[0];
  return (
    <View style={{ zIndex: 10 }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.filterBtnText}>{sel.label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          {opts.map((o) => (
            <Pressable
              key={o.key}
              style={[styles.filterOpt, value === o.key && styles.filterOptActive]}
              onPress={() => { onChange(o.key); setOpen(false); }}
            >
              <Text style={[styles.filterOptText, value === o.key && styles.filterOptTextActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Row action menu ───────────────────────────────────────────────────── */
function RowMenu({ channel, isActive, onEdit, onToggleStatus, onDelete, onClose }) {
  return (
    <View style={styles.rowMenu}>
      <Pressable style={styles.rowMenuItem} onPress={() => { onEdit(channel); onClose(); }}>
        <Ionicons name="pencil-outline" size={14} color={colors.primary} />
        <Text style={[styles.rowMenuText, { color: colors.primary }]}>Edit</Text>
      </Pressable>
      <View style={styles.rowMenuDivider} />
      <Pressable style={styles.rowMenuItem} onPress={() => { onToggleStatus(channel, isActive); onClose(); }}>
        <Ionicons
          name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
          size={14}
          color={isActive ? colors.danger : colors.success}
        />
        <Text style={[styles.rowMenuText, { color: isActive ? colors.danger : colors.success }]}>
          {isActive ? 'Deactivate' : 'Activate'}
        </Text>
      </Pressable>
      <View style={styles.rowMenuDivider} />
      <Pressable style={styles.rowMenuItem} onPress={() => { onDelete(channel); onClose(); }}>
        <Ionicons name="trash-outline" size={14} color={colors.danger} />
        <Text style={[styles.rowMenuText, { color: colors.danger }]}>Delete</Text>
      </Pressable>
    </View>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function SalesChannelsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const managerRole = isManager(role);
  // Only admin/manager can create or edit channels; senior managers get a read-only view.
  const canEdit = ['admin', 'manager'].includes(String(role).toLowerCase());
  const viewerOnly = managerRole && !canEdit;

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await listSalesChannels(token, params);
      setChannels(res.channels || []);
    } catch (e) {
      setError(e.message || 'Failed to load sales channels');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const handleToggleStatus = async (channel, currentlyActive) => {
    try {
      await updateSalesChannelStatus(token, channel._id, {
        status: currentlyActive ? 'inactive' : 'active',
        isActive: !currentlyActive,
      });
      fetchChannels();
    } catch (e) {
      alert(e.message || 'Failed to update status');
    }
  };

  const handleDelete = async (channel) => {
    if (!window.confirm(`Delete "${channel.channelName}"? This cannot be undone.`)) return;
    try {
      await deleteSalesChannel(token, channel._id);
      fetchChannels();
    } catch (e) {
      alert(e.message || 'Failed to delete channel');
    }
  };

  const filtered = channels.filter((ch) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (ch.channelName || '').toLowerCase().includes(q) ||
      (ch.channelKey || '').toLowerCase().includes(q) ||
      (ch.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <AppShell
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="SalesChannels"
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Sales Channels</Text>
          <Text style={styles.pageSubtitle}>
            Manage channels used for product pricing and FOC configuration
          </Text>
        </View>
        {canEdit && (
          <Pressable
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('SalesChannelForm', { mode: 'create' })}
          >
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.btnPrimaryText}>Add Channel</Text>
          </Pressable>
        )}
      </View>

      {viewerOnly && (
        <View style={styles.readOnlyBanner}>
          <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.readOnlyBannerText}>
            View-only — sales channels are managed by line managers. You can review them but not create or edit.
          </Text>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total Channels', value: channels.length, icon: 'radio-button-on', iconColor: colors.primary, iconBg: '#E8F0FF' },
          { label: 'Active', value: channels.filter((c) => c.isActive !== false && c.status !== 'inactive').length, icon: 'checkmark-circle-outline', iconColor: colors.success, iconBg: '#E7F8EF' },
          { label: 'FOC Enabled', value: channels.filter((c) => c.focEnabled).length, icon: 'trending-up-outline', iconColor: '#F97316', iconBg: '#FFF3E0' },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.iconBg }]}>
              <Ionicons name={s.icon} size={20} color={s.iconColor} />
            </View>
            <View>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Table card */}
      <View style={styles.tableCard}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search channels..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
        </View>

        {/* Table head */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2 }]}>Channel Name</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Channel Key</Text>
          <Text style={[styles.th, { flex: 1 }]}>FOC</Text>
          <Text style={[styles.th, { flex: 1 }]}>Status</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Created At</Text>
          <Text style={[styles.th, { flex: 1 }]}>Actions</Text>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading channels...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={fetchChannels}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="radio-button-on-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {channels.length === 0 ? 'No sales channels yet.' : 'No channels match your search.'}
            </Text>
            {canEdit && channels.length === 0 && (
              <Pressable
                style={styles.btnPrimary}
                onPress={() => navigation.navigate('SalesChannelForm', { mode: 'create' })}
              >
                <Ionicons name="add" size={15} color={colors.white} />
                <Text style={styles.btnPrimaryText}>Add First Channel</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filtered.map((ch, idx) => {
            const active = ch.isActive !== false && ch.status !== 'inactive';
            const menuOpen = openMenuId === ch._id;
            return (
              <View
                key={ch._id || idx}
                style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt, { zIndex: filtered.length - idx }]}
              >
                {/* Channel Name */}
                <View style={[styles.td, { flex: 2 }]}>
                  <Text style={styles.cellPrimary} numberOfLines={1}>{ch.channelName || '—'}</Text>
                  {ch.description ? (
                    <Text style={styles.cellSub} numberOfLines={1}>{ch.description}</Text>
                  ) : null}
                </View>

                {/* Channel Key */}
                <View style={[styles.td, { flex: 1.5 }]}>
                  <Text style={styles.cellMono} numberOfLines={1}>{ch.channelKey || '—'}</Text>
                </View>

                {/* FOC */}
                <View style={[styles.td, { flex: 1 }]}>
                  <FocBadge enabled={ch.focEnabled} />
                </View>

                {/* Status */}
                <View style={[styles.td, { flex: 1 }]}>
                  <StatusBadge active={active} />
                </View>

                {/* Created At + creator */}
                <View style={[styles.td, { flex: 1.5 }]}>
                  <Text style={styles.cellSub}>
                    {ch.createdAt ? moment(ch.createdAt).format('DD/MM/YYYY') : '—'}
                  </Text>
                  {(ch.createdByName || ch.createdBy?.fullName || ch.createdBy?.name) ? (
                    <Text style={styles.cellSub} numberOfLines={1}>
                      by {ch.createdByName || ch.createdBy?.fullName || ch.createdBy?.name}
                    </Text>
                  ) : null}
                </View>

                {/* Actions */}
                <View style={[styles.td, { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                  {canEdit ? (
                    <>
                      <Pressable
                        style={styles.actionIcon}
                        onPress={() => navigation.navigate('SalesChannelForm', { mode: 'edit', channelId: ch._id })}
                      >
                        <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                      </Pressable>
                      <View style={{ zIndex: menuOpen ? 9999 : 1 }}>
                        <Pressable
                          style={styles.actionIcon}
                          onPress={() => setOpenMenuId(menuOpen ? null : ch._id)}
                        >
                          <Ionicons name="ellipsis-vertical" size={15} color={colors.textSecondary} />
                        </Pressable>
                        {menuOpen && (
                          <RowMenu
                            channel={ch}
                            isActive={active}
                            onEdit={(c) => navigation.navigate('SalesChannelForm', { mode: 'edit', channelId: c._id })}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDelete}
                            onClose={() => setOpenMenuId(null)}
                          />
                        )}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.cellMuted}>—</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'),
  },
  pageTitle: { fontSize: globalWidth('1.15%'), fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: globalWidth('0.65%'), color: colors.textSecondary, marginTop: 3 },
  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  readOnlyBannerText: { flex: 1, fontSize: globalWidth('0.62%'), color: colors.textSecondary, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: globalWidth('1%'), marginBottom: globalHeight('1.5%'), flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 16, ...shadow,
  },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: globalWidth('0.58%'), color: colors.textSecondary },
  statValue: { fontSize: globalWidth('1.1%'), fontWeight: '800', color: colors.textPrimary, marginTop: 2 },

  tableCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, ...shadow,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap',
  },
  searchWrap: {
    flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, height: 36, backgroundColor: colors.backgroundColor,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 36, backgroundColor: colors.surface, minWidth: 120,
  },
  filterBtnText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  filterDropdown: {
    position: 'absolute', top: 40, left: 0, minWidth: 140,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, zIndex: 100, ...shadow,
  },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 10 },
  filterOptActive: { backgroundColor: colors.primary + '12' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundColor,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: { fontSize: globalWidth('0.6%'), fontWeight: '700', color: colors.textSecondary },

  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tableRowAlt: { backgroundColor: colors.backgroundColor },
  td: { justifyContent: 'center', paddingRight: 8 },

  cellPrimary: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cellSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cellMono: { fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' },
  cellMuted: { fontSize: 13, color: colors.textMuted },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  statusBadgeActive: { backgroundColor: '#E7F8EF' },
  statusBadgeInactive: { backgroundColor: '#FEF2F2' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  focBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  focBadgeOn: { backgroundColor: '#E7F8EF' },
  focBadgeOff: { backgroundColor: colors.backgroundColor },
  focBadgeText: { fontSize: 12, fontWeight: '600' },

  actionIcon: {
    width: 30, height: 30, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.backgroundColor,
  },
  rowMenu: {
    position: 'absolute', right: 0, top: 34, width: 160,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, zIndex: 200, ...shadow,
  },
  rowMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  rowMenuText: { fontSize: 13, fontWeight: '600' },
  rowMenuDivider: { height: 1, backgroundColor: colors.border },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  centered: { alignItems: 'center', padding: 40, gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13 },
  emptyText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  retryBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
