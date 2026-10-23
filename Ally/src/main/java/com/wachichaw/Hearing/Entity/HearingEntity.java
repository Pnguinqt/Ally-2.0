package com.wachichaw.Hearing.Entity;

import java.time.Instant;

import com.wachichaw.Case.Entity.LegalCasesEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "case_hearings", indexes = @Index(name = "idx_hearings_case_start", columnList = "case_id, starts_at"))
@Getter
@Setter
public class HearingEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long hearingId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false)
    private LegalCasesEntity legalCase;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Column(nullable = false)
    private String location;

    @Column(length = 4000)
    private String notes;

    @Column(nullable = false, updatable = false)
    private int bookedBy;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
