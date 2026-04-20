package com.idncar.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.InviteCodeMapper;
import com.idncar.mapper.LoginRecordMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.AuthResponse;
import com.idncar.model.dto.ChangePasswordRequest;
import com.idncar.model.dto.LoginRecordDto;
import com.idncar.model.dto.LoginRequest;
import com.idncar.model.dto.RegisterRequest;
import com.idncar.model.dto.SendEmailCodeRequest;
import com.idncar.model.dto.SendEmailCodeResponse;
import com.idncar.model.dto.UpdateProfileRequest;
import com.idncar.model.dto.UserDto;
import com.idncar.model.entity.InviteCode;
import com.idncar.model.entity.LoginRecord;
import com.idncar.model.entity.User;
import com.idncar.service.AuthService;
import com.idncar.service.UserAccessService;
import com.idncar.util.JwtUtil;
import jakarta.annotation.Resource;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Date;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AuthServiceImpl implements AuthService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");
    private static final Pattern PASSWORD_PATTERN = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d).{6,}$");

    @Autowired
    private UserMapper userMapper;

    @Resource
    private  JavaMailSender mailSender;

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

    @Value("${app.auth.email-code-expire-minutes:10}")
    private long emailCodeExpireMinutes;

    @Value("${app.auth.email-code-cooldown-seconds:60}")
    private long emailCodeCooldownSeconds;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${app.mail.mock-enabled:false}")
    private boolean mailMockEnabled;

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.avatar-subdir:avatars}")
    private String uploadAvatarSubDir;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Random random = new Random();
    private static final long MAX_AVATAR_SIZE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_AVATAR_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
    );

    @Override
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

    @Override
    public SendEmailCodeResponse sendRegisterEmailCode(SendEmailCodeRequest request) {
        String email = requireEmail(request.getEmail());

        if (userMapper.selectByEmail(email) != null) {
            throw ApiException.badRequest("该邮箱已注册，请直接登录");
        }

        String cooldownKey = registerCooldownKey(email);
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw ApiException.badRequest("验证码发送过于频繁，请稍后再试");
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        redisTemplate.opsForValue().set(registerCodeKey(email), code, emailCodeExpireMinutes, TimeUnit.MINUTES);
        redisTemplate.opsForValue().set(cooldownKey, "1", emailCodeCooldownSeconds, TimeUnit.SECONDS);

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null || mailMockEnabled || mailFrom == null || mailFrom.isBlank()) {
            return new SendEmailCodeResponse("验证码已生成，当前为调试模式", code);
        }
        try{ MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);
            helper.setFrom(mailFrom, "IDNCAR");
            helper.setTo(email);
            helper.setSubject("IDNCAR 注册验证码");
            helper.setText("您的验证码为 " + code + "，" + emailCodeExpireMinutes + " 分钟内有效。");
            mailSender.send(message);
        }catch(Exception e){
            System.err.println("邮件发送失败 , error: " + e.getMessage());
        }


        return new SendEmailCodeResponse("邮件发送成功，请查收邮箱验证码", null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserDto register(RegisterRequest request) {
        String username = requireText(request.getUsername(), "请输入用户名");
        String email = requireEmail(request.getEmail());
        String password = requirePassword(request.getPassword());
        String nickname = requireText(request.getNickname(), "请输入昵称");
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

    @Override
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

    @Override
    public UserDto getCurrentUser(Long userId) {
        return UserDto.fromEntity(userAccessService.requireActiveUser(userId));
    }

    @Override
    public UserDto updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userAccessService.requireActiveUser(userId);

        if (request.getNickname() != null) {
            String nickname = request.getNickname().trim();
            if (nickname.isEmpty()) {
                throw ApiException.badRequest("昵称不能为空");
            }
            user.setNickname(nickname);
        }

        if (request.getAvatarUrl() != null) {
            String avatarUrl = request.getAvatarUrl().trim();
            user.setAvatarUrl(avatarUrl.isEmpty() ? defaultAvatar(user.getNickname()) : avatarUrl);
        }

        if (request.getBio() != null) {
            user.setBio(request.getBio().trim());
        }

        userMapper.updateById(user);
        return UserDto.fromEntity(userMapper.selectById(userId));
    }

    @Override
    public UserDto uploadAvatar(Long userId, MultipartFile file) {
        User user = userAccessService.requireActiveUser(userId);
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("请选择要上传的头像图片");
        }
        if (file.getSize() > MAX_AVATAR_SIZE_BYTES) {
            throw ApiException.badRequest("头像图片不能超过 5MB");
        }

        String contentType = normalizeNullableText(file.getContentType());
        if (contentType == null || !ALLOWED_AVATAR_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw ApiException.badRequest("仅支持 JPG、PNG、WEBP、GIF 图片");
        }

        Path uploadDir = Paths.get(uploadBaseDir).toAbsolutePath().normalize().resolve(uploadAvatarSubDir).normalize();
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "创建头像目录失败");
        }

        String extension = switch (contentType.toLowerCase()) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> throw ApiException.badRequest("仅支持 JPG、PNG、WEBP、GIF 图片");
        };

        deletePreviousUploadedAvatar(user.getAvatarUrl(), uploadDir);

        String fileName = "user-" + userId + "-" + UUID.randomUUID().toString().replace("-", "") + extension;
        Path targetPath = uploadDir.resolve(fileName).normalize();
        if (!targetPath.startsWith(uploadDir)) {
            throw ApiException.badRequest("非法文件名");
        }

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "保存头像失败");
        }

        user.setAvatarUrl("/uploads/" + uploadAvatarSubDir + "/" + fileName);
        userMapper.updateById(user);
        return UserDto.fromEntity(userMapper.selectById(userId));
    }

    @Override
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

    @Override
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
        return normalizedEmail;
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

        String prefix = "/uploads/" + uploadAvatarSubDir + "/";
        if (!normalizedAvatarUrl.startsWith(prefix)) {
            return;
        }

        String fileName = normalizedAvatarUrl.substring(prefix.length());
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

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
