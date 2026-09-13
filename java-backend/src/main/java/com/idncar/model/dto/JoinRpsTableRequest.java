package com.idncar.model.dto;

public record JoinRpsTableRequest(String name, String password, String requestToken) {

    public JoinRpsTableRequest(String name) {
        this(name, null, null);
    }
}
