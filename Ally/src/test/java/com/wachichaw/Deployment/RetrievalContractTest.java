package com.wachichaw.Deployment;

import com.wachichaw.AllyRAG.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class RetrievalContractTest {
    @Test
    void controllerDoesNotGenerateFromUnverifiedCasesOrFailures() {
        var controller = new com.wachichaw.AllyChatAI.Controller.ChatController();
        var rag = org.mockito.Mockito.mock(RagService.class);
        var generator = org.mockito.Mockito.mock(com.wachichaw.AllyChatAI.Service.DeepSeekChatService.class);
        ReflectionTestUtils.setField(controller, "ragService", rag);
        ReflectionTestUtils.setField(controller, "deepSeekChatService", generator);
        ReflectionTestUtils.setField(controller, "validator", new LegalQuestionValidator());
        var request = new ChatRequest();
        request.setMessage("Retrieve Pedro P. Isican v. People, G.R. No. 266431");
        request.setUseRAG(true);
        var result = new RagSearchResponse();
        var record = new LegalCase();
        record.setTitle("Isican");
        record.setContent("Quoted MTC conviction");
        record.setScore(99.0);
        record.setLegalValidationStatus("unverified");
        record.setCanStateFinalOutcome(false);
        result.setCases(java.util.List.of(record));
        result.setValidationWarning("Review official decision");
        org.mockito.Mockito.when(rag.searchRelevantCases(request.getMessage(), 3)).thenReturn(result);
        var http = new org.springframework.mock.web.MockHttpServletRequest();
        var response = controller.chat(request, http);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(0, response.getBody().getCaseCount());
        assertFalse(response.getBody().isCanStateFinalOutcome());
        assertEquals("Review official decision", response.getBody().getValidationWarning());
        assertFalse(response.getBody().getResponse().contains("conviction"));
        org.mockito.Mockito.when(rag.searchRelevantCases(request.getMessage(), 3))
                .thenThrow(new IllegalStateException());
        assertEquals(503, controller.chat(request, http).getStatusCode().value());
        org.mockito.Mockito.verifyNoInteractions(generator);
    }

    @Test
    void preservesContractThroughHttpAndChatSerialization() throws Exception {
        var service = new RagService(100, 100);
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "ragServiceUrl", "http://rag.test");
        var server = MockRestServiceServer
                .createServer((RestTemplate) ReflectionTestUtils.getField(service, "restTemplate"));
        server.expect(requestTo("http://rag.test/search"))
                .andExpect(jsonPath("$.top_k").value(3))
                .andExpect(jsonPath("$.query").value("Isican"))
                .andRespond(withSuccess(
                        """
                                {"cases":[{"title":"Isican","case_number":"266431","decision_date":"2023-01-18","score":99,"content":"excerpt","source_url":""}],
                                 "count":1,"query":"Isican","rejected":false,"confidence":0.99,
                                 "legal_validation_status":"unverified","can_state_final_outcome":false,"validation_warning":"Review official decision"}
                                """,
                        MediaType.APPLICATION_JSON));
        var result = service.searchRelevantCases("Isican", 3);
        var chat = new ChatResponse();
        chat.setLegalValidationStatus(result.getLegalValidationStatus());
        chat.setCanStateFinalOutcome(result.isCanStateFinalOutcome());
        chat.setValidationWarning(result.getValidationWarning());
        chat.setRelevantCases(result.getCases());
        var json = new ObjectMapper().valueToTree(chat);
        assertEquals("unverified", json.get("legal_validation_status").asText());
        assertFalse(json.get("can_state_final_outcome").asBoolean());
        assertEquals("Review official decision", json.get("validation_warning").asText());
        assertEquals("266431", json.get("relevantCases").get(0).get("case_number").asText());
        assertEquals("2023-01-18", json.get("relevantCases").get(0).get("decision_date").asText());
        server.verify();
    }

    @Test
    void timeoutDoesNotReturnSuccessfulEmptyResult() {
        var service = new RagService(100, 100);
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "ragServiceUrl", "http://rag.test");
        var server = MockRestServiceServer
                .createServer((RestTemplate) ReflectionTestUtils.getField(service, "restTemplate"));
        server.expect(requestTo("http://rag.test/search"))
                .andRespond(withException(new java.net.SocketTimeoutException()));
        assertThrows(IllegalStateException.class, () -> service.searchRelevantCases("Isican", 3));
        server.verify();
    }
}
