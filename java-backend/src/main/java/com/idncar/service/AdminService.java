package com.idncar.service;

import com.idncar.model.dto.AdminOperationLogDto;
import com.idncar.model.dto.AdminPostReportDto;
import com.idncar.model.dto.AdminUpdateUserRequest;
import com.idncar.model.dto.CreateDownloadResourceRequest;
import com.idncar.model.dto.CreateInviteCodeRequest;
import com.idncar.model.dto.DownloadResourceDto;
import com.idncar.model.dto.InviteCodeDto;
import com.idncar.model.dto.ReviewPostReportRequest;
import com.idncar.model.dto.SaveSiteNoticeRequest;
import com.idncar.model.dto.SiteNoticeDto;
import com.idncar.model.dto.UploadedDownloadFileDto;
import com.idncar.model.dto.UserDto;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface AdminService {

    List<UserDto> getUsers(Long adminUserId);

    UserDto updateUser(Long adminUserId, Long targetUserId, AdminUpdateUserRequest request);

    void deleteUser(Long adminUserId, Long targetUserId);

    List<InviteCodeDto> getInviteCodes(Long adminUserId);

    List<InviteCodeDto> createInviteCodes(Long adminUserId, CreateInviteCodeRequest request);

    void deleteInviteCode(Long adminUserId, Long inviteCodeId);

    DownloadResourceDto createDownloadResource(Long adminUserId, CreateDownloadResourceRequest request);

    UploadedDownloadFileDto uploadDownloadFile(Long adminUserId, MultipartFile file);

    void deleteDownloadResource(Long adminUserId, Long downloadResourceId);

    List<SiteNoticeDto> getSiteNotices(Long adminUserId);

    SiteNoticeDto createSiteNotice(Long adminUserId, SaveSiteNoticeRequest request);

    SiteNoticeDto updateSiteNotice(Long adminUserId, Long siteNoticeId, SaveSiteNoticeRequest request);

    void deleteSiteNotice(Long adminUserId, Long siteNoticeId);

    List<AdminPostReportDto> getPostReports(Long adminUserId, String status);

    AdminPostReportDto reviewPostReport(Long adminUserId, Long reportId, ReviewPostReportRequest request);

    List<AdminOperationLogDto> getOperationLogs(Long adminUserId, Integer limit);
}
