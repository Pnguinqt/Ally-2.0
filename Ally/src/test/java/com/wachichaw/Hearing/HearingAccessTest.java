package com.wachichaw.Hearing;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.wachichaw.Audit.Service.AuditLogService;
import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.Hearing.Controller.HearingController;
import com.wachichaw.Hearing.Entity.HearingEntity;
import com.wachichaw.Hearing.Repo.HearingRepo;
import com.wachichaw.Hearing.Service.HearingService;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.UserEntity;
import com.wachichaw.User.Repo.UserRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class HearingAccessTest {
    private final LegalCaseRepo cases = mock(LegalCaseRepo.class);
    private final HearingRepo hearings = mock(HearingRepo.class);
    private final AuditLogService audit = mock(AuditLogService.class);
    private final UserRepo users = mock(UserRepo.class);
    private final JwtUtil jwt = new JwtUtil();
    private final LawyerEntity lawyer = new LawyerEntity();
    private final ClientEntity client = new ClientEntity();
    private final LegalCasesEntity legalCase = new LegalCasesEntity();
    private MockMvc mvc;
    private static final String URL = "/api/cases/10/hearings";

    @BeforeEach void setup() {
        lawyer.setUserId(1);
        lawyer.setAccountType(AccountType.LAWYER);
        client.setUserId(2);
        client.setAccountType(AccountType.CLIENT);
        legalCase.setCaseId(10);
        legalCase.setLawyer(lawyer);
        legalCase.setClient(client);
        legalCase.setStatus(CaseStatus.ACCEPTED);
        when(users.findById(1)).thenReturn(Optional.of(lawyer));
        when(users.findById(2)).thenReturn(Optional.of(client));
        when(cases.findById(10)).thenReturn(Optional.of(legalCase));
        when(cases.findByIdForHearingBooking(10)).thenReturn(Optional.of(legalCase));
        when(hearings.findByLegalCaseCaseIdOrderByStartsAtAsc(10)).thenReturn(List.of());
        when(hearings.save(any())).thenAnswer(invocation -> {
            HearingEntity hearing = invocation.getArgument(0);
            hearing.setHearingId(7L);
            return hearing;
        });
        var mapper = new ObjectMapper().findAndRegisterModules().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mvc = MockMvcBuilders.standaloneSetup(new HearingController(new HearingService(cases, hearings, audit), jwt, users))
            .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper)).build();
    }

    @Test void bothParticipantsSeeTheSamePersistedHearingIncludingItsNotes() throws Exception {
        HearingEntity hearing = new HearingEntity();
        hearing.setHearingId(7L);
        hearing.setLegalCase(legalCase);
        hearing.setTitle("Pre-trial");
        hearing.setStartsAt(Instant.parse("2099-11-01T01:00:00Z"));
        hearing.setEndsAt(Instant.parse("2099-11-01T02:00:00Z"));
        hearing.setLocation("RTC Branch 1");
        hearing.setNotes("Bring supporting documents");
        when(hearings.findByLegalCaseCaseIdOrderByStartsAtAsc(10)).thenReturn(List.of(hearing));
        for (UserEntity participant : List.of(lawyer, client)) {
            mvc.perform(get(URL).header("Authorization", token(participant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].caseId").value(10))
                .andExpect(jsonPath("$[0].startsAt").value("2099-11-01T01:00:00Z"))
                .andExpect(jsonPath("$[0].notes").value("Bring supporting documents"));
        }
    }

    @Test void assignedLawyerBooksHearingWithServerOwnedProvenance() throws Exception {
        mvc.perform(post(URL).header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.hearingId").value(7))
            .andExpect(jsonPath("$.title").value("Pre-trial"))
            .andExpect(jsonPath("$.bookedBy").value(1)).andExpect(jsonPath("$.createdAt").isNotEmpty());
        verify(hearings).save(argThat(hearing -> hearing.getLegalCase() == legalCase
            && hearing.getLocation().equals("RTC Branch 1") && hearing.getBookedBy() == 1));
        verify(audit).log(eq(1), eq("HEARING_BOOKED"), eq("HEARING"), eq("CASE"), eq("10"), anyString(), eq("SUCCESS"));
    }

    @Test void clientCannotBookEvenForTheirOwnCase() throws Exception {
        mvc.perform(post(URL).header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isForbidden());
        verify(hearings, never()).save(any());
    }

    @ParameterizedTest @EnumSource(AccountType.class)
    void outsidersCannotReadOrBookAnotherCasesHearings(AccountType role) throws Exception {
        UserEntity outsider = new LawyerEntity();
        outsider.setUserId(99);
        outsider.setAccountType(role);
        when(users.findById(99)).thenReturn(Optional.of(outsider));
        mvc.perform(get(URL).header("Authorization", token(outsider))).andExpect(status().isForbidden());
        mvc.perform(post(URL).header("Authorization", token(outsider)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isForbidden());
        verifyNoInteractions(hearings, audit);
    }

    @Test void missingTamperedExpiredAndDeletedUserTokensAreRejected() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL).header("Authorization", "Bearer invalid")).andExpect(status().isUnauthorized());
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(validRequest())).andExpect(status().isUnauthorized());
        ReflectionTestUtils.setField(jwt, "expirationTime", -1000L);
        mvc.perform(get(URL).header("Authorization", token(lawyer))).andExpect(status().isUnauthorized());
        ReflectionTestUtils.setField(jwt, "expirationTime", 3600000L);
        when(users.findById(1)).thenReturn(Optional.empty());
        mvc.perform(get(URL).header("Authorization", token(lawyer))).andExpect(status().isUnauthorized());
        verifyNoInteractions(cases, hearings, audit);
    }

    @ParameterizedTest @EnumSource(value = CaseStatus.class, names = "ACCEPTED", mode = EnumSource.Mode.EXCLUDE)
    void inactiveCasesRemainReadableButCannotReceiveNewHearings(CaseStatus status) throws Exception {
        legalCase.setStatus(status);
        mvc.perform(get(URL).header("Authorization", token(client))).andExpect(status().isOk());
        mvc.perform(post(URL).header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isConflict());
        verify(hearings, never()).save(any());
    }

    @Test void invalidFieldsAndChronologyDoNotPersist() throws Exception {
        String valid = validRequest();
        for (String body : List.of(
                valid.replace("  Pre-trial  ", "   "),
                valid.replace("  RTC Branch 1  ", " "),
                valid.replace("  Pre-trial  ", "a".repeat(161)),
                valid.replace("  RTC Branch 1  ", "a".repeat(256)),
                valid.replace("2099-11-01T01:00:00Z", "2000-11-01T01:00:00Z"),
                valid.replace("2099-11-01T02:00:00Z", "2099-11-01T01:00:00Z"),
                valid.replace("2099-11-01T02:00:00Z", "2099-11-01T00:00:00Z"),
                valid.replace("\"2099-11-01T01:00:00Z\"", "null"),
                valid.replace("2099-11-01T01:00:00Z", "not-a-date"),
                valid.replace("Bring documents", "a".repeat(4001)))) {
            mvc.perform(post(URL).header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        }
        verify(hearings, never()).save(any());
        verifyNoInteractions(audit);
    }

    @Test void overlappingHearingsReturnActionableConflict() throws Exception {
        when(hearings.existsByLegalCaseCaseIdAndStartsAtLessThanAndEndsAtGreaterThan(anyInt(), any(), any())).thenReturn(true);
        mvc.perform(post(URL).header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("This case already has a hearing at that time"));
        verify(hearings, never()).save(any());
    }

    @Test void missingCasesReturnNotFound() throws Exception {
        when(cases.findById(10)).thenReturn(Optional.empty());
        when(cases.findByIdForHearingBooking(10)).thenReturn(Optional.empty());
        mvc.perform(get(URL).header("Authorization", token(client))).andExpect(status().isNotFound());
        mvc.perform(post(URL).header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isNotFound());
    }

    private String token(UserEntity user) { return "Bearer " + jwt.generateToken(user); }

    private String validRequest() {
        return """
            {"title":"  Pre-trial  ","startsAt":"2099-11-01T01:00:00Z","endsAt":"2099-11-01T02:00:00Z",
             "location":"  RTC Branch 1  ","notes":"Bring documents"}
            """;
    }
}
