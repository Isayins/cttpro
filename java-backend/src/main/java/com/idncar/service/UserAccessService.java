package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.mapper.UserMapper;
import com.idncar.model.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UserAccessService {

    @Autowired
    private UserMapper userMapper;

    public User requireUser(Long userId) {
        if (userId == null) {
            throw ApiException.unauthorized("请先登录");
        }
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw ApiException.notFound("用户不存在");
        }
        return user;
    }

    public User requireActiveUser(Long userId) {
        User user = requireUser(userId);
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw ApiException.forbidden("当前账号已被禁用");
        }
        return user;
    }

    public User requireAdmin(Long userId) {
        User user = requireActiveUser(userId);
        if (!isAdminRole(user.getRole())) {
            throw ApiException.forbidden("仅管理员或网站拥有人可以执行此操作");
        }
        return user;
    }

    public boolean isAdmin(Long userId) {
        if (userId == null) {
            return false;
        }
        User user = userMapper.selectById(userId);
        return user != null && isAdminRole(user.getRole()) && "ACTIVE".equalsIgnoreCase(user.getStatus());
    }

    public boolean isOwner(Long userId) {
        if (userId == null) {
            return false;
        }
        User user = userMapper.selectById(userId);
        return user != null && "OWNER".equalsIgnoreCase(user.getRole()) && "ACTIVE".equalsIgnoreCase(user.getStatus());
    }

    public boolean isAdminRole(String role) {
        return "OWNER".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role);
    }
}
