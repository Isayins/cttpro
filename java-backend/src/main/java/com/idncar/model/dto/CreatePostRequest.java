package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreatePostRequest {

    private String title;
    private String content;
    private String category;
    private List<String> tags;
}
