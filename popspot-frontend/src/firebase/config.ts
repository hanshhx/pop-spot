// src/firebase/config.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // Firebase 콘솔 -> 프로젝트 설정 -> 일반 -> "SDK 설정 및 구성"에서 복사한 내용
  apiKey: "AIzaSyCuqMlvdJXVpU51_aIQrtJrZh0GHyW2Qq4",
  authDomain: "popup-6ef4a.firebaseapp.com",
  projectId: "popup-6ef4a",
  storageBucket: "popup-6ef4a.firebasestorage.app",
  messagingSenderId: "829077828721",
  appId: "1:829077828721:web:9b6c9d86f84ac75a7917d0"
};

// Next.js에서 중복 초기화 방지
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);