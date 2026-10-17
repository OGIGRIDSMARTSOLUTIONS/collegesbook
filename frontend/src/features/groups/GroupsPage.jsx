import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useProfile } from '../../hooks/useProfile';
import {
  useGroups,
  useGroup,
  useGroupMembers,
  useGroupPosts,
  useCreateGroup,
  useCreateGroupPost,
  useGroupMembership,
} from '../../hooks/useGroups';
import { groupService } from '../../services/group.service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingState } from '../../components/loading/Spinner';

function initials(firstName, lastName) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`;
}

function CreateGroupForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', kind: 'PUBLIC' });
  const createGroup = useCreateGroup();

  function handleSubmit(e) {
    e.preventDefault();
    createGroup.mutate(form, {
      onSuccess: (group) => {
        setForm({ name: '', description: '', kind: 'PUBLIC' });
        setOpen(false);
        onCreated?.(group.id);
      },
    });
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Create a group
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <TextField
        label="Name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        required
      />
      <TextField
        label="Description (optional)"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
      />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text">Visibility</span>
        <select
          value={form.kind}
          onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-text"
        >
          <option value="PUBLIC">Public — anyone can find and join</option>
          <option value="PRIVATE">Private — only added members can see it</option>
        </select>
      </label>
      {createGroup.isError && <p className="text-sm text-danger">{createGroup.error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={createGroup.isPending}>
          {createGroup.isPending ? 'Creating…' : 'Create'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function GroupsList({ onSelect }) {
  const groupsQuery = useGroups();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Groups</h1>
        <CreateGroupForm onCreated={onSelect} />
      </div>

      {groupsQuery.isLoading && <LoadingState message="Loading groups…" />}
      {groupsQuery.data?.length === 0 && (
        <p className="text-sm text-text-secondary">No groups yet — be the first to create one.</p>
      )}

      <div className="space-y-2">
        {groupsQuery.data?.map((group) => (
          <button
            key={group.id}
            onClick={() => onSelect(group.id)}
            className="block w-full rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-brand"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-text">{group.name}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                {group.kind}
              </span>
            </div>
            {group.description && <p className="mt-1 text-sm text-text-secondary">{group.description}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupPostComposer({ groupId }) {
  const [body, setBody] = useState('');
  const createPost = useCreateGroupPost(groupId);

  function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    createPost.mutate(
      { body },
      { onSuccess: () => setBody('') }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share something with the group…"
        className="w-full resize-none rounded-md border border-border bg-surface p-2 text-text placeholder:text-text-secondary/70 focus:border-brand"
        rows={3}
      />
      <div className="mt-2 flex justify-end">
        <Button type="submit" disabled={createPost.isPending || !body.trim()}>
          {createPost.isPending ? 'Posting…' : 'Post'}
        </Button>
      </div>
      {createPost.isError && <p className="mt-1 text-sm text-danger">{createPost.error.message}</p>}
    </form>
  );
}


function GroupInvitations({ groupId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const candidates = useQuery({
    queryKey: ['group-invite-candidates', groupId, search],
    queryFn: () => groupService.inviteCandidates(groupId, search),
    enabled: open,
  });
  const send = useMutation({
    mutationFn: () => groupService.inviteStudents(groupId, selected),
    onSuccess: () => {
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['group-invite-candidates', groupId] });
    },
  });
  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      <button className="text-sm font-semibold text-brand" onClick={() => setOpen(value => !value)}>
        {open ? 'Close invitations' : '+ Invite students'}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <input aria-label="Search students" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Search students by name" value={search} onChange={event => setSearch(event.target.value)} />
          {candidates.isLoading && <p className="text-sm">Finding students...</p>}
          {candidates.isError && <p className="text-sm text-danger">{candidates.error.message}</p>}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {candidates.data?.map(student => (
              <label key={student.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                {student.profilePhotoUrl ? <img src={student.profilePhotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs">{initials(student.firstName, student.lastName)}</span>}
                <span className="flex-1 text-sm">{student.firstName} {student.lastName}</span>
                {student.status === 'AVAILABLE' ? <input type="checkbox" aria-label={`Invite ${student.firstName} ${student.lastName}`} checked={selected.includes(student.id)} onChange={event => setSelected(current => event.target.checked ? [...current, student.id] : current.filter(id => id !== student.id))} /> : <span className="text-xs text-text-secondary">{student.status === 'MEMBER' ? 'Member' : 'Invited'}</span>}
              </label>
            ))}
          </div>
          <Button disabled={!selected.length || send.isPending} onClick={() => send.mutate()}>Send {selected.length} invitation{selected.length === 1 ? '' : 's'}</Button>
          {send.isSuccess && <p className="text-sm text-green-600">Invitations sent.</p>}
          {send.isError && <p className="text-sm text-danger">{send.error.message}</p>}
        </div>
      )}
    </div>
  );
}

function IncomingGroupInvitations({ onSelect }) {
  const queryClient = useQueryClient();
  const invitations = useQuery({ queryKey: ['my-group-invitations'], queryFn: groupService.incomingInvitations, refetchInterval: 30000 });
  const respond = useMutation({
    mutationFn: ({ id, action }) => groupService.respondInvitation(id, action),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-group-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      if (result.status === 'ACCEPTED') onSelect(result.groupId);
    },
  });
  if (!invitations.data?.length) return null;
  return <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
    <h2 className="font-semibold text-text">Group invitations ({invitations.data.length})</h2>
    {invitations.data.map(invite => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
      <span className="text-sm">You've been invited to <strong>{invite.group.name}</strong></span>
      <div className="flex gap-2">
        <Button disabled={respond.isPending} onClick={() => respond.mutate({ id: invite.id, action: 'accept' })}>Accept</Button>
        <Button variant="secondary" disabled={respond.isPending} onClick={() => respond.mutate({ id: invite.id, action: 'decline' })}>Decline</Button>
      </div>
    </div>)}
    {respond.isError && <p className="text-sm text-danger">{respond.error.message}</p>}
  </section>;
}

function GroupDetail({ groupId, onBack }) {
  const { data: me } = useProfile();
  const groupQuery = useGroup(groupId);
  const membersQuery = useGroupMembers(groupId);
  const postsQuery = useGroupPosts(groupId);
  const { join, leave } = useGroupMembership(groupId);

  const isMember = membersQuery.data?.some((m) => m.id === me?.id);

  if (groupQuery.isError) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-text-secondary hover:text-text">
          ← Back to groups
        </button>
        <p className="text-sm text-danger">This group isn't available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-text-secondary hover:text-text">
        ← Back to groups
      </button>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text">{groupQuery.data?.name}</h1>
            {groupQuery.data?.description && (
              <p className="mt-1 text-sm text-text-secondary">{groupQuery.data.description}</p>
            )}
          </div>
          {isMember ? (
            <Button variant="secondary" onClick={() => leave.mutate()} disabled={leave.isPending}>
              Leave
            </Button>
          ) : (
            <Button onClick={() => join.mutate()} disabled={join.isPending}>
              Join
            </Button>
          )}
        </div>
        {join.isError && <p className="mt-2 text-sm text-danger">{join.error.message}</p>}

        {membersQuery.data && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-text-secondary">
              Members ({membersQuery.data.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {membersQuery.data.map((m) => (
                <span
                  key={m.id}
                  className="max-w-full rounded-full border border-border bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand break-words"
                >
                  {[m.firstName, m.lastName].filter(Boolean).join(' ') || 'Unnamed student'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {isMember && <GroupInvitations groupId={groupId} />}
      {isMember && <GroupPostComposer groupId={groupId} />}

      <div className="space-y-3">
        {postsQuery.data?.length === 0 && (
          <p className="text-sm text-text-secondary">No posts in this group yet.</p>
        )}
        {postsQuery.data?.map((post) => (
          <div key={post.id} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium text-text">
              {post.author?.firstName} {post.author?.lastName}
            </p>
            <p className="mt-1 text-text">{post.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  function selectGroup(id) {
    setSearchParams(id ? { id } : {});
  }

  return selectedId ? (
    <GroupDetail groupId={selectedId} onBack={() => selectGroup(null)} />
  ) : (
    <div className="space-y-4"><IncomingGroupInvitations onSelect={selectGroup} /><GroupsList onSelect={selectGroup} /></div>
  );
}