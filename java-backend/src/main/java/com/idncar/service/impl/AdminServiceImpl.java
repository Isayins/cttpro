package com.idncar.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.DownloadResourceMapper;
import com.idncar.mapper.InviteCodeMapper;
import com.idncar.mapper.PostMapper;
import com.idncar.mapper.PostReportMapper;
import com.idncar.mapper.SiteNoticeMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.AdminOperationLogDto;
import com.idncar.model.dto.AdminPostReportDto;
import com.idncar.model.dto.AdminUpdateUserRequest;
import com.idncar.model.dto.CreateDownloadResourceRequest;
import com.idncar.model.dto.CreateInviteCodeRequest;
import com.idncar.model.dto.DownloadResourceDto;
import com.idncar.model.dto.InviteCodeDto;
import com.idncar.model.dto.ReviewPostReportRequest;
import com.idncar.model.dto.SaveSiteNoticeRequest;
import com.idncar.model.dto.SiteNoticeDto;
import com.idncar.model.dto.UploadedDownloadFileDto;
import com.idncar.model.dto.UserDto;
import com.idncar.model.entity.AdminOperationLog;
import com.idncar.model.entity.DownloadResource;
import com.idncar.model.entity.InviteCode;
import com.idncar.model.entity.Post;
import com.idncar.model.entity.PostReport;
import com.idncar.model.entity.SiteNotice;
import com.idncar.model.entity.User;
import com.idncar.service.AdminService;
import com.idncar.service.NotificationService;
import com.idncar.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class AdminServiceImpl implements AdminService {

    private static final int MAX_CODE_GENERATE_ATTEMPTS = 10;
    private static final Pattern PASSWORD_PATTERN = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d).{6,}$");
    private static final List<String> REVIEW_STATUS = List.of("PENDING", "RESOLVED", "REJECTED");
    private static final long DEFAULT_MAX_DOWNLOAD_FILE_SIZE_BYTES = 1024L * 1024L * 1024L;

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.download-subdir:downloads}")
    private String uploadDownloadSubDir;

    @Value("${app.upload.download-max-size-bytes:" + DEFAULT_MAX_DOWNLOAD_FILE_SIZE_BYTES + "}")
    private long maxDownloadFileSizeBytes;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private InviteCodeMapper inviteCodeMapper;

    @Autowired
    private DownloadResourceMapper downloadResourceMapper;

    @Autowired
    private SiteNoticeMapper siteNoticeMapper;

    @Autowired
    private PostReportMapper postReportMapper;

    @Autowired
    private PostMapper postMapper;

    @Autowired
    private AdminOperationLogMapper adminOperationLogMapper;

    @Autowired
    private NotificationService notificationService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public List<UserDto> getUsers(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        return userMapper.selectList(new QueryWrapper<User>().orderByDesc("create_time"))
                .stream()
                .map(UserDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    public UserDto updateUser(Long adminUserId, Long targetUserId, AdminUpdateUserRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        User targetUser = requireTargetUser(targetUserId);

        validateUserManagementPermission(operator, targetUser, true);

        String oldRole = targetUser.getRole();
        String oldStatus = targetUser.getStatus();

        if (request.getNickname() != null) {
            String nickname = request.getNickname().trim();
            if (nickname.isEmpty()) {
                throw ApiException.badRequest("昵称不能为空");
            }
            targetUser.setNickname(nickname);
        }

        if (request.getAvatarUrl() != null) {
            targetUser.setAvatarUrl(normalizeNullableText(request.getAvatarUrl()));
        }

        if (request.getBio() != null) {
            targetUser.setBio(normalizeNullableText(request.getBio()));
        }

        if (request.getRole() != null) {
            String role = request.getRole().trim().toUpperCase();
            if (!List.of("ADMIN", "USER").contains(role)) {
                throw ApiException.badRequest("角色仅支持 ADMIN 或 USER");
            }
            if ("ADMIN".equals(role) && !"OWNER".equalsIgnoreCase(operator.getRole())) {
                throw ApiException.forbidden("只有网站拥有人可以授权管理员");
            }
            targetUser.setRole(role);
        }

        if (request.getStatus() != null) {
            String status = request.getStatus().trim().toUpperCase();
            if (!List.of("ACTIVE", "DISABLED").contains(status)) {
                throw ApiException.badRequest("状态仅支持 ACTIVE 或 DISABLED");
            }
            if (!"OWNER".equalsIgnoreCase(operator.getRole()) && !"USER".equalsIgnoreCase(targetUser.getRole())) {
                throw ApiException.forbidden("管理员只能修改普通用户状态");
            }
            targetUser.setStatus(status);
        }

        if (request.getPassword() != null && !request.getPassword().trim().isEmpty()) {
            if (!"OWNER".equalsIgnoreCase(operator.getRole()) && !"USER".equalsIgnoreCase(targetUser.getRole())) {
                throw ApiException.forbidden("管理员只能重置普通用户密码");
            }
            validatePassword(request.getPassword().trim());
            targetUser.setPassword(passwordEncoder.encode(request.getPassword().trim()));
        }

        userMapper.updateById(targetUser);
        User updatedUser = userMapper.selectById(targetUserId);

        logOperation(
                operator,
                "USER_UPDATED",
                "USER",
                updatedUser.getId(),
                updatedUser.getNickname(),
                "更新用户资料，角色: " + oldRole + " -> " + updatedUser.getRole() + "，状态: " + oldStatus + " -> " + updatedUser.getStatus()
        );
        return UserDto.fromEntity(updatedUser);
    }

    @Override
    public void deleteUser(Long adminUserId, Long targetUserId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        User targetUser = requireTargetUser(targetUserId);

        if (adminUserId.equals(targetUserId)) {
            throw ApiException.badRequest("不能删除当前登录账号");
        }

        validateUserManagementPermission(operator, targetUser, false);
        userMapper.deleteById(targetUserId);
        logOperation(operator, "USER_DELETED", "USER", targetUser.getId(), targetUser.getNickname(), "删除用户 " + targetUser.getUsername());
    }

    @Override
    public List<InviteCodeDto> getInviteCodes(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        List<InviteCode> inviteCodes = inviteCodeMapper.selectList(new QueryWrapper<InviteCode>().orderByDesc("create_time"));
        return toInviteCodeDtos(inviteCodes);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<InviteCodeDto> createInviteCodes(Long adminUserId, CreateInviteCodeRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);

        int count = request == null || request.getCount() == null ? 1 : request.getCount();
        int expiresInDays = request == null || request.getExpiresInDays() == null ? 7 : request.getExpiresInDays();

        if (count < 1 || count > 20) {
            throw ApiException.badRequest("一次最多生成 20 个邀请码");
        }

        if (expiresInDays < 1 || expiresInDays > 90) {
            throw ApiException.badRequest("邀请码有效期必须在 1 到 90 天之间");
        }

        List<InviteCode> created = new ArrayList<>();
        long expiresMillis = expiresInDays * 24L * 60L * 60L * 1000L;

        for (int i = 0; i < count; i++) {
            InviteCode inviteCode = new InviteCode();
            inviteCode.setCode(generateUniqueCode());
            inviteCode.setCreatedBy(adminUserId);
            inviteCode.setStatus("ACTIVE");
            inviteCode.setExpiresAt(new Date(System.currentTimeMillis() + expiresMillis));
            inviteCodeMapper.insert(inviteCode);
            created.add(inviteCode);
        }

        logOperation(operator, "INVITE_CREATED", "INVITE_CODE", null, null, "批量生成邀请码 " + created.size() + " 个");
        return toInviteCodeDtos(created);
    }

    @Override
    public void deleteInviteCode(Long adminUserId, Long inviteCodeId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        InviteCode inviteCode = inviteCodeMapper.selectById(inviteCodeId);
        if (inviteCode == null) {
            throw ApiException.notFound("邀请码不存在");
        }
        inviteCodeMapper.deleteById(inviteCodeId);
        logOperation(operator, "INVITE_DELETED", "INVITE_CODE", inviteCode.getId(), inviteCode.getCode(), "删除邀请码");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DownloadResourceDto createDownloadResource(Long adminUserId, CreateDownloadResourceRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);

        DownloadResource resource = new DownloadResource();
        resource.setTitle(requireText(request.getTitle(), "请输入下载名称"));
        resource.setVersion(normalizeNullableText(request.getVersion()));
        resource.setChangelog(normalizeNullableText(request.getChangelog()));
        resource.setUrl(requireText(request.getUrl(), "请输入下载链接"));
        resource.setIcon(normalizeNullableText(request.getIcon()));
        resource.setLocked(Boolean.TRUE.equals(request.getLocked()));
        resource.setCategory(normalizeNullableText(request.getCategory()));
        resource.setFileSize(normalizeNullableText(request.getFileSize()));
        resource.setChecksumSha256(normalizeNullableText(request.getChecksumSha256()));
        resource.setDownloadCount(0);
        resource.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());

        downloadResourceMapper.insert(resource);
        DownloadResource saved = downloadResourceMapper.selectById(resource.getId());
        logOperation(operator, "DOWNLOAD_CREATED", "DOWNLOAD", saved.getId(), saved.getTitle(), "新增下载资源");
        return DownloadResourceDto.fromEntity(saved);
    }

    @Override
    public UploadedDownloadFileDto uploadDownloadFile(Long adminUserId, MultipartFile file) {
        User operator = userAccessService.requireAdmin(adminUserId);
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("请选择要上传的文件");
        }

        long maxSize = maxDownloadFileSizeBytes <= 0 ? DEFAULT_MAX_DOWNLOAD_FILE_SIZE_BYTES : maxDownloadFileSizeBytes;
        if (file.getSize() > maxSize) {
            throw ApiException.badRequest("文件大小超出限制");
        }

        Path uploadDir = Paths.get(uploadBaseDir).toAbsolutePath().normalize().resolve(uploadDownloadSubDir).normalize();
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "创建下载目录失败");
        }

        String originalFileName = sanitizeFileName(file.getOriginalFilename());
        String extension = extractExtension(originalFileName);
        String storedFileName = "download-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().replace("-", "") + extension;

        Path targetPath = uploadDir.resolve(storedFileName).normalize();
        if (!targetPath.startsWith(uploadDir)) {
            throw ApiException.badRequest("非法文件名");
        }

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "保存文件失败");
        }

        String fileUrl = "/api/uploads/" + uploadDownloadSubDir + "/" + storedFileName;
        logOperation(operator, "DOWNLOAD_FILE_UPLOADED", "DOWNLOAD", null, originalFileName, "上传下载文件");
        return new UploadedDownloadFileDto(fileUrl, originalFileName, storedFileName, file.getSize(), formatFileSize(file.getSize()));
    }

    @Override
    public void deleteDownloadResource(Long adminUserId, Long downloadResourceId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        DownloadResource resource = downloadResourceMapper.selectById(downloadResourceId);
        if (resource == null) {
            throw ApiException.notFound("下载内容不存在");
        }
        downloadResourceMapper.deleteById(downloadResourceId);
        logOperation(operator, "DOWNLOAD_DELETED", "DOWNLOAD", resource.getId(), resource.getTitle(), "删除下载资源");
    }

    @Override
    public List<SiteNoticeDto> getSiteNotices(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        return siteNoticeMapper.selectList(
                        new QueryWrapper<SiteNotice>()
                                .orderByAsc("sort_order")
                                .orderByDesc("update_time")
                ).stream()
                .map(SiteNoticeDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SiteNoticeDto createSiteNotice(Long adminUserId, SaveSiteNoticeRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);

        SiteNotice siteNotice = new SiteNotice();
        siteNotice.setTitle(requireText(request.getTitle(), "请输入公告标题"));
        siteNotice.setContent(requireText(request.getContent(), "请输入公告内容"));
        siteNotice.setPublished(request.getPublished() == null || request.getPublished());
        siteNotice.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());

        siteNoticeMapper.insert(siteNotice);
        SiteNotice saved = siteNoticeMapper.selectById(siteNotice.getId());
        logOperation(operator, "NOTICE_CREATED", "SITE_NOTICE", saved.getId(), saved.getTitle(), "新增站点公告");
        pushNoticeNotification(saved, operator, false);
        return SiteNoticeDto.fromEntity(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SiteNoticeDto updateSiteNotice(Long adminUserId, Long siteNoticeId, SaveSiteNoticeRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);

        SiteNotice siteNotice = siteNoticeMapper.selectById(siteNoticeId);
        if (siteNotice == null) {
            throw ApiException.notFound("站点公告不存在");
        }

        siteNotice.setTitle(requireText(request.getTitle(), "请输入公告标题"));
        siteNotice.setContent(requireText(request.getContent(), "请输入公告内容"));
        siteNotice.setPublished(request.getPublished() == null || request.getPublished());
        siteNotice.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());

        siteNoticeMapper.updateById(siteNotice);
        SiteNotice updated = siteNoticeMapper.selectById(siteNoticeId);
        logOperation(operator, "NOTICE_UPDATED", "SITE_NOTICE", updated.getId(), updated.getTitle(), "更新站点公告");
        pushNoticeNotification(updated, operator, true);
        return SiteNoticeDto.fromEntity(updated);
    }

    @Override
    public void deleteSiteNotice(Long adminUserId, Long siteNoticeId) {
        User operator = userAccessService.requireAdmin(adminUserId);

        SiteNotice siteNotice = siteNoticeMapper.selectById(siteNoticeId);
        if (siteNotice == null) {
            throw ApiException.notFound("站点公告不存在");
        }

        siteNoticeMapper.deleteById(siteNoticeId);
        logOperation(operator, "NOTICE_DELETED", "SITE_NOTICE", siteNotice.getId(), siteNotice.getTitle(), "删除站点公告");
    }

    @Override
    public List<AdminPostReportDto> getPostReports(Long adminUserId, String status) {
        userAccessService.requireAdmin(adminUserId);

        QueryWrapper<PostReport> queryWrapper = new QueryWrapper<>();
        String normalizedStatus = normalizeNullableText(status);
        if (normalizedStatus != null && !"ALL".equalsIgnoreCase(normalizedStatus)) {
            queryWrapper.eq("status", normalizedStatus.toUpperCase());
        }
        queryWrapper.orderByAsc("status").orderByDesc("create_time");

        return toPostReportDtos(postReportMapper.selectList(queryWrapper));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminPostReportDto reviewPostReport(Long adminUserId, Long reportId, ReviewPostReportRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        PostReport report = postReportMapper.selectById(reportId);
        if (report == null) {
            throw ApiException.notFound("举报记录不存在");
        }

        String status = requireText(request.getStatus(), "请选择处理状态").toUpperCase();
        if (!REVIEW_STATUS.contains(status)) {
            throw ApiException.badRequest("处理状态仅支持 PENDING、RESOLVED 或 REJECTED");
        }

        report.setStatus(status);
        report.setReviewNote(limitText(normalizeNullableText(request.getReviewNote()), 500));
        report.setReviewedBy(operator.getId());
        report.setReviewedAt(new Date());
        report.setUpdateTime(new Date());
        postReportMapper.updateById(report);

        AdminPostReportDto dto = toPostReportDtos(List.of(postReportMapper.selectById(reportId))).stream()
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("举报记录不存在"));

        logOperation(operator, "POST_REPORT_REVIEWED", "POST_REPORT", dto.getId(), dto.getPostTitle(), "处理举报，状态更新为 " + status);
        notificationService.createNotification(
                dto.getReporterId(),
                "REPORT_REVIEW",
                "你的举报已有处理结果",
                "你提交的帖子举报《" + limitText(dto.getPostTitle(), 40) + "》已更新为：" + status,
                "/forum"
        );
        return dto;
    }

    @Override
    public List<AdminOperationLogDto> getOperationLogs(Long adminUserId, Integer limit) {
        userAccessService.requireAdmin(adminUserId);
        int safeLimit = limit == null ? 40 : Math.max(1, Math.min(limit, 100));

        List<AdminOperationLog> logs = adminOperationLogMapper.selectList(new QueryWrapper<AdminOperationLog>()
                .orderByDesc("create_time")
                .last("LIMIT " + safeLimit));

        List<Long> operatorIds = logs.stream()
                .map(AdminOperationLog::getOperatorId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, User> operators = operatorIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(operatorIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return logs.stream()
                .map(log -> AdminOperationLogDto.fromEntity(log, operators.get(log.getOperatorId())))
                .collect(Collectors.toList());
    }

    private User requireTargetUser(Long targetUserId) {
        User user = userMapper.selectById(targetUserId);
        if (user == null) {
            throw ApiException.notFound("目标用户不存在");
        }
        return user;
    }

    private void validateUserManagementPermission(User operator, User targetUser, boolean allowEdit) {
        boolean operatorIsOwner = "OWNER".equalsIgnoreCase(operator.getRole());
        boolean targetIsOwner = "OWNER".equalsIgnoreCase(targetUser.getRole());
        boolean targetIsAdmin = "ADMIN".equalsIgnoreCase(targetUser.getRole());

        if (targetIsOwner) {
            throw ApiException.forbidden("网站拥有人账号不允许在后台被修改或删除");
        }

        if (!operatorIsOwner && targetIsAdmin) {
            throw ApiException.forbidden(allowEdit ? "管理员不能修改其他管理员" : "管理员不能删除其他管理员");
        }
    }

    private List<InviteCodeDto> toInviteCodeDtos(List<InviteCode> inviteCodes) {
        List<Long> usedByIds = inviteCodes.stream()
                .map(InviteCode::getUsedBy)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, User> usedByUsers = usedByIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(usedByIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return inviteCodes.stream()
                .map(inviteCode -> InviteCodeDto.fromEntity(inviteCode, usedByUsers.get(inviteCode.getUsedBy())))
                .collect(Collectors.toList());
    }

    private List<AdminPostReportDto> toPostReportDtos(List<PostReport> reports) {
        List<Long> postIds = reports.stream()
                .map(PostReport::getPostId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());

        List<Long> userIds = reports.stream()
                .flatMap(report -> Stream.of(report.getReporterId(), report.getReviewedBy()))
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, Post> posts = postIds.isEmpty()
                ? Collections.emptyMap()
                : postMapper.selectBatchIds(postIds).stream()
                .collect(Collectors.toMap(Post::getId, Function.identity()));

        Map<Long, User> users = userIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return reports.stream()
                .map(report -> AdminPostReportDto.fromEntity(
                        report,
                        posts.get(report.getPostId()),
                        users.get(report.getReporterId()),
                        users.get(report.getReviewedBy())
                ))
                .collect(Collectors.toList());
    }

    private void logOperation(User operator,
                              String actionType,
                              String targetType,
                              Long targetId,
                              String targetName,
                              String detail) {
        AdminOperationLog log = new AdminOperationLog();
        log.setOperatorId(operator.getId());
        log.setOperatorRole(operator.getRole());
        log.setActionType(actionType);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setTargetName(limitText(normalizeNullableText(targetName), 160));
        log.setDetail(limitText(normalizeNullableText(detail), 500));
        log.setCreateTime(new Date());
        adminOperationLogMapper.insert(log);
    }

    private void pushNoticeNotification(SiteNotice notice, User operator, boolean updated) {
        if (notice == null || !Boolean.TRUE.equals(notice.getPublished())) {
            return;
        }

        List<Long> activeUserIds = userMapper.selectList(new QueryWrapper<User>().eq("status", "ACTIVE"))
                .stream()
                .map(User::getId)
                .collect(Collectors.toList());
        String title = updated ? "站点公告已更新" : "站点发布了新公告";
        String content = (operator == null ? "管理员" : operator.getNickname())
                + (updated ? " 更新了公告《" : " 发布了公告《")
                + limitText(notice.getTitle(), 40)
                + "》";

        notificationService.createNotifications(activeUserIds, "SITE_NOTICE", title, content, "/#site-notices");
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < MAX_CODE_GENERATE_ATTEMPTS; attempt++) {
            String code = UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
            Long count = inviteCodeMapper.selectCount(new QueryWrapper<InviteCode>().eq("code", code));
            if (count == null || count == 0) {
                return code;
            }
        }
        throw ApiException.badRequest("邀请码生成失败，请稍后重试");
    }

    private String sanitizeFileName(String originalFileName) {
        String normalized = normalizeNullableText(originalFileName);
        if (normalized == null) {
            return "file";
        }

        String fileName = normalized.replace("\\", "/");
        int slashIndex = fileName.lastIndexOf("/");
        if (slashIndex >= 0 && slashIndex < fileName.length() - 1) {
            fileName = fileName.substring(slashIndex + 1);
        }

        fileName = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        fileName = limitText(fileName, 120);
        if (fileName == null || fileName.isBlank()) {
            return "file";
        }
        return fileName;
    }

    private String extractExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex <= 0 || dotIndex == fileName.length() - 1) {
            return "";
        }
        String extension = fileName.substring(dotIndex).toLowerCase();
        if (extension.length() > 12) {
            return "";
        }
        return extension;
    }

    private String formatFileSize(long bytes) {
        if (bytes <= 0) {
            return "0 B";
        }
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        double size = bytes;
        int unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024.0;
            unitIndex++;
        }
        if (size >= 100) {
            return String.format("%.0f %s", size, units[unitIndex]);
        }
        if (size >= 10) {
            return String.format("%.1f %s", size, units[unitIndex]);
        }
        return String.format("%.2f %s", size, units[unitIndex]);
    }

    private void validatePassword(String password) {
        if (!PASSWORD_PATTERN.matcher(password).matches()) {
            throw ApiException.badRequest("密码至少 6 位，且必须包含字母和数字");
        }
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String requireText(String value, String message) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw ApiException.badRequest(message);
        }
        return normalized;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
