package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.User;
import com.idncar.service.impl.MailBrandTemplateHelper;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.time.Year;
import java.util.Arrays;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ManualPaymentConfirmationMailService {

    private static final Logger log = LoggerFactory.getLogger(ManualPaymentConfirmationMailService.class);
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);

    @Autowired
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Autowired
    private MailBrandTemplateHelper mailBrandTemplateHelper;

    @Autowired
    private UserMapper userMapper;

    @Value("${app.payment.manual-confirm.enabled:true}")
    private boolean enabled;

    @Value("${app.payment.manual-confirm.recipients:}")
    private String configuredRecipients;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String springMailUsername;

    @Value("${app.mail.mock-enabled:false}")
    private boolean mailMockEnabled;

    public void sendOrderCreated(PaymentOrder order, User payer) {
        if (!enabled || order == null) {
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("Manual payment confirmation email skipped: mail sender unavailable, outTradeNo={}", order.getOutTradeNo());
            return;
        }
        if (mailMockEnabled) {
            log.warn("Manual payment confirmation email skipped: mock mail enabled, outTradeNo={}", order.getOutTradeNo());
            return;
        }

        String senderAddress = resolveMailFromAddress();
        List<String> recipients = resolveRecipients();
        if (senderAddress == null || recipients.isEmpty()) {
            log.warn("Manual payment confirmation email skipped: sender or recipients missing, outTradeNo={}, sender={}, recipients={}",
                    order.getOutTradeNo(), senderAddress, recipients.size());
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderAddress, "IDNCAR");
            helper.setTo(recipients.toArray(String[]::new));
            helper.setSubject(buildSubject(order));
            helper.setText(buildHtml(order, payer), true);
            mailBrandTemplateHelper.addInlineLogoIfNeeded(helper);
            mailSender.send(message);
            log.info("Manual payment confirmation email sent: outTradeNo={}, recipients={}", order.getOutTradeNo(), recipients.size());
        } catch (Exception exception) {
            log.warn("Manual payment confirmation email failed: outTradeNo={}, error={}",
                    order.getOutTradeNo(), exception.getMessage(), exception);
        }
    }

    private List<String> resolveRecipients() {
        Set<String> recipients = new LinkedHashSet<>();
        parseRecipients(configuredRecipients).forEach(recipients::add);
        if (recipients.isEmpty()) {
            recipients.addAll(adminRecipients());
        }
        if (recipients.isEmpty()) {
            String fallback = resolveMailFromAddress();
            if (isDeliverableEmail(fallback)) {
                recipients.add(fallback);
            }
        }
        return List.copyOf(recipients);
    }

    private List<String> adminRecipients() {
        return userMapper.selectList(new QueryWrapper<User>()
                        .in("role", List.of("OWNER", "ADMIN"))
                        .eq("status", "ACTIVE")
                        .isNotNull("email")
                        .ne("email", "")
                        .orderByAsc("id"))
                .stream()
                .map(User::getEmail)
                .map(this::normalizeNullableText)
                .filter(this::isDeliverableEmail)
                .collect(Collectors.toList());
    }

    private List<String> parseRecipients(String value) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            return List.of();
        }
        return Arrays.stream(normalized.split("[,;，；\\s]+"))
                .map(this::normalizeNullableText)
                .filter(this::isDeliverableEmail)
                .distinct()
                .collect(Collectors.toList());
    }

    private boolean isDeliverableEmail(String value) {
        String normalized = normalizeNullableText(value);
        return normalized != null
                && EMAIL_PATTERN.matcher(normalized).matches()
                && !normalized.toLowerCase().endsWith(".local");
    }

    private String resolveMailFromAddress() {
        String configuredFrom = normalizeNullableText(mailFrom);
        if (configuredFrom != null) {
            return configuredFrom;
        }
        return normalizeNullableText(springMailUsername);
    }

    private String buildSubject(PaymentOrder order) {
        return limitText("待人工确认收款 - " + firstText(order.getSubject(), order.getOutTradeNo(), "支付订单"), 120);
    }

    private String buildHtml(PaymentOrder order, User payer) {
        String brandMark = mailBrandTemplateHelper.buildBrandMarkHtml();
        String adminUrl = escapeHtml(mailBrandTemplateHelper.sitePath("/admin#payments"));
        String siteUrl = escapeHtml(mailBrandTemplateHelper.siteUrl());
        String orderNo = escapeHtml(order.getOutTradeNo());
        String subject = escapeHtml(firstText(order.getSubject(), "支付订单"));
        String amount = escapeHtml(formatAmount(order.getTotalAmount()));
        String channel = escapeHtml(firstText(order.getChannel(), "-"));
        String payerText = escapeHtml(resolvePayerText(order, payer));
        String deliveryEmail = escapeHtml(firstText(order.getDeliveryEmail(), "-"));
        String createdAt = escapeHtml(formatDate(order.getCreateTime()));
        String expireAt = escapeHtml(formatDate(order.getExpireTime()));
        int currentYear = Year.now().getValue();

        return """
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>IDNCAR 人工确认收款</title>
                </head>
                <body style="margin:0;padding:0;background:#eef3f8;font-family:'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#102033;">
                  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">有新的支付订单等待人工确认收款。</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="background:#eef3f8;padding:32px 12px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="max-width:680px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e2ec;box-shadow:0 18px 48px rgba(16,32,51,0.12);">
                          <tr>
                            <td style="padding:28px 32px;background:#102033;color:#ffffff;">
                              <table role="presentation" cellpadding="0" cellspacing="0" width="100%%">
                                <tr>
                                  <td style="vertical-align:middle;">%s</td>
                                  <td align="right" style="vertical-align:middle;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#a9b8c9;">Manual Review</td>
                                </tr>
                              </table>
                              <div style="margin-top:28px;font-size:13px;line-height:1.7;color:#b8c7d8;">支付订单等待人工确认</div>
                              <div style="margin-top:8px;font-size:28px;font-weight:800;line-height:1.32;color:#ffffff;">%s</div>
                              <div style="margin-top:12px;font-size:14px;line-height:1.8;color:#d9e2ec;">订单号：<span style="font-family:Consolas,Menlo,monospace;">%s</span></div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:34px 32px 30px;">
                              <div style="font-size:15px;line-height:1.9;color:#475569;">用户已创建支付订单。请先在支付宝/微信账单中核实到账金额，再进入后台点击“人工确认”，系统会把订单同步为已支付并触发后续发货流程。</div>
                              <div style="margin:24px 0 26px;padding:22px;border-radius:8px;background:#f8fbff;border:1px solid #cfe0f5;">
                                <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="font-size:14px;line-height:1.9;color:#334155;">
                                  <tr><td style="width:96px;color:#64748b;">金额</td><td style="font-size:22px;font-weight:800;color:#102033;">%s</td></tr>
                                  <tr><td style="color:#64748b;">通道</td><td>%s</td></tr>
                                  <tr><td style="color:#64748b;">付款人</td><td>%s</td></tr>
                                  <tr><td style="color:#64748b;">收货邮箱</td><td>%s</td></tr>
                                  <tr><td style="color:#64748b;">创建时间</td><td>%s</td></tr>
                                  <tr><td style="color:#64748b;">失效时间</td><td>%s</td></tr>
                                </table>
                              </div>
                              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;">
                                <tr>
                                  <td style="border-radius:6px;background:#1d4ed8;">
                                    <a href="%s" target="_blank" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">进入后台确认收款</a>
                                  </td>
                                  <td style="padding-left:14px;font-size:13px;line-height:1.8;color:#64748b;">
                                    官网：<a href="%s" target="_blank" style="color:#1d4ed8;text-decoration:none;">%s</a>
                                  </td>
                                </tr>
                              </table>
                              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.9;color:#64748b;">
                                为避免误确认，请只在实际到账后操作。邮件按钮会进入后台管理页，仍需管理员登录。
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.8;color:#8291a3;text-align:center;">
                              © %d IDNCAR. 这是一封系统自动发送的订单提醒邮件。
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(brandMark, subject, orderNo, amount, channel, payerText, deliveryEmail,
                createdAt, expireAt, adminUrl, siteUrl, siteUrl, currentYear);
    }

    private String resolvePayerText(PaymentOrder order, User payer) {
        if (payer == null) {
            return order.getPayerUserId() == null ? "未绑定用户" : "用户 ID " + order.getPayerUserId();
        }
        return firstText(payer.getNickname(), payer.getUsername(), payer.getEmail(), "用户 ID " + payer.getId());
    }

    private String formatAmount(BigDecimal amount) {
        return amount == null ? "-" : "¥" + amount.toPlainString();
    }

    private String formatDate(Date date) {
        return date == null ? "-" : new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }

    private String firstText(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String normalized = normalizeNullableText(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String escapeHtml(String value) {
        String text = value == null ? "" : value;
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
