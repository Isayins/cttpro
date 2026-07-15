package com.idncar.api.forum;

import com.idncar.model.dto.CreatePostReportRequest;
import com.idncar.model.dto.CreateForumBoardOwnerApplicationRequest;
import com.idncar.model.dto.ForumBoardDto;
import com.idncar.model.dto.ForumBoardOwnerApplicationDto;
import com.idncar.model.dto.ForumLeaderboardDto;
import com.idncar.model.dto.ForumSignInDto;
import com.idncar.model.dto.PostDto;
import com.idncar.model.dto.ReplyDto;
import com.idncar.model.dto.ReviewForumBoardOwnerApplicationRequest;
import com.idncar.model.dto.SaveForumBoardLevelTitlesRequest;
import com.idncar.model.dto.CreatePostRequest;
import com.idncar.model.dto.CreateReplyRequest;
import com.idncar.model.dto.SaveForumBoardRequest;
import com.idncar.service.ForumService;
import com.idncar.service.UserAccessService;
import com.idncar.util.ImageUploadHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/forum")
public class ForumController {

    @Autowired
    private ForumService forumService;

    @Autowired
    private UserAccessService userAccessService;

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.forum-image-subdir:forum-images}")
    private String uploadForumImageSubDir;

    @Value("${app.upload.forum-board-avatar-subdir:forum-board-avatars}")
    private String uploadForumBoardAvatarSubDir;

    @GetMapping("/boards")
    public ResponseEntity<List<ForumBoardDto>> getForumBoards(@RequestParam(defaultValue = "false") boolean includeInactive,
                                                              @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(forumService.getForumBoards(includeInactive, userId));
    }

    @PostMapping("/boards")
    public ResponseEntity<ForumBoardDto> createForumBoard(@RequestBody SaveForumBoardRequest request,
                                                          @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.createForumBoard(request, userId));
    }

    @PutMapping("/boards/{id}")
    public ResponseEntity<ForumBoardDto> updateForumBoard(@PathVariable Long id,
                                                           @RequestBody SaveForumBoardRequest request,
                                                           @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.updateForumBoard(id, request, userId));
    }

    @PutMapping("/boards/{id}/level-titles")
    public ResponseEntity<ForumBoardDto> updateForumBoardLevelTitles(@PathVariable Long id,
                                                                     @RequestBody SaveForumBoardLevelTitlesRequest request,
                                                                     @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.updateForumBoardLevelTitles(id, request, userId));
    }

    @PostMapping("/boards/{id}/owner-applications")
    public ResponseEntity<ForumBoardOwnerApplicationDto> applyForumBoardOwner(@PathVariable Long id,
                                                                               @RequestBody CreateForumBoardOwnerApplicationRequest request,
                                                                               @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.applyForumBoardOwner(id, request, userId));
    }

    @GetMapping("/board-owner-applications/mine")
    public ResponseEntity<List<ForumBoardOwnerApplicationDto>> getMyForumBoardOwnerApplications(
            @RequestParam(required = false) String status,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(forumService.getMyForumBoardOwnerApplications(status, userId));
    }

    @GetMapping("/board-owner-applications")
    public ResponseEntity<List<ForumBoardOwnerApplicationDto>> getForumBoardOwnerApplications(
            @RequestParam(required = false) String status,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(forumService.getForumBoardOwnerApplications(status, userId));
    }

    @PostMapping("/board-owner-applications/{id}/review")
    public ResponseEntity<ForumBoardOwnerApplicationDto> reviewForumBoardOwnerApplication(
            @PathVariable Long id,
            @RequestBody ReviewForumBoardOwnerApplicationRequest request,
            @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.reviewForumBoardOwnerApplication(id, request, userId));
    }

    @PostMapping(value = "/boards/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadForumBoardAvatar(@RequestAttribute("userId") Long userId,
                                                                      @RequestParam("file") MultipartFile file) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(ImageUploadHelper.saveImage(file, userId, uploadBaseDir, uploadForumBoardAvatarSubDir, "forum-board", "吧头像"));
    }

    @PostMapping(value = {"/images", "/images/"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadForumImage(@RequestAttribute("userId") Long userId,
                                                                @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ImageUploadHelper.saveImage(file, userId, uploadBaseDir, uploadForumImageSubDir, "forum", "论坛"));
    }

    @PostMapping("/posts")
    public ResponseEntity<PostDto> createPost(@RequestBody CreatePostRequest request, 
                                           @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.createPost(request, userId));
    }

    @GetMapping("/posts")
    public ResponseEntity<List<PostDto>> getPosts(@RequestParam(defaultValue = "1") int page,
                                                  @RequestParam(defaultValue = "10") int size,
                                                  @RequestParam(required = false) String keyword,
                                                  @RequestParam(required = false) String category,
                                                  @RequestParam(required = false) Boolean mine,
                                                  @RequestParam(required = false) Boolean favorites,
                                                  @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(forumService.getPosts(page, size, keyword, category, mine, favorites, userId));
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<ForumLeaderboardDto> getLeaderboard(@RequestParam(required = false) Long boardId) {
        return ResponseEntity.ok(forumService.getLeaderboard(boardId));
    }

    @GetMapping("/sign-in/status")
    public ResponseEntity<ForumSignInDto> getSignInStatus(@RequestParam(required = false) Long boardId,
                                                          @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(forumService.getSignInStatus(userId, boardId));
    }

    @PostMapping("/sign-in")
    public ResponseEntity<ForumSignInDto> signIn(@RequestParam(required = false) Long boardId,
                                                 @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.signIn(userId, boardId));
    }

    @GetMapping("/posts/{id}")
    public ResponseEntity<PostDto> getPostById(@PathVariable Long id,
                                               @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(forumService.getPostById(id, userId));
    }

    @PutMapping("/posts/{id}")
    public ResponseEntity<PostDto> updatePost(@PathVariable Long id, 
                                           @RequestBody CreatePostRequest request, 
                                           @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.updatePost(id, request, userId));
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable Long id, 
                                         @RequestAttribute("userId") Long userId) {
        forumService.deletePost(id, userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/posts/{id}/replies")
    public ResponseEntity<ReplyDto> createReply(@PathVariable Long id, 
                                             @RequestBody CreateReplyRequest request, 
                                             @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.createReply(id, request, userId));
    }

    @GetMapping("/posts/{id}/replies")
    public ResponseEntity<List<ReplyDto>> getReplies(@PathVariable Long id, 
                                                  @RequestParam(defaultValue = "1") int page, 
                                                  @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(forumService.getReplies(id, page, size));
    }

    @PostMapping("/posts/{id}/like")
    public ResponseEntity<PostDto> likePost(@PathVariable Long id,
                                            @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.toggleLikePost(id, userId));
    }

    @PostMapping("/posts/{id}/favorite")
    public ResponseEntity<PostDto> favoritePost(@PathVariable Long id,
                                                @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.toggleFavoritePost(id, userId));
    }

    @PostMapping("/posts/{id}/pin")
    public ResponseEntity<PostDto> updatePinnedStatus(@PathVariable Long id,
                                                      @RequestParam Boolean pinned,
                                                      @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.updatePinnedStatus(id, pinned, userId));
    }

    @PostMapping("/posts/{id}/report")
    public ResponseEntity<Map<String, String>> reportPost(@PathVariable Long id,
                                                          @RequestBody CreatePostReportRequest request,
                                                          @RequestAttribute("userId") Long userId) {
        forumService.reportPost(id, request, userId);
        return ResponseEntity.ok(Map.of("message", "举报已提交"));
    }

}
