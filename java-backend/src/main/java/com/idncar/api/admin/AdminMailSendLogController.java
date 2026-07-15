package com.idncar.api.admin;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.mapper.MailSendLogMapper;
import com.idncar.model.dto.MailSendLogDto;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.entity.MailSendLog;
import com.idncar.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/mail-send-logs")
public class AdminMailSendLogController {

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private MailSendLogMapper mailSendLogMapper;

    @GetMapping
    public ResponseEntity<PageResultDto<MailSendLogDto>> getMailSendLogs(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        userAccessService.requireAdmin(userId);
        int safePage = page == null ? 1 : Math.max(1, page);
        int safeSize = size == null ? 10 : Math.max(1, Math.min(size, 100));
        QueryWrapper<MailSendLog> queryWrapper = new QueryWrapper<>();
        String normalizedKeyword = normalize(keyword);
        if (normalizedKeyword != null) {
            queryWrapper.and(wrapper -> wrapper.like("order_no", normalizedKeyword)
                    .or()
                    .like("recipient_email", normalizedKeyword)
                    .or()
                    .like("product_title", normalizedKeyword)
                    .or()
                    .like("subject", normalizedKeyword)
                    .or()
                    .like("error_message", normalizedKeyword));
        }
        String normalizedStatus = normalize(status);
        if (normalizedStatus != null && !"ALL".equalsIgnoreCase(normalizedStatus)) {
            queryWrapper.eq("status", normalizedStatus.toUpperCase(Locale.ROOT));
        }
        queryWrapper.orderByDesc("create_time").orderByDesc("id");
        Page<MailSendLog> result = mailSendLogMapper.selectPage(new Page<>(safePage, safeSize), queryWrapper);
        List<MailSendLogDto> records = result.getRecords().stream()
                .map(MailSendLogDto::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(PageResultDto.of(records, result.getTotal(), safePage, safeSize));
    }

    private String normalize(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
