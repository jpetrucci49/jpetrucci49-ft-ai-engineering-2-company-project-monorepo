import { CandidateDetailView } from "@/components/candidates/CandidateDetailView";
import { ErrorState } from "@/components/ui/ErrorState";
import { fetchNotes } from "@/lib/api/notes";
import { fetchRecord } from "@/lib/api/records";
import { ApiError } from "@/types/api";
import { toUserFacingMessage } from "@healthcore/api/errors";

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const { id } = await params;

  let candidate = null;
  let notes = null;
  let error: string | null = null;

  try {
    const [record, notesResponse] = await Promise.all([fetchRecord(id), fetchNotes(id)]);
    candidate = record;
    notes = notesResponse.data;
  } catch (fetchError) {
    const status = fetchError instanceof ApiError ? fetchError.status : undefined;
    error = toUserFacingMessage(fetchError, "Could not load candidate details.", status);
  }

  if (error || !candidate || !notes) {
    return (
      <ErrorState
        message={error ?? "Could not load candidate details."}
        homeHref="/"
        homeLabel="Back to pipeline"
      />
    );
  }

  return <CandidateDetailView initialCandidate={candidate} initialNotes={notes} />;
}
