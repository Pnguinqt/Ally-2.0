package com.wachichaw.Admin.Service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.Lawyer.Repo.LawyerRepo;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.UserEntity;
import com.wachichaw.User.Repo.UserRepo;

class AdminAnalyticsServiceTest {

    private UserRepo userRepo;
    private LegalCaseRepo legalCaseRepo;
    private LawyerRepo lawyerRepo;
    private AdminAnalyticsService service;

    @BeforeEach
    void setUp() {
        userRepo = mock(UserRepo.class);
        legalCaseRepo = mock(LegalCaseRepo.class);
        lawyerRepo = mock(LawyerRepo.class);
        service = new AdminAnalyticsService(userRepo, legalCaseRepo, lawyerRepo);
    }

    @Test
    void buildsAnalyticsFromPersistedUsersCasesAndLawyers() {
        LocalDateTime twoDaysAgo = LocalDateTime.now().minusDays(2);

        UserEntity client = mock(UserEntity.class);
        when(client.getAccountType()).thenReturn(AccountType.CLIENT);
        when(client.getCreatedAt()).thenReturn(twoDaysAgo);

        UserEntity admin = mock(UserEntity.class);
        when(admin.getAccountType()).thenReturn(AccountType.ADMIN);
        when(admin.getCreatedAt()).thenReturn(twoDaysAgo);

        LegalCasesEntity completedCase = new LegalCasesEntity();
        completedCase.setDateSubmitted(twoDaysAgo);
        completedCase.setStatus(CaseStatus.COMPLETED);

        LawyerEntity pendingLawyer = new LawyerEntity();
        pendingLawyer.setUserId(12);
        pendingLawyer.setFname("Test");
        pendingLawyer.setLname("Lawyer");
        pendingLawyer.setCasesHandled(4);
        pendingLawyer.setCredentialsVerified(false);

        when(userRepo.findAll()).thenReturn(List.of(client, admin));
        when(legalCaseRepo.findAll()).thenReturn(List.of(completedCase));
        when(lawyerRepo.findAll()).thenReturn(List.of(pendingLawyer));

        var analytics = service.getAnalytics(30, "client");

        assertThat(analytics.role()).isEqualTo("client");
        assertThat(analytics.rangeDays()).isEqualTo(30);
        assertThat(analytics.metrics().totalUsers()).isEqualTo(1);
        assertThat(analytics.metrics().newCases()).isEqualTo(1);
        assertThat(analytics.metrics().caseCompletionRate()).isEqualTo(100);
        assertThat(analytics.metrics().pendingVerifications()).isEqualTo(1);
        long registrations = analytics.userRegistrations().stream()
                .mapToLong(point -> point.registrations())
                .sum();
        assertThat(registrations).isEqualTo(1);
        assertThat(analytics.lawyerPerformance()).singleElement()
                .satisfies(lawyer -> {
                    assertThat(lawyer.lawyerName()).isEqualTo("Test Lawyer");
                    assertThat(lawyer.casesHandled()).isEqualTo(4);
                });
    }
}
