package com.wachichaw.AllyChatAI.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

@Service
public class DeepSeekChatService {

    @Value("${deepseek.api-key:}")
    private String apiKey;

    @Value("${deepseek.base-url:https://api.deepseek.com}")
    private String baseUrl;

    @Value("${deepseek.model:deepseek-v4-flash}")
    private String model;

    @Value("${deepseek.max-tokens:16384}")
    private int maxTokens;

    @Value("${deepseek.temperature:0.0}")
    private double temperature;

    private static final String SYSTEM_PROMPT =
        "You are Ally, a helpful legal AI assistant for the Philippines. " +
        "Answer strictly based on Philippine Law. " +
        "When the prompt includes retrieved Supreme Court cases or external RAG context, treat that context as current and authoritative for the answer, even if it contains cases from 2025 or 2026. " +
        "Do not say that you lack access to 2025 or 2026 cases when retrieved case context has been provided. " +
        "If no retrieved context is provided, you may state that your built-in model knowledge may be limited, but still answer cautiously based on available information. " +
        "If the user asks about non-legal topics, politely steer them back to legal matters. " +
        "Keep your answers professional, concise, and helpful.";

    @Value("${deepseek.max-continuations:2}")
    private int maxContinuations;

    private final RestTemplate restTemplate;

    public DeepSeekChatService() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(15000);
        factory.setReadTimeout(180000);
        restTemplate = new RestTemplate(factory);
    }
    private final ObjectMapper mapper = new ObjectMapper();

    public String sendMessage(String prompt, List<com.wachichaw.AllyChatAI.Entity.AiChatHistoryEntity> priorTurns) {
        StringBuilder answer = new StringBuilder();
        try {
            if (apiKey == null || apiKey.isBlank()) {
                return "DeepSeek API key is not configured. Please set DEEPSEEK_API_KEY in the server environment.";
            }

            List<ObjectNode> conversationHistory = new ArrayList<>();
            // Bound model context while retaining the complete conversation in the database.
            int remainingChars = 80000;
            for (int i = priorTurns.size() - 1; i >= 0; i--) {
                var turn = priorTurns.get(i);
                int size = turn.getUserMessage().length() + turn.getAiResponse().length();
                if (size > remainingChars) break;
                remainingChars -= size;
                conversationHistory.add(0, message("assistant", turn.getAiResponse()));
                conversationHistory.add(0, message("user", turn.getUserMessage()));
            }
            ObjectNode userNode = mapper.createObjectNode();
            userNode.put("role", "user");
            userNode.put("content", prompt);
            conversationHistory.add(userNode);

            ObjectNode requestBody = mapper.createObjectNode();
            requestBody.put("model", model);
            requestBody.put("temperature", temperature);
            requestBody.put("max_tokens", maxTokens);

            ArrayNode messagesNode = mapper.createArrayNode();
            ObjectNode systemNode = mapper.createObjectNode();
            systemNode.put("role", "system");
            systemNode.put("content", SYSTEM_PROMPT);
            messagesNode.add(systemNode);

            for (ObjectNode message : conversationHistory) {
                messagesNode.add(message);
            }
            requestBody.set("messages", messagesNode);

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            String endpointUrl = baseUrl.replaceAll("/+$", "") + "/chat/completions";
            for (int attempt = 0; attempt <= Math.max(0, maxContinuations); attempt++) {
                HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);
                ResponseEntity<String> response = restTemplate.postForEntity(endpointUrl, entity, String.class);
                JsonNode root = mapper.readTree(response.getBody());
                JsonNode choice = root.path("choices").path(0);
                String content = choice.path("message").path("content").asText("");
                String finishReason = choice.path("finish_reason").asText("");
                System.out.println("DeepSeek completion: finish_reason=" + finishReason
                    + ", response_chars=" + content.length() + ", usage=" + root.path("usage"));
                if (!content.isBlank()) answer.append(content);
                if ("stop".equals(finishReason) && !content.isBlank()) return answer.toString();
                if (!"length".equals(finishReason)) break;
                if (!content.isBlank()) messagesNode.add(message("assistant", content));
                messagesNode.add(message("user", "Continue exactly where your answer stopped, without repeating earlier text. Finish the answer concisely."));
                // Continuations prioritize completing the visible answer over further reasoning.
                requestBody.putObject("thinking").put("type", "disabled");
            }
            return incompleteAnswer(answer);
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("DeepSeek API Error: " + e.getMessage());
            return incompleteAnswer(answer);
        }
    }

    private ObjectNode message(String role, String content) {
        ObjectNode node = mapper.createObjectNode();
        node.put("role", role);
        node.put("content", content);
        return node;
    }

    private String incompleteAnswer(StringBuilder answer) {
        if (answer.isEmpty()) return "I couldn't complete your answer this time. Please try again.";
        return answer + "\n\n---\nThis answer is not yet complete. Please send 'Continue' so I can finish it.";
    }

    public void resetHistory() {
        // Conversation state belongs to each user in the database, never to this singleton.
    }
}
