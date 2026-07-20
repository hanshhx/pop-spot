// 패키지명이 media 인 이유: popspot-backend/.gitignore 의 `upload/` 규칙이 앵커 없이 선언돼 있어
// 어느 깊이의 `upload` 디렉터리든 매칭한다. service/upload 로 두면 소스가 통째로 git 에서 무시된다.
package com.example.popspotbackend.service.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * 업로드 이미지의 실체 검증 + 정규화.
 *
 * <p>기존 검증은 <b>확장자</b>와 <b>클라이언트가 보낸 Content-Type</b> 만 봤다. 둘 다 공격자가 마음대로 정하는 값이라, 아무 바이너리든 {@code
 * .jpg} 로 이름 붙이고 {@code Content-Type: image/jpeg} 만 맞추면 그대로 디스크에 저장됐다.
 *
 * <p>여기서는 파일 <b>내용</b>을 기준으로 판단한다:
 *
 * <ol>
 *   <li><b>매직바이트</b> — 선두 바이트로 실제 포맷을 알아내고, 사용자가 준 확장자와 일치하는지 본다.
 *   <li><b>디코드 검증</b> — {@link ImageIO} 로 실제로 열리는지 확인한다. 헤더만 이미지인 척하는 polyglot 이 걸러진다.
 *   <li><b>재인코딩</b> — JPEG/PNG 는 픽셀만 남기고 다시 쓴다. EXIF(GPS 좌표 등 위치정보)와 이미지 데이터 뒤에 숨겨둔 payload 가 함께
 *       사라진다.
 * </ol>
 *
 * <p>WebP 는 JDK 기본 ImageIO 에 리더가 없어 디코드·재인코딩을 못 한다. 시그니처 검사까지만 하고 통과시키되, 응답에 {@code
 * X-Content-Type-Options: nosniff} 가 붙어 있어(WebConfig) 브라우저가 다른 타입으로 해석하지는 않는다.
 *
 * <p>GIF 는 디코드 검증만 한다. 재인코딩하면 애니메이션이 첫 프레임으로 뭉개진다.
 */
@Slf4j
@Component
public class ImageUploadGuard {

    /** 판별된 실제 이미지 종류. */
    public enum Kind {
        JPEG("jpg", "jpeg"),
        PNG("png"),
        GIF("gif"),
        WEBP("webp");

        private final String[] extensions;

        Kind(String... extensions) {
            this.extensions = extensions;
        }

        boolean allows(String ext) {
            for (String e : extensions) {
                if (e.equals(ext)) return true;
            }
            return false;
        }

        /** 재인코딩 후 저장할 확장자. JPEG 는 jpg 로 통일한다. */
        String canonicalExtension() {
            return extensions[0];
        }
    }

    /**
     * 검사 결과.
     *
     * <p>{@link #rejection} 이 null 이 아니면 거부 사유이고, null 이면 {@link #bytes} 를 저장하면 된다. 재인코딩된 경우 {@code
     * bytes} 는 원본이 아니라 새로 만든 바이트다.
     */
    public record Inspection(String rejection, byte[] bytes, String extension) {

        public boolean rejected() {
            return rejection != null;
        }

        static Inspection reject(String message) {
            return new Inspection(message, null, null);
        }

        static Inspection accept(byte[] bytes, String extension) {
            return new Inspection(null, bytes, extension);
        }
    }

    private static final int SIGNATURE_PROBE_BYTES = 12;

    /**
     * 디코드를 허용할 최대 픽셀 수(4천만 = 대략 8000×5000).
     *
     * <p>파일 크기가 아니라 <b>펼쳤을 때의 픽셀 수</b>로 재야 디코드 폭탄을 막을 수 있다.
     */
    private static final long MAX_PIXELS = 40_000_000L;

    /** 재인코딩 JPEG 품질. 기본값 0.75 는 정상 사진도 눈에 띄게 뭉갠다. */
    private static final float JPEG_QUALITY = 0.92f;

    /**
     * 업로드 파일이 진짜 이미지인지 확인하고, 가능하면 안전한 바이트로 다시 만든다.
     *
     * @param file 업로드된 파일
     * @param claimedExtension 파일명에서 뽑아낸 확장자(소문자)
     * @return 거부 사유 또는 저장할 바이트
     */
    public Inspection inspect(MultipartFile file, String claimedExtension) {
        byte[] raw;
        try {
            raw = file.getBytes();
        } catch (IOException e) {
            log.warn("[ImageUploadGuard] 업로드 스트림 읽기 실패: {}", e.getClass().getSimpleName());
            return Inspection.reject("파일을 읽을 수 없습니다.");
        }

        Kind kind = detectKind(raw);
        if (kind == null) {
            log.warn("[ImageUploadGuard] 시그니처 불일치 — 이미지가 아닌 파일 업로드 시도");
            return Inspection.reject("이미지 파일이 아닙니다. (jpg/png/gif/webp 만 가능)");
        }
        if (!kind.allows(claimedExtension)) {
            log.warn("[ImageUploadGuard] 확장자 위장 감지: 확장자={} 실제={}", claimedExtension, kind);
            return Inspection.reject("파일 내용과 확장자가 일치하지 않습니다.");
        }

        // WebP 는 JDK 리더가 없어 디코드 자체가 불가능하다. 시그니처만 믿고 원본을 저장한다.
        if (kind == Kind.WEBP) {
            return Inspection.accept(raw, kind.canonicalExtension());
        }

        BufferedImage decoded = decodeWithPixelCap(raw);
        if (decoded == null) {
            return Inspection.reject("이미지를 열 수 없거나 해상도가 너무 큽니다.");
        }

        // GIF 는 재인코딩하면 애니메이션이 깨진다. 디코드로 실체는 확인했으므로 원본을 저장한다.
        if (kind == Kind.GIF) {
            return Inspection.accept(raw, kind.canonicalExtension());
        }

        byte[] reencoded = reencode(decoded, kind);
        if (reencoded == null) {
            // 크기를 이유로 원본으로 폴백하면 안 된다. 공격자가 일부러 재압축이 커지는 이미지
            // (고노이즈·저품질 JPEG)를 올려 폴백을 발동시키면 EXIF 와 트레일러 payload 가 그대로 살아남아
            // 이 클래스의 방어가 통째로 꺼진다. 재인코딩이 안 되면 저장하지 않는다.
            return Inspection.reject("이미지를 처리할 수 없습니다.");
        }
        return Inspection.accept(reencoded, kind.canonicalExtension());
    }

    /**
     * 래스터를 할당하기 <b>전에</b> 헤더로 해상도를 재고, 상한을 넘으면 디코드하지 않는다.
     *
     * <p>압축 후 크기 제한(10MB)은 디코드 폭탄을 못 막는다. 단색 PNG 30000×30000 은 파일로는 수백 KB 지만 {@code BufferedImage}
     * 로 펼치면 픽셀당 4바이트라 3.6GB 를 요구한다. 이때 나는 {@link OutOfMemoryError} 는 {@code Error} 라 {@code catch
     * (RuntimeException)} 에 걸리지 않고, 힙 고갈이 JVM 전체로 번져 무관한 다른 요청까지 죽인다. 기존 {@code transferTo} 는 힙을 거의
     * 안 썼으므로 상한 없는 디코드는 명백한 회귀다.
     *
     * @return 디코드된 이미지, 또는 열 수 없거나 해상도 상한을 넘으면 null
     */
    private BufferedImage decodeWithPixelCap(byte[] raw) {
        try (ImageInputStream input =
                ImageIO.createImageInputStream(new ByteArrayInputStream(raw))) {
            if (input == null) return null;
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                log.warn("[ImageUploadGuard] 사용 가능한 디코더 없음");
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                long width = reader.getWidth(0);
                long height = reader.getHeight(0);
                if (width * height > MAX_PIXELS) {
                    log.warn("[ImageUploadGuard] 해상도 폭탄 차단 {}x{}", width, height);
                    return null;
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            // 손상된 이미지는 ImageIO 가 RuntimeException 을 던지기도 한다.
            log.warn("[ImageUploadGuard] 디코드 실패: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    /**
     * 픽셀만 다시 써서 EXIF·트레일러 payload 를 제거한다.
     *
     * <p>JPEG 는 알파 채널을 지원하지 않아 투명 PNG 를 그대로 넘기면 깨진다. 여기서는 원본이 JPEG 일 때만 JPEG 로 쓰므로 문제가 없지만, 방어적으로
     * 알파가 있으면 RGB 로 평탄화한다.
     */
    private byte[] reencode(BufferedImage image, Kind kind) {
        try {
            if (kind != Kind.JPEG) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                return ImageIO.write(image, "png", out) ? out.toByteArray() : null;
            }
            BufferedImage target = image;
            if (image.getColorModel().hasAlpha()) {
                target =
                        new BufferedImage(
                                image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
                target.getGraphics().drawImage(image, 0, 0, null);
            }
            return writeJpeg(target);
        } catch (IOException | RuntimeException e) {
            log.warn("[ImageUploadGuard] 재인코딩 실패: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    /**
     * 품질을 명시해 JPEG 로 쓴다.
     *
     * <p>{@code ImageIO.write(..., "jpg", ...)} 는 품질 0.75 고정이라 정상 사용자의 사진도 매번 눈에 띄게 재압축된다. 명시적으로 높여
     * 화질 손실을 줄인다.
     */
    private byte[] writeJpeg(BufferedImage image) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(JPEG_QUALITY);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }

    /** 선두 바이트로 실제 포맷 판별. 모르는 포맷이면 null. */
    private Kind detectKind(byte[] b) {
        if (b == null || b.length < SIGNATURE_PROBE_BYTES) return null;

        // JPEG: FF D8 FF
        if (u(b[0]) == 0xFF && u(b[1]) == 0xD8 && u(b[2]) == 0xFF) return Kind.JPEG;

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (u(b[0]) == 0x89
                && u(b[1]) == 0x50
                && u(b[2]) == 0x4E
                && u(b[3]) == 0x47
                && u(b[4]) == 0x0D
                && u(b[5]) == 0x0A
                && u(b[6]) == 0x1A
                && u(b[7]) == 0x0A) {
            return Kind.PNG;
        }

        // GIF: "GIF87a" 또는 "GIF89a"
        if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8' && b[5] == 'a') {
            return Kind.GIF;
        }

        // WebP: "RIFF" .... "WEBP"
        if (b[0] == 'R'
                && b[1] == 'I'
                && b[2] == 'F'
                && b[3] == 'F'
                && b[8] == 'W'
                && b[9] == 'E'
                && b[10] == 'B'
                && b[11] == 'P') {
            return Kind.WEBP;
        }
        return null;
    }

    /** byte 는 부호 있는 타입이라 0xFF 비교 전에 언사인드로 승격한다. */
    private int u(byte value) {
        return value & 0xFF;
    }
}
