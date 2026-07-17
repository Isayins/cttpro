package com.idncar.config;

import com.idncar.filter.JwtAuthenticationFilter;
import com.idncar.handler.JwtAuthenticationEntryPoint;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("#{'${app.security.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*,http://192.168.*:*,http://10.*:*,http://172.*:*,https://idncar.com,https://www.idncar.com,https://*.idncar.com}'.split(',')}")
    private List<String> allowedOriginPatterns;

    @Value("${app.upload.avatar-subdir:avatars}")
    private String uploadAvatarSubDir;

    @Value("${app.upload.chat-image-subdir:chat-images}")
    private String uploadChatImageSubDir;

    @Value("${app.upload.forum-image-subdir:forum-images}")
    private String uploadForumImageSubDir;

    @Value("${app.upload.forum-board-avatar-subdir:forum-board-avatars}")
    private String uploadForumBoardAvatarSubDir;

    @Value("${app.upload.product-image-subdir:product-images}")
    private String uploadProductImageSubDir;

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(
                        "/api/auth/login",
                        "/api/auth/register",
                        "/api/auth/email-code",
                        "/api/auth/password-reset-code",
                        "/api/auth/reset-password").permitAll()
                .requestMatchers("/api/code/fetch", "/api/code/fetch/").permitAll()
                .requestMatchers("/api/mail/get/**").permitAll()
                .requestMatchers("/api/qr-codes/public/**").permitAll()
                .requestMatchers(
                        "/api/payments/alipay/notify",
                        "/api/payments/alipay/notify/",
                        "/api/payments/alipay/auth/callback",
                        "/api/payments/alipay/auth/callback/",
                        "/api/payments/vmq/notify",
                        "/api/payments/vmq/notify/",
                        "/api/payments/vmq/return",
                        "/api/payments/vmq/return/",
                        "/api/payments/vmq/getState",
                        "/api/payments/vmq/getState/",
                        "/api/payments/vmq/appHeart",
                        "/api/payments/vmq/appHeart/",
                        "/api/payments/vmq/appPush",
                        "/api/payments/vmq/appPush/").permitAll()
                .requestMatchers("/uploads/" + normalizePathSegment(uploadAvatarSubDir) + "/**",
                        "/api/uploads/" + normalizePathSegment(uploadAvatarSubDir) + "/**",
                        "/uploads/" + normalizePathSegment(uploadChatImageSubDir) + "/**",
                        "/api/uploads/" + normalizePathSegment(uploadChatImageSubDir) + "/**",
                        "/uploads/" + normalizePathSegment(uploadForumImageSubDir) + "/**",
                        "/api/uploads/" + normalizePathSegment(uploadForumImageSubDir) + "/**",
                        "/uploads/" + normalizePathSegment(uploadForumBoardAvatarSubDir) + "/**",
                        "/api/uploads/" + normalizePathSegment(uploadForumBoardAvatarSubDir) + "/**",
                        "/uploads/" + normalizePathSegment(uploadProductImageSubDir) + "/**",
                        "/api/uploads/" + normalizePathSegment(uploadProductImageSubDir) + "/**").permitAll()
                .requestMatchers("/api/auth/**").authenticated()
                .requestMatchers("/api/admin/**").authenticated()
                .requestMatchers("/api/community/**").authenticated()
                .requestMatchers(HttpMethod.GET,
                        "/api/forum/sign-in/status",
                        "/api/forum/sign-in/status/",
                        "/api/forum/board-owner-applications",
                        "/api/forum/board-owner-applications/",
                        "/api/forum/board-owner-applications/mine",
                        "/api/forum/board-owner-applications/mine/").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/forum/**").permitAll()
                .requestMatchers("/api/forum/**").authenticated()
                .requestMatchers("/api/tools/**").authenticated()
                .requestMatchers("/api/payments/**").authenticated()
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/actuator/**").denyAll()
                .anyRequest().permitAll()
            )
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            );

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(allowedOriginPatterns.stream().map(String::trim).filter(origin -> !origin.isEmpty()).toList());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private String normalizePathSegment(String value) {
        String normalized = value == null ? "" : value.trim().replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (normalized.isBlank() || normalized.contains("/") || normalized.equals(".") || normalized.equals("..")) {
            throw new IllegalStateException("Invalid avatar upload subdir: " + value);
        }
        return normalized;
    }
}
