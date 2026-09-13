package com.wachichaw.Config;
import java.util.List;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;

@Configuration
public class SecurityConfig {

    private final OAuth2LoginSuccessHandler oauthLogin;
    private final ClientRegistrationRepository clientRegistrationRepository;

    public SecurityConfig(
            OAuth2LoginSuccessHandler oauthLogin,
            ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository
    ) {
        this.oauthLogin = oauthLogin;
        this.clientRegistrationRepository = clientRegistrationRepository.getIfAvailable();
    }

    @Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable())
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)) // <-- Change this!
        .authorizeHttpRequests(authorize -> authorize
            .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
            .requestMatchers(
                "/api-docs/**",
                "/swagger-ui/**",
                "/api-docs/**",
                "/swagger-resources/**",
                "/swagger-ui/index.html/",
                "/swagger-ui/index.html#/",
                "/users/Client",
                "/users/Lawyer",
                "/users/login",
                "/users/**",
                "/login/oauth2/code/google",
                "/error", "/login**", "/oauth2/**",
                "/verifyClient","/api/email/send","/verifyLawyer"
            ).permitAll()
            .anyRequest().permitAll())
        .httpBasic(Customizer.withDefaults());

    if (clientRegistrationRepository != null) {
        http.oauth2Login(oauth2 -> oauth2
            .successHandler(oauthLogin)
            .userInfoEndpoint(userInfo -> userInfo.oidcUserService(oidcUserService())));
    }

    return http.build();
}
     @Bean
        public OidcUserService oidcUserService() {
            return new OidcUserService();
        }
     @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfiguration());
        return source;
    }

    private CorsConfiguration corsConfiguration() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(
            "https://ally-frontend-eta.vercel.app", "http://localhost:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With", "X-XSRF-TOKEN"));
        configuration.setMaxAge(3600L);
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
        return configuration;
    }
}
