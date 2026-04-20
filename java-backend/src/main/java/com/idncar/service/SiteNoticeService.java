package com.idncar.service;

import com.idncar.model.dto.SiteNoticeDto;

import java.util.List;

public interface SiteNoticeService {

    List<SiteNoticeDto> getPublishedNotices();
}
