package com.idncar.service;

import com.idncar.model.dto.PostDto;
import com.idncar.model.dto.ReplyDto;
import com.idncar.model.dto.CreatePostRequest;
import com.idncar.model.dto.CreatePostReportRequest;
import com.idncar.model.dto.CreateReplyRequest;
import com.idncar.model.dto.CreateForumBoardOwnerApplicationRequest;
import com.idncar.model.dto.ForumBoardDto;
import com.idncar.model.dto.ForumBoardOwnerApplicationDto;
import com.idncar.model.dto.ForumLeaderboardDto;
import com.idncar.model.dto.ForumSignInDto;
import com.idncar.model.dto.ReviewForumBoardOwnerApplicationRequest;
import com.idncar.model.dto.SaveForumBoardLevelTitlesRequest;
import com.idncar.model.dto.SaveForumBoardRequest;

import java.util.List;

public interface ForumService {

    PostDto createPost(CreatePostRequest request, Long userId);

    List<PostDto> getPosts(int page, int size, String keyword, String category, Boolean mineOnly, Boolean favoritesOnly, Long currentUserId);

    PostDto getPostById(Long id, Long currentUserId);

    PostDto updatePost(Long id, CreatePostRequest request, Long userId);

    void deletePost(Long id, Long userId);

    ReplyDto createReply(Long postId, CreateReplyRequest request, Long userId);

    List<ReplyDto> getReplies(Long postId, int page, int size);

    PostDto toggleLikePost(Long postId, Long userId);

    PostDto toggleFavoritePost(Long postId, Long userId);

    PostDto updatePinnedStatus(Long postId, Boolean pinned, Long userId);

    void reportPost(Long postId, CreatePostReportRequest request, Long userId);

    ForumLeaderboardDto getLeaderboard(Long boardId);

    ForumSignInDto getSignInStatus(Long userId, Long boardId);

    ForumSignInDto signIn(Long userId, Long boardId);

    List<ForumBoardDto> getForumBoards(boolean includeInactive, Long currentUserId);

    ForumBoardDto createForumBoard(SaveForumBoardRequest request, Long userId);

    ForumBoardDto updateForumBoard(Long id, SaveForumBoardRequest request, Long userId);

    ForumBoardDto updateForumBoardLevelTitles(Long id, SaveForumBoardLevelTitlesRequest request, Long userId);

    ForumBoardOwnerApplicationDto applyForumBoardOwner(Long boardId, CreateForumBoardOwnerApplicationRequest request, Long userId);

    List<ForumBoardOwnerApplicationDto> getMyForumBoardOwnerApplications(String status, Long userId);

    List<ForumBoardOwnerApplicationDto> getForumBoardOwnerApplications(String status, Long userId);

    ForumBoardOwnerApplicationDto reviewForumBoardOwnerApplication(Long applicationId, ReviewForumBoardOwnerApplicationRequest request, Long userId);
}
