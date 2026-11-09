package com.wachichaw.Hearing.Service;

import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.wachichaw.Audit.Service.AuditLogService;
import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Hearing.DTO.HearingRequest;
import com.wachichaw.Hearing.DTO.HearingResponse;
import com.wachichaw.Hearing.Entity.HearingEntity;
import com.wachichaw.Hearing.Repo.HearingRepo;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.UserEntity;

@Service
public class HearingService {
    private final LegalCaseRepo cases;
    private final HearingRepo hearings;
    private final AuditLogService audit;

    public HearingService(LegalCaseRepo cases, HearingRepo hearings, AuditLogService audit) {
        this.cases = cases;
        this.hearings = hearings;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<HearingResponse> list(int caseId, UserEntity user) {
        var legalCase = cases.findById(caseId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
        requireParticipant(legalCase, user);
        return hearings.findByLegalCaseCaseIdOrderByStartsAtAsc(caseId).stream().map(HearingResponse::from).toList();
    }

    @Transactional
    public HearingResponse book(int caseId, UserEntity user, HearingRequest request) {
        var legalCase = activeCase(caseId, user);
        var hearing = new HearingEntity();
        hearing.setLegalCase(legalCase);
        applyProposal(hearing, user, request);
        hearing.setBookedBy(user.getUserId());
        hearing.setCreatedAt(Instant.now());
        hearing = hearings.save(hearing);
        log(user, caseId, "APPOINTMENT_PROPOSED");
        return HearingResponse.from(hearing);
    }

    @Transactional
    public HearingResponse edit(int caseId, Long id, UserEntity user, HearingRequest request) {
        activeCase(caseId, user);
        var hearing = appointment(caseId, id);
        requireRevision(hearing, request.revision());
        requireFuture(hearing);
        applyProposal(hearing, user, request);
        log(user, caseId, "APPOINTMENT_EDITED");
        return HearingResponse.from(hearings.save(hearing));
    }

    @Transactional
    public HearingResponse accept(int caseId, Long id, UserEntity user, long revision) {
        activeCase(caseId, user);
        var hearing = appointment(caseId, id);
        requireRevision(hearing, revision);
        requireFuture(hearing);
        if (!"PENDING".equals(hearing.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This appointment is already confirmed");
        }
        if (hearing.getProposedBy() == null || hearing.getProposedBy() == user.getUserId()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the other participant can accept this proposal");
        }
        requireNoOverlap(hearing, hearing.getStartsAt(), hearing.getEndsAt());
        hearing.setStatus("CONFIRMED");
        hearing.setAcceptedBy(user.getUserId());
        hearing.setRevision(revision + 1);
        log(user, caseId, "APPOINTMENT_ACCEPTED");
        return HearingResponse.from(hearings.save(hearing));
    }

    @Transactional
    public void delete(int caseId, Long id, UserEntity user, long revision) {
        // A participant can remove an appointment even after the case has closed.
        var legalCase = cases.findByIdForUpdate(caseId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
        requireParticipant(legalCase, user);
        var hearing = appointment(caseId, id);
        requireRevision(hearing, revision);
        hearings.delete(hearing);
        log(user, caseId, "APPOINTMENT_DELETED");
    }

    private LegalCasesEntity activeCase(int caseId, UserEntity user) {
        // All appointment mutations lock the parent case, serializing edits and acceptance.
        var legalCase = cases.findByIdForUpdate(caseId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
        requireParticipant(legalCase, user);
        if (legalCase.getStatus() != CaseStatus.ACCEPTED || legalCase.getClient() == null || legalCase.getLawyer() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Appointments can only be proposed or accepted for accepted cases");
        }
        return legalCase;
    }

    private HearingEntity appointment(int caseId, Long id) {
        var hearing = hearings.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
        if (hearing.getLegalCase().getCaseId() != caseId) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found in this case");
        }
        return hearing;
    }

    private void requireRevision(HearingEntity hearing, Long revision) {
        long current = hearing.getRevision() == null ? 0L : hearing.getRevision();
        if (revision == null || revision != current) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This appointment has changed. Refresh and review the latest proposal");
        }
    }

    private void requireFuture(HearingEntity hearing) {
        if (!hearing.getStartsAt().isAfter(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An appointment that has started cannot be edited or accepted");
        }
    }

    private void applyProposal(HearingEntity hearing, UserEntity user, HearingRequest request) {
        String title = requiredText(request.title(), "Appointment title", 160);
        String meetingType = request.meetingType() == null ? "F2F" : request.meetingType();
        if (!List.of("F2F", "ONLINE").contains(meetingType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Face-to-face or Online for the meeting type");
        }
        String location = "";
        String meetingLink = null;
        if ("F2F".equals(meetingType)) {
            location = requiredText(request.location(), "Venue / address", 255);
        } else {
            meetingLink = requiredText(request.meetingLink(), "Meeting link", 2048);
            try {
                var uri = java.net.URI.create(meetingLink);
                if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                        || uri.getHost() == null || uri.getUserInfo() != null) {
                    throw new IllegalArgumentException();
                }
            } catch (IllegalArgumentException invalidLink) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid http or https meeting link");
            }
        }
        String notes = request.notes() == null ? "" : request.notes().trim();
        if (notes.length() > 4000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notes must be 4000 characters or fewer");
        }
        if (request.startsAt() == null || request.endsAt() == null || !request.startsAt().isAfter(Instant.now())
                || !request.endsAt().isAfter(request.startsAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Choose a future appointment time with an end time after its start");
        }
        requireNoOverlap(hearing, request.startsAt(), request.endsAt());
        hearing.setTitle(title);
        hearing.setLocation(location);
        hearing.setMeetingType(meetingType);
        hearing.setMeetingLink(meetingLink);
        hearing.setNotes(notes);
        hearing.setStartsAt(request.startsAt());
        hearing.setEndsAt(request.endsAt());
        hearing.setStatus("PENDING");
        hearing.setProposedBy(user.getUserId());
        hearing.setAcceptedBy(null);
        hearing.setRevision(hearing.getRevision() == null ? 1L : hearing.getRevision() + 1);
    }

    private void requireNoOverlap(HearingEntity hearing, Instant startsAt, Instant endsAt) {
        int caseId = hearing.getLegalCase().getCaseId();
        boolean overlaps = hearing.getHearingId() == null
            ? hearings.existsByLegalCaseCaseIdAndStartsAtLessThanAndEndsAtGreaterThan(caseId, endsAt, startsAt)
            : hearings.existsByLegalCaseCaseIdAndHearingIdNotAndStartsAtLessThanAndEndsAtGreaterThan(caseId, hearing.getHearingId(), endsAt, startsAt);
        if (overlaps) throw new ResponseStatusException(HttpStatus.CONFLICT, "This case already has an appointment at that time");
    }

    private void log(UserEntity user, int caseId, String action) {
        audit.log(user.getUserId(), action, "APPOINTMENT", "CASE", String.valueOf(caseId), action, "SUCCESS");
    }

    private void requireParticipant(LegalCasesEntity legalCase, UserEntity user) {
        boolean lawyer = user.getAccountType() == AccountType.LAWYER && legalCase.getLawyer() != null
            && legalCase.getLawyer().getUserId() == user.getUserId();
        boolean client = user.getAccountType() == AccountType.CLIENT && legalCase.getClient() != null
            && legalCase.getClient().getUserId() == user.getUserId();
        if (!lawyer && !client) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only this case's client and lawyer can access its appointments");
        }
    }

    private String requiredText(String value, String label, int limit) {
        if (value == null || value.isBlank() || value.trim().length() > limit) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " is required and must be " + limit + " characters or fewer");
        }
        return value.trim();
    }
}
