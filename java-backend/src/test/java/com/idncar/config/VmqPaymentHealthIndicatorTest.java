package com.idncar.config;

import com.idncar.service.InternalVmqPaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Status;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class VmqPaymentHealthIndicatorTest {

    @Test
    void enabledOfflineMonitorIsDownButDisabledMonitorIsUp() {
        InternalVmqPaymentService service = mock(InternalVmqPaymentService.class);
        VmqPaymentHealthIndicator indicator = new VmqPaymentHealthIndicator(service);
        when(service.getMonitorHealth())
                .thenReturn(new InternalVmqPaymentService.VmqMonitorHealth(true, "OFFLINE", null))
                .thenReturn(new InternalVmqPaymentService.VmqMonitorHealth(false, "OFFLINE", null));

        assertThat(indicator.health().getStatus()).isEqualTo(Status.DOWN);
        assertThat(indicator.health().getStatus()).isEqualTo(Status.UP);
    }
}
