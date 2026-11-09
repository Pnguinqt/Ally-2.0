package com.wachichaw.Case.Repo;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.wachichaw.Case.Entity.CaseNoteEntity;

public interface CaseNoteRepo extends JpaRepository<CaseNoteEntity, Long> {
    Optional<CaseNoteEntity> findByLegalCaseCaseIdAndAuthorUserId(int caseId, int userId);
}
