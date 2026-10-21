package com.wachichaw.AllyRAG;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class LegalCase {
    @JsonProperty("relevance_explanation")
    private String relevanceExplanation;
    @com.fasterxml.jackson.annotation.JsonProperty("legal_validation_status")
    private String legalValidationStatus = "unverified";
    @com.fasterxml.jackson.annotation.JsonProperty("can_state_final_outcome")
    private boolean canStateFinalOutcome;
    @com.fasterxml.jackson.annotation.JsonProperty("validation_warning")
    private String validationWarning;

    @JsonProperty("case_number")
    private String caseNumber;
    @JsonProperty("decision_date")
    private String decisionDate;
    @JsonProperty("final_disposition")
    private String finalDisposition;
    @JsonProperty("court_level")
    private String courtLevel;
    @JsonProperty("source_provider")
    private String sourceProvider;
    private String title;
    private Double score;
    private String content;
    private String citation;
    private String section;

    @JsonProperty("source_url")
    private String sourceUrl;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Double getScore() {
        return score;
    }

    public void setScore(Double score) {
        this.score = score;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getCitation() {
        return citation;
    }

    public void setCitation(String citation) {
        this.citation = citation;
    }

    public String getSection() {
        return section;
    }

    public void setSection(String section) {
        this.section = section;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }
}
