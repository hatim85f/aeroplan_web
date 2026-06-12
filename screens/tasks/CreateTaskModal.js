import React, { useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';
import { createTask, getAssignableUsers } from '../../store/tasks/taskActions';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const FREQS = ['daily', 'weekly', 'monthly'];
const isoToday = () => new Date().toISOString().slice(0, 10);
const repInitials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function DateInput({ value, onChange, min }) {
  return (
    <input
      type="date"
      value={value || ''}
      min={min || undefined}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 38,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: colors.border,
        paddingLeft: 10,
        paddingRight: 10,
        fontSize: 12,
        color: value ? colors.textPrimary : colors.textSecondary,
        backgroundColor: colors.backgroundColor,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
      }}
    />
  );
}

export default function CreateTaskModal({ token, onClose, onCreated, isManager = true }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('checklist');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState(isoToday());
  const [dueDate, setDueDate] = useState('');
  const [assignAll, setAssignAll] = useState(false);
  const [users, setUsers] = useState([]);
  const [pickedIds, setPickedIds] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [steps, setSteps] = useState([{ title: '' }]);
  const [frequency, setFrequency] = useState('monthly');
  const [requiredTimes, setRequiredTimes] = useState('2');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isManager) return;
    getAssignableUsers(token).then(setUsers).catch(() => setUsers([]));
  }, [token, isManager]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => !q || String(u.userName).toLowerCase().includes(q));
  }, [userSearch, users]);

  const togglePicked = (id) => setPickedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required.'); return; }
    if (isManager && !assignAll && !pickedIds.length) { setError('Select at least one team member or assign to all team.'); return; }
    if (taskType === 'checklist' && !steps.some((s) => s.title.trim())) { setError('Add at least one step.'); return; }
    if (taskType === 'recurring' && (!frequency || !(Number(requiredTimes) >= 1))) { setError('Set frequency and required times.'); return; }

    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      taskType,
      // Reps create self-assigned tasks; backend assigns them and loops in their manager.
      assignToAllTeam: isManager ? assignAll : false,
      assignedUserIds: isManager ? (assignAll ? undefined : pickedIds) : undefined,
      priority,
      startDate,
      dueDate: dueDate || undefined,
    };
    if (taskType === 'checklist') {
      body.steps = steps.filter((s) => s.title.trim()).map((s, i) => ({ title: s.title.trim(), order: i }));
    } else {
      body.recurrence = { frequency, requiredTimesPerPeriod: Number(requiredTimes), startDate, endDate: dueDate || undefined };
    }

    try {
      setSaving(true);
      const created = await createTask(token, body);
      onCreated?.(created);
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.title}>Create Task</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
        </View>

        <ScrollView style={{ maxHeight: '74vh' }} nestedScrollEnabled>
          <Field label="Task Title *"><TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Revise list and add gynae" placeholderTextColor={colors.textMuted} /></Field>
          <Field label="Description"><TextInput style={[styles.input, { minHeight: 60 }]} value={description} onChangeText={setDescription} multiline placeholder="Optional" placeholderTextColor={colors.textMuted} /></Field>

          <Field label="Task Type">
            <View style={styles.segment}>
              {[{ k: 'checklist', l: 'Checklist' }, { k: 'recurring', l: 'Recurring' }].map((o) => (
                <Pressable key={o.k} style={[styles.segmentBtn, taskType === o.k && styles.segmentBtnActive]} onPress={() => setTaskType(o.k)}>
                  <Text style={[styles.segmentText, taskType === o.k && styles.segmentTextActive]}>{o.l}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <View style={styles.row}>
            <Field label="Priority" flex>
              <View style={styles.chipRow}>
                {PRIORITIES.map((p) => (
                  <Pressable key={p} style={[styles.chip, priority === p && styles.chipActive]} onPress={() => setPriority(p)}>
                    <Text style={[styles.chipText, priority === p && styles.chipTextActive, { textTransform: 'capitalize' }]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          </View>
          <View style={styles.row}>
            <Field label="Start Date" flex><DateInput value={startDate} onChange={setStartDate} /></Field>
            <Field label={taskType === 'recurring' ? 'End Date' : 'Due Date'} flex><DateInput value={dueDate} onChange={setDueDate} min={startDate} /></Field>
          </View>

          {/* Assignees */}
          {!isManager ? (
            <View style={styles.selfNote}>
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.selfNoteText}>This task will be assigned to you. Your manager is automatically looped in.</Text>
            </View>
          ) : (
          <Field label="Assign To">
            <Pressable style={styles.allTeamRow} onPress={() => setAssignAll((v) => !v)}>
              <Ionicons name={assignAll ? 'checkbox' : 'square-outline'} size={17} color={assignAll ? colors.primary : colors.textMuted} />
              <Text style={styles.allTeamText}>All team</Text>
            </Pressable>
            {!assignAll ? (
              <>
                <Text style={styles.helperText}>Select team members (medical reps) to assign:</Text>
                <View style={[styles.searchBox, { marginTop: 6 }]}>
                  <Ionicons name="search-outline" size={13} color={colors.textMuted} />
                  <TextInput value={userSearch} onChangeText={setUserSearch} placeholder="Search team members…" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
                </View>
                <Text style={styles.pickedCount}>{pickedIds.length} of {users.length} selected</Text>
                <ScrollView style={styles.userList} nestedScrollEnabled>
                  {filteredUsers.map((u) => {
                    const sel = pickedIds.includes(String(u.userId));
                    return (
                      <Pressable key={String(u.userId)} style={[styles.userOpt, sel && styles.userOptActive]} onPress={() => togglePicked(String(u.userId))}>
                        <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={16} color={sel ? colors.primary : colors.textMuted} />
                        <View style={styles.repAvatar}><Text style={styles.repAvatarText}>{repInitials(u.userName)}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userOptText} numberOfLines={1}>{u.userName}</Text>
                          {u.role ? <Text style={styles.userOptRole}>{String(u.role).replace(/_/g, ' ')}</Text> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                  {!filteredUsers.length ? <Text style={styles.emptyText}>No team members found in your team.</Text> : null}
                </ScrollView>
              </>
            ) : null}
          </Field>
          )}

          {/* Type-specific */}
          {taskType === 'checklist' ? (
            <Field label="Steps">
              {steps.map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <Text style={styles.stepNum}>{idx + 1}</Text>
                  <TextInput style={[styles.input, { flex: 1 }]} value={step.title} onChangeText={(t) => setSteps((cur) => cur.map((s, i) => (i === idx ? { title: t } : s)))} placeholder={`Step ${idx + 1}`} placeholderTextColor={colors.textMuted} />
                  <Pressable style={styles.removeStep} onPress={() => setSteps((cur) => cur.length === 1 ? [{ title: '' }] : cur.filter((_, i) => i !== idx))}>
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
              <Pressable style={[styles.btnOutline, { alignSelf: 'flex-start' }]} onPress={() => setSteps((cur) => [...cur, { title: '' }])}>
                <Ionicons name="add" size={13} color={colors.primary} />
                <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Add step</Text>
              </Pressable>
            </Field>
          ) : (
            <View style={styles.row}>
              <Field label="Frequency" flex>
                <View style={styles.chipRow}>
                  {FREQS.map((f) => (
                    <Pressable key={f} style={[styles.chip, frequency === f && styles.chipActive]} onPress={() => setFrequency(f)}>
                      <Text style={[styles.chipText, frequency === f && styles.chipTextActive, { textTransform: 'capitalize' }]}>{f}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label="Required times / period" flex>
                <TextInput style={styles.input} value={requiredTimes} onChangeText={setRequiredTimes} keyboardType="numeric" placeholder="2" placeholderTextColor={colors.textMuted} />
              </Field>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable style={styles.btnOutline} onPress={onClose} disabled={saving}><Text style={styles.btnOutlineText}>Cancel</Text></Pressable>
          <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="checkmark" size={14} color="#fff" />}
            <Text style={styles.btnPrimaryText}>Create Task</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Field({ label, children, flex }) {
  return <View style={[{ gap: 5, marginBottom: 12 }, flex && { flex: 1 }]}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7,18,47,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { backgroundColor: colors.surface, borderRadius: 14, padding: 18, gap: 12, width: '100%', maxWidth: 620, maxHeight: '92%', ...shadow },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: colors.backgroundColor, fontSize: 12, color: colors.textPrimary },
  row: { flexDirection: 'row', gap: 10 },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.backgroundColor },
  segmentBtn: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  segmentTextActive: { color: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: colors.backgroundColor },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  allTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allTeamText: { fontSize: 12.5, fontWeight: '700', color: colors.textPrimary },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, backgroundColor: colors.backgroundColor, minHeight: 36 },
  searchInput: { flex: 1, fontSize: 12, color: colors.textPrimary, paddingVertical: 8 },
  pickedCount: { fontSize: 11, fontWeight: '800', color: colors.primary, marginTop: 6 },
  userList: { maxHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 6 },
  userOpt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  userOptActive: { backgroundColor: colors.primary + '0E' },
  userOptText: { fontSize: 12.5, color: colors.textPrimary, fontWeight: '600' },
  userOptRole: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize', marginTop: 1 },
  helperText: { fontSize: 11.5, color: colors.textSecondary, fontWeight: '600', marginTop: 4 },
  selfNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary + '0E', borderRadius: 8, padding: 11, marginBottom: 12 },
  selfNoteText: { flex: 1, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  repAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' },
  repAvatarText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary + '14', textAlign: 'center', lineHeight: 22, fontSize: 11, fontWeight: '800', color: colors.primary },
  removeStep: { padding: 6 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  error: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  emptyText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: 10 },
});
