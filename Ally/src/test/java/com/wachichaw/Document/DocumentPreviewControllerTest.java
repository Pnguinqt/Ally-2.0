package com.wachichaw.Document;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.wachichaw.Document.Controller.DocumentPreviewController;
import com.wachichaw.Document.Service.*;
import com.wachichaw.Document.Entity.DocumentEntity;
import com.wachichaw.Case.Entity.LegalCasesEntity;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.User.Entity.AccountType;

class DocumentPreviewControllerTest {
    DocumentService documents;
    DocumentPinService pins;
    DocumentPreviewController controller;
    ClientEntity actor;
    DocumentEntity photo;
    @BeforeEach void setup() {
        documents = mock(DocumentService.class); pins = mock(DocumentPinService.class);
        controller = new DocumentPreviewController(documents, pins);
        actor = new ClientEntity(); actor.setUserId(1); actor.setAccountType(AccountType.CLIENT);
        var c = new LegalCasesEntity(); c.setCaseId(7);
        photo = new DocumentEntity(); photo.setCaseEntity(c); photo.setDocumentType("JPG");
        when(documents.retrieveDocument(9, 1, "CLIENT")).thenReturn(photo);
        when(pins.unlocked(7, 1, "login")).thenReturn(true);
    }
    @Test void checksPinEveryTimeBeforeReadingAndPreventsCaching() throws Exception {
        byte[] bytes = {1, 2, 3}; when(documents.readDocumentBytes(photo)).thenReturn(bytes);
        for (int i = 0; i < 2; i++) {
            var response = controller.preview(9, actor, "login", Map.of("pin", "0042"));
            assertArrayEquals(bytes, response.getBody());
            assertEquals("no-store", response.getHeaders().getCacheControl());
            assertEquals("image/jpeg", response.getHeaders().getContentType().toString());
        }
        var order = inOrder(pins, documents);
        order.verify(documents).retrieveDocument(9, 1, "CLIENT");
        order.verify(pins).unlocked(7, 1, "login");
        order.verify(pins).verifyPin(7, 1, "0042");
        order.verify(documents).readDocumentBytes(photo);
        verify(pins, times(2)).verifyPin(7, 1, "0042");
    }
    @Test void wrongOrMissingPinNeverReturnsPhotoBytes() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(pins).verifyPin(7, 1, "1111");
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(pins).verifyPin(7, 1, null);
        assertThrows(ResponseStatusException.class, () -> controller.preview(9, actor, "login", Map.of("pin", "1111")));
        assertThrows(ResponseStatusException.class, () -> controller.preview(9, actor, "login", Map.of()));
        verify(documents, never()).readDocumentBytes(any());
    }
    @Test void expiredDocumentUnlockCannotBeBypassedWithPreviewPin() throws Exception {
        when(pins.unlocked(7, 1, "login")).thenReturn(false);
        var error = assertThrows(ResponseStatusException.class, () -> controller.preview(9, actor, "login", Map.of("pin", "0042")));
        assertEquals(HttpStatus.LOCKED, error.getStatusCode());
        verify(documents, never()).readDocumentBytes(any());
    }
    @Test void allFileTypesRequirePinBeforeReturningAnyBytes() throws Exception {
        var types = Map.of("pdf", "application/pdf", "txt", "text/plain;charset=UTF-8",
            "md", "text/plain;charset=UTF-8", "doc", "application/msword",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "unknown", "application/octet-stream");
        when(documents.readDocumentBytes(photo)).thenReturn(new byte[]{1});
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(pins).verifyPin(7, 1, null);
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(pins).verifyPin(7, 1, "1111");
        for (var type : types.entrySet()) {
            photo.setDocumentType(type.getKey());
            clearInvocations(documents);
            assertThrows(ResponseStatusException.class, () -> controller.preview(9, actor, "login", Map.of()));
            assertThrows(ResponseStatusException.class, () -> controller.preview(9, actor, "login", Map.of("pin", "1111")));
            verify(documents, never()).readDocumentBytes(any());
            var result = controller.preview(9, actor, "login", Map.of("pin", "0042"));
            assertEquals(type.getValue(), result.getHeaders().getContentType().toString());
            assertEquals("no-store", result.getHeaders().getCacheControl());
        }
    }
    @Test void localFilePreviewRequiresVerificationWithoutExtendingAccess() {
        var pinController = new com.wachichaw.Document.Controller.DocumentPinController(pins);
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(pins).verifyPin(7, 1, "1111");
        assertThrows(ResponseStatusException.class, () -> pinController.verifyPreview(7, actor, "login", Map.of("pin", "1111")));
        assertTrue(pinController.verifyPreview(7, actor, "login", Map.of("pin", "0042")).get("verified"));
        verify(pins, never()).unlock(anyInt(), anyInt(), anyString(), anyString());
        when(pins.unlocked(7, 1, "login")).thenReturn(false);
        assertThrows(ResponseStatusException.class, () -> pinController.verifyPreview(7, actor, "login", Map.of("pin", "0042")));
    }
    @Test void downloadChecksPinEachTimeAndMarksAttachmentWithoutCaching() throws Exception {
        photo.setDocumentName("case photo.jpg");
        when(documents.readDocumentBytes(photo)).thenReturn(new byte[]{1, 2});
        for (int i = 0; i < 2; i++) {
            var response = controller.download(9, actor, "login", Map.of("pin", "0042"));
            assertArrayEquals(new byte[]{1, 2}, response.getBody());
            assertEquals("no-store", response.getHeaders().getCacheControl());
            assertTrue(response.getHeaders().getContentDisposition().isAttachment());
            assertEquals("case photo.jpg", response.getHeaders().getContentDisposition().getFilename());
        }
        verify(pins, times(2)).verifyPin(7, 1, "0042");
    }
    @Test void downloadRejectsWrongMissingPinAndExpiredUnlockBeforeReadingBytes() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(pins).verifyPin(7, 1, "1111");
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(pins).verifyPin(7, 1, null);
        assertThrows(ResponseStatusException.class, () -> controller.download(9, actor, "login", Map.of("pin", "1111")));
        assertThrows(ResponseStatusException.class, () -> controller.download(9, actor, "login", Map.of()));
        when(pins.unlocked(7, 1, "login")).thenReturn(false);
        assertThrows(ResponseStatusException.class, () -> controller.download(9, actor, "login", Map.of("pin", "0042")));
        verify(documents, never()).readDocumentBytes(any());
    }
    @Test void legacyGetDownloadCannotBypassPin() {
        var legacy = new com.wachichaw.Document.Controller.DocumentController(documents);
        var response = legacy.legacyDownloadDocument();
        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, response.getStatusCode());
        verifyNoInteractions(documents);
    }
}
