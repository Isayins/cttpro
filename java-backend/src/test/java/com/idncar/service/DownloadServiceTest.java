package com.idncar.service;

import com.idncar.mapper.DownloadResourceMapper;
import com.idncar.model.dto.DownloadCaptchaDto;
import com.idncar.model.dto.DownloadTargetDto;
import com.idncar.model.dto.DownloadResourceDto;
import com.idncar.model.dto.VerifyDownloadCaptchaRequest;
import com.idncar.model.dto.VerifyDownloadCaptchaResponse;
import com.idncar.model.entity.DownloadResource;
import com.idncar.service.DownloadService;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DownloadServiceTest {

    @Test
    void captchaAndDownloadTokenSurviveRedisReadFailure() throws Exception {
        DownloadResource resource = resource(true, null);
        DownloadService service = service(resource, true);

        DownloadCaptchaDto captcha = service.createCaptcha();
        String answer = extractCaptchaAnswer(captcha.image());

        VerifyDownloadCaptchaResponse verified = service.verifyCaptcha(new VerifyDownloadCaptchaRequest(
                captcha.captchaId(), answer, resource.getUrl(), resource.getTitle(), null));
        assertThat(verified.ok()).isTrue();
        assertThat(verified.downloadToken()).isNotBlank();

        DownloadTargetDto target = service.consumeDownloadToken(verified.downloadToken());
        assertThat(target.url()).isEqualTo(resource.getUrl());
        assertThat(target.fileName()).isEqualTo("测试资源.zip");
    }

    @Test
    void resourcePasswordIsValidatedWithoutExposingOrRequiringCaptcha() throws Exception {
        String passwordHash = new BCryptPasswordEncoder().encode("file-pass-123");
        DownloadResource resource = resource(false, passwordHash);
        DownloadService service = service(resource, true);

        VerifyDownloadCaptchaResponse wrong = service.verifyCaptcha(new VerifyDownloadCaptchaRequest(
                null, null, "download-resource:1", resource.getTitle(), "wrong-password"));
        assertThat(wrong.ok()).isFalse();
        assertThat(wrong.message()).isEqualTo("下载密码错误");

        VerifyDownloadCaptchaResponse verified = service.verifyCaptcha(new VerifyDownloadCaptchaRequest(
                null, null, "download-resource:1", resource.getTitle(), "file-pass-123"));
        assertThat(verified.ok()).isTrue();
        assertThat(verified.downloadToken()).isNotBlank();

        DownloadResourceDto publicDto = DownloadResourceDto.fromPublicEntity(resource);
        assertThat(publicDto.getPasswordProtected()).isTrue();
        assertThat(publicDto.getUrl()).isEqualTo("download-resource:1");
    }

    private DownloadService service(DownloadResource resource, boolean redisReadFails) throws Exception {
        DownloadResourceMapper mapper = mock(DownloadResourceMapper.class);
        when(mapper.selectOne(any())).thenReturn(resource);
        when(mapper.selectById(resource.getId())).thenReturn(resource);

        @SuppressWarnings("unchecked")
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        if (redisReadFails) {
            when(valueOperations.get(anyString())).thenThrow(new IllegalStateException("Redis unavailable"));
        }

        DownloadService service = new DownloadService();
        setField(service, "downloadResourceMapper", mapper);
        setField(service, "redisTemplate", redisTemplate);
        return service;
    }

    private DownloadResource resource(boolean locked, String passwordHash) {
        DownloadResource resource = new DownloadResource();
        resource.setId(1L);
        resource.setTitle("测试资源");
        resource.setUrl("/api/uploads/downloads/test.zip");
        resource.setLocked(locked);
        resource.setDownloadPasswordHash(passwordHash);
        return resource;
    }

    private String extractCaptchaAnswer(String image) {
        String prefix = "data:image/svg+xml;base64,";
        assertThat(image).startsWith(prefix);
        String svg = new String(Base64.getDecoder().decode(image.substring(prefix.length())), StandardCharsets.UTF_8);
        Matcher matcher = Pattern.compile(">(\\d{4})</text>").matcher(svg);
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
