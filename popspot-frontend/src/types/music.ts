// 음악 → 팝업 매칭 기능 타입

export interface MusicTrack {
  id: number;
  itunesTrackId: string;
  artistName: string;
  trackName: string;
  albumName?: string;
  artworkUrl?: string;        // 100x100
  artworkUrlHires?: string;   // 1000x1000
  previewUrl?: string;
  youtubeVideoId?: string;
  youtubeChannel?: string;
  isOfficial?: boolean;
  moodTags?: string;          // JSON 배열 문자열
  durationMs?: number;
  playCount?: number;
}

export interface PopupMatch {
  popupId: number;
  name: string;
  location?: string;
  category?: string;
  imageUrl?: string;
  score: number;              // 0~100
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
  playedAt: string;
  matchedPopupId?: number;
}
