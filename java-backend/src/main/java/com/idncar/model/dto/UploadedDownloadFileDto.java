package com.idncar.model.dto;

public record UploadedDownloadFileDto(
        String fileUrl,
        String originalFileName,
        String storedFileName,
        Long fileSizeBytes,
        String fileSizeText
) {
}
