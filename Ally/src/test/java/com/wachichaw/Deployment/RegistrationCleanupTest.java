package com.wachichaw.Deployment;

import com.wachichaw.User.Service.UserService;
import com.wachichaw.User.Repo.UserRepo;
import com.wachichaw.Client.Entity.TempClient;
import com.wachichaw.Admin.Service.SystemSettingsService;
import com.wachichaw.EmailConfig.Service.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RegistrationCleanupTest {
    @Test void failedEmailRemovesPendingOtpAndDoesNotCreateVerifiedAccount() {
        var repo = mock(UserRepo.class);
        var pending = mock(TempClient.class);
        var verification = mock(VerificationService.class);
        var settings = mock(SystemSettingsService.class, RETURNS_DEEP_STUBS);
        when(settings.getSettings().isEnableEmailVerification()).thenReturn(true);
        when(repo.findByEmail("test@example.com")).thenReturn(Optional.empty());
        doThrow(new EmailDeliveryException("offline")).when(verification).sendVerificationEmail(anyString(), anyString(), anyString());
        var service = new UserService(repo, mock(PasswordEncoder.class));
        ReflectionTestUtils.setField(service, "tempClientStorageService", pending);
        ReflectionTestUtils.setField(service, "verificationService", verification);
        ReflectionTestUtils.setField(service, "systemSettingsService", settings);
        assertThrows(EmailDeliveryException.class, () -> service.createClient("test@example.com", "test-only", "Test", "User", 639171234567L, "Address", "City", "Province", "1000", null));
        var token = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(pending).saveUnverifiedUser(token.capture(), any());
        verify(pending).removeUnverifiedUser(token.getValue());
        verify(repo, never()).save(any());
    }
}
