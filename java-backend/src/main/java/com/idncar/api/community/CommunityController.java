package com.idncar.api.community;

import com.idncar.model.dto.ChatRoomMessageDto;
import com.idncar.model.dto.ChatPresenceModeDto;
import com.idncar.model.dto.CreatePrivateChatMessageRequest;
import com.idncar.model.dto.CommunityTalkCommentDto;
import com.idncar.model.dto.CommunityTalkPostDto;
import com.idncar.model.dto.CreateChatMessageRequest;
import com.idncar.model.dto.CreateCommunityTalkCommentRequest;
import com.idncar.model.dto.CreateCommunityTalkPostRequest;
import com.idncar.model.dto.CreateCommunityReportRequest;
import com.idncar.model.dto.PrivateChatMessageDto;
import com.idncar.model.dto.PrivateChatUserDto;
import com.idncar.model.dto.UpdateChatPresenceModeRequest;
import com.idncar.service.CommunityService;
import com.idncar.util.ImageUploadHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
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
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    @Autowired
    private CommunityService communityService;

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.chat-image-subdir:chat-images}")
    private String uploadChatImageSubDir;

    @GetMapping({"/chat/rooms/{roomId}/messages", "/chat/rooms/{roomId}/messages/"})
    public ResponseEntity<List<ChatRoomMessageDto>> getChatMessages(@PathVariable String roomId) {
        return ResponseEntity.ok(communityService.getChatMessages(roomId));
    }

    @PostMapping({"/chat/messages", "/chat/messages/"})
    public ResponseEntity<ChatRoomMessageDto> createChatMessage(@RequestAttribute("userId") Long userId,
                                                                 @RequestBody CreateChatMessageRequest request) {
        return ResponseEntity.ok(communityService.createChatMessage(userId, request));
    }

    @PostMapping(value = {"/chat/images", "/chat/images/"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadChatImage(@RequestAttribute("userId") Long userId,
                                                               @RequestParam("file") MultipartFile file) {
        communityService.requireChatImageUploadAllowed(userId);
        return ResponseEntity.ok(ImageUploadHelper.saveImage(file, userId, uploadBaseDir, uploadChatImageSubDir, "chat", "聊天"));
    }

    @DeleteMapping({"/chat/rooms/{roomId}/messages", "/chat/rooms/{roomId}/messages/"})
    public ResponseEntity<Void> clearChatMessages(@RequestAttribute("userId") Long userId,
                                                   @PathVariable String roomId) {
        communityService.clearChatMessages(userId, roomId);
        return ResponseEntity.ok().build();
    }

    @GetMapping({"/private/users", "/private/users/"})
    public ResponseEntity<List<PrivateChatUserDto>> getPrivateChatUsers(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(communityService.getPrivateChatUsers(userId));
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

    @PostMapping({"/private/users/{targetUserId}/block", "/private/users/{targetUserId}/block/"})
    public ResponseEntity<Void> blockPrivateChatUser(@RequestAttribute("userId") Long userId,
                                                      @PathVariable Long targetUserId) {
        communityService.blockPrivateChatUser(userId, targetUserId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping({"/private/users/{targetUserId}/block", "/private/users/{targetUserId}/block/"})
    public ResponseEntity<Void> unblockPrivateChatUser(@RequestAttribute("userId") Long userId,
                                                        @PathVariable Long targetUserId) {
        communityService.unblockPrivateChatUser(userId, targetUserId);
        return ResponseEntity.ok().build();
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

    @PostMapping({"/reports", "/reports/"})
    public ResponseEntity<Void> reportCommunityContent(@RequestAttribute("userId") Long userId,
                                                        @RequestBody CreateCommunityReportRequest request) {
        communityService.reportCommunityContent(userId, request);
        return ResponseEntity.ok().build();
    }

    @GetMapping({"/talk/posts", "/talk/posts/"})
    public ResponseEntity<List<CommunityTalkPostDto>> getTalkPosts() {
        return ResponseEntity.ok(communityService.getTalkPosts());
    }

    @PostMapping({"/talk/posts", "/talk/posts/"})
    public ResponseEntity<CommunityTalkPostDto> createTalkPost(@RequestAttribute("userId") Long userId,
                                                               @RequestBody CreateCommunityTalkPostRequest request) {
        return ResponseEntity.ok(communityService.createTalkPost(userId, request));
    }

    @PostMapping({"/talk/posts/{postId}/like", "/talk/posts/{postId}/like/"})
    public ResponseEntity<CommunityTalkPostDto> likeTalkPost(@RequestAttribute("userId") Long userId,
                                                             @PathVariable Long postId) {
        return ResponseEntity.ok(communityService.likeTalkPost(userId, postId));
    }

    @DeleteMapping({"/talk/posts/{postId}", "/talk/posts/{postId}/"})
    public ResponseEntity<Void> deleteTalkPost(@RequestAttribute("userId") Long userId,
                                               @PathVariable Long postId) {
        communityService.deleteTalkPost(userId, postId);
        return ResponseEntity.ok().build();
    }

    @PostMapping({"/talk/posts/{postId}/comments", "/talk/posts/{postId}/comments/"})
    public ResponseEntity<CommunityTalkCommentDto> createTalkComment(@RequestAttribute("userId") Long userId,
                                                                     @PathVariable Long postId,
                                                                     @RequestBody CreateCommunityTalkCommentRequest request) {
        return ResponseEntity.ok(communityService.createTalkComment(userId, postId, request));
    }

}
