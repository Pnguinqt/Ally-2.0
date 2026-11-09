package com.wachichaw.Message;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.Message.Controller.MessagingSessionController;
import com.wachichaw.User.Entity.AccountType;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessagingSessionControllerTest {
    private final FirebaseApp app = mock(FirebaseApp.class);
    private final JwtUtil jwt = new JwtUtil();
    private final MessagingSessionController controller = new MessagingSessionController(app, jwt);

    @Test void issuesFirebaseTokenForVerifiedAllyAccountOnly() throws Exception {
        var actor = client(12);
        var token = jwt.generateToken(actor);
        var auth = mock(FirebaseAuth.class);
        var claims = Map.<String, Object>of("allyMessagingExpiresAt", jwt.extractExpirationMillis(token), "allyRole", "CLIENT");
        try (var firebase = mockStatic(FirebaseAuth.class)) {
            firebase.when(() -> FirebaseAuth.getInstance(app)).thenReturn(auth);
            when(auth.createCustomToken("12", claims)).thenReturn("firebase-token");

            var response = controller.create(actor, "Bearer " + token);
            assertEquals(Map.of("token", "firebase-token"), response.getBody());
            assertEquals("no-store", response.getHeaders().getCacheControl());
        }
    }

    @Test void refusesMissingMismatchedAndForgedSignIns() {
        var actor = client(12);
        assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(ResponseStatusException.class,
            () -> controller.create(null, null)).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(ResponseStatusException.class,
            () -> controller.create(actor, "Bearer " + jwt.generateToken(client(13)))).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(ResponseStatusException.class,
            () -> controller.create(actor, "Bearer " + new JwtUtil().generateToken(actor))).getStatusCode());
        verifyNoInteractions(app);
    }

    private ClientEntity client(int id) {
        var client = new ClientEntity();
        client.setUserId(id);
        client.setAccountType(AccountType.CLIENT);
        return client;
    }
}
