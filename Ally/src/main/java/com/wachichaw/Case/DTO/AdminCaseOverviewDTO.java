package com.wachichaw.Case.DTO;

import java.time.LocalDateTime;

import com.wachichaw.Case.Entity.LegalCasesEntity;

public record AdminCaseOverviewDTO(
        int caseId,
        long caseNumber,
        String caseType,
        String urgencyLevel,
        String status,
        LocalDateTime dateSubmitted,
        boolean lawyerAssigned) {

    public AdminCaseOverviewDTO(LegalCasesEntity legalCase) {
        this(
            legalCase.getCaseId(),
            legalCase.getCaseNumber(),
            legalCase.getCaseType(),
            legalCase.getUrgencyLevel() != null ? legalCase.getUrgencyLevel().name() : null,
            legalCase.getStatus() != null ? legalCase.getStatus().name() : null,
            legalCase.getDateSubmitted(),
            legalCase.getLawyer() != null
        );
    }
}
