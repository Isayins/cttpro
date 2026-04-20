package com.idncar.api.auth;

import com.idncar.model.dto.AuthResponse;
import com.idncar.model.dto.ChangePasswordRequest;
import com.idncar.model.dto.LoginRecordDto;
import com.idncar.model.dto.LoginRequest;
import com.idncar.model.dto.RegisterRequest;
import com.idncar.model.dto.SendEmailCodeRequest;
import com.idncar.model.dto.SendEmailCodeResponse;
import com.idncar.model.dto.UpdateProfileRequest;
import com.idncar.model.dto.UserDto;
import com.idncar.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request,
                                              HttpServletRequest httpServletRequest) {
        return ResponseEntity.ok(authService.login(
                request,
                resolveIpAddress(httpServletRequest),
                httpServletRequest.getHeader("User-Agent")
        ));
    }

    @PostMapping("/email-code")
    public ResponseEntity<SendEmailCodeResponse> sendEmailCode(@RequestBody SendEmailCodeRequest request) {
        return ResponseEntity.ok(authService.sendRegisterEmailCode(request));
    }

    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String token) {
        authService.logout(token);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(authService.getCurrentUser(userId));
    }

    @PutMapping("/me")
    public ResponseEntity<UserDto> updateProfile(@RequestAttribute("userId") Long userId,
                                                 @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(userId, request));
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserDto> uploadAvatar(@RequestAttribute("userId") Long userId,
                                                @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(authService.uploadAvatar(userId, file));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@RequestAttribute("userId") Long userId,
                                               @RequestBody ChangePasswordRequest request) {
        authService.changePassword(userId, request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/login-records")
    public ResponseEntity<List<LoginRecordDto>> getLoginRecords(@RequestAttribute("userId") Long userId,
                                                                @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(authService.getRecentLoginRecords(userId, limit));
    }

    private String resolveIpAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
