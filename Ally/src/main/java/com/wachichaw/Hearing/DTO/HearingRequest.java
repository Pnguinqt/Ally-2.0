package com.wachichaw.Hearing.DTO;

import java.time.Instant;

public record HearingRequest(String title, Instant startsAt, Instant endsAt, String location, String notes) {}
