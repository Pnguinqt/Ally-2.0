package com.wachichaw.Demo;

import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import com.wachichaw.AllyChatAI.Controller.ChatController;
import com.wachichaw.AllyRAG.ChatRequest;
import com.wachichaw.AllyRAG.ChatResponse;
import com.wachichaw.Document.Entity.DocumentSummaryResponse;
import com.wachichaw.Document.Service.DocumentSummaryService;
import com.wachichaw.Lawyer.Repo.LawyerRepo;

/** Read-only directory snapshots and transient AI tools; never creates real demo users or cases. */
@RestController
@RequestMapping("/api/demo")
public class DemoController {
    private final LawyerRepo lawyers;
    private final ChatController chat;
    private final DocumentSummaryService summaries;

    @Value("${demo.enabled:true}")
    private boolean enabled;

    public DemoController(LawyerRepo lawyers, ChatController chat, DocumentSummaryService summaries) {
        this.lawyers = lawyers;
        this.chat = chat;
        this.summaries = summaries;
    }

    private void requireEnabled() {
        if (!enabled) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Demo is unavailable.");
    }

    public record DemoLawyer(String id, String name, String city, List<String> specializations) {}

    @GetMapping("/lawyers")
    @Transactional(readOnly = true)
    public List<DemoLawyer> lawyers() {
        requireEnabled();
        return lawyers.findByCredentialsVerified(true).stream()
            .map(lawyer -> new DemoLawyer("demo-lawyer-" + lawyer.getUserId(),
                "Atty. " + lawyer.getFname() + " " + lawyer.getLname(), lawyer.getCity(),
                List.copyOf(lawyer.getSpecialization())))
            .toList();
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        requireEnabled();
        // The null request explicitly prevents JWT lookup, history persistence, and audit writes,
        // even when the browser also has a signed-in production account.
        return chat.chat(request, null);
    }

    @PostMapping(value = "/summary", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentSummaryResponse summarize(@RequestPart("file") MultipartFile file) throws java.io.IOException {
        requireEnabled();
        if (file.isEmpty() || file.getSize() > 10 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a PDF up to 10 MB.");
        }
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(java.util.Locale.ROOT).endsWith(".pdf")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a PDF file.");
        }
        return summaries.summarizeDemoPdf(name, file.getBytes());
    }

    @ExceptionHandler(DocumentSummaryService.UnreadableDocumentException.class)
    public ResponseEntity<?> unreadable(RuntimeException error) {
        return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<?> unavailable(IllegalStateException error) {
        return ResponseEntity.status(503).body(Map.of("message", "AI service is unavailable. Please try again later."));
    }
}
