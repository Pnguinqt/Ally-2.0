package com.wachichaw.Hearing.Repo;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.wachichaw.Hearing.Entity.HearingEntity;

public interface HearingRepo extends JpaRepository<HearingEntity, Long> {
    List<HearingEntity> findByLegalCaseCaseIdOrderByStartsAtAsc(int caseId);

    boolean existsByLegalCaseCaseIdAndStartsAtLessThanAndEndsAtGreaterThan(int caseId, Instant endsAt, Instant startsAt);
}
