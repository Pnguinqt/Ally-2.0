package com.wachichaw.AllyChatAI.Service;

import com.wachichaw.AllyChatAI.Entity.AiChatHistoryEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class DeepSeekChatServiceTest {
    private DeepSeekChatService service;
    private MockRestServiceServer server;

    @BeforeEach void setup() {
        service = new DeepSeekChatService();
        ReflectionTestUtils.setField(service, "apiKey", "test-key");
        ReflectionTestUtils.setField(service, "baseUrl", "https://example.test");
        ReflectionTestUtils.setField(service, "model", "deepseek-v4-flash");
        ReflectionTestUtils.setField(service, "maxTokens", 16384);
        ReflectionTestUtils.setField(service, "maxContinuations", 2);
        server = MockRestServiceServer.createServer((RestTemplate) ReflectionTestUtils.getField(service, "restTemplate"));
    }

    private String completion(String text, String reason) {
        return "{\"choices\":[{\"message\":{\"content\":\"" + text + "\"},\"finish_reason\":\"" + reason + "\"}]}";
    }

    @Test void continuesTruncatedAnswers() {
        server.expect(requestTo("https://example.test/chat/completions"))
            .andExpect(jsonPath("$.max_tokens").value(16384))
            .andRespond(withSuccess(completion("First part. ", "length"), MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://example.test/chat/completions"))
            .andExpect(jsonPath("$.thinking.type").value("disabled"))
            .andExpect(jsonPath("$.messages[2].content").value("First part. "))
            .andRespond(withSuccess(completion("Finished.", "stop"), MediaType.APPLICATION_JSON));
        assertEquals("First part. Finished.", service.sendMessage("Question", List.of()));
        server.verify();
    }

    @Test void conversationContextDoesNotLeakIntoAnotherRequest() {
        var turn = new AiChatHistoryEntity();
        turn.setUserMessage("Private earlier question");
        turn.setAiResponse("Earlier answer");
        server.expect(requestTo("https://example.test/chat/completions"))
            .andExpect(jsonPath("$.messages[1].content").value("Private earlier question"))
            .andExpect(jsonPath("$.messages[3].content").value("Follow-up"))
            .andRespond(withSuccess(completion("Answer", "stop"), MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://example.test/chat/completions"))
            .andExpect(jsonPath("$.messages.length()").value(2))
            .andExpect(jsonPath("$.messages[1].content").value("Another user"))
            .andRespond(withSuccess(completion("Separate answer", "stop"), MediaType.APPLICATION_JSON));
        service.sendMessage("Follow-up", List.of(turn));
        assertEquals("Separate answer", service.sendMessage("Another user", List.of()));
        server.verify();
    }

    @Test void exhaustedContinuationBudgetIsExplicit() {
        ReflectionTestUtils.setField(service, "maxContinuations", 0);
        server.expect(requestTo("https://example.test/chat/completions"))
            .andRespond(withSuccess(completion("Partial answer", "length"), MediaType.APPLICATION_JSON));
        String result = service.sendMessage("Question", List.of());
        assertTrue(result.startsWith("Partial answer"));
        assertTrue(result.contains("not yet complete"));
        server.verify();
    }
}
