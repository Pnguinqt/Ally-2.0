package com.wachichaw.Case.Entity;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import com.wachichaw.User.Entity.UserEntity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "case_notes", uniqueConstraints = @UniqueConstraint(columnNames = {"case_id", "author_id"}))
@Getter
@Setter
public class CaseNoteEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false, updatable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private LegalCasesEntity legalCase;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false, updatable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private UserEntity author;

    @Lob
    @Column(nullable = false)
    private String content;
}
