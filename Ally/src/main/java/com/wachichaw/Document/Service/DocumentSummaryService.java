package com.wachichaw.Document.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.wachichaw.AllyChatAI.Service.DeepSeekChatService;
import com.wachichaw.Document.Entity.DocumentEntity;
import com.wachichaw.Document.Entity.DocumentSummaryResponse;

@Service
public class DocumentSummaryService {

    private final DocumentService documentService;
    private final DeepSeekChatService deepSeekChatService;

    @Value("${document.summary.max-characters:60000}")
    private int maxCharacters;

    public DocumentSummaryService(DocumentService documentService, DeepSeekChatService deepSeekChatService) {
        this.documentService = documentService;
        this.deepSeekChatService = deepSeekChatService;
    }

    public DocumentSummaryResponse summarize(int documentId, int userId, String userRole) {
        DocumentEntity document = documentService.retrieveDocument(documentId, userId, userRole);
        String fileType = resolveFileType(document);
        ensureSupported(fileType);

        try {
            String extractedText = normalizeText(extractText(fileType, documentService.readDocumentBytes(document)));
            if (extractedText.isBlank()) {
                throw new UnreadableDocumentException(
                    "No readable text was found. Scanned PDFs and image files need OCR before they can be summarized.");
            }

            int limit = Math.max(1000, maxCharacters);
            boolean truncated = extractedText.length() > limit;
            String summarySource = truncated ? extractedText.substring(0, limit) : extractedText;
            String summary = deepSeekChatService.summarizeDocument(
                document.getDocumentName(), summarySource, truncated);

            return new DocumentSummaryResponse(
                document.getDocument_id(),
                document.getDocumentName(),
                summary,
                truncated,
                Instant.now());
        } catch (UnsupportedDocumentTypeException | UnreadableDocumentException | IllegalStateException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new UnreadableDocumentException("The document text could not be extracted.", exception);
        }
    }

    private String extractText(String fileType, byte[] content) throws Exception {
        return switch (fileType) {
            case "txt", "md" -> new String(content, StandardCharsets.UTF_8);
            case "pdf" -> extractPdf(content);
            case "docx" -> extractDocx(content);
            case "doc" -> extractDoc(content);
            default -> throw new UnsupportedDocumentTypeException(fileType);
        };
    }

    private String extractPdf(byte[] content) throws Exception {
        try (PDDocument pdf = Loader.loadPDF(content)) {
            return new PDFTextStripper().getText(pdf);
        }
    }

    private String extractDocx(byte[] content) throws Exception {
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(content));
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String extractDoc(byte[] content) throws Exception {
        try (HWPFDocument document = new HWPFDocument(new ByteArrayInputStream(content));
             WordExtractor extractor = new WordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String resolveFileType(DocumentEntity document) {
        String configuredType = document.getDocumentType();
        if (configuredType != null && !configuredType.isBlank()) {
            String normalized = configuredType.toLowerCase(Locale.ROOT).replace(".", "").trim();
            if (!normalized.contains("/")) return normalized;
        }

        String name = document.getDocumentName();
        int dot = name == null ? -1 : name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    }

    private void ensureSupported(String fileType) {
        if (!fileType.matches("pdf|doc|docx|txt|md")) {
            throw new UnsupportedDocumentTypeException(fileType);
        }
    }

    private String normalizeText(String text) {
        if (text == null) return "";
        return text
            .replace("\u0000", "")
            .replaceAll("[\\t\\x0B\\f\\r ]+", " ")
            .replaceAll(" *\\n *", "\n")
            .replaceAll("\\n{3,}", "\n\n")
            .trim();
    }

    public static class UnsupportedDocumentTypeException extends RuntimeException {
        public UnsupportedDocumentTypeException(String fileType) {
            super("Summaries support PDF, DOC, DOCX, TXT, and MD files."
                + (fileType == null || fileType.isBlank() ? "" : " This file is " + fileType.toUpperCase(Locale.ROOT) + "."));
        }
    }

    public static class UnreadableDocumentException extends RuntimeException {
        public UnreadableDocumentException(String message) {
            super(message);
        }

        public UnreadableDocumentException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
