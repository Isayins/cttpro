package com.idncar.service;

import com.idncar.exception.ApiException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserProfilePolicyTest {

    @Test
    void normalizesSupportedProfileValues() {
        assertThat(UserProfilePolicy.normalizeNickname("  昵称  ")).isEqualTo("昵称");
        assertThat(UserProfilePolicy.normalizeAvatarUrl("  /api/uploads/avatars/user-1.jpg  "))
                .isEqualTo("/api/uploads/avatars/user-1.jpg");
        assertThat(UserProfilePolicy.normalizeAvatarUrl("https://cdn.example.com/avatar.png"))
                .isEqualTo("https://cdn.example.com/avatar.png");
        assertThat(UserProfilePolicy.normalizeBio("  简介  ")).isEqualTo("简介");
        assertThat(UserProfilePolicy.normalizeBio("   ")).isNull();
    }

    @Test
    void rejectsUnsafeAvatarUrls() {
        assertThatThrownBy(() -> UserProfilePolicy.normalizeAvatarUrl("javascript:alert(1)"))
                .isInstanceOf(ApiException.class)
                .hasMessage("头像地址仅支持 HTTP(S) 或站内图片路径");
        assertThatThrownBy(() -> UserProfilePolicy.normalizeAvatarUrl("/api/uploads/../secret.png"))
                .isInstanceOf(ApiException.class)
                .hasMessage("头像地址仅支持 HTTP(S) 或站内图片路径");
        assertThatThrownBy(() -> UserProfilePolicy.normalizeAvatarUrl("//"))
                .isInstanceOf(ApiException.class)
                .hasMessage("头像地址仅支持 HTTP(S) 或站内图片路径");
    }

    @Test
    void rejectsValuesBeyondPersistedProfileLimits() {
        assertThatThrownBy(() -> UserProfilePolicy.normalizeNickname("a".repeat(51)))
                .isInstanceOf(ApiException.class)
                .hasMessage("昵称不能超过 50 个字符");
        assertThatThrownBy(() -> UserProfilePolicy.normalizeAvatarUrl(
                "https://example.com/" + "a".repeat(240)))
                .isInstanceOf(ApiException.class)
                .hasMessage("头像地址不能超过 255 个字符");
        assertThatThrownBy(() -> UserProfilePolicy.normalizeBio("a".repeat(501)))
                .isInstanceOf(ApiException.class)
                .hasMessage("个人简介不能超过 500 个字符");
    }
}
