import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  getPendingInvitations,
  getInvitationHistory,
  acceptInvitation,
  rejectInvitation,
} from '../../store/teamInvitations/teamInvitationsActions';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

const PALETTE = ['#8B5CF6', '#0F6FFF', '#F97316', '#22C55E', '#EF4444'];
function getColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function Avatar({ name, size = 36 }) {
  const bg = getColor(name);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg + '33' }]}>
      <Text style={[styles.avatarText, { color: bg, fontSize: size * 0.35 }]}>{getInitials(name)}</Text>
    </View>
  );
}

/* ─── Invitation Card ───────────────────────────────────────────────────── */
function InvitationCard({ invitation, onAccept, onReject, loading, hasTeam }) {
  const teamName = invitation.team?.teamName || invitation.team?.name || invitation.teamName || 'Unknown Team';
  const lineName = invitation.line?.lineName || invitation.line?.name || invitation.lineName || '—';
  const territory = invitation.team?.territory || invitation.territory || '—';
  const managerName = invitation.manager?.fullName || invitation.managerName || '—';
  const invitedDate = invitation.createdAt
    ? new Date(invitation.createdAt).toLocaleDateString()
    : '—';

  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteCardHeader}>
        <Avatar name={teamName} size={44} />
        <View style={styles.inviteCardInfo}>
          <Text style={styles.inviteTeamName}>{teamName}</Text>
          <View style={styles.inviteMetaRow}>
            <Text style={styles.inviteMetaItem}>
              <Text style={styles.inviteMetaKey}>Line: </Text>{lineName}
            </Text>
            <Text style={styles.inviteMetaDot}> · </Text>
            <Text style={styles.inviteMetaItem}>
              <Text style={styles.inviteMetaKey}>Territory: </Text>{territory}
            </Text>
          </View>
          <View style={styles.inviteMetaRow}>
            <Text style={styles.inviteMetaItem}>
              <Text style={styles.inviteMetaKey}>Manager: </Text>{managerName}
            </Text>
            <Text style={styles.inviteMetaDot}> · </Text>
            <Text style={styles.inviteMetaItem}>
              <Text style={styles.inviteMetaKey}>Invited: </Text>{invitedDate}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.inviteActions}>
        <Pressable
          style={[styles.acceptBtn, (loading || hasTeam) && styles.btnDisabled]}
          onPress={onAccept}
          disabled={loading || hasTeam}
        >
          {loading === 'accepting'
            ? <ActivityIndicator size={14} color={colors.success} />
            : <Ionicons name="checkmark-outline" size={15} color={colors.success} />}
          <Text style={styles.acceptBtnText}>Accept</Text>
        </Pressable>
        <Pressable
          style={[styles.rejectBtn, loading && styles.btnDisabled]}
          onPress={onReject}
          disabled={!!loading}
        >
          {loading === 'rejecting'
            ? <ActivityIndicator size={14} color={colors.danger} />
            : <Ionicons name="close-outline" size={15} color={colors.danger} />}
          <Text style={styles.rejectBtnText}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── History Row ───────────────────────────────────────────────────────── */
function HistoryStatusPill({ status }) {
  const s = String(status).toLowerCase();
  return (
    <View style={[styles.histPill, s === 'accepted' ? styles.histPillAccepted : styles.histPillRejected]}>
      <Text style={[styles.histPillText, s === 'accepted' ? styles.histPillTextAccepted : styles.histPillTextRejected]}>
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </Text>
    </View>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────────── */
export default function TeamInvitationsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';

  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [actionLoading, setActionLoading] = useState({}); // { [id]: 'accepting' | 'rejecting' }
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const userTeam = user?.team || user?.teamId || null;

  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const data = await getPendingInvitations(token);
      setPending(Array.isArray(data) ? data : []);
    } catch { setPending([]); }
    finally { setLoadingPending(false); }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await getInvitationHistory(token);
      const list = Array.isArray(data) ? data : [];
      setHistory(list.filter((inv) => {
        const s = String(inv.status || '').toLowerCase();
        return s === 'accepted' || s === 'rejected';
      }));
    } catch { setHistory([]); }
    finally { setLoadingHistory(false); }
  }, [token]);

  useEffect(() => {
    fetchPending();
    fetchHistory();
  }, [fetchPending, fetchHistory]);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAccept = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'accepting' }));
    try {
      await acceptInvitation(token, id);
      showMessage('Invitation accepted.');
      fetchPending();
      fetchHistory();
    } catch (e) {
      showMessage(e.message || 'Failed to accept invitation', 'error');
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const handleReject = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'rejecting' }));
    try {
      await rejectInvitation(token, id);
      showMessage('Invitation rejected.');
      fetchPending();
      fetchHistory();
    } catch (e) {
      showMessage(e.message || 'Failed to reject invitation', 'error');
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Notifications"
      pendingCount={pending.length}
    >
      {/* Page title */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>My Team & Invitations</Text>
          <Text style={styles.pageSubtitle}>View your current team and manage team invitations.</Text>
        </View>
      </View>

      {/* Toast message */}
      {!!message && (
        <View style={[styles.toast, messageType === 'error' ? styles.toastError : styles.toastSuccess]}>
          <Ionicons
            name={messageType === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={16}
            color={messageType === 'error' ? colors.danger : colors.success}
          />
          <Text style={[styles.toastText, messageType === 'error' ? styles.toastTextError : styles.toastTextSuccess]}>
            {message}
          </Text>
        </View>
      )}

      {/* ── Current Team Card ── */}
      {userTeam && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Current Team</Text>
          <View style={styles.currentTeamCard}>
            <View style={styles.currentTeamHeader}>
              <Avatar name={userTeam?.teamName || userTeam?.name || 'My Team'} size={44} />
              <View style={styles.currentTeamInfo}>
                <View style={styles.chipRow}>
                  <Text style={styles.currentTeamName}>
                    {userTeam?.teamName || userTeam?.name || 'My Team'}
                  </Text>
                  <View style={styles.chipActive}>
                    <Text style={styles.chipActiveText}>Active</Text>
                  </View>
                  <View style={styles.chipPublic}>
                    <Text style={styles.chipPublicText}>Public</Text>
                  </View>
                </View>
                <View style={styles.currentTeamMeta}>
                  <Text style={styles.metaItem}>
                    Member Since: {userTeam?.joinedAt ? new Date(userTeam.joinedAt).toLocaleDateString() : '—'}
                  </Text>
                  <Text style={styles.metaDot}> · </Text>
                  <Text style={styles.metaItem}>
                    {userTeam?.memberCount || userTeam?.members?.length || 0} Team Members
                  </Text>
                </View>
                <View style={styles.currentTeamMeta}>
                  <Text style={styles.metaItem}>
                    <Text style={styles.metaKey}>Line: </Text>
                    {userTeam?.line?.lineName || userTeam?.lineName || '—'}
                  </Text>
                  <Text style={styles.metaDot}> · </Text>
                  <Text style={styles.metaItem}>
                    <Text style={styles.metaKey}>Territory: </Text>
                    {userTeam?.territory || '—'}
                  </Text>
                  <Text style={styles.metaDot}> · </Text>
                  <Text style={styles.metaItem}>
                    <Text style={styles.metaKey}>Manager: </Text>
                    {userTeam?.manager?.fullName || userTeam?.managerName || '—'}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              style={styles.viewTeamBtn}
              onPress={() => {
                const tid = userTeam?._id || userTeam?.id || userTeam?.teamId;
                if (tid) navigation.navigate('TeamDetail', { teamId: tid });
              }}
            >
              <Text style={styles.viewTeamBtnText}>View Team</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Pending Invitations ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          {pending.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pending.length}</Text>
            </View>
          )}
        </View>

        {userTeam && pending.length > 0 && (
          <View style={styles.warningBanner}>
            <Ionicons name="information-circle-outline" size={15} color="#F97316" />
            <Text style={styles.warningText}>
              You already belong to a team. You can accept only one team invitation.
            </Text>
          </View>
        )}

        {pending.length > 0 && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
            <Text style={styles.infoBannerText}>
              Accepting a team invitation assigns you to that team.
            </Text>
          </View>
        )}

        {loadingPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : pending.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No pending invitations.</Text>
          </View>
        ) : (
          <View style={styles.inviteList}>
            {pending.map((inv) => {
              const id = inv._id || inv.id;
              return (
                <InvitationCard
                  key={id}
                  invitation={inv}
                  loading={actionLoading[id]}
                  hasTeam={!!userTeam}
                  onAccept={() => handleAccept(id)}
                  onReject={() => handleReject(id)}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* ── Invitation History ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Invitation History</Text>

        <View style={styles.tableCard}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 1.5 }]}>Manager</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Team</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Line</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Territory</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Invited On</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Responded On</Text>
            <Text style={[styles.th, { flex: 1 }]}>Status</Text>
          </View>

          {loadingHistory ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No invitation history.</Text>
            </View>
          ) : (
            history.map((inv, idx) => {
              const id = inv._id || inv.id;
              const managerName = inv.manager?.fullName || inv.managerName || '—';
              const teamName = inv.team?.teamName || inv.team?.name || inv.teamName || '—';
              const lineName = inv.line?.lineName || inv.line?.name || inv.lineName || '—';
              const territory = inv.team?.territory || inv.territory || '—';
              const invitedOn = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—';
              const respondedOn = inv.respondedAt ? new Date(inv.respondedAt).toLocaleDateString() : '—';
              const status = inv.status || 'unknown';

              return (
                <View key={id || idx} style={styles.histRow}>
                  <View style={[styles.td, { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <Avatar name={managerName} size={26} />
                    <Text style={styles.cellPrimary} numberOfLines={1}>{managerName}</Text>
                  </View>
                  <View style={[styles.td, { flex: 1.5 }]}>
                    <Text style={styles.cellSecondary} numberOfLines={1}>{teamName}</Text>
                  </View>
                  <View style={[styles.td, { flex: 1.5 }]}>
                    <Text style={styles.cellSecondary} numberOfLines={1}>{lineName}</Text>
                  </View>
                  <View style={[styles.td, { flex: 1.5 }]}>
                    <Text style={styles.cellSecondary}>{territory}</Text>
                  </View>
                  <View style={[styles.td, { flex: 1.5 }]}>
                    <Text style={styles.cellSecondary}>{invitedOn}</Text>
                  </View>
                  <View style={[styles.td, { flex: 1.5 }]}>
                    <Text style={styles.cellSecondary}>{respondedOn}</Text>
                  </View>
                  <View style={[styles.td, { flex: 1 }]}>
                    <HistoryStatusPill status={status} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  pageHeader: { marginBottom: globalHeight('2%') },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 8, marginBottom: 12,
  },
  toastSuccess: { backgroundColor: '#E7F8EF' },
  toastError: { backgroundColor: '#FEF2F2' },
  toastText: { fontSize: 13, fontWeight: '600' },
  toastTextSuccess: { color: colors.success },
  toastTextError: { color: colors.danger },

  sectionCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, padding: 18, marginBottom: 16, ...shadow, gap: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  countBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  countBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },

  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF4EE', borderRadius: 8, padding: 10,
  },
  warningText: { flex: 1, fontSize: 13, color: '#F97316' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.primaryLight, borderRadius: 8, padding: 10,
  },
  infoBannerText: { flex: 1, fontSize: 13, color: colors.primary },

  inviteList: { gap: 10 },
  inviteCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.backgroundColor, padding: 14, gap: 12,
  },
  inviteCardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  inviteCardInfo: { flex: 1, gap: 4 },
  inviteTeamName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  inviteMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  inviteMetaItem: { fontSize: 12, color: colors.textSecondary },
  inviteMetaKey: { fontWeight: '700', color: colors.textPrimary },
  inviteMetaDot: { color: colors.textMuted, marginHorizontal: 4 },
  inviteActions: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.success,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
  },
  acceptBtnText: { color: colors.success, fontSize: 13, fontWeight: '700' },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.danger,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
  },
  rejectBtnText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  currentTeamCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.backgroundColor, padding: 14, gap: 12,
  },
  currentTeamHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  currentTeamInfo: { flex: 1, gap: 5 },
  currentTeamName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chipActive: { backgroundColor: '#E7F8EF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  chipActiveText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  chipPublic: { backgroundColor: '#DBEAFF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  chipPublicText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  currentTeamMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaItem: { fontSize: 12, color: colors.textSecondary },
  metaKey: { fontWeight: '700', color: colors.textPrimary },
  metaDot: { color: colors.textMuted, marginHorizontal: 4 },
  viewTeamBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7,
  },
  viewTeamBtnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  tableCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundColor, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  histRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  td: { justifyContent: 'center', paddingRight: 8 },
  cellPrimary: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cellSecondary: { fontSize: 12, color: colors.textSecondary },

  histPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  histPillAccepted: { backgroundColor: '#E7F8EF' },
  histPillRejected: { backgroundColor: '#FEF2F2' },
  histPillText: { fontSize: 11, fontWeight: '700' },
  histPillTextAccepted: { color: colors.success },
  histPillTextRejected: { color: colors.danger },

  centered: { alignItems: 'center', padding: 24 },
  emptyState: { alignItems: 'center', padding: 24, gap: 8 },
  emptyText: { fontSize: 14, color: colors.textMuted },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
});
