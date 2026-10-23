package com.wachichaw.Document;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import com.wachichaw.AllyChatAI.Service.DeepSeekChatService;
import com.wachichaw.Document.Entity.DocumentEntity;
import com.wachichaw.Document.Service.DocumentService;
import com.wachichaw.Document.Service.DocumentSummaryService;
import com.wachichaw.Document.Service.DocumentSummaryService.UnreadableDocumentException;
import com.wachichaw.Document.Service.DocumentSummaryService.UnsupportedDocumentTypeException;

class DocumentSummaryServiceTest {

    private DocumentService documentService;
    private DeepSeekChatService deepSeekChatService;
    private DocumentSummaryService summaryService;

    @BeforeEach
    void setUp() {
        documentService = mock(DocumentService.class);
        deepSeekChatService = mock(DeepSeekChatService.class);
        summaryService = new DocumentSummaryService(documentService, deepSeekChatService);
        ReflectionTestUtils.setField(summaryService, "maxCharacters", 60000);
    }

    @Test
    void summarizesTextDocumentAfterAccessControlledRetrieval() throws Exception {
        DocumentEntity document = document(12, "Demand letter.txt", "txt");
        when(documentService.retrieveDocument(12, 7, "CLIENT")).thenReturn(document);
        when(documentService.readDocumentBytes(document)).thenReturn(
            "Payment is due on 30 June 2026.".getBytes(StandardCharsets.UTF_8));
        when(deepSeekChatService.summarizeDocument(anyString(), anyString(), anyBoolean()))
            .thenReturn("## Overview\nPayment demand.");

        var result = summaryService.summarize(12, 7, "CLIENT");

        assertEquals(12, result.documentId());
        assertEquals("Demand letter.txt", result.documentName());
        assertFalse(result.sourceTextTruncated());
        assertTrue(result.summary().contains("Payment demand"));
        verify(documentService).retrieveDocument(12, 7, "CLIENT");
    }

    @Test
    void extractsSearchablePdfText() throws Exception {
        DocumentEntity document = document(20, "Agreement.pdf", "pdf");
        when(documentService.retrieveDocument(20, 3, "LAWYER")).thenReturn(document);
        when(documentService.readDocumentBytes(document)).thenReturn(pdfWithText("Lease expires December 2027"));
        when(deepSeekChatService.summarizeDocument(anyString(), anyString(), anyBoolean()))
            .thenReturn("Summary");

        summaryService.summarize(20, 3, "LAWYER");

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(deepSeekChatService).summarizeDocument(
            org.mockito.ArgumentMatchers.eq("Agreement.pdf"), text.capture(), org.mockito.ArgumentMatchers.eq(false));
        assertTrue(text.getValue().contains("Lease expires December 2027"));
    }

    @Test
    void marksLongSourceAsTruncated() throws Exception {
        ReflectionTestUtils.setField(summaryService, "maxCharacters", 1000);
        DocumentEntity document = document(30, "Long.txt", "txt");
        when(documentService.retrieveDocument(30, 9, "CLIENT")).thenReturn(document);
        when(documentService.readDocumentBytes(document)).thenReturn("A".repeat(1500).getBytes(StandardCharsets.UTF_8));
        when(deepSeekChatService.summarizeDocument(anyString(), anyString(), anyBoolean()))
            .thenReturn("Summary");

        var result = summaryService.summarize(30, 9, "CLIENT");

        assertTrue(result.sourceTextTruncated());
        verify(deepSeekChatService).summarizeDocument("Long.txt", "A".repeat(1000), true);
    }

    @Test
    void rejectsImageWithoutCallingAi() {
        DocumentEntity document = document(40, "Evidence.png", "png");
        when(documentService.retrieveDocument(40, 9, "CLIENT")).thenReturn(document);

        assertThrows(UnsupportedDocumentTypeException.class,
            () -> summaryService.summarize(40, 9, "CLIENT"));
        verify(deepSeekChatService, never()).summarizeDocument(anyString(), anyString(), anyBoolean());
    }

    @Test
    void rejectsDocumentWithNoReadableText() throws Exception {
        DocumentEntity document = document(50, "Empty.txt", "txt");
        when(documentService.retrieveDocument(50, 9, "CLIENT")).thenReturn(document);
        when(documentService.readDocumentBytes(document)).thenReturn("   \n\n".getBytes(StandardCharsets.UTF_8));

        assertThrows(UnreadableDocumentException.class,
            () -> summaryService.summarize(50, 9, "CLIENT"));
    }

    private DocumentEntity document(int id, String name, String type) {
        DocumentEntity document = new DocumentEntity();
        document.setDocument_id(id);
        document.setDocumentName(name);
        document.setDocumentType(type);
        return document;
    }

    private byte[] pdfWithText(String text) throws Exception {
        try (PDDocument pdf = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            pdf.addPage(page);
            try (PDPageContentStream stream = new PDPageContentStream(pdf, page)) {
                stream.beginText();
                stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                stream.newLineAtOffset(72, 720);
                stream.showText(text);
                stream.endText();
            }
            pdf.save(output);
            return output.toByteArray();
        }
    }
}
