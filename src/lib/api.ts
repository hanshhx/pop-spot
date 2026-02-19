// src/lib/api.ts

// ==============================================================================
// 1. 환경 변수 설정 (주소 관리)
// ==============================================================================

// 백엔드 API 주소 (REST API용)
// 배포 시 .env.local 또는 Vercel 설정에 있는 NEXT_PUBLIC_API_URL을 사용
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// 🔥 [추가] 웹소켓 주소 (ChatRoom, PlanningPage용)
// 배포 환경과 로컬 환경을 구분하기 위해 환경 변수에서 가져옵니다.
export const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8080";


// ==============================================================================
// 2. API 호출 유틸리티 (apiFetch)
// ==============================================================================

/**
 * 강화된 fetch 래퍼 함수
 * 기능 1: 'http'로 시작하지 않는 경로는 자동으로 백엔드 주소(API_BASE_URL)를 붙여줍니다.
 * 기능 2: localStorage에 로그인 토큰이 있으면 자동으로 'Authorization' 헤더에 추가합니다.
 * 기능 3: 기본적으로 'Content-Type: application/json'을 설정해줍니다. (파일 업로드 제외)
 */
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  
  // [주소 처리] http로 시작하면 그대로 쓰고, 아니면 앞에 기본 주소를 붙임
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  // [토큰 처리] 클라이언트 환경(브라우저)인 경우에만 토큰을 가져옴
  const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;

  // [헤더 처리] 기본 헤더 설정
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // 토큰이 있다면 Bearer 토큰 추가
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  // 사용자가 따로 넘겨준 헤더가 있다면 합침 (사용자 설정이 우선)
  const headers = { ...defaultHeaders, ...(options.headers as Record<string, string>) };

  // 🔥 [예외 처리] 만약 파일 업로드(FormData)라면 Content-Type을 지워야 브라우저가 알아서 설정함
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  // 디버깅용 로그 (배포 후에는 너무 많이 뜨면 주석 처리 가능)
  console.log(`📡 [API 요청] ${url}`);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    // 공통 에러 처리
    if (!res.ok) {
      console.error(`❌ API Error (${res.status}): ${url}`);
      // 필요하다면 여기서 401(토큰 만료) 시 자동 로그아웃 로직 등을 넣을 수 있음
    }

    return res;
  } catch (error) {
    console.error(`🚨 Network Error: ${url}`, error);
    throw error;
  }
};