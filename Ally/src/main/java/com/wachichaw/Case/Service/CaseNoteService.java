package com.wachichaw.Case.Service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.wachichaw.Case.Entity.CaseNoteEntity;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.CaseNoteRepo;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.UserEntity;

@Service
public class CaseNoteService {
    private final LegalCaseRepo cases;
    private final CaseNoteRepo notes;

    public CaseNoteService(LegalCaseRepo cases, CaseNoteRepo notes) {
        this.cases = cases;
        this.notes = notes;
    }

    @Transactional(readOnly = true)
    public String load(int caseId, UserEntity actor) {
        requireParticipant(caseId, actor, false);
        return notes.findByLegalCaseCaseIdAndAuthorUserId(caseId, actor.getUserId())
            .map(CaseNoteEntity::getContent).orElse(null);
    }

    @Transactional
    public String save(int caseId, UserEntity actor, String content) {
        // Serialize saves on the case, including concurrent attempts to create the first note.
        var legalCase = requireParticipant(caseId, actor, true);
        if (content == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Note content is required.");
        }

        var note = notes.findByLegalCaseCaseIdAndAuthorUserId(caseId, actor.getUserId()).orElseGet(() -> {
            var newNote = new CaseNoteEntity();
            newNote.setLegalCase(legalCase);
            newNote.setAuthor(actor);
            return newNote;
        });
        note.setContent(content);
        return notes.save(note).getContent();
    }

    private LegalCasesEntity requireParticipant(int caseId, UserEntity actor, boolean forUpdate) {
        if (actor == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to access workspace notes.");
        }
        var candidate = forUpdate ? cases.findByIdForUpdate(caseId) : cases.findById(caseId);
        var legalCase = candidate.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found."));
        var client = legalCase.getClient();
        var lawyer = legalCase.getLawyer();
        boolean isClient = actor.getAccountType() == AccountType.CLIENT && client != null && client.getUserId() == actor.getUserId();
        boolean isLawyer = actor.getAccountType() == AccountType.LAWYER && lawyer != null && lawyer.getUserId() == actor.getUserId();
        if (!isClient && !isLawyer) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to notes for this case.");
        }
        return legalCase;
    }
}
