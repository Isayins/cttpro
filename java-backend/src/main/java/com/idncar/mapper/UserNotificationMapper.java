package com.idncar.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.idncar.model.entity.UserNotification;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Mapper;

import java.util.Date;
import java.util.List;

@Mapper
public interface UserNotificationMapper extends BaseMapper<UserNotification> {

    int markAllAsReadByUserId(@Param("userId") Long userId, @Param("readTime") Date readTime);

    int insertBatch(@Param("notifications") List<UserNotification> notifications);
}
