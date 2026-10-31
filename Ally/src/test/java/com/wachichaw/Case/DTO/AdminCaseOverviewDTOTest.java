package com.wachichaw.Case.DTO;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;

class AdminCaseOverviewDTOTest {

    @Test
    void serializationExcludesPrivateCaseContent() throws Exception {
        LegalCasesEntity legalCase = new LegalCasesEntity();
        legalCase.setCaseId(12);
        legalCase.setCaseNumber(1042L);
        legalCase.setCaseType("Civil");
        legalCase.setStatus(CaseStatus.PENDING);
        legalCase.setDateSubmitted(LocalDateTime.of(2026, 10, 31, 9, 30));
        legalCase.setTitle("Private case title");
        legalCase.setDescription("Private case description");

        String json = new ObjectMapper()
                .findAndRegisterModules()
                .writeValueAsString(new AdminCaseOverviewDTO(legalCase));

        assertThat(json)
                .contains("\"caseNumber\":1042")
                .contains("\"caseType\":\"Civil\"")
                .contains("\"status\":\"PENDING\"")
                .doesNotContain("Private case title")
                .doesNotContain("Private case description")
                .doesNotContain("\"title\"")
                .doesNotContain("\"description\"")
                .doesNotContain("\"client\"")
                .doesNotContain("\"lawyer\"");
    }
}
