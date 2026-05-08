package com.example.popspotbackend.service.music;

/**
 * @deprecated 검색 자동완성(/api/music/suggest) 도입으로 검색어 정규화가 더 이상 필요 없다.
 *             사용자가 자동완성 후보를 클릭하면 정확한 형태의 검색어가 들어오므로
 *             AI 가 추측하는 과정을 제거했다. 호환을 위해 빈 클래스만 남겨둔다.
 */
@Deprecated
public final class MusicQueryNormalizationService {
    private MusicQueryNormalizationService() { /* no instantiation */ }
}
