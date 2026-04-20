package com.idncar.api.forum;

import com.idncar.model.dto.PostDto;
import com.idncar.model.dto.ReplyDto;
import com.idncar.model.dto.CreatePostRequest;
import com.idncar.model.dto.CreateReplyRequest;
import com.idncar.service.ForumService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/forum")
public class ForumController {

    @Autowired
    private ForumService forumService;

    @PostMapping("/posts")
    public ResponseEntity<PostDto> createPost(@RequestBody CreatePostRequest request, 
                                           @RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(forumService.createPost(request, userId));
    }

    @GetMapping("/posts")
    public ResponseEntity<List<PostDto>> getPosts(@RequestParam(defaultValue = "1") int page, 
                                               @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(forumService.getPosts(page, size));
    }

    @GetMapping("/posts/{id}")
    public ResponseEntity<PostDto> getPostById(@PathVariable Long id) {
        return ResponseEntity.ok(forumService.getPostById(id));
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
    public ResponseEntity<Void> likePost(@PathVariable Long id) {
        forumService.likePost(id);
        return ResponseEntity.ok().build();
    }
}
