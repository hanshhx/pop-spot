package com.example.popspotbackend.controller;

import com.example.popspotbackend.config.LogSafe;
import com.example.popspotbackend.dto.CalendarPopupDto;
import com.example.popspotbackend.dto.PopupPublicDetailDto;
import com.example.popspotbackend.dto.PopupPublicListDto;
import com.example.popspotbackend.dto.PopupReportRequestDto;
import com.example.popspotbackend.dto.PopupTakedownRequestDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.PopupStoreService;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 팝업스토어 공개 엔드포인트.
 *
 * <p>CORS 는 {@code SecurityConfig} 의 전역 설정에 위임하므로 컨트롤러 단 {@code @CrossOrigin} 은 두지 않는다. 팝업 takedown
 * 은 신고 이력을 남긴 뒤 admin 검증을 거쳐 차단한다. 이메일만으로 공개 페이지를 즉시 내릴 수 없게 한다.
 *
 * <p><b>응답은 엔티티가 아니라 공개용 DTO 로 나간다.</b> {@link PopupPublicListDto} / {@link PopupPublicDetailDto} 가
 * 필드 화이트리스트다 — 수집 원본 URL·검수 메타·제보자 식별자는 무인증으로 나가지 않는다. 각 DTO 의 클래스 주석에 어느 필드를 왜 뺐는지 적어 두었다.
 */
@Slf4j
@RestController
@RequestMapping("/api/popups")
@RequiredArgsConstructor
public class PopupStoreController {

    private static final String REVIEW_STATUS_TAKEDOWN = "TAKEDOWN";
    private static final String STATUS_PENDING = "PENDING";
    private static final String IMAGE_NOTE_PREFIX = "\n\n[제보 이미지] ";

    /**
     * 무인증 공개 목록 전용 캐시 정책 — {@code Cache-Control: max-age=300, public, stale-while-revalidate=3600}.
     *
     * <p>목록은 로그인 여부와 무관하게 모두에게 같은 응답이라 공유 캐시(Vercel CDN·브라우저)에 얹어도 안전하다. 지금까지는 Spring Security 기본
     * 헤더({@code no-cache, no-store})가 붙어 홈 진입 한 번마다 집 VM 까지 왕복했고, 그 상시 부하 때문에 자동수집까지 꺼야 했다. 팝업 데이터는
     * 하루 단위로만 바뀌므로 5분 지연은 사용자가 알아채지 못한다. {@code stale-while-revalidate} 로 만료 직후에도 캐시본을 먼저 주고 뒤에서
     * 갱신해, 백엔드가 잠깐 느려도 홈이 멈추지 않는다.
     *
     * <p><b>회원 전용·개인화 응답에는 절대 붙이지 않는다</b>(위시리스트·마이페이지·스탬프 등). 여기 붙이는 곳은 목록/검색/캘린더뿐이고, 조회수를 증가시키는
     * 상세({@code GET /{id}})와 모든 POST 는 제외한다.
     *
     * <p>Spring Security 의 {@code CacheControlHeadersWriter} 는 Cache-Control 이 이미 있으면 덮어쓰지 않으므로
     * 컨트롤러에서 지정한 값이 그대로 나간다.
     */
    private static final CacheControl PUBLIC_LIST_CACHE =
            CacheControl.maxAge(Duration.ofMinutes(5))
                    .cachePublic()
                    .staleWhileRevalidate(Duration.ofHours(1));

    private final PopupStoreService popupStoreService;
    private final YouTubeService youTubeService;

    @GetMapping
    public ResponseEntity<List<PopupPublicListDto>> getAllPopups(
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_LIST_CACHE)
                .body(toPublicList(popupStoreService.getAllPopups(category)));
    }

    /**
     * 상세. 진입할 때마다 조회수를 1 올리는 부수효과가 있어 캐시 헤더를 붙이지 않는다 — 캐시에 걸리면 조회수가 멈추고, 그 값이 인기 정렬의 기준이라 랭킹 자체가
     * 고장난다.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getPopupById(@PathVariable Long id) {
        PopupStore popup = popupStoreService.getPopupById(id);
        String videoId = youTubeService.searchVideoId(popup.getName());

        Map<String, Object> result = new HashMap<>();
        result.put("data", PopupPublicDetailDto.fromEntity(popup));
        result.put("imageUrl", popup.getImageUrl());
        result.put("videoId", videoId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/trending")
    public ResponseEntity<List<PopupPublicListDto>> getTrendingPopups() {
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_LIST_CACHE)
                .body(toPublicList(popupStoreService.getTrendingPopups()));
    }

    @GetMapping("/search")
    public ResponseEntity<List<PopupPublicListDto>> searchPopups(@RequestParam String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return ResponseEntity.ok().cacheControl(PUBLIC_LIST_CACHE).body(List.of());
        }
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_LIST_CACHE)
                .body(toPublicList(popupStoreService.searchPopups(keyword)));
    }

    /**
     * 캘린더 — 1~2개월치 팝업. 파라미터를 생략하면 오늘 ~ 60일 후.
     *
     * @param from YYYY-MM-DD 시작일 (선택)
     * @param to YYYY-MM-DD 종료일 (선택)
     */
    @GetMapping("/calendar")
    public ResponseEntity<List<CalendarPopupDto>> getCalendar(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_LIST_CACHE)
                .body(popupStoreService.getCalendar(from, to));
    }

    /** 권리자 takedown 요청. 신고를 기록하고 admin 후속 조사로 넘긴다. */
    @PostMapping("/{id}/takedown")
    public ResponseEntity<Map<String, Object>> requestTakedown(
            @PathVariable Long id, @Valid @RequestBody PopupTakedownRequestDto dto) {
        PopupStore popup = popupStoreService.findOrThrow(id);
        applyTakedown(popup, dto);
        popupStoreService.save(popup);

        // 요청자 이메일은 마스킹하고 사유는 로그에 남기지 않는다. 둘 다 이미 DB(takedown 필드)에
        // 저장돼 관리자 화면에서 볼 수 있으므로, 로그에 또 남기면 보존 기간만 길어지고 얻는 게 없다.
        // 사유는 권리 주장 내용이라 제3자·계약 정보가 섞여 들어오기도 한다.
        log.warn(
                "[Takedown] 팝업 id={} name='{}' 요청자={} → 관리자 검증 대기",
                id,
                popup.getName(),
                LogSafe.email(dto.getRequesterEmail()));

        return ResponseEntity.ok(buildTakedownResponse(id));
    }

    /** 사용자 팝업 제보. DTO 화이트리스트로 Mass Assignment 방어. */
    @PostMapping("/report")
    public ResponseEntity<Map<String, Object>> reportPopup(
            @Valid @RequestBody PopupReportRequestDto dto) {
        PopupStore saved = popupStoreService.save(buildReportedPopup(dto));

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", saved.getId());
        resp.put("status", saved.getStatus());
        resp.put("message", "제보 완료. 관리자 승인 후 노출됩니다.");
        return ResponseEntity.ok(resp);
    }

    /* ============================== 내부 헬퍼 ============================== */

    /**
     * 엔티티 목록 → 공개용 DTO 목록. 목록 계열 세 경로가 같은 화이트리스트를 쓰게 한 곳에 모은다 — 한 곳만 엔티티를 그대로 흘리면 차단이 무의미해진다.
     *
     * <p>lazy 필드({@code images}) 접근은 목록 쿼리가 모두 {@code @EntityGraph} 로 fetch 하므로 여기서 N+1 이 새로 생기지
     * 않는다(엔티티를 직렬화하던 기존 동작과 같은 접근이다).
     */
    private List<PopupPublicListDto> toPublicList(List<PopupStore> popups) {
        return popups.stream().map(PopupPublicListDto::fromEntity).toList();
    }

    private void applyTakedown(PopupStore popup, PopupTakedownRequestDto dto) {
        if (popup.getTakedownRequestedAt() != null
                || REVIEW_STATUS_TAKEDOWN.equals(popup.getReviewStatus())) {
            // 이미 접수됐거나 관리자가 임시 차단한 건이면 최초 신고 기록(시각·사유·신고자)을 그대로 보존한다.
            // 재신고마다 시각을 갱신하면 SLA cutoff 가 계속 뒤로 밀려 admin 알림이 울리지 않고,
            // 주기적으로 재신고하는 것만으로 검토 기한을 무한히 미룰 수 있다.
            return;
        }
        popup.setTakedownRequestedAt(LocalDateTime.now());
        popup.setTakedownReason(dto.getReason());
        popup.setTakedownRequester(dto.getRequesterEmail());
    }

    private Map<String, Object> buildTakedownResponse(Long id) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "PENDING_REVIEW");
        resp.put("message", "신고가 접수되었습니다. 권리 관계 확인 후 24시간 내 조치합니다.");
        resp.put("popupId", id);
        return resp;
    }

    /** 제보 단계에서는 imageUrl 필드가 없어 description 끝에 메모로 남긴다. 정식 등록은 관리자가 PopupImage 를 통해 추가한다. */
    private PopupStore buildReportedPopup(PopupReportRequestDto dto) {
        String description = appendImageNote(dto.getDescription(), dto.getImageUrl());
        PopupStore popup =
                PopupStore.builder()
                        .name(dto.getName())
                        .location(dto.getLocation())
                        .category(dto.getCategory())
                        .description(description)
                        .startDate(dto.getStartDate())
                        .endDate(dto.getEndDate())
                        .build();
        popup.setStatus(STATUS_PENDING);
        popup.setViewCount(0);
        return popup;
    }

    private String appendImageNote(String description, String imageUrl) {
        String base = description == null ? "" : description;
        if (imageUrl != null && !imageUrl.isBlank()) {
            return base + IMAGE_NOTE_PREFIX + imageUrl;
        }
        return base;
    }
}
