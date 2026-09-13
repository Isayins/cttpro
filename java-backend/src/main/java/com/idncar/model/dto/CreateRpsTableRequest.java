package com.idncar.model.dto;

public record CreateRpsTableRequest(String name, String accessMode, String password) {

    public CreateRpsTableRequest(String name) {
        this(name, "PUBLIC", null);
    }
}
