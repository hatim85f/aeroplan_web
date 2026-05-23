import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getLineById, removeLineMember, inviteToLine, deleteLine } from '../../store/lines/linesActions';
import { getProfilePicture } from '../../constants/profile';

const isManager = (role) => ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const LINE_COLORS = ['#8B5CF6', '#0F6FFF', '#F97316', '#22C55E', '#EF4444', '#F6A900'];

function getColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return LINE_COLORS[Math.abs(h) % LINE_COLORS.length];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'LN';
}

function StatusPill({ active }) {
  return (
    <View style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
      <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

function Avatar({ name, size = 32, imageUrl }) {
  const bg = getColor(name);
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg + '33' }]}>
      <Text style={[styles.avatarText, { color: bg, fontSize: size * 0.35 }]}>{getInitials(name)}</Text>
    </View>
  );
}

/* ─── Tabs ──────────────────────────────────────────────────────────────── */
const TABS = ['Teams Under This Line', 'Line Information', 'Members', 'About'];

/* ─── Teams Tab ─────────────────────────────────────────────────────────── */
function TeamsTab({ teams = [], navigation }) {
  if (!teams.length) {
    return (
      <View style={styles.tabEmpty}>
        <Ionicons name="people-outline" size={28} color={colors.textMuted} />
        <Text style={styles.tabEmptyText}>No teams under this line yet.</Text>
      </View>
    );
  }
  return (
    <View>
      {/* Table head */}
      <View style={styles.tableHead}>
        <Text style={[styles.th, { flex: 2 }]}>Team</Text>
        <Text style={[styles.th, { flex: 1.5 }]}>Manager</Text>
        <Text style={[styles.th, { flex: 1 }]}>Members</Text>
        <Text style={[styles.th, { flex: 1.5 }]}>Territory</Text>
        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
      </View>
      {teams.map((team, idx) => {
        const tid = team._id || team.id || team.teamId;
        const tname = team.teamName || team.name || 'Unnamed';
        const manager = team.manager?.fullName || team.managerName || '—';
        const members = team.members?.length || team.memberCount || 0;
        const territory = team.territory || '—';
        const active = team.isActive !== false && team.status !== 'inactive';
        const tlogo = team.teamLogo || team.logo;
        return (
          <Pressable
            key={tid || idx}
            style={styles.tableRow}
            onPress={() => navigation.navigate('TeamDetail', { teamId: tid })}
          >
            <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <Avatar name={tname} size={28} imageUrl={tlogo} />
              <Text style={styles.cellPrimary} numberOfLines={1}>{tname}</Text>
            </View>
            <View style={[styles.td, { flex: 1.5 }]}>
              <Text style={styles.cellSecondary}>{manager}</Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <Text style={styles.cellSecondary}>{members}</Text>
            </View>
            <View style={[styles.td, { flex: 1.5 }]}>
              <Text style={styles.cellSecondary}>{territory}</Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <StatusPill active={active} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Members Tab ───────────────────────────────────────────────────────── */
function MembersTab({ members = [], isManagerRole, token, lineId, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [removingId, setRemovingId] = useState(null);

  const filtered = members.filter((m) => {
    const name = m.fullName || m.name || m.displayName || '';
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const active = m.isActive !== false && m.status !== 'inactive';
    const matchFilter = filter === 'All' || (filter === 'Active' && active) || (filter === 'Inactive' && !active);
    return matchSearch && matchFilter;
  });

  const handleRemove = async (userId) => {
    if (!window.confirm('Remove this member from the line?')) return;
    setRemovingId(userId);
    try {
      await removeLineMember(token, lineId, userId);
      onRefresh();
    } catch (e) {
      alert(e.message || 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <View>
      <View style={styles.membersToolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={13} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.filterRow}>
          {['All', 'Active', 'Inactive'].map((f) => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {filtered.length === 0 ? (
        <View style={styles.tabEmpty}>
          <Text style={styles.tabEmptyText}>No members found.</Text>
        </View>
      ) : (
        filtered.map((m, idx) => {
          const uid = m._id || m.id || m.userId;
          const name = m.fullName || m.name || m.displayName || 'Unknown';
          const appId = m.appId || m.representativeId || '—';
          const active = m.isActive !== false && m.status !== 'inactive';
          const pic = getProfilePicture(m);
          return (
            <View key={uid || idx} style={styles.memberRow}>
              <Avatar name={name} size={36} imageUrl={pic} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{name}</Text>
                <Text style={styles.memberAppId}>{appId}</Text>
              </View>
              <StatusPill active={active} />
              {isManagerRole && (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => handleRemove(uid)}
                  disabled={removingId === uid}
                >
                  {removingId === uid
                    ? <ActivityIndicator size={14} color={colors.danger} />
                    : <Ionicons name="person-remove-outline" size={15} color={colors.danger} />}
                </Pressable>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

/* ─── Line Information Tab ──────────────────────────────────────────────── */
function LineInfoTab({ line, lineId, membersCount }) {
  const fields = [
    { label: 'Line ID', value: lineId || '—' },
    { label: 'Line Name', value: line?.lineName || line?.name || line?.title || '—' },
    { label: 'Description', value: line?.description || 'No description' },
    { label: 'Status', value: line?.isActive === false || line?.status === 'inactive' ? 'Inactive' : 'Active' },
    { label: 'Members', value: String(membersCount) },
    { label: 'Created', value: line?.createdAt ? new Date(line.createdAt).toLocaleDateString() : '—' },
    { label: 'Updated', value: line?.updatedAt ? new Date(line.updatedAt).toLocaleDateString() : '—' },
  ];
  return (
    <View style={styles.infoGrid}>
      {fields.map(({ label, value }) => (
        <View key={label} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ─── About Tab ─────────────────────────────────────────────────────────── */
function AboutTab({ line }) {
  return (
    <View style={styles.aboutSection}>
      <Text style={styles.aboutTitle}>About This Line</Text>
      <Text style={styles.aboutBody}>{line?.description || 'No description provided.'}</Text>
    </View>
  );
}

/* ─── Right Panel ───────────────────────────────────────────────────────── */
function RightPanel({ line }) {
  return (
    <View style={styles.rightPanel}>
      <View style={styles.panelCard}>
        <Text style={styles.panelCardTitle}>Line Performance (MTD)</Text>
        <View style={styles.perfRow}>
          <View style={styles.perfItem}>
            <Text style={styles.perfValue}>$0</Text>
            <Text style={styles.perfLabel}>MTD Sales</Text>
          </View>
          <View style={styles.perfItem}>
            <Text style={styles.perfValue}>—%</Text>
            <Text style={styles.perfLabel}>Achievement</Text>
          </View>
        </View>
      </View>

      <View style={styles.panelCard}>
        <Text style={styles.panelCardTitle}>Top Performing Teams</Text>
        {(line?.teams?.slice(0, 3) || []).map((t, i) => (
          <View key={i} style={styles.topTeamRow}>
            <Avatar name={t.teamName || t.name || 'Team'} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={styles.topTeamName}>{t.teamName || t.name || 'Team'}</Text>
              <Text style={styles.topTeamSub}>{t.territory || '—'}</Text>
            </View>
            <Text style={styles.topTeamScore}>{i + 1}st</Text>
          </View>
        ))}
        {(!line?.teams || line.teams.length === 0) && (
          <Text style={styles.tabEmptyText}>No team data available.</Text>
        )}
      </View>
    </View>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────────── */
export default function LineDetailScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const routeLineId = route?.params?.lineId;
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const isManagerRole = isManager(role);

  const [line, setLine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [inviteId, setInviteId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [deletingLine, setDeletingLine] = useState(false);

  const fetchLine = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLineById(token, routeLineId);
      setLine(data);
    } catch (e) {
      setError(e.message || 'Failed to load line');
    } finally {
      setLoading(false);
    }
  }, [token, routeLineId]);

  useEffect(() => { fetchLine(); }, [fetchLine]);

  const handleInvite = async () => {
    setInviteError('');
    setInviteSuccess('');
    if (!inviteId.trim()) { setInviteError('Enter a Rep App ID'); return; }
    if (!lineId) { setInviteError('Line ID is missing'); return; }
    setInviteLoading(true);
    try {
      await inviteToLine(token, {
        appId: inviteId.trim(),
        lineId,
        message: `Please join the ${name} line`,
      });
      setInviteSuccess('Invitation sent successfully!');
      setInviteId('');
      fetchLine();
    } catch (e) {
      setInviteError(e.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeleteLine = async () => {
    if (!window.confirm('Are you sure you want to delete this line?')) return;
    setDeletingLine(true);
    try {
      await deleteLine(token, lineId);
      navigation.navigate('Lines');
    } catch (e) {
      alert(e.message || 'Failed to delete line');
      setDeletingLine(false);
    }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Lines">
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading line...</Text>
        </View>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Lines">
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchLine}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  const name = line?.lineName || line?.name || line?.title || 'Line';
  const desc = line?.description || '';
  const active = line?.isActive !== false && line?.status !== 'inactive';
  const lineId = line?.lineId || line?._id || line?.id || routeLineId;
  const teams = Array.isArray(line?.teams) ? line.teams : [];
  const members = Array.isArray(line?.members) ? line.members : [];
  const membersCount =
    members.length ||
    line?.numberOfMembers ||
    line?.memberCount ||
    line?.membersCount ||
    0;
  const lineColor = getColor(name);

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Lines"
    >
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Lines')}>
          <Text style={styles.breadcrumbLink}>Lines</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{name}</Text>
      </View>

      {/* Two-column layout */}
      <View style={styles.twoCol}>
        {/* Left column */}
        <View style={styles.leftCol}>
          {/* Line header card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              {(line?.lineLogo || line?.logo) ? (
                <Image
                  source={{ uri: line.lineLogo || line.logo }}
                  style={[styles.largeCircle]}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.largeCircle, { backgroundColor: lineColor }]}>
                  <Text style={styles.largeCircleText}>{getInitials(name)}</Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                <Text style={styles.lineName}>{name}</Text>
                {desc ? <Text style={styles.lineDesc}>{desc}</Text> : null}
                <View style={styles.headerMeta}>
                  <StatusPill active={active} />
                  <Text style={styles.metaText}>Line ID: {lineId || '—'}</Text>
                  <Text style={styles.metaText}>
                    {membersCount} Member{membersCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>

            {isManagerRole && (
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.btnOutline}
                  onPress={() => navigation.navigate('CreateLine', { lineId: routeLineId })}
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                  <Text style={styles.btnOutlineText}>Edit Line</Text>
                </Pressable>
                <Pressable
                  style={styles.btnDanger}
                  onPress={handleDeleteLine}
                  disabled={deletingLine}
                >
                  {deletingLine
                    ? <ActivityIndicator size={14} color={colors.danger} />
                    : <Ionicons name="trash-outline" size={14} color={colors.danger} />}
                  <Text style={styles.btnDangerText}>Delete Line</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Invite Rep (manager only) */}
          {isManagerRole && (
            <View style={styles.inviteCard}>
              <Text style={styles.inviteTitle}>Invite Representative</Text>
              <View style={styles.inviteRow}>
                <TextInput
                  style={styles.inviteInput}
                  placeholder="Enter Rep App ID: AP-123456"
                  placeholderTextColor={colors.textMuted}
                  value={inviteId}
                  onChangeText={setInviteId}
                />
                <Pressable
                  style={styles.btnPrimary}
                  onPress={handleInvite}
                  disabled={inviteLoading}
                >
                  {inviteLoading
                    ? <ActivityIndicator size={14} color={colors.white} />
                    : <Text style={styles.btnPrimaryText}>Invite</Text>}
                </Pressable>
              </View>
              {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
              {inviteSuccess ? <Text style={styles.successText}>{inviteSuccess}</Text> : null}
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabsCard}>
            <View style={styles.tabBar}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.tabContent}>
              {activeTab === 'Teams Under This Line' && (
                <TeamsTab teams={teams} navigation={navigation} />
              )}
              {activeTab === 'Members' && (
                <MembersTab
                  members={members}
                  isManagerRole={isManagerRole}
                  token={token}
                  lineId={lineId}
                  onRefresh={fetchLine}
                />
              )}
              {activeTab === 'Line Information' && <LineInfoTab line={line} lineId={lineId} membersCount={membersCount} />}
              {activeTab === 'About' && <AboutTab line={line} />}
            </View>
          </View>
        </View>

        {/* Right panel */}
        <RightPanel line={line} />
      </View>
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const shadow = {
  shadowColor: '#0B2B66',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  centered: { alignItems: 'center', padding: 32, gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13 },
  retryBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.5%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  twoCol: { flexDirection: 'row', gap: globalWidth('1.2%'), alignItems: 'flex-start' },
  leftCol: { flex: 0.65, gap: globalHeight('1.2%') },

  headerCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, padding: 18, ...shadow, gap: 14,
  },
  headerTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  largeCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  largeCircleText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  headerInfo: { flex: 1, gap: 4 },
  lineName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  lineDesc: { fontSize: 13, color: colors.textSecondary },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.textSecondary },

  headerActions: { flexDirection: 'row', gap: 10 },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.danger,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7,
  },
  btnDangerText: { color: colors.danger, fontSize: 13, fontWeight: '700' },

  inviteCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, padding: 16, ...shadow, gap: 10,
  },
  inviteTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  inviteRow: { flexDirection: 'row', gap: 8 },
  inviteInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 38, fontSize: 13, color: colors.textPrimary,
    outlineStyle: 'none',
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  tabsCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, overflow: 'hidden', ...shadow,
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingHorizontal: 16, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  tabContent: { padding: 0 },

  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundColor,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  td: { justifyContent: 'center', paddingRight: 8 },
  cellPrimary: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cellSecondary: { fontSize: 12, color: colors.textSecondary },

  tabEmpty: { alignItems: 'center', padding: 28, gap: 8 },
  tabEmptyText: { fontSize: 13, color: colors.textMuted },

  membersToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, flexWrap: 'wrap' },
  searchWrap: {
    flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, height: 36,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: colors.white },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  memberAppId: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  removeBtn: {
    width: 30, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },

  infoGrid: { padding: 16, gap: 14 },
  infoRow: { flexDirection: 'row', gap: 16 },
  infoLabel: { width: 120, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary },

  aboutSection: { padding: 16, gap: 8 },
  aboutTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  aboutBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },

  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  pillActive: { backgroundColor: '#E7F8EF' },
  pillInactive: { backgroundColor: '#FFF4EE' },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextActive: { color: colors.success },
  pillTextInactive: { color: '#F97316' },

  rightPanel: { flex: 0.35, gap: globalHeight('1.2%') },
  panelCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, padding: 16, ...shadow, gap: 12,
  },
  panelCardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  perfRow: { flexDirection: 'row', gap: 12 },
  perfItem: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: colors.backgroundColor, borderRadius: 8 },
  perfValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  perfLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  topTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  topTeamName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  topTeamSub: { fontSize: 11, color: colors.textSecondary },
  topTeamScore: { fontSize: 12, fontWeight: '800', color: colors.primary },
});
