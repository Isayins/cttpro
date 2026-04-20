package com.idncar.api.community;

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
import com.idncar.service.CommunityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    @Autowired
    private CommunityService communityService;

    @GetMapping({"/chat/rooms/{roomId}/messages", "/chat/rooms/{roomId}/messages/"})
    public ResponseEntity<List<ChatRoomMessageDto>> getChatMessages(@PathVariable String roomId) {
        return ResponseEntity.ok(communityService.getChatMessages(roomId));
    }

    @PostMapping({"/chat/messages", "/chat/messages/"})
    public ResponseEntity<ChatRoomMessageDto> createChatMessage(@RequestBody CreateChatMessageRequest request) {
        return ResponseEntity.ok(communityService.createChatMessage(request));
    }

    @DeleteMapping({"/chat/rooms/{roomId}/messages", "/chat/rooms/{roomId}/messages/"})
    public ResponseEntity<Void> clearChatMessages(@PathVariable String roomId) {
        communityService.clearChatMessages(roomId);
        return ResponseEntity.ok().build();
    }

    @GetMapping({"/private/users", "/private/users/"})
    public ResponseEntity<List<PrivateChatUserDto>> getOnlinePrivateChatUsers(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(communityService.getOnlinePrivateChatUsers(userId));
    }

    @GetMapping({"/private/messages/{targetUserId}", "/private/messages/{targetUserId}/"})
    public ResponseEntity<List<PrivateChatMessageDto>> getPrivateMessages(@RequestAttribute("userId") Long userId,
                                                                          @PathVariable Long targetUserId) {
        return ResponseEntity.ok(communityService.getPrivateMessages(userId, targetUserId));
    }

    @PostMapping({"/private/messages", "/private/messages/"})
    public ResponseEntity<PrivateChatMessageDto> createPrivateMessage(@RequestAttribute("userId") Long userId,
                                                                      @RequestBody CreatePrivateChatMessageRequest request) {
        return ResponseEntity.ok(communityService.createPrivateMessage(userId, request));
    }

    @GetMapping({"/private/presence", "/private/presence/"})
    public ResponseEntity<ChatPresenceModeDto> getPresenceMode(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(communityService.getChatPresenceMode(userId));
    }

    @PutMapping({"/private/presence", "/private/presence/"})
    public ResponseEntity<ChatPresenceModeDto> updatePresenceMode(@RequestAttribute("userId") Long userId,
                                                                  @RequestBody UpdateChatPresenceModeRequest request) {
        return ResponseEntity.ok(communityService.updateChatPresenceMode(userId, request));
    }

    @GetMapping({"/talk/posts", "/talk/posts/"})
    public ResponseEntity<List<CommunityTalkPostDto>> getTalkPosts() {
        return ResponseEntity.ok(communityService.getTalkPosts());
    }

    @PostMapping({"/talk/posts", "/talk/posts/"})
    public ResponseEntity<CommunityTalkPostDto> createTalkPost(@RequestBody CreateCommunityTalkPostRequest request) {
        return ResponseEntity.ok(communityService.createTalkPost(request));
    }

    @PostMapping({"/talk/posts/{postId}/like", "/talk/posts/{postId}/like/"})
    public ResponseEntity<CommunityTalkPostDto> likeTalkPost(@PathVariable Long postId) {
        return ResponseEntity.ok(communityService.likeTalkPost(postId));
    }

    @DeleteMapping({"/talk/posts/{postId}", "/talk/posts/{postId}/"})
    public ResponseEntity<Void> deleteTalkPost(@PathVariable Long postId,
                                               @RequestParam String author) {
        communityService.deleteTalkPost(postId, author);
        return ResponseEntity.ok().build();
    }

    @PostMapping({"/talk/posts/{postId}/comments", "/talk/posts/{postId}/comments/"})
    public ResponseEntity<CommunityTalkCommentDto> createTalkComment(@PathVariable Long postId,
                                                                     @RequestBody CreateCommunityTalkCommentRequest request) {
        return ResponseEntity.ok(communityService.createTalkComment(postId, request));
    }
}
