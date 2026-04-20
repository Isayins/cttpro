package com.idncar.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    private SecretKey key;

    @PostConstruct
    public void init() {
        // 配置中的密钥使用 Base64 存储，这里先解码再构造签名密钥
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    }

    // ================== 生成 Token ==================
    public String generateToken(Long userId) {
        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(key)
                .compact();
    }

    // ================== 解析 Token ==================
    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    // ================== 获取用户ID ==================
    public String extractUserId(String token) {
        return parseToken(token).getSubject();
    }

    // ================== 判断是否过期 ==================
    public boolean isTokenExpired(String token) {
        return parseToken(token).getExpiration().before(new Date());
    }

    // ================== 返回过期时间（给Redis用） ==================
    public long getExpirationTime() {
        return expiration;
    }
}
