package com.idncar.api.common;

import com.idncar.model.dto.SiteNoticeDto;
import com.idncar.service.SiteNoticeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/site-notices")
public class SiteNoticeController {

    @Autowired
    private SiteNoticeService siteNoticeService;

    @GetMapping
    public ResponseEntity<List<SiteNoticeDto>> getSiteNotices() {
        return ResponseEntity.ok(siteNoticeService.getPublishedNotices());
    }
}
