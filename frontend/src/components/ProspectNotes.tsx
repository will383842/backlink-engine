import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, StickyNote, User } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "@/lib/api";

interface NoteEvent {
  id: number;
  eventType: string;
  data: { text: string; author: string } | null;
  createdAt: string;
  user?: { id: number; name: string; email: string } | null;
}

interface ProspectNotesProps {
  prospectId: number;
}

export default function ProspectNotes({ prospectId }: ProspectNotesProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data: notes, isLoading } = useQuery<NoteEvent[]>({
    queryKey: ["prospect-notes", prospectId],
    queryFn: async () => {
      const res = await api.get(`/prospects/${prospectId}/notes`);
      return res.data.data ?? res.data;
    },
    enabled: prospectId > 0,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const res = await api.post(`/prospects/${prospectId}/notes`, {
        text: noteText,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["prospect-notes", prospectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["prospect-timeline", prospectId],
      });
      setText("");
      toast.success("Note added");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    addNoteMutation.mutate(trimmed);
  }

  return (
    <div className="card">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
        <StickyNote size={16} /> CRM Notes
      </h3>

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note about this prospect..."
          rows={3}
          className="input-field w-full resize-y text-sm"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={!text.trim() || addNoteMutation.isPending}
            className="btn-primary text-sm"
          >
            <MessageSquarePlus size={14} className="mr-1.5" />
            {addNoteMutation.isPending ? "Saving..." : "Add Note"}
          </button>
        </div>
      </form>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : !notes?.length ? (
        <p className="text-sm text-surface-400">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-surface-200 bg-surface-50 p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-surface-800">
                {note.data?.text}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs text-surface-400">
                <span className="inline-flex items-center gap-1">
                  <User size={12} />
                  {note.user?.name ?? note.data?.author ?? "System"}
                </span>
                <time>
                  {format(new Date(note.createdAt), "dd MMM yyyy HH:mm")}
                </time>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
