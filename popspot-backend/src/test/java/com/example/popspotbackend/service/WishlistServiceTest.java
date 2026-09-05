package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.entity.Wishlist;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.repository.WishlistRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 찜 담기 / 빼기의 <b>의미</b>를 못박는다.
 *
 * <p>이 검사들이 왜 생겼는지부터. 웹의 게스트 찜 이전 코드가 {@code POST} 를 "담기" 로 알고 이미 찜한 팝업에까지 보냈고, {@code POST} 는 토글이라
 * 그것들을 <b>지웠다</b>. 응답이 200 이라 호출부는 성공으로 알았고, 브라우저에 남아 있던 사본까지 함께 지워 <b>양쪽에서 사라졌다</b>. 그 코드의 주석은 "서버
 * 찜은 멱등이라 두 번 올려도 결과는 같다" 고 적고 있었다 — 사실이 아니었고, 아무도 그것을 검사하지 않았다(이 서비스에 검사가 하나도 없었다).
 *
 * <p>그래서 여기서 지키는 것은 두 가지다. <b>(1) 토글은 정말 토글이다</b> — 멱등하지 않다는 사실을 검사로 남겨, 다음 사람이 같은 착각을 코드로 확인할 수 있게
 * 한다. <b>(2) 빼기는 빼기다</b> — 없는 것을 빼라고 해도 담지 않는다.
 */
@ExtendWith(MockitoExtension.class)
class WishlistServiceTest {

    private static final String USER_ID = "user-1";
    private static final Long POPUP_ID = 3240L;

    @Mock private WishlistRepository wishlistRepository;
    @Mock private UserRepository userRepository;
    @Mock private PopupStoreRepository popupStoreRepository;

    @InjectMocks private WishlistService wishlistService;

    @Test
    @DisplayName("토글은 이미 담긴 팝업을 지운다 — 담기로 쓰면 안 된다")
    void toggleWishlist_removesWhenAlreadyPresent() {
        Wishlist existing = Wishlist.builder().id(7L).build();
        when(wishlistRepository.existsByUser_UserIdAndPopupStore_Id(USER_ID, POPUP_ID))
                .thenReturn(true);
        when(wishlistRepository.findByUser_UserIdAndPopupStore_Id(USER_ID, POPUP_ID))
                .thenReturn(Optional.of(existing));

        String result = wishlistService.toggleWishlist(USER_ID, POPUP_ID);

        // 이 단언이 이 파일의 핵심이다. "두 번 담으면 그대로" 가 아니라 "두 번 담으면 지워진다".
        assertThat(result).isEqualTo("REMOVED");
        verify(wishlistRepository).delete(existing);
        verify(wishlistRepository, never()).save(any());
    }

    @Test
    @DisplayName("토글은 없던 팝업을 담는다")
    void toggleWishlist_addsWhenAbsent() {
        User user = User.builder().userId(USER_ID).build();
        PopupStore popup = PopupStore.builder().id(POPUP_ID).build();
        when(wishlistRepository.existsByUser_UserIdAndPopupStore_Id(USER_ID, POPUP_ID))
                .thenReturn(false);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(popupStoreRepository.findById(POPUP_ID)).thenReturn(Optional.of(popup));

        String result = wishlistService.toggleWishlist(USER_ID, POPUP_ID);

        assertThat(result).isEqualTo("ADDED");
        verify(wishlistRepository).save(any(Wishlist.class));
    }

    @Test
    @DisplayName("빼기는 담긴 것을 지운다")
    void removeWishlist_deletesWhenPresent() {
        Wishlist existing = Wishlist.builder().id(7L).build();
        when(wishlistRepository.existsByUser_UserIdAndPopupStore_Id(USER_ID, POPUP_ID))
                .thenReturn(true);
        when(wishlistRepository.findByUser_UserIdAndPopupStore_Id(USER_ID, POPUP_ID))
                .thenReturn(Optional.of(existing));

        String result = wishlistService.removeWishlist(USER_ID, POPUP_ID);

        assertThat(result).isEqualTo("REMOVED");
        verify(wishlistRepository).delete(existing);
    }

    /**
     * 날짜 없는 팝업 하나가 <b>목록 전체</b>를 날려 버리던 것.
     *
     * <p>{@code toResponse} 가 {@code getEndDate().toString()} 을 부르고 있었다. 두 필드는 이미 {@code String} 이라
     * 변환할 것이 없었고, null 이면 그 자리에서 NPE 가 나 조회 전체가 500 이 됐다. 종료일 없는 팝업이 1,554곳 중 907곳(58%)이라 아주 흔한
     * 경우였다.
     *
     * <p>화면에서는 <b>"찜 개수는 올라가는데 목록은 비어 있는"</b> 모습이었다. 개수는 {@code countByUser_UserId} 라 날짜를 안 건드려
     * 멀쩡했고, 프론트는 {@code if (res.ok)} 안에서만 목록을 세팅해서 500 이 와도 오류 하나 없이 빈 화면을 유지했다.
     */
    @Test
    @DisplayName("날짜가 없는 팝업도 목록에 나온다 — 한 줄 때문에 전체를 잃지 않는다")
    void getMyWishlist_survivesNullDates() {
        PopupStore 날짜없음 =
                PopupStore.builder().id(POPUP_ID).name("날짜 미상 팝업").location("서울 성동구").build();
        Wishlist row = Wishlist.builder().id(1L).popupStore(날짜없음).build();
        when(wishlistRepository.findAllByUser_UserIdOrderByIdDesc(USER_ID))
                .thenReturn(java.util.List.of(row));

        var result = wishlistService.getMyWishlist(USER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getPopupId()).isEqualTo(POPUP_ID);
        assertThat(result.get(0).getStartDate()).isNull();
        assertThat(result.get(0).getEndDate()).isNull();
    }

    @Test
    @DisplayName("날짜가 있으면 그대로 내보낸다")
    void getMyWishlist_passesDatesThrough() {
        PopupStore popup =
                PopupStore.builder()
                        .id(POPUP_ID)
                        .name("릴 X 토니노 람보르기니 GROUND")
                        .startDate("2026-09-15")
                        .endDate("2026-09-23")
                        .build();
        when(wishlistRepository.findAllByUser_UserIdOrderByIdDesc(USER_ID))
                .thenReturn(java.util.List.of(Wishlist.builder().id(1L).popupStore(popup).build()));

        var result = wishlistService.getMyWishlist(USER_ID);

        assertThat(result.get(0).getStartDate()).isEqualTo("2026-09-15");
        assertThat(result.get(0).getEndDate()).isEqualTo("2026-09-23");
    }

    /**
     * 빼기가 토글과 갈라지는 지점. 토글이었다면 여기서 <b>담아 버린다</b> — 빼기 버튼이 담기 버튼으로 둔갑하는 것이 정확히 그 사고다. 두 번 눌렀거나 다른
     * 기기에서 먼저 뺐을 때 도달한다.
     */
    @Test
    @DisplayName("빼기는 없는 것을 빼라고 해도 담지 않는다 — 성공으로 끝낸다")
    void removeWishlist_isIdempotentWhenAbsent() {
        when(wishlistRepository.existsByUser_UserIdAndPopupStore_Id(USER_ID, POPUP_ID))
                .thenReturn(false);

        String result = wishlistService.removeWishlist(USER_ID, POPUP_ID);

        assertThat(result).isEqualTo("ABSENT");
        verify(wishlistRepository, never()).save(any());
        verify(wishlistRepository, never()).delete(any());
        // 없는 것을 지우는 데 유저·팝업을 조회할 이유가 없다. 불필요한 왕복이 없음을 함께 못박는다.
        verify(userRepository, never()).findById(any());
        verify(popupStoreRepository, never()).findById(any());
    }
}
