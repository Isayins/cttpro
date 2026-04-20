package com.idncar.service;

import com.idncar.model.dto.DownloadCaptchaDto;
import com.idncar.model.dto.DownloadResourceDto;
import com.idncar.model.dto.DownloadTargetDto;
import com.idncar.model.dto.VerifyDownloadCaptchaRequest;
import com.idncar.model.dto.VerifyDownloadCaptchaResponse;

import java.util.List;

public interface DownloadService {

    List<DownloadResourceDto> getDownloads();

    void trackDownload(Long downloadId);

    DownloadCaptchaDto createCaptcha();

    VerifyDownloadCaptchaResponse verifyCaptcha(VerifyDownloadCaptchaRequest request);

    DownloadTargetDto consumeDownloadToken(String token);
}
