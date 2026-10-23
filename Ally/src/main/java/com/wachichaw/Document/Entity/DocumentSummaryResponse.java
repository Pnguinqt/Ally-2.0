package com.wachichaw.Document.Entity;

import java.time.Instant;

public record DocumentSummaryResponse(
    int documentId,
    String documentName,
    String summary,
    boolean sourceTextTruncated,
    Instant generatedAt
) {}
