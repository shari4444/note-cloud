-- ==============================================================================
-- Shari'z notecloud - Supabase Database Schema & Row Level Security (RLS)
-- ==============================================================================

-- 1. Create the notes table
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Note',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create the note_collaborators table
create table if not exists public.note_collaborators (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  note_title text not null default 'Untitled Note',
  inviter_id uuid not null references auth.users(id) on delete cascade,
  inviter_email text not null default '',
  invitee_email text not null,
  invitee_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_collaborator_unique unique (note_id, invitee_email)
);

-- Safe migrations for existing tables
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'note_collaborators' and column_name = 'note_title') then
    alter table public.note_collaborators add column note_title text not null default 'Untitled Note';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'note_collaborators' and column_name = 'inviter_email') then
    alter table public.note_collaborators add column inviter_email text not null default '';
  end if;
end $$;

-- 3. Create indexes for fast queries
create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_updated_at_idx on public.notes(updated_at desc);
create index if not exists note_collab_note_id_idx on public.note_collaborators(note_id);
create index if not exists note_collab_invitee_email_idx on public.note_collaborators(invitee_email);
create index if not exists note_collab_invitee_id_idx on public.note_collaborators(invitee_id);
create index if not exists note_collab_token_idx on public.note_collaborators(token);

-- 4. Create function and trigger for automatic updated_at timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_notes_updated on public.notes;
create trigger on_notes_updated
  before update on public.notes
  for each row
  execute procedure public.handle_updated_at();

drop trigger if exists on_note_collab_updated on public.note_collaborators;
create trigger on_note_collab_updated
  before update on public.note_collaborators
  for each row
  execute procedure public.handle_updated_at();

-- 5. Enable Row Level Security (RLS)
alter table public.notes enable row level security;
alter table public.note_collaborators enable row level security;

-- ==============================================================================
-- 6. Row Level Security Policies on public.notes
-- ==============================================================================

-- SELECT: Owner OR accepted collaborator can view notes
drop policy if exists "Users can select own notes" on public.notes;
drop policy if exists "Users can select own or collaborated notes" on public.notes;
create policy "Users can select own or collaborated notes"
  on public.notes for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.note_collaborators nc
      where nc.note_id = public.notes.id
        and nc.status = 'accepted'
        and (
          nc.invitee_id = auth.uid()
          or lower(nc.invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
    )
  );

-- INSERT: Only authenticated user can create their own notes
drop policy if exists "Users can insert own notes" on public.notes;
create policy "Users can insert own notes"
  on public.notes for insert
  with check (user_id = auth.uid());

-- UPDATE: Owner OR accepted collaborator can edit notes
drop policy if exists "Users can update own notes" on public.notes;
drop policy if exists "Users can update own or collaborated notes" on public.notes;
create policy "Users can update own or collaborated notes"
  on public.notes for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.note_collaborators nc
      where nc.note_id = public.notes.id
        and nc.status = 'accepted'
        and (
          nc.invitee_id = auth.uid()
          or lower(nc.invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
    )
  )
  with check (
    user_id = public.notes.user_id -- prevent changing ownership
  );

-- DELETE: Only the note owner can delete the note
drop policy if exists "Users can delete own notes" on public.notes;
create policy "Users can delete own notes"
  on public.notes for delete
  using (user_id = auth.uid());

-- ==============================================================================
-- 7. Row Level Security Policies on public.note_collaborators
-- (Notice: We do NOT query public.notes here to completely prevent recursion)
-- ==============================================================================

-- SELECT: Inviter or Invitee can view invitations
drop policy if exists "Users can view relevant collaboration invitations" on public.note_collaborators;
create policy "Users can view relevant collaboration invitations"
  on public.note_collaborators for select
  using (
    inviter_id = auth.uid()
    or invitee_id = auth.uid()
    or lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

-- INSERT: Only note owner (inviter) can insert invitations
drop policy if exists "Note owners can insert invitations" on public.note_collaborators;
create policy "Note owners can insert invitations"
  on public.note_collaborators for insert
  with check (
    inviter_id = auth.uid()
  );

-- UPDATE: Invitee can accept/decline, or inviter can update
drop policy if exists "Users can update collaboration status" on public.note_collaborators;
create policy "Users can update collaboration status"
  on public.note_collaborators for update
  using (
    inviter_id = auth.uid()
    or invitee_id = auth.uid()
    or lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

-- DELETE: Inviter can cancel, or invitee can remove
drop policy if exists "Users can remove collaboration" on public.note_collaborators;
create policy "Users can remove collaboration"
  on public.note_collaborators for delete
  using (
    inviter_id = auth.uid()
    or invitee_id = auth.uid()
    or lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

-- ==============================================================================
-- 8. Permissions & PostgREST Schema Cache Reload
-- ==============================================================================
grant usage on schema public to anon, authenticated;
grant all on public.notes to anon, authenticated;
grant all on public.note_collaborators to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- Force PostgREST API to refresh schema cache immediately
notify pgrst, 'reload schema';

