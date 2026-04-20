package com.idncar.service;

import com.idncar.model.dto.QrCodeAccessRequest;
import com.idncar.model.dto.QrCodeAccessResponse;
import com.idncar.model.dto.QrCodeDto;
import com.idncar.model.dto.QrCodePublicDto;
import com.idncar.model.dto.QrScanLogDto;
import com.idncar.model.dto.SaveQrCodeRequest;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

public interface QrCodeService {

    List<QrCodeDto> getAdminQrCodes(Long adminUserId);

    QrCodeDto createQrCode(Long adminUserId, SaveQrCodeRequest request);

    QrCodeDto updateQrCode(Long adminUserId, Long qrCodeId, SaveQrCodeRequest request);

    void deleteQrCode(Long adminUserId, Long qrCodeId);

    List<QrScanLogDto> getRecentScanLogs(Long adminUserId, Long qrCodeId, Integer limit);

    QrCodePublicDto getPublicQrCode(String shortCode, Long currentUserId);

    QrCodeAccessResponse accessQrCode(String shortCode, QrCodeAccessRequest request, Long currentUserId, HttpServletRequest httpServletRequest);
}
