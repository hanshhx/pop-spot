package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.WishlistResponseDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.entity.Wishlist;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.repository.WishlistRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 위시리스트 토글 / 빼기 / 조회. 결과는 클라이언트가 분기할 수 있도록 문자열로 반환한다.
 *
 * <p><b>토글과 빼기는 다른 문이다.</b> 토글은 없으면 담고, 빼기는 없으면 아무것도 하지 않는다. 하나로 합치면 "빼기" 버튼이 상태에 따라 담기 버튼이 된다 —
 * 실제로 게스트 찜 이전이 토글을 담기처럼 쓰다가 이미 찜해 둔 팝업을 지웠다. 두 의미를 검사로 못박아 두었다({@code WishlistServiceTest}).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WishlistService {

    private static final String RESULT_ADDED = "ADDED";
    private static final String RESULT_REMOVED = "REMOVED";

    /** 지우라고 했는데 애초에 없었다. 실패가 아니다 — 아래 {@link #removeWishlist} 주석 참고. */
    private static final String RESULT_ABSENT = "ABSENT";

    private final WishlistRepository wishlistRepository;
    private final UserRepository userRepository;
    private final PopupStoreRepository popupStoreRepository;

    @Transactional
    public String toggleWishlist(String userId, Long popupStoreId) {
        if (wishlistRepository.existsByUser_UserIdAndPopupStore_Id(userId, popupStoreId)) {
            removeExisting(userId, popupStoreId);
            return RESULT_REMOVED;
        }
        addNew(userId, popupStoreId);
        return RESULT_ADDED;
    }

    /**
     * 찜을 <b>뺀다</b>. 이미 없으면 없는 대로 성공이다.
     *
     * <p><b>왜 없는 것을 지워도 성공인가.</b> 이 문을 부르는 화면은 둘 다 "담겨 있다" 는 전제 아래 눌린다 — 웹의 마이팝 목록에서
     * 빼기(HomeClient), 앱 상세의 하트 끄기(useWishlist). 그 전제가 어긋나는 경우(두 번 누름, 다른 기기에서 먼저 뺌, 목록이 오래됨)에 404 를
     * 주면 호출부의 {@code res.ok} 가 거짓이 되어 웹은 카드를 그대로 두고 앱은 "찜을 풀지 못했어요" 를 띄운다. <b>목적이 이미 달성된 상황이 실패로
     * 보인다.</b> 그래서 결과만 본문으로 알리고 상태는 200 이다.
     *
     * <p>토글({@link #toggleWishlist})과 따로 두는 이유도 같다. 토글은 없으면 <b>담아 버리므로</b> 빼기 버튼이 담기 버튼으로 둔갑한다. 실제로
     * 게스트 찜 이전이 토글을 빼기처럼 쓰다가 이미 찜해 둔 팝업을 지웠다.
     */
    @Transactional
    public String removeWishlist(String userId, Long popupStoreId) {
        if (!wishlistRepository.existsByUser_UserIdAndPopupStore_Id(userId, popupStoreId)) {
            return RESULT_ABSENT;
        }
        removeExisting(userId, popupStoreId);
        return RESULT_REMOVED;
    }

    public List<WishlistResponseDto> getMyWishlist(String userId) {
        return wishlistRepository.findAllByUser_UserIdOrderByIdDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    /* ============================== 내부 헬퍼 ============================== */

    private void removeExisting(String userId, Long popupStoreId) {
        Wishlist wishlist =
                wishlistRepository
                        .findByUser_UserIdAndPopupStore_Id(userId, popupStoreId)
                        .orElseThrow(() -> new IllegalArgumentException("찜 정보가 없습니다."));
        wishlistRepository.delete(wishlist);
    }

    private void addNew(String userId, Long popupStoreId) {
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> new IllegalArgumentException("유저 없음"));
        PopupStore popup =
                popupStoreRepository
                        .findById(popupStoreId)
                        .orElseThrow(() -> new IllegalArgumentException("팝업 없음"));
        wishlistRepository.save(Wishlist.builder().user(user).popupStore(popup).build());
    }

    private WishlistResponseDto toResponse(Wishlist w) {
        PopupStore popup = w.getPopupStore();
        return WishlistResponseDto.builder()
                .wishlistId(w.getId())
                .popupId(popup.getId())
                .popupName(popup.getName())
                .popupImage(popup.getImageUrl())
                .location(popup.getLocation())
                .startDate(popup.getStartDate().toString())
                .endDate(popup.getEndDate().toString())
                .build();
    }
}
