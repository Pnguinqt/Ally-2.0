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
        if (user.getAccountType() != AccountType.LAWYER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned lawyer can book hearings");
        }
        // Serialize bookings for this case so simultaneous requests cannot reserve overlapping hearings.
        var legalCase = cases.findByIdForHearingBooking(caseId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
        requireParticipant(legalCase, user);
        if (legalCase.getStatus() != CaseStatus.ACCEPTED || legalCase.getClient() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hearings can only be booked for accepted cases");
        }
        String title = requiredText(request.title(), "Hearing title", 160);
        String location = requiredText(request.location(), "Court / location", 255);
        String notes = request.notes() == null ? "" : request.notes().trim();
        if (notes.length() > 4000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notes must be 4000 characters or fewer");
        }
        var now = Instant.now();
        if (request.startsAt() == null || request.endsAt() == null || !request.startsAt().isAfter(now)
                || !request.endsAt().isAfter(request.startsAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Choose a future hearing time with an end time after its start");
        }
        if (hearings.existsByLegalCaseCaseIdAndStartsAtLessThanAndEndsAtGreaterThan(
                caseId, request.endsAt(), request.startsAt())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This case already has a hearing at that time");
        }
        var hearing = new HearingEntity();
        hearing.setLegalCase(legalCase);
        hearing.setTitle(title);
        hearing.setLocation(location);
        hearing.setNotes(notes);
        hearing.setStartsAt(request.startsAt());
        hearing.setEndsAt(request.endsAt());
        hearing.setBookedBy(user.getUserId());
        hearing.setCreatedAt(now);
        hearing = hearings.save(hearing);
        audit.log(user.getUserId(), "HEARING_BOOKED", "HEARING", "CASE", String.valueOf(caseId),
            "Booked hearing: " + title + " at " + request.startsAt(), "SUCCESS");
        return HearingResponse.from(hearing);
    }

    private void requireParticipant(LegalCasesEntity legalCase, UserEntity user) {
        boolean lawyer = user.getAccountType() == AccountType.LAWYER && legalCase.getLawyer() != null
            && legalCase.getLawyer().getUserId() == user.getUserId();
        boolean client = user.getAccountType() == AccountType.CLIENT && legalCase.getClient() != null
            && legalCase.getClient().getUserId() == user.getUserId();
        if (!lawyer && !client) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only this case's client and lawyer can access its hearings");
        }
    }

    private String requiredText(String value, String label, int limit) {
        if (value == null || value.isBlank() || value.trim().length() > limit) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " is required and must be " + limit + " characters or fewer");
        }
        return value.trim();
    }
}
