package com.idncar.service;

import com.idncar.model.dto.AuthResponse;
import com.idncar.model.dto.LoginRequest;
import com.idncar.model.dto.RegisterRequest;
import com.idncar.model.dto.UserDto;

public interface AuthService {

    AuthResponse login(LoginRequest request);

    UserDto register(RegisterRequest request);

    void logout(String token);
}
