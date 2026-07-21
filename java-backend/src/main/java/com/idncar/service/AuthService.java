package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.InviteCodeMapper;
import com.idncar.mapper.LoginRecordMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.AuthResponse;
import com.idncar.model.dto.ChangePasswordRequest;
import com.idncar.model.dto.ChangeEmailRequest;
import com.idncar.model.dto.LoginRecordDto;
import com.idncar.model.dto.LoginRequest;
import com.idncar.model.dto.RegisterRequest;
import com.idncar.model.dto.ResetPasswordRequest;
import com.idncar.model.dto.SendEmailCodeRequest;
import com.idncar.model.dto.SendEmailCodeResponse;
import com.idncar.model.dto.UpdateProfileRequest;
import com.idncar.model.dto.UserDto;
import com.idncar.model.entity.InviteCode;
import com.idncar.model.entity.LoginRecord;
import com.idncar.model.entity.User;
import com.idncar.service.impl.MailBrandTemplateHelper;
import com.idncar.util.ImageUploadHelper;
import com.idncar.util.JwtUtil;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Year;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final String PASSWORD_RESET_CODE_SENT_MESSAGE =
            "如果该邮箱已注册，验证码邮件将发送到该邮箱";
    private static final String EMAIL_PURPOSE_REGISTER = "REGISTER";
    private static final String EMAIL_PURPOSE_PASSWORD_RESET = "PASSWORD_RESET";
    private static final String EMAIL_PURPOSE_CHANGE = "EMAIL_CHANGE";

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");
    private static final Pattern PASSWORD_PATTERN = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d).{6,}$");
    private static final long MAX_AVATAR_SIZE_BYTES = 5L * 1024 * 1024;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private InviteCodeMapper inviteCodeMapper;

    @Autowired
    private LoginRecordMapper loginRecordMapper;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Autowired
    private MailBrandTemplateHelper mailBrandTemplateHelper;

    @Value("${app.auth.email-code-expire-minutes:10}")
    private long emailCodeExpireMinutes;

    @Value("${app.auth.email-code-cooldown-seconds:60}")
    private long emailCodeCooldownSeconds;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String springMailUsername;

    @Value("${app.mail.mock-enabled:false}")
    private boolean mailMockEnabled;

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.avatar-subdir:avatars}")
    private String uploadAvatarSubDir;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Random random = new Random();

    public AuthResponse login(LoginRequest request, String ipAddress, String userAgent) {
        String identity = requireText(request.getUsername(), "请输入用户名或邮箱");
        String password = requireText(request.getPassword(), "请输入密码");

        User user = identity.contains("@")
                ? userMapper.selectByEmail(identity)
                : userMapper.selectByUsername(identity);

        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            logLoginAttempt(user == null ? null : user.getId(), identity, ipAddress, userAgent, "FAILED");
            throw ApiException.unauthorized("用户名、邮箱或密码错误");
        }

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            logLoginAttempt(user.getId(), identity, ipAddress, userAgent, "FAILED");
            throw ApiException.forbidden("当前账号已被禁用");
        }

        String token = jwtUtil.generateToken(user.getId());
        String currentTokenKey = "token:" + user.getId();
        String previousToken = (String) redisTemplate.opsForValue().get(currentTokenKey);
        if (previousToken != null && !previousToken.equals(token)) {
            redisTemplate.opsForValue().set(
                    "token:blacklist:" + previousToken,
                    "1",
                    jwtUtil.getExpirationTime(),
                    TimeUnit.MILLISECONDS
            );
        }
        redisTemplate.opsForValue().set(
                currentTokenKey,
                token,
                jwtUtil.getExpirationTime(),
                TimeUnit.MILLISECONDS
        );

        logLoginAttempt(user.getId(), identity, ipAddress, userAgent, "SUCCESS");
        return new AuthResponse(token, UserDto.fromEntity(user));
    }

    public SendEmailCodeResponse sendRegisterEmailCode(SendEmailCodeRequest request) {
        String email = requireEmail(request.getEmail());

        if (userMapper.selectByEmail(email) != null) {
            throw ApiException.badRequest("该邮箱已注册，请直接登录");
        }

        return sendVerificationEmail(
                email, registerCodeKey(email), registerCooldownKey(email), EMAIL_PURPOSE_REGISTER);
    }

    public SendEmailCodeResponse sendPasswordResetEmailCode(SendEmailCodeRequest request) {
        String email = requireEmail(request.getEmail());
        String cooldownKey = passwordResetCooldownKey(email);
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw ApiException.badRequest("验证码发送过于频繁，请稍后再试");
        }

        if (userMapper.selectByEmail(email) == null) {
            redisTemplate.opsForValue().set(cooldownKey, "1", emailCodeCooldownSeconds, TimeUnit.SECONDS);
            return new SendEmailCodeResponse(PASSWORD_RESET_CODE_SENT_MESSAGE, null);
        }

        sendVerificationEmail(email, passwordResetCodeKey(email), cooldownKey, EMAIL_PURPOSE_PASSWORD_RESET);
        redisTemplate.delete(passwordResetAttemptsKey(email));
        return new SendEmailCodeResponse(PASSWORD_RESET_CODE_SENT_MESSAGE, null);
    }

    public SendEmailCodeResponse sendEmailChangeCode(Long userId, SendEmailCodeRequest request) {
        User user = userAccessService.requireActiveUser(userId);
        String email = requireEmail(request.getEmail());
        if (email.equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest("新邮箱不能与当前邮箱相同");
        }
        if (userMapper.selectByEmail(email) != null) {
            throw ApiException.badRequest("该邮箱已被其他账号使用");
        }
        return sendVerificationEmail(
                email, emailChangeCodeKey(userId, email), emailChangeCooldownKey(userId), EMAIL_PURPOSE_CHANGE);
    }

    @Transactional(rollbackFor = Exception.class)
    public void resetPassword(ResetPasswordRequest request) {
        String email = requireEmail(request.email());
        String emailCode = requireText(request.emailCode(), "请输入邮箱验证码");
        String newPassword = requirePassword(request.newPassword());
        String confirmPassword = requireText(request.confirmPassword(), "请再次输入新密码");
        User user = userMapper.selectByEmail(email);
        Object storedCode = redisTemplate.opsForValue().get(passwordResetCodeKey(email));

        if (user == null || storedCode == null || !emailCode.equals(String.valueOf(storedCode))) {
            Long failedAttempts = redisTemplate.opsForValue().increment(passwordResetAttemptsKey(email));
            if (failedAttempts != null && failedAttempts == 1L) {
                redisTemplate.expire(
                        passwordResetAttemptsKey(email), emailCodeExpireMinutes, TimeUnit.MINUTES);
            }
            if (failedAttempts != null && failedAttempts >= 5L) {
                redisTemplate.delete(passwordResetCodeKey(email));
            }
            throw ApiException.badRequest("邮箱验证码错误或已过期");
        }
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw ApiException.forbidden("当前账号已被禁用");
        }
        if (!newPassword.equals(confirmPassword)) {
            throw ApiException.badRequest("两次输入的新密码不一致");
        }
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw ApiException.badRequest("新密码不能与当前密码相同");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userMapper.updateById(user);
        redisTemplate.delete(passwordResetCodeKey(email));
        redisTemplate.delete(passwordResetCooldownKey(email));
        redisTemplate.delete(passwordResetAttemptsKey(email));
        invalidateUserSession(user.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public UserDto register(RegisterRequest request) {
        String username = requireText(request.getUsername(), "请输入用户名");
        String email = requireEmail(request.getEmail());
        String password = requirePassword(request.getPassword());
        String nickname = UserProfilePolicy.normalizeNickname(request.getNickname());
        String inviteCodeValue = requireText(request.getInviteCode(), "请输入邀请码").toUpperCase();
        String emailCode = requireText(request.getEmailCode(), "请输入邮箱验证码");

        if (userMapper.selectByUsername(username) != null) {
            throw ApiException.badRequest("该用户名已存在，请更换用户名");
        }

        if (userMapper.selectByEmail(email) != null) {
            throw ApiException.badRequest("该邮箱已注册，请直接登录");
        }

        Object storedCode = redisTemplate.opsForValue().get(registerCodeKey(email));
        if (storedCode == null || !emailCode.equals(String.valueOf(storedCode))) {
            throw ApiException.badRequest("邮箱验证码错误或已过期");
        }

        InviteCode inviteCode = inviteCodeMapper.selectOne(new QueryWrapper<InviteCode>()
                .eq("code", inviteCodeValue)
                .last("LIMIT 1"));

        if (inviteCode == null) {
            throw ApiException.badRequest("邀请码不存在");
        }

        if (!"ACTIVE".equalsIgnoreCase(inviteCode.getStatus())) {
            throw ApiException.badRequest("邀请码当前不可用");
        }

        if (inviteCode.getExpiresAt() != null && inviteCode.getExpiresAt().before(new Date())) {
            inviteCode.setStatus("EXPIRED");
            inviteCodeMapper.updateById(inviteCode);
            throw ApiException.badRequest("邀请码已过期");
        }

        boolean reusableInviteCode = Boolean.TRUE.equals(inviteCode.getReusable());
        if (!reusableInviteCode && (inviteCode.getUsedBy() != null || inviteCode.getUsedAt() != null)) {
            throw ApiException.badRequest("邀请码已被使用");
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setNickname(nickname);
        user.setRole("USER");
        user.setStatus("ACTIVE");
        user.setChatVisibility("ONLINE");
        user.setAvatarUrl(defaultAvatar(nickname));
        user.setExperience(0);
        user.setLevel(1);
        user.setBio("这个用户还没有填写个人简介。");
        userMapper.insert(user);

        if (reusableInviteCode) {
            inviteCode.setUsageCount(nextUsageCount(inviteCode.getUsageCount()));
            inviteCode.setStatus("ACTIVE");
        } else {
            inviteCode.setUsedBy(user.getId());
            inviteCode.setUsedAt(new Date());
            inviteCode.setStatus("USED");
        }
        inviteCodeMapper.updateById(inviteCode);

        redisTemplate.delete(registerCodeKey(email));
        return UserDto.fromEntity(user);
    }

    public void logout(String token) {
        String normalizedToken = normalizeNullableText(token);
        if (normalizedToken == null || !normalizedToken.startsWith("Bearer ")) {
            throw ApiException.unauthorized("请先登录");
        }

        normalizedToken = normalizedToken.replace("Bearer ", "").trim();
        String userId = jwtUtil.extractUserId(normalizedToken);
        jwtUtil.parseToken(normalizedToken);

        redisTemplate.opsForValue().set(
                "token:blacklist:" + normalizedToken,
                "1",
                jwtUtil.getExpirationTime(),
                TimeUnit.MILLISECONDS
        );
        redisTemplate.delete("token:" + userId);
    }

    public UserDto getCurrentUser(Long userId) {
        return UserDto.fromEntity(userAccessService.requireActiveUser(userId));
    }

    public UserDto updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userAccessService.requireActiveUser(userId);

        if (request.getNickname() != null) {
            user.setNickname(UserProfilePolicy.normalizeNickname(request.getNickname()));
        }

        if (request.getAvatarUrl() != null) {
            String avatarUrl = UserProfilePolicy.normalizeAvatarUrl(request.getAvatarUrl());
            user.setAvatarUrl(avatarUrl == null ? defaultAvatar(user.getNickname()) : avatarUrl);
        }

        if (request.getBio() != null) {
            user.setBio(UserProfilePolicy.normalizeBio(request.getBio()));
        }

        userMapper.updateById(user);
        return UserDto.fromEntity(userMapper.selectById(userId));
    }

    public UserDto uploadAvatar(Long userId, MultipartFile file) {
        User user = userAccessService.requireActiveUser(userId);
        String previousAvatarUrl = user.getAvatarUrl();
        Path uploadDir = ImageUploadHelper.resolveUploadDir(uploadBaseDir, uploadAvatarSubDir, "头像");
        Map<String, String> uploaded = ImageUploadHelper.saveImage(
                file,
                userId,
                uploadBaseDir,
                uploadAvatarSubDir,
                "user",
                "头像",
                MAX_AVATAR_SIZE_BYTES
        );
        String uploadedAvatarUrl = uploaded.get("url");

        user.setAvatarUrl(uploadedAvatarUrl);
        try {
            userMapper.updateById(user);
        } catch (RuntimeException e) {
            deletePreviousUploadedAvatar(uploadedAvatarUrl, uploadDir);
            throw e;
        }
        deletePreviousUploadedAvatar(previousAvatarUrl, uploadDir);
        return UserDto.fromEntity(userMapper.selectById(userId));
    }

    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userAccessService.requireActiveUser(userId);

        String currentPassword = requireText(request.getCurrentPassword(), "请输入当前密码");
        String newPassword = requirePassword(request.getNewPassword());
        String confirmPassword = requireText(request.getConfirmPassword(), "请再次输入新密码");

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw ApiException.badRequest("当前密码不正确");
        }

        if (!newPassword.equals(confirmPassword)) {
            throw ApiException.badRequest("两次输入的新密码不一致");
        }

        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw ApiException.badRequest("新密码不能与当前密码相同");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userMapper.updateById(user);
    }

    @Transactional(rollbackFor = Exception.class)
    public void changeEmail(Long userId, ChangeEmailRequest request) {
        User user = userAccessService.requireActiveUser(userId);
        String currentPassword = requireText(request.currentPassword(), "请输入当前密码");
        String newEmail = requireEmail(request.newEmail());
        String emailCode = requireText(request.emailCode(), "请输入邮箱验证码");

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw ApiException.badRequest("当前密码不正确");
        }
        if (newEmail.equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest("新邮箱不能与当前邮箱相同");
        }
        User existing = userMapper.selectByEmail(newEmail);
        if (existing != null && !existing.getId().equals(userId)) {
            throw ApiException.badRequest("该邮箱已被其他账号使用");
        }
        Object storedCode = redisTemplate.opsForValue().get(emailChangeCodeKey(userId, newEmail));
        if (storedCode == null || !emailCode.equals(String.valueOf(storedCode))) {
            throw ApiException.badRequest("邮箱验证码错误或已过期");
        }

        user.setEmail(newEmail);
        userMapper.updateById(user);
        redisTemplate.delete(emailChangeCodeKey(userId, newEmail));
        redisTemplate.delete(emailChangeCooldownKey(userId));
        invalidateUserSession(userId);
    }

    public List<LoginRecordDto> getRecentLoginRecords(Long userId, Integer limit) {
        userAccessService.requireActiveUser(userId);
        int safeLimit = limit == null ? 10 : Math.max(1, Math.min(limit, 20));

        return loginRecordMapper.selectList(new QueryWrapper<LoginRecord>()
                        .eq("user_id", userId)
                        .orderByDesc("create_time")
                        .last("LIMIT " + safeLimit))
                .stream()
                .map(LoginRecordDto::fromEntity)
                .collect(Collectors.toList());
    }

    private void logLoginAttempt(Long userId, String identity, String ipAddress, String userAgent, String status) {
        LoginRecord record = new LoginRecord();
        record.setUserId(userId);
        record.setLoginIdentity(limitText(identity, 120));
        record.setIpAddress(limitText(normalizeNullableText(ipAddress), 120));
        record.setUserAgent(limitText(normalizeNullableText(userAgent), 500));
        record.setDeviceType(detectDeviceType(userAgent));
        record.setLoginStatus(status);
        record.setCreateTime(new Date());
        loginRecordMapper.insert(record);
    }

    private String detectDeviceType(String userAgent) {
        String normalized = normalizeNullableText(userAgent);
        if (normalized == null) {
            return "UNKNOWN";
        }

        String lower = normalized.toLowerCase();
        if (lower.contains("ipad") || lower.contains("tablet")) {
            return "TABLET";
        }
        if (lower.contains("mobile") || lower.contains("android") || lower.contains("iphone")) {
            return "MOBILE";
        }
        return "DESKTOP";
    }

    private String requireText(String value, String message) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw ApiException.badRequest(message);
        }
        return normalized;
    }

    private String requireEmail(String email) {
        String normalizedEmail = requireText(email, "请输入邮箱");
        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw ApiException.badRequest("邮箱格式不正确");
        }
        return normalizedEmail.toLowerCase(Locale.ROOT);
    }

    private String requirePassword(String password) {
        String normalizedPassword = requireText(password, "请输入密码");
        if (!PASSWORD_PATTERN.matcher(normalizedPassword).matches()) {
            throw ApiException.badRequest("密码至少 6 位，且必须包含字母和数字");
        }
        return normalizedPassword;
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String registerCodeKey(String email) {
        return "email:register:code:" + email.toLowerCase();
    }

    private String registerCooldownKey(String email) {
        return "email:register:cooldown:" + email.toLowerCase();
    }

    private String passwordResetCodeKey(String email) {
        return "email:password-reset:code:" + email.toLowerCase();
    }

    private String passwordResetCooldownKey(String email) {
        return "email:password-reset:cooldown:" + email.toLowerCase();
    }

    private String passwordResetAttemptsKey(String email) {
        return "email:password-reset:attempts:" + email.toLowerCase();
    }

    private String emailChangeCodeKey(Long userId, String email) {
        return "email:change:code:" + userId + ":" + email.toLowerCase();
    }

    private String emailChangeCooldownKey(Long userId) {
        return "email:change:cooldown:" + userId;
    }

    private int nextUsageCount(Integer usageCount) {
        return usageCount == null ? 1 : usageCount + 1;
    }

    private String defaultAvatar(String seed) {
        return "https://api.dicebear.com/9.x/initials/svg?seed=" + seed.replace(" ", "%20");
    }

    private void deletePreviousUploadedAvatar(String avatarUrl, Path uploadDir) {
        String normalizedAvatarUrl = normalizeNullableText(avatarUrl);
        if (normalizedAvatarUrl == null) {
            return;
        }

        String fileName = extractUploadedAvatarFileName(normalizedAvatarUrl);
        if (fileName == null) {
            return;
        }

        if (fileName.isBlank() || fileName.contains("/") || fileName.contains("\\")) {
            return;
        }

        Path targetPath = uploadDir.resolve(fileName).normalize();
        if (!targetPath.startsWith(uploadDir)) {
            return;
        }

        try {
            Files.deleteIfExists(targetPath);
        } catch (IOException ignored) {
            // Keep the new upload even if cleanup fails.
        }
    }

    private String extractUploadedAvatarFileName(String avatarUrl) {
        String path = extractUrlPath(avatarUrl);
        if (path == null) {
            return null;
        }

        List<String> prefixes = List.of(
                "/api/uploads/" + uploadAvatarSubDir + "/",
                "/uploads/" + uploadAvatarSubDir + "/"
        );

        for (String prefix : prefixes) {
            if (path.startsWith(prefix)) {
                return path.substring(prefix.length());
            }
        }
        return null;
    }

    private String extractUrlPath(String url) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            try {
                String path = URI.create(url).getPath();
                return path == null || path.isBlank() ? null : path;
            } catch (Exception ignored) {
                return null;
            }
        }
        return url;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private SendEmailCodeResponse sendVerificationEmail(String email, String codeKey, String cooldownKey, String purpose) {
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw ApiException.badRequest("验证码发送过于频繁，请稍后再试");
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        redisTemplate.opsForValue().set(codeKey, code, emailCodeExpireMinutes, TimeUnit.MINUTES);
        redisTemplate.opsForValue().set(cooldownKey, "1", emailCodeCooldownSeconds, TimeUnit.SECONDS);

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            clearEmailState(codeKey, cooldownKey);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "邮件服务未配置完成，暂时无法发送验证码");
        }
        if (mailMockEnabled) {
            clearEmailState(codeKey, cooldownKey);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "当前环境仍处于 mock 发信模式，请关闭 APP_MAIL_MOCK_ENABLED");
        }

        String senderAddress = resolveMailFromAddress();
        if (senderAddress == null) {
            clearEmailState(codeKey, cooldownKey);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "发件邮箱未配置，请设置 APP_MAIL_FROM 或 SPRING_MAIL_USERNAME");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderAddress, "IDNCAR");
            helper.setTo(email);
            helper.setSubject(switch (purpose) {
                case EMAIL_PURPOSE_PASSWORD_RESET -> "IDNCAR 密码重置验证码";
                case EMAIL_PURPOSE_CHANGE -> "IDNCAR 更换邮箱验证码";
                default -> "IDNCAR 注册验证码";
            });
            helper.setText(switch (purpose) {
                case EMAIL_PURPOSE_PASSWORD_RESET -> buildPasswordResetEmailHtml(code);
                case EMAIL_PURPOSE_CHANGE -> buildEmailChangeEmailHtml(code);
                default -> buildRegisterEmailHtml(code);
            }, true);
            mailBrandTemplateHelper.addInlineLogoIfNeeded(helper);
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("Verification email failed: purpose={}, email={}, sender={}, error={}",
                    purpose, email, senderAddress, e.getMessage(), e);
            clearEmailState(codeKey, cooldownKey);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "验证码邮件发送失败，请稍后重试");
        }

        return new SendEmailCodeResponse("邮件发送成功，请查收邮箱验证码", null);
    }

    void invalidateUserSession(Long userId) {
        Object currentToken = redisTemplate.opsForValue().get("token:" + userId);
        if (currentToken != null) {
            redisTemplate.opsForValue().set(
                    "token:blacklist:" + currentToken,
                    "1",
                    jwtUtil.getExpirationTime(),
                    TimeUnit.MILLISECONDS
            );
        }
        redisTemplate.delete("token:" + userId);
    }

    private void clearEmailState(String codeKey, String cooldownKey) {
        redisTemplate.delete(codeKey);
        redisTemplate.delete(cooldownKey);
    }

    private String resolveMailFromAddress() {
        String configuredFrom = normalizeNullableText(mailFrom);
        if (configuredFrom != null) {
            return configuredFrom;
        }
        return normalizeNullableText(springMailUsername);
    }

    private String buildRegisterEmailHtml(String code) {
        String brandMark = mailBrandTemplateHelper.buildBrandMarkHtml();
        String siteUrl = mailBrandTemplateHelper.escapeHtml(mailBrandTemplateHelper.siteUrl());
        String loginUrl = mailBrandTemplateHelper.escapeHtml(mailBrandTemplateHelper.sitePath("/login"));
        int currentYear = Year.now().getValue();
        return """
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>IDNCAR 注册验证码</title>
                </head>
                <body style="margin:0;padding:0;background:#eef3f8;font-family:'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#102033;">
                  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">您的 IDNCAR 注册验证码是 %s，%d 分钟内有效。</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="background:#eef3f8;padding:32px 12px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e2ec;box-shadow:0 18px 48px rgba(16,32,51,0.12);">
                          <tr>
                            <td style="padding:28px 32px;background:#102033;color:#ffffff;">
                              <table role="presentation" cellpadding="0" cellspacing="0" width="100%%">
                                <tr>
                                  <td style="vertical-align:middle;">%s</td>
                                  <td align="right" style="vertical-align:middle;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#a9b8c9;">Account Verify</td>
                                </tr>
                              </table>
                              <div style="margin-top:28px;font-size:13px;line-height:1.7;color:#b8c7d8;">IDNCAR 账号安全</div>
                              <div style="margin-top:8px;font-size:28px;font-weight:800;line-height:1.32;color:#ffffff;">注册验证码</div>
                              <div style="margin-top:12px;font-size:14px;line-height:1.8;color:#d9e2ec;">请使用下方验证码完成邮箱验证。</div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:34px 32px 30px;">
                              <div style="font-size:15px;line-height:1.9;color:#475569;">
                                这是一封系统自动发送的验证邮件，请勿将验证码泄露给他人。
                              </div>
                              <div style="margin:26px 0;padding:24px;border-radius:8px;background:#f8fbff;border:1px solid #cfe0f5;text-align:center;">
                                <div style="font-size:12px;letter-spacing:0.20em;text-transform:uppercase;color:#58708d;">Verification Code</div>
                                <div style="margin-top:14px;font-size:34px;font-weight:900;letter-spacing:0.30em;color:#102033;">%s</div>
                              </div>
                              <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="margin-top:22px;">
                                <tr>
                                  <td style="padding:16px 18px;border-radius:8px;background:#f9fafb;border:1px solid #e2e8f0;">
                                    <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;">有效期</div>
                                    <div style="margin-top:8px;font-size:16px;font-weight:800;color:#102033;">%d 分钟</div>
                                  </td>
                                  <td width="12"></td>
                                  <td style="padding:16px 18px;border-radius:8px;background:#f9fafb;border:1px solid #e2e8f0;">
                                    <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;">安全提示</div>
                                    <div style="margin-top:8px;font-size:16px;font-weight:800;color:#102033;">仅用于本次注册</div>
                                  </td>
                                </tr>
                              </table>
                              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;">
                                <tr>
                                  <td style="border-radius:6px;background:#1d4ed8;">
                                    <a href="%s" target="_blank" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">打开 IDNCAR</a>
                                  </td>
                                  <td style="padding-left:14px;font-size:13px;line-height:1.8;color:#64748b;">
                                    官网：<a href="%s" target="_blank" style="color:#1d4ed8;text-decoration:none;">%s</a>
                                  </td>
                                </tr>
                              </table>
                              <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.9;color:#64748b;">
                                如果这不是您的操作，可以直接忽略此邮件。为了账号安全，请不要把验证码提供给任何人。
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.8;color:#8291a3;text-align:center;">
                              © %d IDNCAR. 这是一封系统自动发送的验证邮件，请勿直接回复。
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(code, emailCodeExpireMinutes, brandMark, code, emailCodeExpireMinutes, loginUrl, siteUrl, siteUrl, currentYear);
    }

    private String buildPasswordResetEmailHtml(String code) {
        return buildRegisterEmailHtml(code)
                .replace("注册验证码", "密码重置验证码")
                .replace("完成邮箱验证", "重置账号密码")
                .replace("仅用于本次注册", "仅用于本次密码重置");
    }

    private String buildEmailChangeEmailHtml(String code) {
        return buildRegisterEmailHtml(code)
                .replace("注册验证码", "更换邮箱验证码")
                .replace("完成邮箱验证", "绑定新的账号邮箱")
                .replace("仅用于本次注册", "仅用于本次邮箱更换");
    }
}
