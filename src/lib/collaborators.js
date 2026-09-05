import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Invite a collaborator to a note by their email (Google ID)
 */
export async function inviteCollaborator(noteId, inviterId, inviteeEmail, inviterEmail = '', noteTitle = 'Untitled Note') {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const cleanEmail = inviteeEmail.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please provide a valid email address.');
  }

  // Insert invitation record
  const { data, error } = await supabase
    .from('note_collaborators')
    .insert([
      {
        note_id: noteId,
        note_title: noteTitle || 'Untitled Note',
        inviter_id: inviterId,
        inviter_email: inviterEmail || '',
        invitee_email: cleanEmail,
        status: 'pending'
      }
    ])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`An invitation for ${cleanEmail} already exists for this note.`);
    }
    console.error('Error inviting collaborator:', error);
    throw error;
  }

  const origin = window.location.origin;
  const acceptUrl = `${origin}/dashboard/index.html?invite=${data.token}&action=accept`;
  const declineUrl = `${origin}/dashboard/index.html?invite=${data.token}&action=decline`;

  return {
    invitation: data,
    acceptUrl,
    declineUrl
  };
}

/**
 * Fetch all collaborators for a specific note
 */
export async function fetchNoteCollaborators(noteId) {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('note_collaborators')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching note collaborators:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch pending incoming collaboration invitations for the current user
 */
export async function fetchIncomingInvitations(userEmail, userId) {
  if (!isSupabaseConfigured() || (!userEmail && !userId)) return [];

  const cleanEmail = (userEmail || '').trim().toLowerCase();

  const query = supabase
    .from('note_collaborators')
    .select('*')
    .eq('status', 'pending');

  if (cleanEmail && userId) {
    query.or(`invitee_email.ilike.${cleanEmail},invitee_id.eq.${userId}`);
  } else if (cleanEmail) {
    query.ilike('invitee_email', cleanEmail);
  } else if (userId) {
    query.eq('invitee_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching incoming invitations:', error);
    return [];
  }

  return data || [];
}

/**
 * Accept or decline a collaboration invitation by Token or Invitation ID
 */
export async function respondToInvitation(tokenOrId, action, userId = null) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const cleanAction = action === 'accept' ? 'accepted' : 'declined';
  const updates = {
    status: cleanAction,
    updated_at: new Date().toISOString()
  };

  if (userId && cleanAction === 'accepted') {
    updates.invitee_id = userId;
  }

  let query = supabase.from('note_collaborators').update(updates);

  if (tokenOrId.length > 25 && !tokenOrId.includes('-')) {
    query = query.eq('token', tokenOrId);
  } else if (tokenOrId.includes('-') && tokenOrId.length === 36) {
    query = query.or(`token.eq.${tokenOrId},id.eq.${tokenOrId}`);
  } else {
    query = query.eq('token', tokenOrId);
  }

  const { data, error } = await query.select('*').single();

  if (error) {
    console.error(`Error responding to invitation (${cleanAction}):`, error);
    throw error;
  }

  return data;
}

/**
 * Remove/Revoke a collaborator from a note
 */
export async function removeCollaborator(collaboratorId) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('note_collaborators')
    .delete()
    .eq('id', collaboratorId);

  if (error) {
    console.error('Error removing collaborator:', error);
    throw error;
  }

  return true;
}
