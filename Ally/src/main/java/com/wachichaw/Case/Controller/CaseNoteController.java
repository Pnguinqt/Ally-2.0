package com.wachichaw.Case.Controller;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.wachichaw.Case.Service.CaseNoteService;
import com.wachichaw.User.Entity.UserEntity;

@RestController
@RequestMapping("/api/cases/{caseId}/note")
public class CaseNoteController {
    public record Note(String content) {}

    private final CaseNoteService notes;

    public CaseNoteController(CaseNoteService notes) {
        this.notes = notes;
    }

    @GetMapping
    public ResponseEntity<Note> load(@PathVariable int caseId, @AuthenticationPrincipal UserEntity actor) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Note(notes.load(caseId, actor)));
    }

    @PutMapping
    public ResponseEntity<Note> save(@PathVariable int caseId, @AuthenticationPrincipal UserEntity actor, @RequestBody Note note) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Note(notes.save(caseId, actor, note.content())));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> error(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).cacheControl(CacheControl.noStore())
            .body(Map.of("message", error.getReason()));
    }
}
