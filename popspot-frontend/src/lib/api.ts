// [로직] 배포 환경에서는 환경변수를 쓰고, 로컬에서는 8080을 쓰도록 유연하게 대처합니다.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * [구조 해석] apiFetch 유틸리티
 * 1. 상대 경로만 넣어도 자동으로 도메인을 붙여줍니다.
 * 2. 로컬스토리지의 토큰을 자동으로 헤더에 심어줍니다.
 * 3. 크로스 도메인 환경에서 인증 정보를 포함하도록 설정합니다.
 */
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  // 1. URL 구성
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  // 2. 토큰 획득 (SSR 환경 고려)
  const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
  
  // 3. 기본 헤더 설정
  const defaultHeaders: Record<string, string> = { 
    "Content-Type": "application/json" 
  };

  // 4. [핵심] 토큰이 있다면 Authorization 헤더에 Bearer 방식으로 추가
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  // 5. 헤더 병합 (options에서 추가로 들어온 헤더가 있으면 덮어씌움)
  const headers = { ...defaultHeaders, ...(options.headers as Record<string, string>) };
  
  // 6. FormData 전송 시 Content-Type 자동 설정을 위해 삭제
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  console.log(`📡 [API 요청] ${url}`);
  
  try {
    const res = await fetch(url, { 
      ...options, 
      headers,
      // 🔥 [핵심 추가] 도메인이 달라도(co.kr ↔ duckdns.org) 인증 정보와 헤더가 유실되지 않게 함
      credentials: "include" 
    });

    if (!res.ok) {
      // 401, 403 에러 등의 상태를 확인하기 위해 로그 출력
      console.error(`❌ API Error (${res.status}): ${url}`);
    }
    
    return res;
  } catch (error) {
    console.error(`🚨 Network Error: ${url}`, error);
    throw error;
  }
};