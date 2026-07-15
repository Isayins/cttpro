package com.idncar.service.impl;

import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class MailBrandTemplateHelper {

    private static final String DEFAULT_SITE_BASE_URL = "https://idncar.com";
    private static final String INLINE_LOGO_CONTENT_ID = "idncarLogo";

    private final String siteBaseUrl;
    private final String logoUrl;
    private final Resource inlineLogo = new ClassPathResource("mail/idncar-logo.png");

    public MailBrandTemplateHelper(
            @Value("${app.site.base-url:" + DEFAULT_SITE_BASE_URL + "}") String siteBaseUrl,
            @Value("${app.mail.logo-url:}") String logoUrl) {
        this.siteBaseUrl = normalizeSiteBaseUrl(siteBaseUrl);
        this.logoUrl = normalizeNullableText(logoUrl);
    }

    public String buildBrandMarkHtml() {
        String logoSource = logoUrl == null ? "cid:" + INLINE_LOGO_CONTENT_ID : logoUrl;
        return "<img src=\"" + escapeHtml(logoSource) + "\" alt=\"IDNCAR\" width=\"48\" height=\"48\" style=\"display:block;width:48px;height:48px;border-radius:8px;background:#ffffff;border:1px solid rgba(255,255,255,0.55);\"/>";
    }

    public void addInlineLogoIfNeeded(MimeMessageHelper helper) throws MessagingException {
        if (logoUrl != null || !inlineLogo.exists()) {
            return;
        }
        helper.addInline(INLINE_LOGO_CONTENT_ID, inlineLogo, MediaType.IMAGE_PNG_VALUE);
    }

    public String siteUrl() {
        return siteBaseUrl;
    }

    public String sitePath(String path) {
        String normalizedPath = path == null ? "" : path.trim();
        if (!normalizedPath.startsWith("/")) {
            normalizedPath = "/" + normalizedPath;
        }
        return siteBaseUrl + normalizedPath;
    }

    public String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String normalizeSiteBaseUrl(String value) {
        String baseUrl = normalizeNullableText(value);
        if (baseUrl == null) {
            baseUrl = DEFAULT_SITE_BASE_URL;
        }
        while (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }
        return baseUrl;
    }

    private String normalizeNullableText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
