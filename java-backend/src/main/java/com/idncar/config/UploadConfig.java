package com.idncar.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class UploadConfig implements WebMvcConfigurer {

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadDir = Paths.get(uploadBaseDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to create upload directory: " + uploadDir, e);
        }

        registry.addResourceHandler("/uploads/**", "/api/uploads/**")
                .addResourceLocations(uploadDir.toUri().toString());
    }
}
