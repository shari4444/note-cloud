import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Fetch all notes for the authenticated user from Supabase.
 * RLS automatically ensures both owned notes and accepted collaborated notes are returned.
 */
export async function fetchNotes(currentUserId = null) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set up your .env file.');
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes from Supabase:', error);
    throw new Error(error.message || 'Error loading notes from Supabase');
  }

  const notesList = data || [];
  if (currentUserId) {
    return notesList.map(note => ({
      ...note,
      is_shared: note.user_id !== currentUserId
    }));
  }

  return notesList;
}

/**
 * Create a new note in Supabase PostgreSQL
 */
export async function createNote(userId = null, initialData = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  // Ensure we have a valid authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const effectiveUserId = userId || userData?.user?.id;

  if (!effectiveUserId || userError) {
    throw new Error('You must be logged in to create notes. Please log in again.');
  }

  const newNote = {
    user_id: effectiveUserId,
    title: initialData.title || 'Untitled Note',
    content: initialData.content !== undefined ? initialData.content : ''
  };

  const { data, error } = await supabase
    .from('notes')
    .insert([newNote])
    .select()
    .single();

  if (error) {
    console.error('Error creating note in Supabase:', error);
    throw new Error(error.message || 'Database error creating note');
  }

  return {
    ...data,
    is_shared: false
  };
}

/**
 * Update an existing note in Supabase
 */
export async function updateNote(noteId, updates) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const payload = {
    updated_at: new Date().toISOString()
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.content !== undefined) payload.content = updates.content;

  const { data, error } = await supabase
    .from('notes')
    .update(payload)
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    console.error('Error updating note in Supabase:', error);
    throw new Error(error.message || 'Database error saving note');
  }

  return data;
}

/**
 * Delete a note from Supabase
 */
export async function deleteNote(noteId) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    console.error('Error deleting note in Supabase:', error);
    throw new Error(error.message || 'Database error deleting note');
  }

  return true;
}
