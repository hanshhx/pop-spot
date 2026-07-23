package com.example.popspotbackend.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MatePostTest {

    @Test
    void 참여자는_부분문자열이_아닌_정확한_ID로_판정한다() {
        MatePost post = MatePost.builder().joinedUsers("user-10,user-20,").build();

        assertThat(post.hasJoined("user-1")).isFalse();
        assertThat(post.hasJoined("user-10")).isTrue();
    }

    @Test
    void 탈퇴사용자_참조도_정확한_ID만_제거한다() {
        MatePost post =
                MatePost.builder()
                        .joinedUsers("user-1,user-10,")
                        .reportedBy("user-1,user-10,")
                        .currentPeople(2)
                        .build();

        post.removeUserReferences("user-1");

        assertThat(post.hasJoined("user-1")).isFalse();
        assertThat(post.hasJoined("user-10")).isTrue();
        assertThat(post.hasReported("user-1")).isFalse();
        assertThat(post.hasReported("user-10")).isTrue();
        assertThat(post.getCurrentPeople()).isEqualTo(1);
    }
}
