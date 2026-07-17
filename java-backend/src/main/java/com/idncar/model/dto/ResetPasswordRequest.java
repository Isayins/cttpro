package com.idncar.model.dto;

public record ResetPasswordRequest(
        String email,
        String emailCode,
        String newPassword,
        String confirmPassword
) {
}
