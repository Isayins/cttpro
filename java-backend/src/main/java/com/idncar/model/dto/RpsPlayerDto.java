package com.idncar.model.dto;

public record RpsPlayerDto(
        String seat,
        String name,
        String glyph,
        String identity,
        String identityDescription,
        boolean joined,
        boolean hasChosen,
        String choice
) {
}
