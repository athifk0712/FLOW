import { FunctionsHttpError } from '@supabase/supabase-js';

import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Data access for Flowku Together. Joining, creating and every permission are enforced by the database (RLS and the
// create_group / join_group functions); the app only asks.

export type Group = Pick<Tables<'groups'>, 'id' | 'name' | 'invite_code' | 'currency' | 'created_by'>;
export type Member = Pick<Tables<'group_members'>, 'user_id' | 'display_name' | 'role'>;
export type Target = Pick<Tables<'group_targets'>, 'id' | 'name' | 'description' | 'target_amount' | 'deadline' | 'status'>;
export type GroupContribution = Pick<
  Tables<'group_contributions'>,
  'id' | 'target_id' | 'user_id' | 'amount' | 'note' | 'status' | 'contributed_at'
>;

export type GroupDetail = {
  group: Group;
  members: Member[];
  targets: Target[];
  contributions: GroupContribution[];
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listGroups() {
  const { data, error } = await supabase.from('groups').select('id, name, invite_code, currency, created_by').order('created_at');
  fail(error);
  return data ?? [];
}

export async function loadGroup(groupId: string): Promise<GroupDetail> {
  const [group, members, targets, contributions] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code, currency, created_by').eq('id', groupId).single(),
    supabase.from('group_members').select('user_id, display_name, role').eq('group_id', groupId).order('joined_at'),
    supabase
      .from('group_targets')
      .select('id, name, description, target_amount, deadline, status')
      .eq('group_id', groupId)
      .neq('status', 'CANCELLED')
      .order('created_at'),
    supabase
      .from('group_contributions')
      .select('id, target_id, user_id, amount, note, status, contributed_at')
      .eq('group_id', groupId)
      .order('contributed_at', { ascending: false }),
  ]);
  fail(group.error ?? members.error ?? targets.error ?? contributions.error);
  return {
    group: group.data!,
    members: members.data ?? [],
    targets: targets.data ?? [],
    contributions: contributions.data ?? [],
  };
}

export async function createGroup(name: string, displayName: string) {
  const { data, error } = await supabase.rpc('create_group', { p_name: name, p_display_name: displayName });
  fail(error);
  return data!;
}

export async function joinGroup(code: string, displayName: string) {
  const { data, error } = await supabase.rpc('join_group', { p_code: code, p_display_name: displayName });
  fail(error);
  return data!;
}

export async function addTarget(groupId: string, values: { name: string; target_amount: number; deadline: string | null }) {
  const { error } = await supabase.from('group_targets').insert({ group_id: groupId, ...values });
  fail(error);
}

export async function setTargetStatus(targetId: string, status: 'ACTIVE' | 'DONE' | 'CANCELLED') {
  const { error } = await supabase.from('group_targets').update({ status }).eq('id', targetId);
  fail(error);
}

/** Records the caller's own contribution; it counts once the owner confirms it. */
export async function contribute(groupId: string, targetId: string, amount: number, note: string | null) {
  const { error } = await supabase.from('group_contributions').insert({ group_id: groupId, target_id: targetId, amount, note });
  fail(error);
}

export async function reviewContribution(id: string, status: 'VERIFIED' | 'REJECTED' | 'PENDING') {
  const { error } = await supabase.from('group_contributions').update({ status }).eq('id', id);
  fail(error);
}

export async function deleteContribution(id: string) {
  const { error } = await supabase.from('group_contributions').delete().eq('id', id);
  fail(error);
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  fail(error);
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  fail(error);
}

/** AI draft of a friendly reminder; throws so the caller can fall back to a plain template. */
export async function draftReminder(targetId: string, memberId: string | null) {
  const { data, error } = await supabase.functions.invoke<{ message: string }>('group-remind', {
    body: { target_id: targetId, member_id: memberId },
  });
  if (error) {
    const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(body?.error ?? 'AI belum bisa membuat pesan.');
  }
  if (!data?.message) throw new Error('Pesan kosong.');
  return data.message;
}

// Which group is open in Group Space, remembered on this device.
const SELECTED_KEY = 'flowku.group';

export function rememberedGroup() {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function rememberGroup(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // Not remembered; harmless.
  }
}
