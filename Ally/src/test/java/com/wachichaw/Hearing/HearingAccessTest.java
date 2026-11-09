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
        when(cases.findByIdForUpdate(10)).thenReturn(Optional.of(legalCase));
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
        verify(audit).log(eq(1), eq("APPOINTMENT_PROPOSED"), eq("APPOINTMENT"), eq("CASE"), eq("10"), anyString(), eq("SUCCESS"));
    }

    @Test void clientCanProposeForTheirOwnCase() throws Exception {
        mvc.perform(post(URL).header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.proposedBy").value(2));
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
            .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("This case already has an appointment at that time"));
        verify(hearings, never()).save(any());
    }

    @Test void missingCasesReturnNotFound() throws Exception {
        when(cases.findById(10)).thenReturn(Optional.empty());
        when(cases.findByIdForUpdate(10)).thenReturn(Optional.empty());
        mvc.perform(get(URL).header("Authorization", token(client))).andExpect(status().isNotFound());
        mvc.perform(post(URL).header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isNotFound());
    }

    private HearingEntity proposal(int proposer) {
        HearingEntity hearing = new HearingEntity();
        hearing.setHearingId(7L); hearing.setLegalCase(legalCase);
        hearing.setTitle("Consultation"); hearing.setLocation("Office");
        hearing.setStartsAt(Instant.parse("2099-11-01T01:00:00Z"));
        hearing.setEndsAt(Instant.parse("2099-11-01T02:00:00Z"));
        hearing.setBookedBy(proposer); hearing.setProposedBy(proposer);
        hearing.setStatus("PENDING"); hearing.setRevision(1L);
        when(hearings.findById(7L)).thenReturn(Optional.of(hearing));
        return hearing;
    }

    @Test void onlyTheOtherParticipantCanAcceptInEitherDirection() throws Exception {
        for (UserEntity proposer : List.of(client, lawyer)) {
            proposal(proposer.getUserId());
            UserEntity recipient = proposer == client ? lawyer : client;
            mvc.perform(post(URL + "/7/accept?revision=1").header("Authorization", token(proposer)))
                .andExpect(status().isForbidden());
            mvc.perform(post(URL + "/7/accept?revision=1").header("Authorization", token(recipient)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.acceptedBy").value(recipient.getUserId()))
                .andExpect(jsonPath("$.revision").value(2));
        }
    }

    @Test void editingConfirmedAppointmentResetsAcceptanceAndProposer() throws Exception {
        var hearing = proposal(1);
        hearing.setStatus("CONFIRMED"); hearing.setAcceptedBy(2);
        String request = validRequest().replace("\"notes\":", "\"revision\":1,\"notes\":");
        mvc.perform(put(URL + "/7").header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON).content(request))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.proposedBy").value(2)).andExpect(jsonPath("$.acceptedBy").isEmpty())
            .andExpect(jsonPath("$.revision").value(2));
        mvc.perform(post(URL + "/7/accept?revision=1").header("Authorization", token(lawyer)))
            .andExpect(status().isConflict());
        mvc.perform(post(URL + "/7/accept?revision=2").header("Authorization", token(lawyer)))
            .andExpect(status().isOk());
    }

    @Test void staleEditAcceptAndDeleteAreRejected() throws Exception {
        proposal(1);
        mvc.perform(put(URL + "/7").header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isConflict());
        mvc.perform(post(URL + "/7/accept?revision=0").header("Authorization", token(client))).andExpect(status().isConflict());
        mvc.perform(delete(URL + "/7?revision=0").header("Authorization", token(client))).andExpect(status().isConflict());
        verify(hearings, never()).save(any()); verify(hearings, never()).delete(any());
    }

    @Test void bothParticipantsCanDelete() throws Exception {
        var hearing = proposal(1);
        for (UserEntity user : List.of(client, lawyer)) {
            mvc.perform(delete(URL + "/7?revision=1").header("Authorization", token(user))).andExpect(status().isNoContent());
        }
        verify(hearings, times(2)).delete(hearing);
    }

    @Test void appointmentFromAnotherCaseCannotBeChanged() throws Exception {
        var hearing = proposal(1);
        var otherCase = new LegalCasesEntity(); otherCase.setCaseId(20); hearing.setLegalCase(otherCase);
        mvc.perform(post(URL + "/7/accept?revision=1").header("Authorization", token(client))).andExpect(status().isNotFound());
        mvc.perform(delete(URL + "/7?revision=1").header("Authorization", token(client))).andExpect(status().isNotFound());
    }

    @Test void outsidersCannotEditAcceptOrDelete() throws Exception {
        UserEntity outsider = new LawyerEntity(); outsider.setUserId(99); outsider.setAccountType(AccountType.LAWYER);
        when(users.findById(99)).thenReturn(Optional.of(outsider));
        mvc.perform(put(URL + "/7").header("Authorization", token(outsider)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isForbidden());
        mvc.perform(post(URL + "/7/accept?revision=1").header("Authorization", token(outsider))).andExpect(status().isForbidden());
        mvc.perform(delete(URL + "/7?revision=1").header("Authorization", token(outsider))).andExpect(status().isForbidden());
        verifyNoInteractions(hearings);
    }

    @Test void confirmedAppointmentsCannotBeAcceptedTwice() throws Exception {
        var hearing = proposal(1); hearing.setStatus("CONFIRMED");
        mvc.perform(post(URL + "/7/accept?revision=1").header("Authorization", token(client)))
            .andExpect(status().isConflict());
        verify(hearings, never()).save(any());
    }

    @Test void expiredProposalsCannotBeAcceptedOrEdited() throws Exception {
        var hearing = proposal(1); hearing.setStartsAt(Instant.parse("2000-01-01T00:00:00Z"));
        mvc.perform(post(URL + "/7/accept?revision=1").header("Authorization", token(client)))
            .andExpect(status().isConflict());
        mvc.perform(put(URL + "/7").header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON)
            .content(validRequest().replace("\"notes\":", "\"revision\":1,\"notes\":")))
            .andExpect(status().isConflict());
        verify(hearings, never()).save(any());
    }

    @Test void closedCasesCannotBeEditedOrAcceptedButCanBeDeleted() throws Exception {
        proposal(1); legalCase.setStatus(CaseStatus.COMPLETED);
        mvc.perform(post(URL + "/7/accept?revision=1").header("Authorization", token(client)))
            .andExpect(status().isConflict());
        mvc.perform(put(URL + "/7").header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON).content(validRequest()))
            .andExpect(status().isConflict());
        mvc.perform(delete(URL + "/7?revision=1").header("Authorization", token(client))).andExpect(status().isNoContent());
    }

    @Test void existingAppointmentsRemainConfirmedUntilEdited() throws Exception {
        var hearing = proposal(1); hearing.setStatus(null); hearing.setRevision(null); hearing.setProposedBy(null);
        when(hearings.findByLegalCaseCaseIdOrderByStartsAtAsc(10)).thenReturn(List.of(hearing));
        mvc.perform(get(URL).header("Authorization", token(client)))
            .andExpect(jsonPath("$[0].status").value("CONFIRMED")).andExpect(jsonPath("$[0].revision").value(0));
    }

    @Test void overlappingEditsAreRejectedWithoutCountingTheAppointmentItself() throws Exception {
        proposal(1);
        when(hearings.existsByLegalCaseCaseIdAndHearingIdNotAndStartsAtLessThanAndEndsAtGreaterThan(eq(10), eq(7L), any(), any()))
            .thenReturn(true);
        mvc.perform(put(URL + "/7").header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON)
            .content(validRequest().replace("\"notes\":", "\"revision\":1,\"notes\":")))
            .andExpect(status().isConflict());
        verify(hearings, never()).save(any());
    }

    @Test void faceToFaceAppointmentsStoreVenueAndDiscardMeetingLinks() throws Exception {
        String request = validRequest().replace("\"notes\":", "\"meetingType\":\"F2F\",\"meetingLink\":\"https://example.com/unused\",\"notes\":");
        mvc.perform(post(URL).header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON).content(request))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.meetingType").value("F2F"))
            .andExpect(jsonPath("$.location").value("RTC Branch 1")).andExpect(jsonPath("$.meetingLink").isEmpty());
    }

    @Test void onlineAppointmentsStoreMeetingLinksAndDoNotRequireVenue() throws Exception {
        String request = validRequest().replace("\"location\":\"  RTC Branch 1  \"", "\"location\":null,\"meetingType\":\"ONLINE\",\"meetingLink\":\"https://meet.example.com/case-10\"");
        mvc.perform(post(URL).header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON).content(request))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.meetingType").value("ONLINE"))
            .andExpect(jsonPath("$.meetingLink").value("https://meet.example.com/case-10"))
            .andExpect(jsonPath("$.location").value(""));
    }

    @Test void onlineLinksMustBeValidHttpUrlsAndMeetingTypesMustBeSupported() throws Exception {
        for (String link : List.of("", "not-a-link", "javascript:alert(1)", "ftp://example.com/meeting", "https://", "https://user:secret@example.com/meeting")) {
            String request = validRequest().replace("\"notes\":", "\"meetingType\":\"ONLINE\",\"meetingLink\":\"" + link + "\",\"notes\":");
            mvc.perform(post(URL).header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(post(URL).header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON)
            .content(validRequest().replace("\"notes\":", "\"meetingType\":\"OTHER\",\"notes\":")))
            .andExpect(status().isBadRequest());
        verify(hearings, never()).save(any());
    }

    @Test void switchingMeetingTypeRequiresAcceptanceAgainAndClearsTheOldVenue() throws Exception {
        var hearing = proposal(1); hearing.setStatus("CONFIRMED"); hearing.setAcceptedBy(2); hearing.setMeetingType("F2F");
        String request = validRequest().replace("\"notes\":", "\"revision\":1,\"meetingType\":\"ONLINE\",\"meetingLink\":\"https://meet.example.com/case-10\",\"notes\":");
        mvc.perform(put(URL + "/7").header("Authorization", token(client)).contentType(MediaType.APPLICATION_JSON).content(request))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.meetingType").value("ONLINE")).andExpect(jsonPath("$.location").value(""))
            .andExpect(jsonPath("$.acceptedBy").isEmpty());
        request = validRequest().replace("\"notes\":", "\"revision\":2,\"meetingType\":\"F2F\",\"notes\":");
        mvc.perform(put(URL + "/7").header("Authorization", token(lawyer)).contentType(MediaType.APPLICATION_JSON).content(request))
            .andExpect(status().isOk()).andExpect(jsonPath("$.meetingType").value("F2F"))
            .andExpect(jsonPath("$.meetingLink").isEmpty()).andExpect(jsonPath("$.location").value("RTC Branch 1"));
    }

    private String token(UserEntity user) { return "Bearer " + jwt.generateToken(user); }

    private String validRequest() {
        return """
            {"title":"  Pre-trial  ","startsAt":"2099-11-01T01:00:00Z","endsAt":"2099-11-01T02:00:00Z",
             "location":"  RTC Branch 1  ","notes":"Bring documents"}
            """;
    }
}
