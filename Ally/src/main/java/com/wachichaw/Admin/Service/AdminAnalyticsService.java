package com.wachichaw.Admin.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.wachichaw.Admin.DTO.AdminAnalyticsResponse;
import com.wachichaw.Case.Entity.CaseStatus;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Case.Repo.LegalCaseRepo;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.Lawyer.Repo.LawyerRepo;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.UserEntity;
import com.wachichaw.User.Repo.UserRepo;

@Service
public class AdminAnalyticsService {

    private static final List<Integer> SUPPORTED_RANGES = List.of(7, 30, 90, 0);
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH);

    private final UserRepo userRepo;
    private final LegalCaseRepo legalCaseRepo;
    private final LawyerRepo lawyerRepo;

    public AdminAnalyticsService(UserRepo userRepo, LegalCaseRepo legalCaseRepo, LawyerRepo lawyerRepo) {
        this.userRepo = userRepo;
        this.legalCaseRepo = legalCaseRepo;
        this.lawyerRepo = lawyerRepo;
    }

    public AdminAnalyticsResponse getAnalytics(int requestedDays, String requestedRole) {
        int days = SUPPORTED_RANGES.contains(requestedDays) ? requestedDays : 30;
        String role = normalizeRole(requestedRole);
        LocalDateTime now = LocalDateTime.now();

        List<UserEntity> allUsers = userRepo.findAll();
        List<UserEntity> roleUsers = allUsers.stream()
                .filter(user -> matchesRole(user, role))
                .toList();
        List<LegalCasesEntity> allCases = legalCaseRepo.findAll();
        List<LawyerEntity> allLawyers = lawyerRepo.findAll();

        LocalDateTime currentStart = days == 0 ? earliestDate(roleUsers, allCases, now) : startOfPeriod(now, days);
        LocalDateTime previousStart = days == 0 ? currentStart : currentStart.minusDays(days);

        long currentRegistrations = countUsersBetween(roleUsers, currentStart, now.plusNanos(1));
        long previousRegistrations = days == 0 ? 0 : countUsersBetween(roleUsers, previousStart, currentStart);
        long currentCases = countCasesBetween(allCases, currentStart, now.plusNanos(1));
        long previousCases = days == 0 ? 0 : countCasesBetween(allCases, previousStart, currentStart);

        double currentCompletionRate = completionRate(allCases, currentStart, now.plusNanos(1));
        double previousCompletionRate = days == 0 ? 0 : completionRate(allCases, previousStart, currentStart);

        AdminAnalyticsResponse.Metrics metrics = new AdminAnalyticsResponse.Metrics(
                roleUsers.size(),
                days == 0 ? 0 : percentChange(currentRegistrations, previousRegistrations),
                currentCases,
                days == 0 ? 0 : percentChange(currentCases, previousCases),
                currentCompletionRate,
                days == 0 ? 0 : roundOneDecimal(currentCompletionRate - previousCompletionRate),
                allLawyers.stream().filter(lawyer -> !lawyer.getCredentialsVerified()).count());

        List<TimeBucket> buckets = buildBuckets(days, currentStart, now);
        List<AdminAnalyticsResponse.UserRegistrationPoint> userRegistrations = buckets.stream()
                .map(bucket -> new AdminAnalyticsResponse.UserRegistrationPoint(
                        bucket.label(),
                        countUsersBetween(roleUsers, bucket.start(), bucket.end())))
                .toList();
        List<AdminAnalyticsResponse.CaseActivityPoint> caseActivity = buckets.stream()
                .map(bucket -> new AdminAnalyticsResponse.CaseActivityPoint(
                        bucket.label(),
                        countCasesBetween(allCases, bucket.start(), bucket.end()),
                        countCompletedCasesBetween(allCases, bucket.start(), bucket.end())))
                .toList();

        return new AdminAnalyticsResponse(
                now,
                days,
                role,
                metrics,
                userRegistrations,
                caseActivity,
                buildUserRoleDistribution(allUsers),
                buildCaseStatusDistribution(allCases),
                buildLawyerPerformance(allLawyers));
    }

    private String normalizeRole(String requestedRole) {
        if (requestedRole == null || requestedRole.isBlank()) {
            return "all";
        }
        String role = requestedRole.toLowerCase(Locale.ENGLISH);
        return switch (role) {
            case "client", "lawyer", "admin" -> role;
            default -> "all";
        };
    }

    private boolean matchesRole(UserEntity user, String role) {
        return "all".equals(role)
                || user.getAccountType() != null && user.getAccountType().name().equalsIgnoreCase(role);
    }

    private LocalDateTime earliestDate(List<UserEntity> users, List<LegalCasesEntity> cases, LocalDateTime fallback) {
        LocalDateTime earliestUser = users.stream()
                .map(UserEntity::getCreatedAt)
                .filter(date -> date != null)
                .min(LocalDateTime::compareTo)
                .orElse(fallback);
        LocalDateTime earliestCase = cases.stream()
                .map(LegalCasesEntity::getDateSubmitted)
                .filter(date -> date != null)
                .min(LocalDateTime::compareTo)
                .orElse(fallback);
        LocalDateTime earliest = earliestUser.isBefore(earliestCase) ? earliestUser : earliestCase;
        return YearMonth.from(earliest).atDay(1).atStartOfDay();
    }

    private LocalDateTime startOfPeriod(LocalDateTime now, int days) {
        return now.toLocalDate().minusDays(days - 1L).atStartOfDay();
    }

    private long countUsersBetween(List<UserEntity> users, LocalDateTime start, LocalDateTime end) {
        return users.stream()
                .map(UserEntity::getCreatedAt)
                .filter(date -> isWithin(date, start, end))
                .count();
    }

    private long countCasesBetween(List<LegalCasesEntity> cases, LocalDateTime start, LocalDateTime end) {
        return cases.stream()
                .map(LegalCasesEntity::getDateSubmitted)
                .filter(date -> isWithin(date, start, end))
                .count();
    }

    private long countCompletedCasesBetween(List<LegalCasesEntity> cases, LocalDateTime start, LocalDateTime end) {
        return cases.stream()
                .filter(legalCase -> legalCase.getStatus() == CaseStatus.COMPLETED)
                .map(LegalCasesEntity::getDateSubmitted)
                .filter(date -> isWithin(date, start, end))
                .count();
    }

    private boolean isWithin(LocalDateTime value, LocalDateTime start, LocalDateTime end) {
        return value != null && !value.isBefore(start) && value.isBefore(end);
    }

    private double completionRate(List<LegalCasesEntity> cases, LocalDateTime start, LocalDateTime end) {
        long submitted = countCasesBetween(cases, start, end);
        if (submitted == 0) {
            return 0;
        }
        return roundOneDecimal(countCompletedCasesBetween(cases, start, end) * 100.0 / submitted);
    }

    private double percentChange(long current, long previous) {
        if (previous == 0) {
            return current == 0 ? 0 : 100;
        }
        return roundOneDecimal((current - previous) * 100.0 / previous);
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private Map<String, Long> buildUserRoleDistribution(List<UserEntity> users) {
        Map<String, Long> distribution = new LinkedHashMap<>();
        for (AccountType type : AccountType.values()) {
            distribution.put(toDisplayLabel(type.name()), users.stream()
                    .filter(user -> user.getAccountType() == type)
                    .count());
        }
        return distribution;
    }

    private Map<String, Long> buildCaseStatusDistribution(List<LegalCasesEntity> cases) {
        Map<String, Long> distribution = new LinkedHashMap<>();
        for (CaseStatus status : CaseStatus.values()) {
            distribution.put(toDisplayLabel(status.name()), cases.stream()
                    .filter(legalCase -> legalCase.getStatus() == status)
                    .count());
        }
        return distribution;
    }

    private List<AdminAnalyticsResponse.LawyerPerformance> buildLawyerPerformance(List<LawyerEntity> lawyers) {
        return lawyers.stream()
                .sorted(Comparator.comparingInt(LawyerEntity::getCasesHandled).reversed())
                .limit(8)
                .map(lawyer -> new AdminAnalyticsResponse.LawyerPerformance(
                        lawyer.getUserId(),
                        displayName(lawyer),
                        lawyer.getCasesHandled()))
                .toList();
    }

    private String displayName(LawyerEntity lawyer) {
        String name = String.join(" ",
                lawyer.getFname() == null ? "" : lawyer.getFname(),
                lawyer.getLname() == null ? "" : lawyer.getLname()).trim();
        return name.isBlank() ? "Lawyer #" + lawyer.getUserId() : name;
    }

    private String toDisplayLabel(String value) {
        String lower = value.toLowerCase(Locale.ENGLISH).replace('_', ' ');
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private List<TimeBucket> buildBuckets(int days, LocalDateTime start, LocalDateTime now) {
        if (days == 0) {
            return buildMonthlyBuckets(start, now);
        }
        if (days <= 30) {
            return buildDailyBuckets(start, now);
        }
        return buildWeeklyBuckets(start, now);
    }

    private List<TimeBucket> buildDailyBuckets(LocalDateTime start, LocalDateTime now) {
        List<TimeBucket> buckets = new ArrayList<>();
        LocalDate cursor = start.toLocalDate();
        LocalDate last = now.toLocalDate();
        while (!cursor.isAfter(last)) {
            LocalDateTime bucketStart = cursor.atStartOfDay();
            buckets.add(new TimeBucket(cursor.format(DAY_LABEL), bucketStart, bucketStart.plusDays(1)));
            cursor = cursor.plusDays(1);
        }
        return buckets;
    }

    private List<TimeBucket> buildWeeklyBuckets(LocalDateTime start, LocalDateTime now) {
        List<TimeBucket> buckets = new ArrayList<>();
        LocalDate cursor = start.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate last = now.toLocalDate();
        while (!cursor.isAfter(last)) {
            LocalDateTime bucketStart = cursor.atStartOfDay();
            buckets.add(new TimeBucket("Week of " + cursor.format(DAY_LABEL), bucketStart, bucketStart.plusWeeks(1)));
            cursor = cursor.plusWeeks(1);
        }
        return buckets;
    }

    private List<TimeBucket> buildMonthlyBuckets(LocalDateTime start, LocalDateTime now) {
        List<TimeBucket> buckets = new ArrayList<>();
        YearMonth cursor = YearMonth.from(start);
        YearMonth last = YearMonth.from(now);
        while (!cursor.isAfter(last)) {
            LocalDateTime bucketStart = cursor.atDay(1).atStartOfDay();
            buckets.add(new TimeBucket(cursor.format(MONTH_LABEL), bucketStart, cursor.plusMonths(1).atDay(1).atStartOfDay()));
            cursor = cursor.plusMonths(1);
        }
        return buckets;
    }

    private record TimeBucket(String label, LocalDateTime start, LocalDateTime end) {
    }
}
