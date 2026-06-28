import type {
  CreateMeeting,
  Meeting,
  ResolvePoll,
  Rsvp,
  Vote,
} from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export interface MeetingOption {
  id: string;
  meetingId: string;
  optionTime: string;
}
export interface MeetingVote {
  id: string;
  optionId: string;
  memberId: string;
}
export interface MeetingRsvp {
  id: string;
  meetingId: string;
  memberId: string;
  value: "yes" | "no";
}
export interface MeetingDetail {
  meeting: Meeting;
  options: MeetingOption[];
  rsvps: MeetingRsvp[];
  votes: MeetingVote[];
}

export const meetingsApi = {
  list: () => http<Meeting[]>("/api/meetings"),
  get: (id: string) => http<MeetingDetail>(`/api/meetings/${id}`),
  create: (body: CreateMeeting) =>
    http<Meeting>("/api/meetings", { method: "POST", body: JSON.stringify(body) }),
  resolve: (id: string, body: ResolvePoll) =>
    http<Meeting>(`/api/meetings/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  vote: (id: string, body: Vote) =>
    http<void>(`/api/meetings/${id}/votes`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  unvote: (id: string, body: Vote) =>
    http<void>(`/api/meetings/${id}/votes`, {
      method: "DELETE",
      body: JSON.stringify(body),
    }),
  rsvp: (id: string, body: Rsvp) =>
    http<void>(`/api/meetings/${id}/rsvp`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string) => http<void>(`/api/meetings/${id}`, { method: "DELETE" }),
};

export function useMeetings() {
  return useQuery({ queryKey: qk.meetings, queryFn: meetingsApi.list });
}
export function useMeeting(id?: string) {
  return useQuery({
    queryKey: qk.meeting(id ?? ""),
    queryFn: () => meetingsApi.get(id!),
    enabled: !!id,
  });
}

function useMeetingMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meetings });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export const useCreateMeeting = () => useMeetingMutation(meetingsApi.create);
export const useResolvePoll = () =>
  useMeetingMutation(({ id, body }: { id: string; body: ResolvePoll }) =>
    meetingsApi.resolve(id, body),
  );
export const useVote = () =>
  useMeetingMutation(({ id, body }: { id: string; body: Vote }) =>
    meetingsApi.vote(id, body),
  );
export const useUnvote = () =>
  useMeetingMutation(({ id, body }: { id: string; body: Vote }) =>
    meetingsApi.unvote(id, body),
  );
export const useRsvp = () =>
  useMeetingMutation(({ id, body }: { id: string; body: Rsvp }) =>
    meetingsApi.rsvp(id, body),
  );
export const useDeleteMeeting = () => useMeetingMutation(meetingsApi.remove);
