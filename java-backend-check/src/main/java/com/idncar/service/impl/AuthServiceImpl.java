package com.idncar.service.impl;

import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.AuthResponse;
import com.idncar.model.dto.LoginRequest;
import com.idncar.model.dto.RegisterRequest;
import com.idncar.model.dto.UserDto;
import com.idncar.model.entity.User;
import com.idncar.service.AuthService;
import com.idncar.util.JwtUtil;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class AuthServiceImpl implements AuthService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public AuthResponse login(LoginRequest request) {
        User user = userMapper.selectByUsername(request.getUsername());

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("用户名或密码错误");
        }

        String token = jwtUtil.generateToken(user.getId());
        redisTemplate.opsForValue().set(
                "token:" + user.getId(),
                token,
                jwtUtil.getExpirationTime(),
                TimeUnit.MILLISECONDS
        );

        return new AuthResponse(token, UserDto.fromEntity(user));
    }

    @Override
    public UserDto register(RegisterRequest request) {
        if (userMapper.selectByUsername(request.getUsername()) != null) {
            throw new RuntimeException("用户名已存在");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setNickname(request.getNickname());
        user.setRole("USER");

        userMapper.insert(user);

        return UserDto.fromEntity(user);
    }

    @Override
    public void logout(String token) {
        token = token.replace("Bearer ", "");
        Claims claims = jwtUtil.parseToken(token);
        String userId = claims.getSubject();

        redisTemplate.opsForValue().set(
                "token:blacklist:" + userId,
                "1",
                jwtUtil.getExpirationTime(),
                TimeUnit.MILLISECONDS
        );
    }
}