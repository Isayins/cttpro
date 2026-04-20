package com.idncar.service;

import com.idncar.model.dto.ChatRoomMessageDto;
import com.idncar.model.dto.ChatPresenceModeDto;
import com.idncar.model.dto.CreatePrivateChatMessageRequest;
import com.idncar.model.dto.CommunityTalkCommentDto;
import com.idncar.model.dto.CommunityTalkPostDto;
import com.idncar.model.dto.CreateChatMessageRequest;
import com.idncar.model.dto.CreateCommunityTalkCommentRequest;
import com.idncar.model.dto.CreateCommunityTalkPostRequest;
import com.idncar.model.dto.PrivateChatMessageDto;
import com.idncar.model.dto.PrivateChatUserDto;
import com.idncar.model.dto.UpdateChatPresenceModeRequest;

import java.util.List;

public interface CommunityService {

    List<ChatRoomMessageDto> getChatMessages(String roomId);

    ChatRoomMessageDto createChatMessage(CreateChatMessageRequest request);

    void clearChatMessages(String roomId);

    List<PrivateChatUserDto> getOnlinePrivateChatUsers(Long currentUserId);

    List<PrivateChatMessageDto> getPrivateMessages(Long currentUserId, Long targetUserId);

    PrivateChatMessageDto createPrivateMessage(Long currentUserId, CreatePrivateChatMessageRequest request);

    ChatPresenceModeDto getChatPresenceMode(Long currentUserId);

    ChatPresenceModeDto updateChatPresenceMode(Long currentUserId, UpdateChatPresenceModeRequest request);

    List<CommunityTalkPostDto> getTalkPosts();

    CommunityTalkPostDto createTalkPost(CreateCommunityTalkPostRequest request);

    CommunityTalkPostDto likeTalkPost(Long postId);

    void deleteTalkPost(Long postId, String author);

    CommunityTalkCommentDto createTalkComment(Long postId, CreateCommunityTalkCommentRequest request);
}
