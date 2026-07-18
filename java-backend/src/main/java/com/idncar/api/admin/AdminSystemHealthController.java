package com.idncar.api.admin;

import com.idncar.model.dto.AdminDownloadStatsDto;
import com.idncar.model.dto.AdminPaymentOrderStatsDto;
import com.idncar.model.dto.AdminProductStatsDto;
import com.idncar.model.dto.AdminSystemHealthDto;
import com.idncar.model.dto.ProductDeliveryCodeStatsDto;
import com.idncar.model.dto.VmqPaymentSettingsDto;
import com.idncar.service.AdminService;
import com.idncar.service.AlipayFaceToFacePaymentService;
import com.idncar.service.InternalVmqPaymentService;
import com.idncar.service.ProductDeliveryCodeService;
import com.idncar.service.ProductService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

@RestController
@RequestMapping("/api/admin/system-health")
public class AdminSystemHealthController {

    @Autowired
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Autowired
    private InternalVmqPaymentService internalVmqPaymentService;

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductDeliveryCodeService productDeliveryCodeService;

    @Autowired
    private AlipayFaceToFacePaymentService paymentService;

    @Autowired
    private AdminService adminService;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.mail.mock-enabled:false}")
    private boolean mailMockEnabled;

    @Value("${app.ops.backup-status-file:/opt/cttpro/backup-status.properties}")
    private String backupStatusFile;

    @GetMapping
    public ResponseEntity<AdminSystemHealthDto> getSystemHealth(@RequestAttribute("userId") Long userId) {
        List<AdminSystemHealthDto.Item> items = new ArrayList<>();
        items.add(mailHealth());
        items.add(paymentHealth(userId));
        items.add(orderHealth(userId));
        items.add(deliveryHealth(userId));
        items.add(downloadHealth(userId));
        items.add(backupHealth());
        return ResponseEntity.ok(AdminSystemHealthDto.of(items));
    }

    private AdminSystemHealthDto.Item mailHealth() {
        boolean hasSender = mailSenderProvider.getIfAvailable() != null;
        boolean hasIdentity = hasText(mailFrom) || hasText(mailUsername);
        if (mailMockEnabled) {
            return item("mail", "邮件发送", "WARNING", "当前是模拟发送",
                    "app.mail.mock-enabled=true，不会真正向用户邮箱投递。", "检查邮件配置", "mail-logs");
        }
        if (!hasSender || !hasIdentity) {
            return item("mail", "邮件发送", "ERROR", "邮件未完整配置",
                    "缺少 JavaMailSender 或发件人账号配置，发货邮件可能发送失败。", "查看邮件记录", "mail-logs");
        }
        return item("mail", "邮件发送", "OK", "邮件配置已就绪",
                "已检测到邮件发送器和发件人账号配置。", "查看邮件记录", "mail-logs");
    }

    private AdminSystemHealthDto.Item paymentHealth(Long userId) {
        VmqPaymentSettingsDto settings = internalVmqPaymentService.getAdminSettings(userId);
        if (!Boolean.TRUE.equals(settings.getEnabled())) {
            return item("payment", "支付配置", "WARNING", "V免签未启用",
                    "用户仍可使用其他已接入的支付方式；如要用 V免签，请先启用并配置收款码。", "去配置支付", "vmq-payment");
        }
        boolean missingKey = !hasText(settings.getCommunicationKey());
        boolean missingPayUrl = settings.getPayType() != null && settings.getPayType() == 1
                ? !hasText(settings.getWxPayUrl())
                : !hasText(settings.getAlipayPayUrl());
        if (missingKey || missingPayUrl) {
            return item("payment", "支付配置", "ERROR", "V免签配置不完整",
                    "启用后必须配置通讯密钥和当前收款类型的收款码链接。", "补全支付配置", "vmq-payment");
        }
        if ("OFFLINE".equals(settings.getMonitorState())) {
            return item("payment", "支付配置", "WARNING", "监听端离线",
                    "V免签已启用，但最近心跳显示监听端离线，请检查服务器或手机监听端。", "查看支付配置", "vmq-payment");
        }
        return item("payment", "支付配置", "OK", "支付配置已就绪",
                "V免签关键配置完整，监听状态：" + settings.getMonitorState() + "。", "查看支付配置", "vmq-payment");
    }

    private AdminSystemHealthDto.Item orderHealth(Long userId) {
        AdminPaymentOrderStatsDto stats = paymentService.getAdminOrderStats(userId);
        long errors = safe(stats.getErrors());
        if (errors > 0) {
            return item("orders", "支付订单", "WARNING", "存在异常订单",
                    "当前有 " + errors + " 个订单带有异常原因，请优先核对是否需要重新发货或标记已处理。", "处理异常订单", "payments");
        }
        return item("orders", "支付订单", "OK", "暂无异常订单",
                "支付订单异常计数为 0。", "查看订单", "payments");
    }

    private AdminSystemHealthDto.Item deliveryHealth(Long userId) {
        AdminProductStatsDto productStats = productService.getAdminProductStats(userId);
        ProductDeliveryCodeStatsDto codeStats = productDeliveryCodeService.getAdminDeliveryCodeStats(userId);
        if (safe(productStats.getPublished()) <= 0) {
            return item("delivery", "商品发货", "WARNING", "没有上架商品",
                    "商品全部为草稿或下架状态，用户无法购买或免费领取。", "去商品管理", "products");
        }
        if (codeStats.getTotal() > 0 && codeStats.getAvailable() <= 0) {
            return item("delivery", "商品发货", "ERROR", "CDK库存已空",
                    "已有 CDK 发货记录，但可发货库存为 0，CDK商品会无法正常发货。", "去补充CDK", "delivery-codes");
        }
        if (codeStats.getAvailable() > 0 && codeStats.getAvailable() <= 5) {
            return item("delivery", "商品发货", "WARNING", "CDK库存偏低",
                    "当前可发货 CDK 仅 " + codeStats.getAvailable() + " 个，建议提前补货。", "去补充CDK", "delivery-codes");
        }
        return item("delivery", "商品发货", "OK", "商品发货状态正常",
                "上架商品 " + safe(productStats.getPublished()) + " 个，可发货 CDK " + codeStats.getAvailable() + " 个。", "查看商品", "products");
    }

    private AdminSystemHealthDto.Item downloadHealth(Long userId) {
        AdminDownloadStatsDto stats = adminService.getDownloadResourceStats(userId);
        if (safe(stats.getTotal()) <= 0) {
            return item("downloads", "下载中心", "WARNING", "下载中心暂无资源",
                    "下载页会显得空，请至少添加一个下载资源或安装包。", "去下载管理", "downloads");
        }
        return item("downloads", "下载中心", "OK", "下载中心有可用资源",
                "共 " + safe(stats.getTotal()) + " 个资源，其中 " + safe(stats.getLocked()) + " 个需要验证或密码。", "查看下载", "downloads");
    }

    private AdminSystemHealthDto.Item backupHealth() {
        Path statusPath = Path.of(backupStatusFile).toAbsolutePath().normalize();
        if (!Files.isRegularFile(statusPath)) {
            return item("backup", "数据备份", "WARNING", "尚无备份结果",
                    "未找到备份状态文件，请安装宿主机备份定时器并完成首次备份。", "查看部署说明", "system-health");
        }

        Properties status = new Properties();
        try (Reader reader = Files.newBufferedReader(statusPath, StandardCharsets.UTF_8)) {
            status.load(reader);
        } catch (IOException exception) {
            return item("backup", "数据备份", "ERROR", "备份状态无法读取",
                    "无法读取 " + statusPath + "：" + exception.getMessage(), "检查备份任务", "system-health");
        }

        String result = status.getProperty("status", "UNKNOWN");
        String finishedAt = status.getProperty("finishedAt", "");
        if ("FAILED".equalsIgnoreCase(result)) {
            return item("backup", "数据备份", "ERROR", "最近一次备份失败",
                    status.getProperty("message", "请检查 cttpro-backup.service 日志。"), "检查备份任务", "system-health");
        }
        if (!"SUCCESS".equalsIgnoreCase(result)) {
            return item("backup", "数据备份", "WARNING", "备份状态未知",
                    "状态文件没有成功结果，请检查 cttpro-backup.service。", "检查备份任务", "system-health");
        }

        try {
            if (Duration.between(Instant.parse(finishedAt), Instant.now()).toHours() > 36) {
                return item("backup", "数据备份", "WARNING", "备份已超过 36 小时",
                        "最近完成时间：" + finishedAt, "检查备份任务", "system-health");
            }
        } catch (RuntimeException exception) {
            return item("backup", "数据备份", "WARNING", "备份时间无效",
                    "状态文件中的完成时间无法识别。", "检查备份任务", "system-health");
        }

        if (!Boolean.parseBoolean(status.getProperty("remoteSynced", "false"))) {
            return item("backup", "数据备份", "WARNING", "本机备份成功但未异机同步",
                    "最近完成时间：" + finishedAt + "；配置 BACKUP_REMOTE_TARGET 后可同步到独立服务器。",
                    "配置异机备份", "system-health");
        }
        return item("backup", "数据备份", "OK", "备份与异机同步正常",
                "最近完成时间：" + finishedAt, "查看备份状态", "system-health");
    }

    private AdminSystemHealthDto.Item item(String key, String title, String status, String summary,
                                           String detail, String actionLabel, String targetSection) {
        return new AdminSystemHealthDto.Item(key, title, status, summary, detail, actionLabel, targetSection);
    }

    private long safe(Long value) {
        return value == null ? 0 : value;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
