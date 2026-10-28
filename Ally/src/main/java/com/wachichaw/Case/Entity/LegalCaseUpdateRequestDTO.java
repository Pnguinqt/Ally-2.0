package com.wachichaw.Case.Entity;

public class LegalCaseUpdateRequestDTO {
    private String title;
    private String caseType;
    private String description;

    public LegalCaseUpdateRequestDTO() {
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCaseType() {
        return caseType;
    }

    public void setCaseType(String caseType) {
        this.caseType = caseType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
