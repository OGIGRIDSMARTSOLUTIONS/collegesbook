import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { studentService } from '../../services/student.service';
import { useConnections, usePendingConnections, useBlockedConnections, useConnectionActions } from '../../hooks/useConnections';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { LoadingState } from '../../components/loading/Spinner';

function initials(firstName, lastName) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`;
}

function PersonRow({ student, right }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <Link to={`/profile/${student.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
          {initials(student.firstName, student.lastName)}
        </span>
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-text">
            {student.firstName} {student.lastName}
          </p>
          {student.academicSet?.name && (
            <p className="text-xs text-text-secondary">{student.academicSet.name}</p>
          )}
        </div>
      </Link>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{right}</div>
    </div>
  );
}

function SearchSection() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const { send } = useConnectionActions();
  const [feedback, setFeedback] = useState({});

  const searchQuery = useQuery({
    queryKey: ['students', 'search', submittedQuery],
    queryFn: () => studentService.search({ q: submittedQuery }),
    enabled: submittedQuery.length > 0,
  });

  function handleSubmit(e) {
    e.preventDefault();
    setSubmittedQuery(query.trim());
  }

  function handleConnect(studentId) {
    setFeedback((f) => ({ ...f, [studentId]: null }));
    send.mutate(studentId, {
      onSuccess: () => setFeedback((f) => ({ ...f, [studentId]: { type: 'success', text: 'Request sent' } })),
      onError: (err) => setFeedback((f) => ({ ...f, [studentId]: { type: 'error', text: err.message } })),
    });
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text">Find students</h2>
      <form onSubmit={handleSubmit} className="mt-3 flex min-w-0 flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            label=""
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" className="h-fit self-end">
          Search
        </Button>
      </form>

      {searchQuery.isLoading && <LoadingState message="Searching…" compact />}

      <div className="mt-1 divide-y divide-border">
        {searchQuery.data?.items?.map((student) => (
          <PersonRow
            key={student.id}
            student={student}
            right={
              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="secondary"
                  onClick={() => handleConnect(student.id)}
                  disabled={send.isPending}
                >
                  Connect
                </Button>
                {feedback[student.id] && (
                  <span
                    className={`text-xs ${
                      feedback[student.id].type === 'error' ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {feedback[student.id].text}
                  </span>
                )}
              </div>
            }
          />
        ))}
        {submittedQuery && searchQuery.data?.items?.length === 0 && (
          <p className="py-3 text-sm text-text-secondary">No students found for "{submittedQuery}".</p>
        )}
      </div>
    </section>
  );
}

function PendingSection() {
  const pendingQuery = usePendingConnections();
  const { accept, reject } = useConnectionActions();

  if (pendingQuery.isLoading) return null;
  if (!pendingQuery.data?.length) return null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text">Connection requests</h2>
      <div className="mt-1 divide-y divide-border">
        {pendingQuery.data.map((student) => (
          <PersonRow
            key={student.id}
            student={student}
            right={
              <>
                <Button variant="secondary" onClick={() => reject.mutate(student.id)} disabled={reject.isPending}>
                  Decline
                </Button>
                <Button onClick={() => accept.mutate(student.id)} disabled={accept.isPending}>
                  Accept
                </Button>
              </>
            }
          />
        ))}
      </div>
    </section>
  );
}

function ConnectionsSection() {
  const connectionsQuery = useConnections();
  const { remove, block } = useConnectionActions();
  const navigate = useNavigate();

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text">Your connections</h2>

      {connectionsQuery.isLoading && <LoadingState message="Loading connections…" compact />}

      {connectionsQuery.data?.length === 0 && (
        <p className="mt-3 text-sm text-text-secondary">
          No connections yet — search for students above to get started.
        </p>
      )}

      <div className="mt-1 divide-y divide-border">
        {connectionsQuery.data?.map((student) => (
          <PersonRow
            key={student.id}
            student={student}
            right={
              <>
                <Button variant="secondary" onClick={() => navigate(`/messages?with=${student.id}`)}>
                  Message
                </Button>
                <Button variant="ghost" onClick={() => remove.mutate(student.id)} disabled={remove.isPending}>
                  Remove
                </Button>
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => {
                    if (window.confirm(`Block ${student.firstName}? They won't be able to message you, view your profile, or see your posts.`)) {
                      block.mutate(student.id);
                    }
                  }}
                  disabled={block.isPending}
                >
                  Block
                </Button>
              </>
            }
          />
        ))}
      </div>
    </section>
  );
}

function BlockedStudentsSection() {
  const blockedQuery = useBlockedConnections();
  const { unblock } = useConnectionActions();
  const [error, setError] = useState('');

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text">Blocked students</h2>
      <p className="mt-1 text-xs text-text-secondary">
        Unblocking immediately restores your connection with this student.
      </p>
      {blockedQuery.isLoading && <LoadingState message="Loading blocked students…" compact />}
      {blockedQuery.isError && <p className="mt-2 text-sm text-danger">Could not load blocked students.</p>}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      {blockedQuery.data?.length === 0 && (
        <p className="mt-3 text-sm text-text-secondary">You have not blocked any students.</p>
      )}
      <div className="mt-2 divide-y divide-border">
        {blockedQuery.data?.map((student) => (
          <div key={student.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="text-sm font-medium text-text">
              {[student.firstName, student.lastName].filter(Boolean).join(' ')}
            </span>
            <Button
              variant="secondary"
              disabled={unblock.isPending}
              onClick={() => {
                setError('');
                unblock.mutate(student.id, { onError: (err) => setError(err.message) });
              }}
            >
              Unblock
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function NetworkPage() {
  return (
    <div className="space-y-4">
      <PendingSection />
      <SearchSection />
      <ConnectionsSection />
      <BlockedStudentsSection />
    </div>
  );
}