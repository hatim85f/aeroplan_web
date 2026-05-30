import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  getSalesTeamMemberById,
  updateSalesTeamMemberStatus,
  deleteSalesTeamMember,
} from '../../store/salesTeam/salesTeamActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Returns a display name, or null if the value is a raw ObjectId / empty. */
function resolveUserName(val) {
  if (!val) return null;
  if (typeof val === 'object') return val.fullName || val.name || null;
  // Raw MongoDB ObjectId — 24 hex chars — skip it
  if (/^[a-f0-9]{24}$/i.test(String(val))) return null;
  return String(val);
}

function getInitials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}

function InfoRow({ label, value, mono, children }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {children
        ? <View style={styles.infoValue}>{children}</View>
        : <Text style={[styles.infoValue, mono && { fontFamily: 'monospace', fontSize: 12 }]}>{value || '—'}</Text>
      }
    </View>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Pressable style={styles.copyBtn} onPress={handleCopy}>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? colors.success : colors.primary} />
      <Text style={[styles.copyBtnText, copied && { color: colors.success }]}>
        {copied ? 'Copied' : 'Copy'}
      </Text>
    </Pressable>
  );
}

export default function SalesTeamDetailsScreen({
  navigation, route, userDetails, appMetadata, onSignOut,
}) {
  const memberId    = route?.params?.memberId;
  const user        = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token       = userDetails?.token || userDetails?.data?.token || '';
  const role        = user.role || '';
  const managerRole = isManager(role);

  const [member,    setMember]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [toggling,  setToggling]  = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const fetchMember = useCallback(async () => {
    if (!memberId) { setError('No member ID provided.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await getSalesTeamMemberById(token, memberId);
      setMember(data);
    } catch (e) {
      setError(e.message || 'Failed to load member');
    } finally {
      setLoading(false);
    }
  }, [token, memberId]);

  useEffect(() => { fetchMember(); }, [fetchMember]);

  const handleToggleStatus = async () => {
    setToggling(true);
    try {
      await updateSalesTeamMemberStatus(token, memberId, !member.isActive);
      fetchMember();
    } catch (e) { alert(e.message || 'Failed to update status'); }
    finally { setToggling(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${member?.fullName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteSalesTeamMember(token, memberId);
      navigation.navigate('SalesTeam');
    } catch (e) { alert(e.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Sales Team">
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </AppShell>
    );
  }

  if (error || !member) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Sales Team">
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={styles.errorText}>{error || 'Member not found'}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchMember}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  const name      = member.fullName || member.name || 'Unknown';
  const position  = member.position || '';
  const phone     = member.phone || member.phoneNumber || '';
  const email     = member.email || '';
  const notes     = member.notes || '';
  const active    = member.isActive !== false && member.status !== 'inactive';
  const manager   = member.managerId;
  const mgrName   = typeof manager === 'object' ? (manager?.fullName || manager?.name || '—') : (manager || '—');
  const mgrPos    = typeof manager === 'object' ? (manager?.position || '') : '';
  const accounts  = member.accountIds || member.assignedAccounts || [];
  const teamManaged = member.teamManaged || [];
  const empId     = member.employeeId || member.empId || '';

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Sales Team">

      {/* ── Breadcrumb ── */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('SalesTeam')}>
          <Text style={styles.breadcrumbLink}>Sales Team</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{name}</Text>
      </View>

      {/* ── Header card ── */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          {/* Avatar */}
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{getInitials(name)}</Text>
          </View>
          <View>
            <Text style={styles.memberName}>{name}</Text>
            {position ? <Text style={styles.memberPosition}>{position}</Text> : null}
            <View style={[styles.statusPill, { backgroundColor: active ? '#ECFDF5' : '#FEF2F2', marginTop: 4 }]}>
              <Text style={[styles.statusPillText, { color: active ? '#059669' : '#DC2626' }]}>
                {active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        {managerRole && (
          <View style={styles.headerActions}>
            <Pressable
              style={styles.btnOutline}
              onPress={() => navigation.navigate('SalesTeamForm', { mode: 'edit', memberId })}
            >
              <Ionicons name="pencil-outline" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.btnWarning, toggling && { opacity: 0.6 }]}
              onPress={handleToggleStatus}
              disabled={toggling}
            >
              {toggling
                ? <ActivityIndicator size={13} color={colors.white} />
                : <Ionicons name={active ? 'pause-circle-outline' : 'play-circle-outline'} size={14} color={colors.white} />
              }
              <Text style={styles.btnWarningText}>{toggling ? '...' : active ? 'Deactivate' : 'Activate'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Two-column layout ── */}
      <View style={styles.twoCol}>

        {/* Left */}
        <View style={styles.leftCol}>

          <SectionCard title="Contact Details">
            <InfoRow label="Phone">
              {phone ? (
                <View style={styles.contactRow}>
                  <Text style={styles.infoValueText}>{phone}</Text>
                  <CopyButton value={phone} />
                </View>
              ) : null}
            </InfoRow>
            <InfoRow label="Email">
              {email ? (
                <View style={styles.contactRow}>
                  <Text style={styles.infoValueText}>{email}</Text>
                  <CopyButton value={email} />
                </View>
              ) : null}
            </InfoRow>
            {empId ? <InfoRow label="Employee ID" value={empId} mono /> : null}
            <InfoRow label="Position" value={position} />
          </SectionCard>

          {notes ? (
            <SectionCard title="Notes">
              <Text style={styles.notesText}>{notes}</Text>
            </SectionCard>
          ) : null}

          <SectionCard title="Record Info">
            <InfoRow label="Created At" value={fmtDate(member.createdAt)} />
            <InfoRow label="Updated At" value={fmtDate(member.updatedAt)} />
            {resolveUserName(member.createdBy)
              ? <InfoRow label="Created By" value={resolveUserName(member.createdBy)} />
              : null}
            {resolveUserName(member.updatedBy)
              ? <InfoRow label="Updated By" value={resolveUserName(member.updatedBy)} />
              : null}
          </SectionCard>

          {managerRole && (
            <View style={styles.dangerZone}>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <Pressable
                style={[styles.btnDanger, deleting && { opacity: 0.6 }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size={13} color={colors.white} />
                  : <Ionicons name="trash-outline" size={14} color={colors.white} />
                }
                <Text style={styles.btnDangerText}>{deleting ? 'Deleting...' : 'Delete Salesperson'}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Right */}
        <View style={styles.rightCol}>

          {/* Manager / KAM */}
          <SectionCard title="Manager / KAM">
            {typeof manager === 'object' && manager ? (
              <Pressable
                style={styles.mgrCard}
                onPress={() => navigation.navigate('SalesTeamDetails', { memberId: manager._id || manager.id })}
              >
                <View style={styles.mgrAvatar}>
                  <Text style={styles.mgrAvatarText}>{getInitials(mgrName)}</Text>
                </View>
                <View>
                  <Text style={styles.mgrName}>{mgrName}</Text>
                  {mgrPos ? <Text style={styles.mgrPos}>{mgrPos}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              </Pressable>
            ) : (
              <View style={styles.emptySection}>
                <Ionicons name="person-outline" size={22} color={colors.textMuted} />
                <Text style={styles.emptySectionText}>No manager assigned</Text>
              </View>
            )}
          </SectionCard>

          {/* Assigned Accounts */}
          <SectionCard title={`Assigned Accounts (${accounts.length})`}>
            {accounts.length === 0 ? (
              <View style={styles.emptySection}>
                <Ionicons name="business-outline" size={22} color={colors.textMuted} />
                <Text style={styles.emptySectionText}>No accounts assigned</Text>
              </View>
            ) : (
              accounts.slice(0, 8).map((a, idx) => {
                const aid  = typeof a === 'string' ? a : (a._id || a.id);
                const aName = typeof a === 'object' ? (a.accountName || a.name || aid) : aid;
                const aType = typeof a === 'object' ? (a.accountType || '') : '';
                return (
                  <Pressable
                    key={aid}
                    style={styles.acctRow}
                    onPress={() => navigation.navigate('AccountDetail', { accountId: aid })}
                  >
                    <View style={styles.acctIcon}>
                      <Ionicons name="business-outline" size={13} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.acctName} numberOfLines={1}>{aName}</Text>
                      {aType ? <Text style={styles.acctType}>{aType}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
                  </Pressable>
                );
              })
            )}
            {accounts.length > 8 && (
              <Text style={styles.moreText}>+{accounts.length - 8} more accounts</Text>
            )}
          </SectionCard>

          {/* Team Managed */}
          {teamManaged.length > 0 && (
            <SectionCard title={`Team Managed (${teamManaged.length})`}>
              {teamManaged.map((m) => {
                const mid  = typeof m === 'string' ? m : (m._id || m.id);
                const mName = typeof m === 'object' ? (m.fullName || m.name || mid) : mid;
                const mPos  = typeof m === 'object' ? (m.position || '') : '';
                return (
                  <Pressable
                    key={mid}
                    style={styles.acctRow}
                    onPress={() => navigation.navigate('SalesTeamDetails', { memberId: mid })}
                  >
                    <View style={styles.miniAvatar}>
                      <Text style={styles.miniAvatarText}>{getInitials(mName)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.acctName}>{mName}</Text>
                      {mPos ? <Text style={styles.acctType}>{mPos}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </SectionCard>
          )}
        </View>
      </View>
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  retryBtn:  { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  breadcrumb:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink:    { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  headerCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: globalWidth('1.2%'),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'), flexWrap: 'wrap', gap: 12,
    ...shadow,
  },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.9%'), flex: 1 },
  bigAvatar:     { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bigAvatarText: { fontSize: globalWidth('1%'), fontWeight: '800', color: colors.primary },
  memberName:    { fontSize: globalWidth('1.1%'), fontWeight: '800', color: colors.textPrimary },
  memberPosition:{ fontSize: globalWidth('0.7%'), color: colors.textSecondary, marginTop: 2 },
  statusPill:    { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  statusPillText:{ fontSize: globalWidth('0.6%'), fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.6%') },

  twoCol:   { flexDirection: 'row', gap: globalWidth('1.5%'), alignItems: 'flex-start' },
  leftCol:  { flex: 0.58, gap: globalHeight('1.2%') },
  rightCol: { flex: 0.42, gap: globalHeight('1.2%') },

  card:       { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 18, ...shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle:  { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel:     { width: 130, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  infoValue:     { flex: 1, fontSize: 13, color: colors.textPrimary },
  infoValueText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  contactRow:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  copyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 5, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 7, paddingVertical: 3 },
  copyBtnText: { fontSize: 11, color: colors.primary, fontWeight: '700' },

  notesText:     { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },

  mgrCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  mgrAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mgrAvatarText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  mgrName:       { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  mgrPos:        { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  acctRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  acctIcon:   { width: 28, height: 28, borderRadius: 7, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  acctName:   { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  acctType:   { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  moreText:   { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  miniAvatar:     { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  miniAvatarText: { fontSize: 11, fontWeight: '800', color: colors.primary },

  emptySection:     { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptySectionText: { fontSize: 13, color: colors.textMuted },

  dangerZone:  { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, padding: 16, backgroundColor: '#FEF2F2' },
  dangerTitle: { fontSize: 13, fontWeight: '800', color: colors.danger, marginBottom: 10 },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  btnWarning:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.warning, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnWarningText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  btnDanger:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  btnDangerText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
