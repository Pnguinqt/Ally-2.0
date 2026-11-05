package com.wachichaw.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.security.core.context.SecurityContextHolder;
import com.wachichaw.Document.Service.DocumentPinService;
import com.wachichaw.Document.Repo.DocumentRepo;
import com.wachichaw.User.Entity.UserEntity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
public class DocumentPinConfig implements WebMvcConfigurer {
    private final DocumentPinService pins;
    private final DocumentRepo documents;
    public DocumentPinConfig(DocumentPinService pins, DocumentRepo documents) { this.pins = pins; this.documents = documents; }
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
                if ("OPTIONS".equals(request.getMethod())) return true;
                var auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth == null || !(auth.getPrincipal() instanceof UserEntity actor)) {
                    response.sendError(401); return false;
                }
                String path = request.getRequestURI().substring(request.getContextPath().length());
                if (path.matches("/api/documents/case/[0-9]+/pin(/setup|/verify)?")) return true;
                // The unauthenticated legacy endpoint wrote publicly served files; disable it.
                if (path.contains("/legacy/")) { response.sendError(410); return false; }
                String[] parts = path.split("/");
                int caseId;
                if (path.matches("/api/documents/case/[0-9]+(/count)?")) caseId = Integer.parseInt(parts[4]);
                else if (path.matches("/api/documents/client/[0-9]+/case/[0-9]+")) caseId = Integer.parseInt(parts[6]);
                else if (path.matches("/api/documents/upload/[0-9]+")) caseId = Integer.parseInt(request.getParameter("caseId"));
                else if (parts.length >= 4 && parts[3].matches("[0-9]+")) {
                    var document = documents.findById(Integer.parseInt(parts[3]));
                    if (document.isEmpty()) { response.sendError(404); return false; }
                    caseId = document.get().getCaseEntity().getCaseId();
                } else { response.sendError(403); return false; }
                if (!pins.unlocked(caseId, actor.getUserId(), request.getHeader("Authorization"))) {
                    response.setStatus(423);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"message\":\"Unlock case documents with the four-digit PIN first\"}");
                    return false;
                }
                return true;
            }
        }).addPathPatterns("/api/documents/**");
    }
}
