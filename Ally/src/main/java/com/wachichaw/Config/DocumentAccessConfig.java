package com.wachichaw.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.wachichaw.Document.Repo.DocumentRepo;
import com.wachichaw.Document.Service.DocumentOtpService;
import com.wachichaw.User.Entity.UserEntity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
public class DocumentAccessConfig implements WebMvcConfigurer {
    private final DocumentOtpService otp;
    private final DocumentRepo documents;

    public DocumentAccessConfig(DocumentOtpService otp, DocumentRepo documents) {
        this.otp = otp;
        this.documents = documents;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
                if ("OPTIONS".equals(request.getMethod())) return true;
                response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
                var auth = SecurityContextHolder.getContext().getAuthentication();
                String session = request.getHeader(HttpHeaders.AUTHORIZATION);
                if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof UserEntity actor)
                        || session == null || !session.startsWith("Bearer ")) {
                    response.sendError(401);
                    return false;
                }
                String path = request.getRequestURI().substring(request.getContextPath().length());
                // OTP and transfer controllers check case access before sending or consuming a code.
                if (path.matches("/api/documents/case/[0-9]+/otp(/request|/verify|/local-preview/(request|verify))?")
                        || ("POST".equals(request.getMethod())
                            && path.matches("/api/documents/[0-9]+/(preview|download)(/otp)?"))) {
                    return true;
                }
                // The legacy endpoint wrote publicly served files.
                if (path.contains("/legacy/")) {
                    response.sendError(410);
                    return false;
                }
                try {
                    String[] parts = path.split("/");
                    int caseId;
                    if (path.matches("/api/documents/case/[0-9]+(/count)?")) {
                        caseId = Integer.parseInt(parts[4]);
                    } else if (path.matches("/api/documents/client/[0-9]+/case/[0-9]+")) {
                        caseId = Integer.parseInt(parts[6]);
                    } else if (path.matches("/api/documents/upload/[0-9]+")) {
                        caseId = Integer.parseInt(request.getParameter("caseId"));
                    } else if (parts.length >= 4 && parts[3].matches("[0-9]+")) {
                        var document = documents.findById(Integer.parseInt(parts[3]));
                        if (document.isEmpty()) {
                            response.sendError(404);
                            return false;
                        }
                        caseId = document.get().getCaseEntity().getCaseId();
                    } else {
                        response.sendError(403);
                        return false;
                    }
                    otp.requireWorkspaceAccess(caseId, actor, session);
                    return true;
                } catch (ResponseStatusException error) {
                    response.sendError(error.getStatusCode().value(), error.getReason());
                    return false;
                } catch (NumberFormatException error) {
                    response.sendError(400, "Invalid case or document ID");
                    return false;
                }
            }
        }).addPathPatterns("/api/documents/**");
    }
}
