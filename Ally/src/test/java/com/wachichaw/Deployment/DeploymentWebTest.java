package com.wachichaw.Deployment;

import com.wachichaw.AllyChatAI.Controller.ChatController;
import com.wachichaw.User.Controller.UserController;
import com.wachichaw.Config.*;
import com.wachichaw.AllyRAG.*;
import com.wachichaw.AllyChatAI.Service.*;
import com.wachichaw.User.Service.UserService;
import com.wachichaw.User.Repo.UserRepo;
import com.wachichaw.Lawyer.Repo.LawyerRepo;
import com.wachichaw.Admin.Service.AdminService;
import com.wachichaw.Audit.Service.AuditLogService;
import com.wachichaw.EmailConfig.Service.EmailDeliveryException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {ChatController.class, UserController.class}, properties = {"spring.config.import=", "logging.level.org.springframework.web=INFO"})
@Import(SecurityConfig.class)
class DeploymentWebTest {
    static final String ORIGIN = "https://ally-frontend-eta.vercel.app";
    @Autowired MockMvc mvc;
    @MockitoBean RagService rag;
    @MockitoBean DeepSeekChatService deepSeek;
    @MockitoBean LegalQuestionValidator validator;
    @MockitoBean AiChatHistoryService history;
    @MockitoBean AuditLogService audit;
    @MockitoBean JwtUtil jwt;
    @MockitoBean UserService users;
    @MockitoBean AdminService admins;
    @MockitoBean UserRepo userRepo;
    @MockitoBean LawyerRepo lawyerRepo;
    @MockitoBean com.wachichaw.Lawyer.Service.LawyerService lawyerService;
    @MockitoBean OAuth2LoginSuccessHandler oauth;

    @Test void preflightWorksBeforeAuthenticationForBothOriginsAndAllMethods() throws Exception {
        for (String origin : new String[]{ORIGIN, "http://localhost:5173"}) {
            for (String method : new String[]{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}) {
                mvc.perform(options("/users/Client").header("Origin", origin)
                    .header("Access-Control-Request-Method", method)
                    .header("Access-Control-Request-Headers", "authorization,content-type"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", origin))
                    .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
            }
        }
        verifyNoInteractions(users);
    }
    @Test void rejectsOtherOrigins() throws Exception {
        mvc.perform(options("/users/Client").header("Origin", "https://other.vercel.app")
            .header("Access-Control-Request-Method", "POST"))
            .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
    @Test void unavailableRagReturnsHealthyBackendAndCors() throws Exception {
        when(rag.isRagServiceHealthy()).thenReturn(false);
        mvc.perform(get("/api/chat/health").header("Origin", ORIGIN))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", ORIGIN))
            .andExpect(jsonPath("$.status").value("running"))
            .andExpect(jsonPath("$.ragService").value("down"))
            .andExpect(jsonPath("$.ragAvailable").value(false));
    }
    private MockMultipartHttpServletRequestBuilder registration() {
        var request = multipart("/users/Client");
        request.param("email", "test@example.com").param("password", "test-only")
            .param("Fname", "Test").param("Lname", "User").param("phoneNumber", "639171234567")
            .param("address", "Test").param("city", "Test").param("province", "Test").param("zip", "1000")
            .header("Origin", ORIGIN);
        return request;
    }
    @Test void emailFailureIsControlledWithCors() throws Exception {
        when(users.createClient(anyString(), anyString(), anyString(), anyString(), anyLong(), anyString(), anyString(), anyString(), anyString(), isNull()))
            .thenThrow(new EmailDeliveryException("provider failure"));
        mvc.perform(registration()).andExpect(status().isServiceUnavailable())
            .andExpect(header().string("Access-Control-Allow-Origin", ORIGIN))
            .andExpect(jsonPath("$.message").value("We couldn't send your verification email. Please try registering again shortly."));
    }
    @Test void databaseFailureIsControlledWithCors() throws Exception {
        when(users.createClient(anyString(), anyString(), anyString(), anyString(), anyLong(), anyString(), anyString(), anyString(), anyString(), isNull()))
            .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private database details"));
        mvc.perform(registration()).andExpect(status().isServiceUnavailable())
            .andExpect(header().string("Access-Control-Allow-Origin", ORIGIN))
            .andExpect(jsonPath("$.message").value("Registration is temporarily unavailable. Please try again shortly."));
    }
    @Test void successDoesNotReturnPassword() throws Exception {
        var client = new com.wachichaw.Client.Entity.ClientEntity();
        client.setEmail("test@example.com"); client.setPassword("never-return-this");
        when(users.createClient(anyString(), anyString(), anyString(), anyString(), anyLong(), anyString(), anyString(), anyString(), anyString(), isNull())).thenReturn(client);
        mvc.perform(registration()).andExpect(status().isOk())
            .andExpect(jsonPath("$.verified").value(false)).andExpect(jsonPath("$.password").doesNotExist());
    }
}
