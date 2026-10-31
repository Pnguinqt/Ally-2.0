package com.wachichaw.Admin.DTO;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record AdminAnalyticsResponse(
        LocalDateTime generatedAt,
        int rangeDays,
        String role,
        Metrics metrics,
        List<UserRegistrationPoint> userRegistrations,
        List<CaseActivityPoint> caseActivity,
        Map<String, Long> userRoleDistribution,
        Map<String, Long> caseStatusDistribution,
        List<LawyerPerformance> lawyerPerformance) {

    public record Metrics(
            long totalUsers,
            double userGrowthPercent,
            long newCases,
            double caseGrowthPercent,
            double caseCompletionRate,
            double completionRateChange,
            long pendingVerifications) {
    }

    public record UserRegistrationPoint(String label, long registrations) {
    }

    public record CaseActivityPoint(String label, long submitted, long completed) {
    }

    public record LawyerPerformance(int lawyerId, String lawyerName, int casesHandled) {
    }
}
