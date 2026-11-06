package com.wachichaw.Case.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wachichaw.AllyChatAI.Service.DeepSeekChatService;
import com.wachichaw.Case.DTO.CaseDraftRequest;
import com.wachichaw.Case.DTO.CaseDraftResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CaseDraftService {
    private final DeepSeekChatService ai;
    private final ObjectMapper mapper = new ObjectMapper();

    public CaseDraftService(DeepSeekChatService ai) { this.ai = ai; }

    public CaseDraftResponse draft(CaseDraftRequest request) {
        if (request == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a brief account of what happened.");
        String title = bounded(request.title(), 255);
        String description = bounded(request.description(), 1000);
        String facts = bounded(request.facts(), 3000);
        String caseType = bounded(request.caseType(), 100);
        if ((title + " " + description + " " + facts).trim().length() < 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least 20 characters describing what happened so ALLY can draft from your facts.");
        }
        try {
            var source = mapper.createObjectNode().put("currentTitle", title).put("currentDescription", description)
                .put("additionalFacts", facts).put("caseType", caseType);
            String raw = ai.draftCase(source.toString(), "ceb".equalsIgnoreCase(request.language()) ? "Cebuano (Bisaya)" : "English");
            var result = mapper.readTree(raw);
            if (result == null || !result.path("title").isTextual() || !result.path("description").isTextual()) {
                throw new IllegalStateException("Invalid AI draft");
            }
            String suggestedTitle = result.path("title").asText().trim();
            String suggestedDescription = result.path("description").asText().trim();
            if (suggestedTitle.length() < 5 || suggestedTitle.length() > 160
                    || suggestedDescription.length() < 20 || suggestedDescription.length() > 1000) {
                throw new IllegalStateException("Invalid AI draft length");
            }
            return new CaseDraftResponse(suggestedTitle, suggestedDescription);
        } catch (Exception unavailable) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "ALLY could not prepare a draft. Try again or continue writing your case details.");
        }
    }

    private String bounded(String value, int max) {
        String text = value == null ? "" : value.trim();
        if (text.length() > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The case drafting input is too long. Shorten your notes and try again.");
        return text;
    }
}
