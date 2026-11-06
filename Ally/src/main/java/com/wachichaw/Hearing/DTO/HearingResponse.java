package com.wachichaw.Hearing.DTO;

import java.time.Instant;
import com.wachichaw.Hearing.Entity.HearingEntity;

public record HearingResponse(Long hearingId, int caseId, String title, Instant startsAt, Instant endsAt,
                              String location, String notes, int bookedBy, Instant createdAt,
                              String status, int proposedBy, Integer acceptedBy, long revision,
                              String meetingType, String meetingLink) {
    public static HearingResponse from(HearingEntity hearing) {
        return new HearingResponse(hearing.getHearingId(), hearing.getLegalCase().getCaseId(), hearing.getTitle(),
            hearing.getStartsAt(), hearing.getEndsAt(), hearing.getLocation(), hearing.getNotes(),
            hearing.getBookedBy(), hearing.getCreatedAt(),
            hearing.getStatus() == null ? "CONFIRMED" : hearing.getStatus(),
            hearing.getProposedBy() == null ? hearing.getBookedBy() : hearing.getProposedBy(),
            hearing.getAcceptedBy(), hearing.getRevision() == null ? 0L : hearing.getRevision(),
            hearing.getMeetingType() == null ? "F2F" : hearing.getMeetingType(), hearing.getMeetingLink());
    }
}
