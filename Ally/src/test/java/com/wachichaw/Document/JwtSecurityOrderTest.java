package com.wachichaw.Document;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import com.wachichaw.Config.*;
import com.wachichaw.User.Repo.UserRepo;

class JwtSecurityOrderTest {
    @Configuration
    @EnableWebSecurity
    @org.springframework.web.servlet.config.annotation.EnableWebMvc
    @Import(SecurityConfig.class)
    static class TestConfig {
        @Bean OAuth2LoginSuccessHandler oauth() { return mock(OAuth2LoginSuccessHandler.class); }
        @Bean JwtUtil jwtUtil() { return mock(JwtUtil.class); }
        @Bean UserRepo users() { return mock(UserRepo.class); }
        @Bean JwtRequestFilter jwtFilter(JwtUtil util) { return new JwtRequestFilter(util); }
    }
    @Test void jwtRunsBeforeAnonymousAuthenticationAndOnlyInsideSecurityChain() throws Exception {
        try (var context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.register(TestConfig.class);
            context.refresh();
            var filters = context.getBean(SecurityFilterChain.class).getFilters();
            int jwtIndex = -1, anonymousIndex = -1;
            for (int i = 0; i < filters.size(); i++) {
                if (filters.get(i) instanceof JwtRequestFilter) jwtIndex = i;
                if (filters.get(i) instanceof AnonymousAuthenticationFilter) anonymousIndex = i;
            }
            assertTrue(jwtIndex >= 0);
            assertTrue(jwtIndex < anonymousIndex);
            assertFalse(context.getBean(SecurityConfig.class).jwtFilterRegistration(context.getBean(JwtRequestFilter.class)).isEnabled());
            var lawyer = new com.wachichaw.Lawyer.Entity.LawyerEntity();
            lawyer.setUserId(7);
            when(context.getBean(JwtUtil.class).extractUserId("valid-token")).thenReturn("7");
            when(context.getBean(JwtUtil.class).validateToken("valid-token", "7")).thenReturn(true);
            when(context.getBean(UserRepo.class).findById(7)).thenReturn(java.util.Optional.of(lawyer));
            var request = new org.springframework.mock.web.MockHttpServletRequest("PUT", "/Cases/9/accept/7");
            request.setServletPath("/Cases/9/accept/7");
            request.addHeader("Authorization", "Bearer valid-token");
            var reachedController = new java.util.concurrent.atomic.AtomicBoolean();
            context.getBean("springSecurityFilterChain", jakarta.servlet.Filter.class).doFilter(request,
                new org.springframework.mock.web.MockHttpServletResponse(), (req, res) -> {
                    assertSame(lawyer, org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal());
                    reachedController.set(true);
                });
            assertTrue(reachedController.get());
        }
    }
}
