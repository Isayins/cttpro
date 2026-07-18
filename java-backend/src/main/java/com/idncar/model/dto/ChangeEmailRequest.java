package com.idncar.model.dto;

public record ChangeEmailRequest(
        String currentPassword,
        String newEmail,
        String emailCode
) {
}
