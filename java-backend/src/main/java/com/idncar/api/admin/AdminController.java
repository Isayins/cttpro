package com.idncar.api.admin;

import com.idncar.model.dto.AdminOperationLogDto;
import com.idncar.model.dto.AdminInviteStatsDto;
import com.idncar.model.dto.AdminPostReportDto;
import com.idncar.model.dto.AdminPostReportStatsDto;
import com.idncar.model.dto.AdminSiteNoticeStatsDto;
import com.idncar.model.dto.AdminDownloadStatsDto;
import com.idncar.model.dto.AdminUpdateUserRequest;
import com.idncar.model.dto.AdminUserStatsDto;
import com.idncar.model.dto.CreateDownloadResourceRequest;
import com.idncar.model.dto.CreateInviteCodeRequest;
import com.idncar.model.dto.DownloadResourceDto;
import com.idncar.model.dto.InviteCodeDto;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ReviewPostReportRequest;
import com.idncar.model.dto.SaveSiteNoticeRequest;
import com.idncar.model.dto.SiteNoticeDto;
import com.idncar.model.dto.UploadedDownloadFileDto;
import com.idncar.model.dto.UserDto;
import com.idncar.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @GetMapping("/users")
    public ResponseEntity<List<UserDto>> getUsers(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(adminService.getUsers(userId));
    }

    @GetMapping("/users/page")
    public ResponseEntity<PageResultDto<UserDto>> getUsersPage(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(adminService.getUsersPage(userId, page, size, keyword, role, status));
    }

    @GetMapping("/users/stats")
    public ResponseEntity<AdminUserStatsDto> getUserStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(adminService.getUserStats(userId));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<UserDto> updateUser(@RequestAttribute("userId") Long userId,
                                              @PathVariable Long id,
                                              @RequestBody AdminUpdateUserRequest request) {
        return ResponseEntity.ok(adminService.updateUser(userId, id, request));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@RequestAttribute("userId") Long userId,
                                           @PathVariable Long id) {
        adminService.deleteUser(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/invite-codes")
    public ResponseEntity<List<InviteCodeDto>> getInviteCodes(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(adminService.getInviteCodes(userId));
    }

    @GetMapping("/invite-codes/page")
    public ResponseEntity<PageResultDto<InviteCodeDto>> getInviteCodesPage(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(adminService.getInviteCodesPage(userId, page, size, keyword, status));
    }

    @GetMapping("/invite-codes/stats")
    public ResponseEntity<AdminInviteStatsDto> getInviteCodeStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(adminService.getInviteCodeStats(userId));
    }

    @PostMapping("/invite-codes")
    public ResponseEntity<List<InviteCodeDto>> createInviteCodes(@RequestAttribute("userId") Long userId,
                                                                 @RequestBody(required = false) CreateInviteCodeRequest request) {
        return ResponseEntity.ok(adminService.createInviteCodes(userId, request));
    }

    @DeleteMapping("/invite-codes/{id}")
    public ResponseEntity<Void> deleteInviteCode(@RequestAttribute("userId") Long userId,
                                                 @PathVariable Long id) {
        adminService.deleteInviteCode(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/downloads/page")
    public ResponseEntity<PageResultDto<DownloadResourceDto>> getDownloadsPage(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String mode) {
        return ResponseEntity.ok(adminService.getDownloadResourcesPage(userId, page, size, keyword, mode));
    }

    @GetMapping("/downloads/stats")
    public ResponseEntity<AdminDownloadStatsDto> getDownloadStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(adminService.getDownloadResourceStats(userId));
    }

    @PostMapping("/downloads")
    public ResponseEntity<DownloadResourceDto> createDownload(@RequestAttribute("userId") Long userId,
                                                               @RequestBody CreateDownloadResourceRequest request) {
        return ResponseEntity.ok(adminService.createDownloadResource(userId, request));
    }

    @PutMapping("/downloads/{id}")
    public ResponseEntity<DownloadResourceDto> updateDownload(@RequestAttribute("userId") Long userId,
                                                              @PathVariable Long id,
                                                              @RequestBody CreateDownloadResourceRequest request) {
        return ResponseEntity.ok(adminService.updateDownloadResource(userId, id, request));
    }

    @PostMapping(value = "/downloads/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadedDownloadFileDto> uploadDownloadFile(@RequestAttribute("userId") Long userId,
                                                                      @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(adminService.uploadDownloadFile(userId, file));
    }

    @DeleteMapping("/downloads/{id}")
    public ResponseEntity<Void> deleteDownload(@RequestAttribute("userId") Long userId,
                                               @PathVariable Long id) {
        adminService.deleteDownloadResource(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/site-notices")
    public ResponseEntity<List<SiteNoticeDto>> getSiteNotices(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(adminService.getSiteNotices(userId));
    }

    @GetMapping("/site-notices/page")
    public ResponseEntity<PageResultDto<SiteNoticeDto>> getSiteNoticesPage(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(adminService.getSiteNoticesPage(userId, page, size, keyword, status));
    }

    @GetMapping("/site-notices/stats")
    public ResponseEntity<AdminSiteNoticeStatsDto> getSiteNoticeStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(adminService.getSiteNoticeStats(userId));
    }

    @PostMapping("/site-notices")
    public ResponseEntity<SiteNoticeDto> createSiteNotice(@RequestAttribute("userId") Long userId,
                                                          @RequestBody SaveSiteNoticeRequest request) {
        return ResponseEntity.ok(adminService.createSiteNotice(userId, request));
    }

    @PutMapping("/site-notices/{id}")
    public ResponseEntity<SiteNoticeDto> updateSiteNotice(@RequestAttribute("userId") Long userId,
                                                          @PathVariable Long id,
                                                          @RequestBody SaveSiteNoticeRequest request) {
        return ResponseEntity.ok(adminService.updateSiteNotice(userId, id, request));
    }

    @DeleteMapping("/site-notices/{id}")
    public ResponseEntity<Void> deleteSiteNotice(@RequestAttribute("userId") Long userId,
                                                 @PathVariable Long id) {
        adminService.deleteSiteNotice(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/post-reports")
    public ResponseEntity<List<AdminPostReportDto>> getPostReports(@RequestAttribute("userId") Long userId,
                                                                   @RequestParam(required = false) String status) {
        return ResponseEntity.ok(adminService.getPostReports(userId, status));
    }

    @GetMapping("/post-reports/page")
    public ResponseEntity<PageResultDto<AdminPostReportDto>> getPostReportsPage(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(adminService.getPostReportsPage(userId, page, size, status));
    }

    @GetMapping("/post-reports/stats")
    public ResponseEntity<AdminPostReportStatsDto> getPostReportStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(adminService.getPostReportStats(userId));
    }

    @PutMapping("/post-reports/{id}")
    public ResponseEntity<AdminPostReportDto> reviewPostReport(@RequestAttribute("userId") Long userId,
                                                               @PathVariable Long id,
                                                               @RequestBody ReviewPostReportRequest request) {
        return ResponseEntity.ok(adminService.reviewPostReport(userId, id, request));
    }

    @GetMapping("/operation-logs")
    public ResponseEntity<List<AdminOperationLogDto>> getOperationLogs(@RequestAttribute("userId") Long userId,
                                                                       @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(adminService.getOperationLogs(userId, limit));
    }

    @GetMapping("/operation-logs/page")
    public ResponseEntity<PageResultDto<AdminOperationLogDto>> getOperationLogsPage(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(adminService.getOperationLogsPage(userId, page, size, keyword));
    }
}
