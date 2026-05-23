import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import moment from 'moment';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getCurrentUser, updateUserProfile, saveUserDetails } from '../../store/auth/authActions';
import { getPendingInvitations, acceptInvitation, rejectInvitation } from '../../store/teamInvitations/teamInvitationsActions';
import { uploadProfilePicture } from '../../store/cloudinary';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const ROLE_OPTIONS = [
  { label: 'Manager',               value: 'manager' },
  { label: 'Senior Manager',        value: 'senior_manager' },
  { label: 'Medical Representative', value: 'representative' },
  { label: 'Admin',                 value: 'admin' },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function formatDate(val) {
  if (!val) return '—';
  const m = moment(val);
  return m.isValid() ? m.format('DD/MM/YYYY') : '—';
}

function formatDateTime(val) {
  if (!val) return '—';
  const m = moment(val);
  return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : '—';
}

function formatRole(role) {
  return String(role || 'Representative')
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'U';
}

function getProfileImage(user) {
  return user?.profilePicture || user?.profileImage || user?.photoUrl
    || user?.avatar || user?.image || user?.photo || null;
}

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
function Avatar({ name, imageUrl, size = 80 }) {
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
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.32 }]}>{getInitials(name)}</Text>
    </View>
  );
}

/* ─── Info Row ───────────────────────────────────────────────────────────── */
function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

/* ─── Section Card ───────────────────────────────────────────────────────── */
function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/* ─── Role Dropdown ──────────────────────────────────────────────────────── */
function RoleDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = ROLE_OPTIONS.find((o) => o.value === value);
  return (
    <View style={{ zIndex: 10 }}>
      <Pressable style={styles.input} onPress={() => setOpen((v) => !v)}>
        <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}>
          {current?.label || 'Select role'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdownMenu}>
          {ROLE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.dropdownOpt, value === opt.value && styles.dropdownOptActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.dropdownOptText, value === opt.value && styles.dropdownOptTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Date Picker (web input type="date") ────────────────────────────────── */
function DatePickerField({ value, onChange }) {
  const dateVal = value && moment(value).isValid() ? moment(value).format('YYYY-MM-DD') : '';
  return (
    <input
      type="date"
      value={dateVal}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        paddingLeft: 12,
        paddingRight: 12,
        height: 40,
        fontSize: 13,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
      }}
    />
  );
}

/* ─── Edit field (module-level — must NOT be inside another component) ────── */
function EditField({ label, children }) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      {children}
    </View>
  );
}

/* ─── Edit Form ──────────────────────────────────────────────────────────── */
function EditForm({ user, token, onSaved, onCancel }) {
  const [form, setForm] = useState({
    fullName:     user.displayName || user.fullName || user.name || user.userName || '',
    userName:     user.userName || '',
    phone:        user.phone || '',
    position:     user.position || '',
    designation:  user.designation || '',
    joinDate:     user.joinDate || '',
    territory:    user.territory || '',
    area:         user.area || '',
    managerAppId: user.managerAppId || user.manager?.appId || '',
    role:         user.role || 'representative',
    profilePicture: getProfileImage(user) || null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imgPreview, setImgPreview] = useState(getProfileImage(user));
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState('');

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handlePickImage = async () => {
    setImgError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;
    setImgPreview(uri);
    setImgUploading(true);
    try {
      const uploaded = await uploadProfilePicture(uri);
      const url = uploaded.secureUrl || uploaded.url;
      setForm((f) => ({ ...f, profilePicture: url }));
    } catch (e) {
      setImgError(e.message || 'Image upload failed');
    } finally {
      setImgUploading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!form.fullName.trim()) { setError('Full name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        fullName:     form.fullName.trim(),
        userName:     form.userName.trim(),
        phone:        form.phone.trim(),
        position:     form.position.trim(),
        designation:  form.designation.trim(),
        joinDate:     form.joinDate,
        territory:    form.territory.trim(),
        area:         form.area.trim(),
        managerAppId: form.managerAppId.trim(),
        role:         form.role,
        ...(form.profilePicture ? { profilePicture: form.profilePicture } : {}),
      };
      const updated = await updateUserProfile(token, payload);
      onSaved(updated);
    } catch (e) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.editForm}>
      {/* Image picker */}
      <View style={styles.editAvatarRow}>
        <Pressable style={styles.editAvatarWrap} onPress={handlePickImage} disabled={imgUploading}>
          <Avatar name={form.fullName} imageUrl={imgPreview} size={72} />
          <View style={styles.cameraBtn}>
            {imgUploading
              ? <ActivityIndicator size={12} color={colors.white} />
              : <Ionicons name="camera" size={14} color={colors.white} />}
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.editAvatarHint}>Tap the photo to change your profile picture.</Text>
          {imgError ? <Text style={styles.fieldError}>{imgError}</Text> : null}
        </View>
      </View>

      <View style={styles.editGrid}>
        <EditField label="Full Name">
          <TextInput style={styles.input} value={form.fullName} onChangeText={set('fullName')} placeholder="Full name" placeholderTextColor={colors.textMuted} />
        </EditField>
        <EditField label="Username">
          <TextInput style={styles.input} value={form.userName} onChangeText={set('userName')} placeholder="@username" placeholderTextColor={colors.textMuted} />
        </EditField>
        <EditField label="Phone">
          <TextInput style={styles.input} value={form.phone} onChangeText={set('phone')} placeholder="+1 555 000 0000" placeholderTextColor={colors.textMuted} />
        </EditField>
        <EditField label="Position">
          <TextInput style={styles.input} value={form.position} onChangeText={set('position')} placeholder="e.g. Field Supervisor" placeholderTextColor={colors.textMuted} />
        </EditField>
        <EditField label="Designation">
          <TextInput style={styles.input} value={form.designation} onChangeText={set('designation')} placeholder="e.g. Senior Rep" placeholderTextColor={colors.textMuted} />
        </EditField>
        <EditField label="Join Date">
          <DatePickerField value={form.joinDate} onChange={set('joinDate')} />
        </EditField>
        <EditField label="Territory">
          <TextInput style={styles.input} value={form.territory} onChangeText={set('territory')} placeholder="e.g. North Region" placeholderTextColor={colors.textMuted} />
        </EditField>
        <EditField label="Area">
          <TextInput style={styles.input} value={form.area} onChangeText={set('area')} placeholder="e.g. Dubai Marina" placeholderTextColor={colors.textMuted} />
        </EditField>
        <EditField label="Manager App ID">
          <TextInput style={styles.input} value={form.managerAppId} onChangeText={set('managerAppId')} placeholder="Manager's App ID" placeholderTextColor={colors.textMuted} />
        </EditField>
        <EditField label="Role">
          <RoleDropdown value={form.role} onChange={set('role')} />
        </EditField>
      </View>

      {error ? <Text style={styles.fieldError}>{error}</Text> : null}

      <View style={styles.editActions}>
        <Pressable style={styles.btnCancel} onPress={onCancel}>
          <Text style={styles.btnCancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
          {saving && <ActivityIndicator size={14} color={colors.white} />}
          <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Invitation Card ────────────────────────────────────────────────────── */
function InvitationCard({ invitation, token, onAction }) {
  const [loading, setLoading] = useState(null);
  const teamName = invitation.team?.name || invitation.teamName || invitation.teamId || 'Unknown Team';
  const message = invitation.message || 'You have been invited to join a team.';
  const id = invitation._id || invitation.id;

  const handle = async (action) => {
    setLoading(action);
    try {
      if (action === 'accept') await acceptInvitation(token, id);
      else await rejectInvitation(token, id);
      onAction();
    } catch (e) {
      alert(e.message || `Failed to ${action} invitation`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteIcon}>
        <Ionicons name="people" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.inviteTeam}>{teamName}</Text>
        <Text style={styles.inviteMsg} numberOfLines={2}>{message}</Text>
      </View>
      <View style={styles.inviteBtns}>
        <Pressable style={styles.btnAccept} onPress={() => handle('accept')} disabled={!!loading}>
          {loading === 'accept'
            ? <ActivityIndicator size={12} color={colors.white} />
            : <Text style={styles.btnAcceptText}>Accept</Text>}
        </Pressable>
        <Pressable style={styles.btnReject} onPress={() => handle('reject')} disabled={!!loading}>
          {loading === 'reject'
            ? <ActivityIndicator size={12} color={colors.danger} />
            : <Text style={styles.btnRejectText}>Decline</Text>}
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function ProfileScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const storedUser = userDetails?.user || userDetails?.data?.user || userDetails || {};

  // Initialise with cached data immediately — no blank screen on load
  const [user, setUser] = useState(storedUser);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [invLoading, setInvLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Silently refresh in background — never block the UI
  const fetchUser = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await getCurrentUser(token);
      if (fresh) {
        setUser(fresh);
        await saveUserDetails({ ...userDetails, user: fresh });
      }
    } catch { /* keep cached */ } finally {
      setRefreshing(false);
    }
  }, [token]);

  const fetchInvitations = useCallback(async () => {
    setInvLoading(true);
    try {
      const data = await getPendingInvitations(token);
      const list = Array.isArray(data) ? data : [];
      setInvitations(list.filter((inv) => (inv.status || 'pending') === 'pending'));
    } catch { setInvitations([]); } finally {
      setInvLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
    fetchInvitations();
  }, [fetchUser, fetchInvitations]);

  const handleSaved = async (updatedUser) => {
    const merged = { ...user, ...updatedUser };
    setUser(merged);
    setEditing(false);
    await saveUserDetails({ ...userDetails, user: merged });
  };

  const handleCopyAppId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(profile.appId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = () => {
    if (window.confirm('Are you sure you want to sign out?')) onSignOut();
  };

  // Build display object
  const profile = {
    fullName:      user.displayName || user.fullName || user.name || user.userName || 'User',
    profileImage:  getProfileImage(user),
    role:          user.role || '—',
    status:        user.status || 'active',
    appId:         user.appId || '—',
    username:      user.userName || '—',
    email:         user.email || '—',
    phone:         user.phone || '—',
    designation:   user.designation || user.role || '—',
    position:      user.position || '—',
    employeeCode:  user.employeeCode || '—',
    joinDate:      formatDate(user.joinDate),
    territory:     user.territory || '—',
    area:          user.area || '—',
    teamsManaged:  user.teamsCount || 0,
    currentTeam:   user.teamName || user.team?.name || user.teamId || '—',
    directManager:
      user.manager?.fullName || user.manager?.name || user.manager?.userName ||
      user.manager?.appId || user.managerName || user.directManager || user.managerId || '—',
    lastLogin:    formatDateTime(user.lastLoginAt || user.lastLogin),
    lastActivity: formatDateTime(user.lastActivityAt || user.lastActivity),
    memberSince:  formatDate(user.createdAt),
  };

  const managerRole = isManager(profile.role);
  const statusActive = profile.status !== 'inactive' && profile.status !== 'suspended';

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Profile"
      scrollable
    >
      <View style={styles.pageContent}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your personal information and account settings</Text>
        </View>
        <View style={styles.headerRight}>
          {refreshing && <ActivityIndicator size={14} color={colors.primary} />}
          {!editing && (
            <Pressable style={styles.btnOutline} onPress={() => setEditing(true)}>
              <Ionicons name="pencil-outline" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Edit Profile</Text>
            </Pressable>
          )}
        </View>
      </View>

      {editing ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Profile</Text>
          <Text style={styles.cardSubtitle}>Update your personal information below.</Text>
          <EditForm
            user={user}
            token={token}
            onSaved={handleSaved}
            onCancel={() => setEditing(false)}
          />
        </View>
      ) : (
        <>
          {/* ── Hero card ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroLeft}>
              <View style={styles.avatarWrap}>
                <Avatar name={profile.fullName} imageUrl={profile.profileImage} size={80} />
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{profile.fullName}</Text>
                <View style={styles.heroMeta}>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>{formatRole(profile.role)}</Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: statusActive ? colors.success : colors.danger }]} />
                  <Text style={styles.heroStatus}>{statusActive ? 'Active' : profile.status}</Text>
                </View>
                <View style={styles.appIdRow}>
                  <Ionicons name="id-card-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.appIdText}>{profile.appId}</Text>
                  <Pressable style={styles.copyBtn} onPress={handleCopyAppId}>
                    <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? colors.success : colors.primary} />
                    <Text style={[styles.copyBtnText, copied && { color: colors.success }]}>
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.heroContacts}>
                  {profile.email !== '—' && (
                    <View style={styles.heroContact}>
                      <Ionicons name="mail-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.heroContactText}>{profile.email}</Text>
                    </View>
                  )}
                  {profile.phone !== '—' && (
                    <View style={styles.heroContact}>
                      <Ionicons name="call-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.heroContactText}>{profile.phone}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.memberSince}</Text>
                <Text style={styles.statLabel}>Member Since</Text>
              </View>
              {managerRole && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.teamsManaged}</Text>
                  <Text style={styles.statLabel}>Teams Managed</Text>
                </View>
              )}
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatRole(profile.role)}</Text>
                <Text style={styles.statLabel}>Role</Text>
              </View>
            </View>
          </View>

          {/* ── Two columns ── */}
          <View style={styles.twoCol}>
            {/* Left */}
            <View style={styles.leftCol}>
              <SectionCard title="Contact Information">
                <InfoRow label="Username"      value={profile.username} />
                <InfoRow label="Email Address" value={profile.email} />
                <InfoRow label="Phone Number"  value={profile.phone} />
              </SectionCard>

              <SectionCard title="Work Information">
                <InfoRow label="Designation"    value={profile.designation} />
                <InfoRow label="Position"       value={profile.position} />
                <InfoRow label="Employee Code"  value={profile.employeeCode} />
                <InfoRow label="Join Date"      value={profile.joinDate} />
                <InfoRow label="Territory"      value={profile.territory} />
                <InfoRow label="Area"           value={profile.area} />
                {managerRole
                  ? <InfoRow label="Teams Managed" value={String(profile.teamsManaged)} />
                  : <InfoRow label="Current Team"  value={profile.currentTeam} />}
                <InfoRow label="Direct Manager" value={profile.directManager} />
              </SectionCard>

              <SectionCard title="Security & Session">
                <InfoRow label="Last Login"    value={profile.lastLogin} />
                <InfoRow label="Last Activity" value={profile.lastActivity} />
                <View style={styles.sessionRow}>
                  <View style={styles.sessionIcon}>
                    <Ionicons name="desktop-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionDevice}>Current Session (This Device)</Text>
                    <Text style={styles.sessionSub}>Web Browser · {profile.area !== '—' ? profile.area : 'Unknown Location'}</Text>
                  </View>
                  <View style={styles.sessionActivePill}>
                    <Text style={styles.sessionActivePillText}>Active Now</Text>
                  </View>
                </View>
              </SectionCard>

              <View style={styles.dangerZone}>
                <Pressable style={styles.btnSignOut} onPress={handleSignOut}>
                  <Ionicons name="log-out-outline" size={16} color={colors.danger} />
                  <Text style={styles.btnSignOutText}>Sign Out</Text>
                </Pressable>
              </View>
            </View>

            {/* Right */}
            <View style={styles.rightCol}>
              <SectionCard title={`Pending Invitations${invitations.length ? ` (${invitations.length})` : ''}`}>
                {invLoading ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : invitations.length === 0 ? (
                  <View style={styles.emptyInv}>
                    <Ionicons name="mail-open-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.emptyInvText}>No pending invitations.</Text>
                  </View>
                ) : (
                  invitations.map((inv) => (
                    <InvitationCard
                      key={inv._id || inv.id}
                      invitation={inv}
                      token={token}
                      onAction={() => { fetchInvitations(); fetchUser(); }}
                    />
                  ))
                )}
              </SectionCard>

              <SectionCard title="Team Information">
                <InfoRow label="Team"      value={profile.currentTeam} />
                <InfoRow label="Territory" value={profile.territory} />
                <InfoRow label="Area"      value={profile.area} />
                {!managerRole && <InfoRow label="Manager" value={profile.directManager} />}
              </SectionCard>

              <SectionCard title="Account Stats">
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{user.teamsCount || 0}</Text>
                    <Text style={styles.statBoxLabel}>Teams</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{user.activeInvitationsCount || user.invitationsCount || 0}</Text>
                    <Text style={styles.statBoxLabel}>Invitations</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{formatRole(profile.role)}</Text>
                    <Text style={styles.statBoxLabel}>Role</Text>
                  </View>
                </View>
              </SectionCard>
            </View>
          </View>
        </>
      )}
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const shadow = {
  shadowColor: '#0B2B66',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  pageContent: { flexGrow: 1 },
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('1.8%'), flexWrap: 'wrap', gap: 10,
  },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },

  centered:    { alignItems: 'center', padding: 32, gap: 10 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },

  /* Hero */
  heroCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 20, ...shadow,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 16, marginBottom: globalHeight('1.2%'),
  },
  heroLeft:  { flexDirection: 'row', alignItems: 'flex-start', gap: 16, flex: 1, minWidth: 260 },
  avatarWrap: { position: 'relative' },
  heroInfo:  { flex: 1, gap: 6 },
  heroName:  { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  heroMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rolePill:  { backgroundColor: colors.primary + '18', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  rolePillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  heroStatus:  { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  appIdRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appIdText:   { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  copyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.primary + '12' },
  copyBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  heroContacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  heroContact:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroContactText: { fontSize: 12, color: colors.textSecondary },
  heroStats:   { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  statItem:    { alignItems: 'center', gap: 4 },
  statValue:   { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  statLabel:   { fontSize: 11, color: colors.textSecondary },

  /* Two-col layout */
  twoCol:   { flexDirection: 'row', gap: globalWidth('1.5%'), alignItems: 'flex-start' },
  leftCol:  { flex: 0.6, gap: globalHeight('1.2%') },
  rightCol: { flex: 0.4, gap: globalHeight('1.2%') },

  /* Section card */
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 20, ...shadow,
  },
  cardHeader:   { marginBottom: 14 },
  cardTitle:    { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 20 },

  /* Info rows */
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoLabel: { width: 140, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary },

  /* Session */
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12,
    padding: 12, borderRadius: 8, backgroundColor: colors.backgroundColor,
  },
  sessionIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  sessionDevice: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  sessionSub:    { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  sessionActivePill:     { backgroundColor: '#E7F8EF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  sessionActivePillText: { fontSize: 11, fontWeight: '700', color: colors.success },

  /* Invitations */
  inviteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  inviteIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inviteTeam: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  inviteMsg:  { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  inviteBtns: { gap: 6, alignItems: 'flex-end' },
  btnAccept:  { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  btnAcceptText: { fontSize: 12, fontWeight: '700', color: colors.white },
  btnReject:  { borderWidth: 1, borderColor: colors.danger, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  btnRejectText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  emptyInv:  { alignItems: 'center', padding: 24, gap: 8 },
  emptyInvText: { fontSize: 13, color: colors.textMuted },

  /* Stats grid */
  statsGrid:    { flexDirection: 'row', gap: 8 },
  statBox:      { flex: 1, alignItems: 'center', padding: 12, backgroundColor: colors.backgroundColor, borderRadius: 8, gap: 4 },
  statBoxValue: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  statBoxLabel: { fontSize: 11, color: colors.textSecondary },

  /* Avatar */
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: colors.white, fontWeight: '800' },

  /* Danger zone */
  dangerZone: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16, ...shadow, backgroundColor: colors.surface },
  btnSignOut:     { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  btnSignOutText: { fontSize: 14, fontWeight: '700', color: colors.danger },

  /* Buttons */
  btnOutline:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  btnPrimary:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnCancel:      { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnCancelText:  { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },

  /* Edit form */
  editForm:      { gap: 20, marginTop: 8 },
  editAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  editAvatarWrap: { position: 'relative' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  editAvatarHint: { fontSize: 12, color: colors.textSecondary },
  editGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  editField: { width: '48%', gap: 5, minWidth: 200 },
  editLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  fieldError: { fontSize: 12, color: colors.danger, marginTop: 4 },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.surface, outlineStyle: 'none',
    flexDirection: 'row', alignItems: 'center',
  },

  /* Dropdown */
  dropdownMenu: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface,
    marginTop: 2, position: 'absolute', left: 0, right: 0, zIndex: 999, ...shadow,
  },
  dropdownOpt:         { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownOptActive:   { backgroundColor: colors.primary + '15' },
  dropdownOptText:     { fontSize: 13, color: colors.textPrimary },
  dropdownOptTextActive: { color: colors.primary, fontWeight: '700' },
});
