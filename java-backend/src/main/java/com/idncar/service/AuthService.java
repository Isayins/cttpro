package com.idncar.service;

import com.idncar.model.dto.AuthResponse;
import com.idncar.model.dto.ChangePasswordRequest;
import com.idncar.model.dto.LoginRecordDto;
import com.idncar.model.dto.LoginRequest;
import com.idncar.model.dto.RegisterRequest;
import com.idncar.model.dto.SendEmailCodeRequest;
import com.idncar.model.dto.SendEmailCodeResponse;
import com.idncar.model.dto.UpdateProfileRequest;
import com.idncar.model.dto.UserDto;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface AuthService {

    AuthResponse login(LoginRequest request, String ipAddress, String userAgent);

    SendEmailCodeResponse sendRegisterEmailCode(SendEmailCodeRequest request);

    UserDto register(RegisterRequest request);

    void logout(String token);

    UserDto getCurrentUser(Long userId);

    UserDto updateProfile(Long userId, UpdateProfileRequest request);

    UserDto uploadAvatar(Long userId, MultipartFile file);

    void changePassword(Long userId, ChangePasswordRequest request);

    List<LoginRecordDto> getRecentLoginRecords(Long userId, Integer limit);
}
