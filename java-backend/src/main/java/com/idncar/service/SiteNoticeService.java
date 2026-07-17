package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.mapper.SiteNoticeMapper;
import com.idncar.model.dto.SiteNoticeDto;
import com.idncar.model.entity.SiteNotice;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class SiteNoticeService {

    @Autowired
    private SiteNoticeMapper siteNoticeMapper;

    public List<SiteNoticeDto> getPublishedNotices() {
        return siteNoticeMapper.selectList(
                        new QueryWrapper<SiteNotice>()
                                .eq("published", true)
                                .orderByAsc("sort_order")
                                .orderByDesc("update_time")
                ).stream()
                .map(SiteNoticeDto::fromEntity)
                .collect(Collectors.toList());
    }
}
