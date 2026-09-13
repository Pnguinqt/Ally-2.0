package com.wachichaw.AllyRAG;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class RagService {

    @Value("${rag.service.url}")
    private String ragServiceUrl;

    @Value("${rag.enabled:false}")
    private boolean enabled;

    private final RestTemplate restTemplate;
    private final RestTemplate healthRestTemplate;

    public RagService(@Value("${rag.service.timeout:10000}") int timeout,
                      @Value("${rag.health.timeout:2000}") int healthTimeout) {
        this.restTemplate = client(timeout);
        this.healthRestTemplate = client(healthTimeout);
    }

    private RestTemplate client(int timeout) {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Math.max(1, Math.min(timeout, 3000)));
        factory.setReadTimeout(Math.max(1, timeout));
        return new RestTemplate(factory);
    }

    /**
     * NEW: Validate question using Python's semantic filtering
     * This runs REGARDLESS of RAG setting
     */
    public ValidationResponse validateQuestion(String query) {
        if (!enabled) {
            ValidationResponse fallback = new ValidationResponse();
            fallback.setValid(true);
            fallback.setMethod("rag_disabled");
            return fallback;
        }
        try {
            String url = ragServiceUrl + "/api/validate";

            Map<String, Object> request = new HashMap<>();
            request.put("query", query);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<ValidationResponse> response = restTemplate.postForEntity(
                url, entity, ValidationResponse.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }

            // If validation endpoint fails, allow through (fail open)
            ValidationResponse fallback = new ValidationResponse();
            fallback.setValid(true);
            fallback.setMethod("fallback");
            return fallback;

        } catch (Exception e) {
            System.err.println("Python validation error: " + e.getMessage());
            // On error, allow through (fail open)
            ValidationResponse fallback = new ValidationResponse();
            fallback.setValid(true);
            fallback.setMethod("error");
            return fallback;
        }
    }

    /**
     * Search relevant cases (only when RAG is enabled)
     */
    public RagSearchResponse searchRelevantCases(String query, int topK) {
        if (!enabled) return new RagSearchResponse();
        try {
            String url = ragServiceUrl + "/search";

            Map<String, Object> request = new HashMap<>();
            request.put("query", query);
            request.put("top_k", topK);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<RagSearchResponse> response = restTemplate.postForEntity(
                url, entity, RagSearchResponse.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }

            return new RagSearchResponse();

        } catch (Exception e) {
            System.err.println("RAG service error: " + e.getMessage());
            return new RagSearchResponse();
        }
    }

    public boolean isRagServiceHealthy() {
        if (!enabled) return false;
        try {
            String healthUrl = ragServiceUrl + "/health";
            ResponseEntity<String> response = healthRestTemplate.getForEntity(healthUrl, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }
}