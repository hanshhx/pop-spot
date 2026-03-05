// [로직] 배포 환경에서는 환경변수를 쓰고, 로컬에서는 8080을 쓰도록 유연하게 대처합니다.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * [구조 해석] apiFetch 유틸리티
 * 1. 상대 경로만 넣어도 자동으로 도메인을 붙여줍니다.
 * 2. 로컬스토리지의 토큰을 자동으로 헤더에 심어줍니다.
 */
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
  const defaultHeaders: Record<string, string> = { "Content-Type": "application/json" };

  if (token) defaultHeaders["Authorization"] = `Bearer ${token}`;
  const headers = { ...defaultHeaders, ...(options.headers as Record<string, string>) };
  if (options.body instanceof FormData) delete headers["Content-Type"];

  console.log(`📡 [API 요청] ${url}`);
  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) console.error(`❌ API Error (${res.status}): ${url}`);
    return res;
  } catch (error) {
    console.error(`🚨 Network Error: ${url}`, error);
    throw error;
  }
};