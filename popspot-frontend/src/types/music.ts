/**
 * 음악 → 팝업 매칭 기능 타입.
 *
 * <p>{@link MusicTrack} 의 {@code itunesTrackId} 는 레거시 호환 필드명 — 실제로는 Spotify trackId 가
 * 들어간다 (v1.3 에서 Spotify 로 마이그레이션됨). DB 컬럼명 변경 없이 의미만 바뀐 케이스.
 */

export interface MusicTrack {
  id: number;
  /** 레거시 itunes_track_id 컬럼 — 대부분 null (v1.3 Spotify 마이그레이션 이후). */
  itunesTrackId?: string;
  /**
   * v2.21-S13 — 실제 Spotify trackId. 검색으로 들어온 트랙은 이 필드에 채워진다.
   * Web Playback SDK 가 `spotify:track:${spotifyTrackId}` 로 재생.
   */
  spotifyTrackId?: string;
  artistName: string;
  trackName: string;
  albumName?: string;
  /** 앨범 커버 100×100. */
  artworkUrl?: string;
  /** 앨범 커버 1000×1000 (고해상도). */
  artworkUrlHires?: string;
  previewUrl?: string;
  youtubeVideoId?: string;
  youtubeChannel?: string;
  isOfficial?: boolean;
  /** JSON 문자열 형태의 무드 태그 배열 — 클라이언트에서 `JSON.parse` 필요. */
  moodTags?: string;
  durationMs?: number;
  playCount?: number;
}

export interface PopupMatch {
  popupId: number;
  name: string;
  location?: string;
  category?: string;
  imageUrl?: string;
  /** 0 ~ 100 점수 (높을수록 매칭도 높음). */
  score: number;
}

export interface MatchResult {
  track: MusicTrack;
  moodTags: string[];
  popups: PopupMatch[];
}

export interface UserMusicHistory {
  id: number;
  userId: string;
  trackId: number;
  /** ISO 8601 타임스탬프. */
  playedAt: string;
  matchedPopupId?: number;
}
