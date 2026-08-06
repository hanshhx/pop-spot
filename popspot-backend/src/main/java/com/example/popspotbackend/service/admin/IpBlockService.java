package com.example.popspotbackend.service.admin;

import com.example.popspotbackend.config.ClientIpResolver.ClientIp;
import com.example.popspotbackend.dto.IpBlockDto;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * D-2 — 특정 IP 를 <b>한시적으로</b> 막는다.
 *
 * <p><b>수동으로 걸고 자동으로 풀린다.</b> 자동으로 걸지 않는 이유는 D-1 을 알림이 아니라 현황판으로 만든 것과 같다 — 임계값을 정하려면 "평소" 를 알아야
 * 하는데 그 기준선이 아직 없다. 게다가 차단은 되돌리기 어려운 쪽이라, 기준 없이 자동으로 거는 것은 <b>공격자에게 정지 버튼을 쥐여 주는</b> 일이 될 수 있다. 사람이
 * 보고 걸고, 시간이 지나면 저절로 풀린다.
 *
 * <p><b>저장은 Redis 다.</b> "자동 해제" 를 우리가 구현하지 않기 위해서다 — 만료를 직접 관리하면 청소가 밀렸을 때 임시 차단이 조용히 영구 차단이 된다.
 * TTL 을 저장소에 맡기면 그 실패 방식이 아예 없어진다. 덤으로 앱을 재시작해도 차단이 유지된다.
 *
 * <p><b>안전장치는 전부 조회 앞에 둔다.</b> 뒤에 두면 저장 방식을 바꾸는 사람이 지나칠 수 있는데, 이 기능은 지나쳤을 때의 대가가 "관리자가 자기 도구에서 잠김 +
 * 전 사용자 업로드 정지" 다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IpBlockService {

    /** 아무리 짧게 걸어도 이만큼. Redis 에서 TTL 0 은 "만료 없음" 이라 0 을 그대로 넘기면 영구가 된다. */
    public static final Duration MIN_BLOCK = Duration.ofMinutes(1);

    /**
     * 아무리 길게 걸어도 이만큼.
     *
     * <p>"임시" 라고 부르는 것이 실수 한 번으로 영구가 되면 안 된다. 하루면 사람이 다시 판단할 기회가 반드시 한 번은 온다 — 더 필요하면 그때 다시 걸면 된다.
     */
    public static final Duration MAX_BLOCK = Duration.ofHours(24);

    static final String KEY_PREFIX = "SECURITY_IPBLOCK:";

    /** 한 번에 훑을 최대 건수. 목록이 이보다 길어질 일은 사실상 없고, 있다면 그것부터 봐야 한다. */
    private static final int LIST_LIMIT = 200;

    /** 사유는 화면에 한 줄로 보여 준다. 길거나 줄바꿈이 섞이면 목록이 무너진다. */
    private static final int REASON_MAX = 200;

    private static final int MAX_IP_LENGTH = 45;

    private static final Pattern IPV4 = Pattern.compile("\\d{1,3}(\\.\\d{1,3}){3}");

    private static final Pattern IPV6_CHARS = Pattern.compile("[0-9a-fA-F:]{2,}");

    private final StringRedisTemplate redis;

    /**
     * 이 요청을 막아야 하는가.
     *
     * <p><b>증명되지 않은 값이면 저장소를 보기도 전에 빠져나온다.</b> 서명 없는 경로는 전원이 Funnel 내부 주소 하나로 보이기 때문에, 그 값으로 차단이
     * 성립하면 <b>한 사람이 아니라 전부가</b> 막힌다 — 프로필 사진·채팅 이미지 업로드가 죽고, 사진 백필·중복 정리·로그 스트림도 그 경로라 관리자가 자기 도구에서
     * 잠긴다. 게다가 Funnel 주소는 아무나 직접 때려서 만들 수 있다.
     */
    public boolean isBlocked(ClientIp ip) {
        if (ip == null || !ip.verified()) return false;

        try {
            return Boolean.TRUE.equals(redis.hasKey(KEY_PREFIX + ip.value()));
        } catch (RuntimeException e) {
            // 저장소가 잠깐 안 되는 것과 사이트가 멈추는 것을 맞바꿀 수 없다. 차단은 부가 기능이다.
            log.warn("[IpBlock] 차단 목록 조회 실패 — 통과시킨다: {}", e.toString());
            return false;
        }
    }

    /**
     * 막아도 <b>효과가 있는</b> 주소인가.
     *
     * <p>내부 주소를 거절하는 것은 형식 검사가 아니라 <b>거짓 안심을 막는 일</b>이다. 위 {@link #isBlocked} 가 증명된 IP 만 보므로 내부 주소는
     * 걸어 봐야 아무 일도 일어나지 않는데, 목록에는 멀쩡히 남아 관리자는 막았다고 믿게 된다.
     *
     * <p>이름(호스트명)도 거절한다. 받아서 풀면 우리 서버가 관리자가 적어 넣은 임의 도메인을 DNS 조회하게 된다. 그래서 <b>리터럴인지 먼저 확인한 뒤에만</b>
     * 파싱한다.
     */
    static boolean isBlockable(String ip) {
        if (ip == null) return false;
        String value = ip.trim();
        if (value.isEmpty() || value.length() > MAX_IP_LENGTH) return false;

        if (IPV4.matcher(value).matches()) {
            for (String octet : value.split("\\.")) {
                // 255 를 넘으면 IPv4 가 아니다. 여기서 걸러야 아래 파싱이 이름으로 착각하지 않는다.
                if (Integer.parseInt(octet) > 255) return false;
            }
        } else if (value.indexOf(':') < 0 || !IPV6_CHARS.matcher(value).matches()) {
            return false;
        }

        try {
            InetAddress address = InetAddress.getByName(value);
            return !(address.isLoopbackAddress()
                    || address.isSiteLocalAddress()
                    || address.isAnyLocalAddress()
                    || address.isLinkLocalAddress()
                    || address.isMulticastAddress());
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /**
     * 이 사람이 그 주소를 막아도 <b>스스로 잠기지 않는가</b>.
     *
     * <p>요청자 위치가 증명되지 않으면 거절한다. 그때 값은 Funnel 내부 주소라 "나인지 아닌지" 를 비교할 방법이 자체가 없기 때문이다 — 모르는 채로 되돌리기
     * 어려운 일을 하지 않는다.
     *
     * <p>관리자 API 는 Vercel 을 거치므로 정상 상황에서는 늘 증명된다. 증명되지 않았다면 그 자체가 무언가 어긋났다는 신호이고, 그런 상태에서 차단을 거는 것은
     * 더 위험하다.
     */
    static boolean canBlockSafely(ClientIp requester, String target) {
        if (requester == null || !requester.verified()) return false;
        return !requester.value().equals(target == null ? null : target.trim());
    }

    /** 기간을 [{@link #MIN_BLOCK}, {@link #MAX_BLOCK}] 안으로 접는다. */
    static Duration clampTtl(Duration requested) {
        if (requested == null || requested.compareTo(MIN_BLOCK) < 0) return MIN_BLOCK;
        return requested.compareTo(MAX_BLOCK) > 0 ? MAX_BLOCK : requested;
    }

    /** 차단을 거절한 이유. 화면이 <b>무엇을 고쳐야 하는지</b> 말해 줄 수 있어야 한다. */
    public enum Refusal {
        /** 공인 IP 가 아니다 — 걸어도 아무 일도 일어나지 않는다. */
        NOT_BLOCKABLE,
        /** 요청자 접속 경로를 증명할 수 없다 — 본인인지 확인할 방법이 없다. */
        ORIGIN_UNPROVEN,
        /** 지금 접속 중인 바로 그 주소다. */
        SELF_BLOCK
    }

    /**
     * 차단 시도 결과.
     *
     * @param refusal 거절 사유. {@code null} 이면 성공
     * @param appliedMinutes 실제로 적용된 분. 요청한 값과 다를 수 있어 화면은 <b>이 값</b>을 보여 준다
     */
    public record BlockOutcome(Refusal refusal, long appliedMinutes) {
        public boolean ok() {
            return refusal == null;
        }
    }

    /**
     * 차단한다.
     *
     * <p><b>안전장치를 여기 둔다.</b> 부르는 쪽에 맡기면 다음 호출자가 하나를 빠뜨리는데, 이 기능은 빠뜨렸을 때의 대가가 "관리자가 자기 도구에서 잠김" 이다.
     * 세 검사가 전부 저장 앞에 있으므로 거절된 요청은 저장소를 건드리지도 않는다.
     */
    public BlockOutcome block(
            String ip, Duration requested, String reason, ClientIp requester, String actorId) {

        if (!isBlockable(ip)) return new BlockOutcome(Refusal.NOT_BLOCKABLE, 0);
        if (requester == null || !requester.verified()) {
            return new BlockOutcome(Refusal.ORIGIN_UNPROVEN, 0);
        }
        if (!canBlockSafely(requester, ip)) return new BlockOutcome(Refusal.SELF_BLOCK, 0);

        Duration ttl = clampTtl(requested);
        String note = oneLine(reason);

        redis.opsForValue()
                .set(
                        KEY_PREFIX + ip.trim(),
                        actorId + "\n" + LocalDateTime.now() + "\n" + note,
                        ttl);
        log.warn("[IpBlock] 차단 — {} · {}분 · {} 가 검 (사유: {})", ip, ttl.toMinutes(), actorId, note);
        return new BlockOutcome(null, ttl.toMinutes());
    }

    /** 푼다. 이미 만료됐으면 {@code false}. */
    public boolean unblock(String ip, String actorId) {
        boolean removed = Boolean.TRUE.equals(redis.delete(KEY_PREFIX + ip.trim()));
        if (removed) log.info("[IpBlock] 해제 — {} · {} 가 품", ip, actorId);
        return removed;
    }

    /**
     * 지금 걸려 있는 것들.
     *
     * <p>IP 를 가리지 않는다. D-1 현황판은 "낯선 곳인가" 만 답하면 되니 가렸지만, 여기서는 <b>관리자가 자기가 건 것을 풀 수 있어야</b> 하므로 온전한
     * 값이 필요하다. 애초에 관리자가 직접 적어 넣은 값이기도 하다.
     *
     * <p>{@code KEYS} 가 아니라 {@code SCAN} 을 쓴다 — {@code KEYS} 는 그동안 Redis 를 통째로 멈추는데, 이 저장소에는 로그인
     * 세션도 같이 들어 있다.
     */
    public List<IpBlockDto> list() {
        List<IpBlockDto> blocks = new ArrayList<>();

        try (Cursor<String> cursor =
                redis.scan(ScanOptions.scanOptions().match(KEY_PREFIX + "*").count(100).build())) {

            while (cursor.hasNext() && blocks.size() < LIST_LIMIT) {
                String key = cursor.next();
                Long remaining = redis.getExpire(key, TimeUnit.SECONDS);

                // 훑는 도중에 만료된 것 — 목록에 넣으면 풀 수 없는 줄이 남는다.
                if (remaining == null || remaining <= 0) continue;

                blocks.add(
                        toDto(
                                key.substring(KEY_PREFIX.length()),
                                redis.opsForValue().get(key),
                                remaining));
            }
        } catch (RuntimeException e) {
            log.warn("[IpBlock] 차단 목록 조회 실패: {}", e.toString());
        }
        return blocks;
    }

    private static IpBlockDto toDto(String ip, String stored, long remainingSeconds) {
        String[] parts = stored == null ? new String[0] : stored.split("\n", 3);
        return new IpBlockDto(
                ip,
                parts.length > 2 ? parts[2] : "",
                parts.length > 0 ? parts[0] : "",
                parts.length > 1 ? parts[1] : "",
                remainingSeconds);
    }

    /** 줄바꿈은 저장 구분자라 사유에 섞이면 값이 쪼개진다. 길이도 함께 자른다. */
    private static String oneLine(String reason) {
        if (reason == null) return "";
        String flat = reason.replaceAll("\\s+", " ").trim();
        return flat.length() <= REASON_MAX ? flat : flat.substring(0, REASON_MAX);
    }
}
