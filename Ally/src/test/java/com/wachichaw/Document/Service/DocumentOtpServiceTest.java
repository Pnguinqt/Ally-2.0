package com.wachichaw.Document.Service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Document.Service.DocumentOtpService.Action;
import com.wachichaw.Document.Service.DocumentOtpService.Scope;
import com.wachichaw.EmailConfig.Service.EmailDeliveryException;
import com.wachichaw.EmailConfig.Service.EmailService;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.User.Entity.AccountType;

class DocumentOtpServiceTest {
    private static final Pattern EMAILED_CODE = Pattern.compile("<strong>([0-9]{6})</strong>");
    private static final Scope PREVIEW = new Scope(7, 9, Action.PREVIEW);
    private static final Scope DOWNLOAD = new Scope(7, 9, Action.DOWNLOAD);
    private static final Scope UNLOCK = new Scope(7, null, Action.UNLOCK);
    private record Delivery(String to, String code) {}

    private final List<Delivery> deliveries = new ArrayList<>();
    private final ClientEntity client = new ClientEntity();
    private final LawyerEntity lawyer = new LawyerEntity();
    private final LegalCasesEntity legalCase = new LegalCasesEntity();
    private final EmailService email = mock(EmailService.class);
    private final Clock clock = mock(Clock.class);
    private Instant now = Instant.parse("2026-01-01T00:00:00Z");
    private DocumentOtpService otp;

    @BeforeEach void setup() {
        client.setUserId(1);
        client.setAccountType(AccountType.CLIENT);
        client.setEmail("client@example.test");
        lawyer.setUserId(2);
        lawyer.setAccountType(AccountType.LAWYER);
        lawyer.setEmail("lawyer@example.test");
        legalCase.setClient(client);
        legalCase.setLawyer(lawyer);
        legalCase.setStatus(CaseStatus.ACCEPTED);
        var cases = mock(LegalCaseRepo.class);
        when(cases.findById(7)).thenReturn(Optional.of(legalCase));
        when(clock.instant()).thenAnswer(invocation -> now);
        doAnswer(invocation -> {
            var code = EMAILED_CODE.matcher(invocation.getArgument(2));
            assertTrue(code.find());
            deliveries.add(new Delivery(invocation.getArgument(0), code.group(1)));
            return null;
        }).when(email).sendEmail(anyString(), anyString(), anyString());
        otp = new DocumentOtpService(cases, email, clock);
    }

    @Test void separateEmailsAndCodesAreScopedToTheAccountDocumentAndAction() {
        otp.requestCode(PREVIEW, client);
        otp.requestCode(PREVIEW, lawyer);
        otp.requestCode(DOWNLOAD, client);
        assertEquals(List.of(client.getEmail(), lawyer.getEmail(), client.getEmail()),
            deliveries.stream().map(Delivery::to).toList());
        assertEquals(3, deliveries.stream().map(Delivery::code).distinct().count());
        String clientCode = deliveries.getFirst().code();
        assertStatus(HttpStatus.FORBIDDEN, () -> otp.verifyCode(PREVIEW, lawyer, clientCode));
        assertStatus(HttpStatus.FORBIDDEN, () -> otp.verifyCode(DOWNLOAD, client, clientCode));
        assertStatus(HttpStatus.GONE, () -> otp.verifyCode(new Scope(7, 10, Action.PREVIEW), client, clientCode));
        otp.verifyCode(PREVIEW, client, clientCode);
        assertStatus(HttpStatus.GONE, () -> otp.verifyCode(PREVIEW, client, clientCode));
        otp.verifyCode(PREVIEW, lawyer, deliveries.get(1).code());
    }

    @Test void codeExpiresExactlyFiveMinutesAfterGeneration() {
        assertEquals(now.plusSeconds(300).toEpochMilli(), otp.requestCode(PREVIEW, client));
        otp.requestCode(DOWNLOAD, client);
        now = now.plusSeconds(299).plusMillis(999);
        otp.verifyCode(PREVIEW, client, deliveries.getFirst().code());
        now = now.plusMillis(1);
        assertStatus(HttpStatus.GONE, () -> otp.verifyCode(DOWNLOAD, client, deliveries.getLast().code()));
    }

    @Test void resendingInvalidatesTheOldCodeAndFiveMistakesAllowAnImmediateNewCode() {
        otp.requestCode(PREVIEW, client);
        String oldCode = deliveries.getLast().code();
        otp.requestCode(PREVIEW, client);
        String currentCode = deliveries.getLast().code();
        assertNotEquals(oldCode, currentCode);
        for (int i = 0; i < 4; i++) {
            assertStatus(HttpStatus.FORBIDDEN, () -> otp.verifyCode(PREVIEW, client, oldCode));
        }
        assertStatus(HttpStatus.GONE, () -> otp.verifyCode(PREVIEW, client, "1234"));
        assertStatus(HttpStatus.GONE, () -> otp.verifyCode(PREVIEW, client, currentCode));
        otp.requestCode(PREVIEW, client);
        otp.verifyCode(PREVIEW, client, deliveries.getLast().code());
    }

    @Test void rateLimitsEmailAcrossScopesWithoutBlockingVerificationOrOtherAccounts() {
        for (int i = 0; i < 6; i++) otp.requestCode(PREVIEW, client);
        var limited = assertThrows(ResponseStatusException.class, () -> otp.requestCode(DOWNLOAD, client));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, limited.getStatusCode());
        assertEquals("60", limited.getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
        otp.verifyCode(PREVIEW, client, deliveries.getLast().code());
        otp.requestCode(DOWNLOAD, lawyer);
        now = now.plusSeconds(60);
        otp.requestCode(DOWNLOAD, client);
    }

    @Test void failedDeliveryLeavesNoUsableCode() {
        otp.requestCode(PREVIEW, client);
        String oldCode = deliveries.getLast().code();
        doThrow(new EmailDeliveryException("failure")).when(email).sendEmail(anyString(), anyString(), anyString());
        assertStatus(HttpStatus.SERVICE_UNAVAILABLE, () -> otp.requestCode(PREVIEW, client));
        assertStatus(HttpStatus.GONE, () -> otp.verifyCode(PREVIEW, client, oldCode));
    }

    @Test void pendingDeliveryCannotBeVerifiedOrReplacedByAConcurrentResend() throws Exception {
        var sending = new CountDownLatch(1);
        var finish = new CountDownLatch(1);
        doAnswer(invocation -> {
            sending.countDown();
            assertTrue(finish.await(5, TimeUnit.SECONDS));
            return null;
        }).when(email).sendEmail(anyString(), anyString(), anyString());
        try (var executor = Executors.newSingleThreadExecutor()) {
            var request = executor.submit(() -> otp.requestCode(PREVIEW, client));
            try {
                assertTrue(sending.await(5, TimeUnit.SECONDS));
                assertStatus(HttpStatus.CONFLICT, () -> otp.requestCode(PREVIEW, client));
                assertStatus(HttpStatus.CONFLICT, () -> otp.verifyCode(PREVIEW, client, "123456"));
            } finally {
                finish.countDown();
            }
            assertEquals(now.plusSeconds(300).toEpochMilli(), request.get(5, TimeUnit.SECONDS));
        }
    }

    @Test void rejectsUnauthorizedUsersAndPendingCasesBeforeSending() {
        var outsider = new ClientEntity();
        outsider.setUserId(99);
        outsider.setAccountType(AccountType.CLIENT);
        assertStatus(HttpStatus.FORBIDDEN, () -> otp.requestCode(PREVIEW, outsider));
        legalCase.setStatus(CaseStatus.PENDING);
        assertStatus(HttpStatus.FORBIDDEN, () -> otp.requestCode(PREVIEW, client));
        verifyNoInteractions(email);
    }

    @Test void workspaceGrantUsesExistingSessionAndCaseBoundary() {
        otp.requestCode(UNLOCK, client);
        long expiresAt = otp.unlock(7, client, "Bearer login", deliveries.getLast().code());
        assertEquals(expiresAt, otp.accessExpiresAt(7, client, "Bearer login"));
        assertEquals(0, otp.accessExpiresAt(7, client, "Bearer other-login"));
        assertEquals(0, otp.accessExpiresAt(7, lawyer, "Bearer login"));
        now = now.plusSeconds(900);
        assertEquals(0, otp.accessExpiresAt(7, client, "Bearer login"));
    }

    private static void assertStatus(HttpStatus status, Runnable request) {
        assertEquals(status, assertThrows(ResponseStatusException.class, request::run).getStatusCode());
    }
}
