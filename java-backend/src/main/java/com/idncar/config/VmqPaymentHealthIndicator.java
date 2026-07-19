package com.idncar.config;

import com.idncar.service.InternalVmqPaymentService;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("vmqPayment")
public class VmqPaymentHealthIndicator implements HealthIndicator {

    private final InternalVmqPaymentService paymentService;

    public VmqPaymentHealthIndicator(InternalVmqPaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Override
    public Health health() {
        InternalVmqPaymentService.VmqMonitorHealth monitor = paymentService.getMonitorHealth();
        Health.Builder health = !monitor.enabled() || "ONLINE".equals(monitor.state())
                ? Health.up()
                : Health.down();
        return health
                .withDetail("enabled", monitor.enabled())
                .withDetail("state", monitor.state())
                .withDetail("lastHeartTime", monitor.lastHeartTime() == null ? "never" : monitor.lastHeartTime())
                .build();
    }
}
