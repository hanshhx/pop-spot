"use client";

import { useEffect, useState } from "react";
import { Crown, Megaphone, Check, ArrowLeft } from "lucide-react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
// 🔥 [수정] API 헬퍼 함수 import (경로는 본인 프로젝트에 맞게 확인해주세요)
import { apiFetch } from "../../src/lib/api";
import { notify, notifyError } from "@/lib/notify";

declare global {
  interface Window {
    IMP: any;
  }
}

interface Goods {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
}

export default function ShopPage() {
  const [items, setItems] = useState<Goods[]>([]);
  // user 상태에 백엔드 DTO 필드(isPremium, megaphoneCount)가 포함됩니다.
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // 1. 유저 정보 및 상품 목록 로드
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
        setUser(JSON.parse(storedUser));
    }

    // 백엔드 GoodsController의 /api/goods/random 호출
    apiFetch("/api/goods/random")
        .then(res => res.json())
        .then(data => setItems(data))
        .catch(err => console.error("상품 로드 실패:", err));
  }, []);

  // 2. 결제 핸들러
  const handlePayment = (item: Goods) => {
    if (!user) return notify("로그인이 필요합니다.");

    if (!window.IMP) return;
    const { IMP } = window;
    
    // 🔥 [수정] 하드코딩된 가맹점 식별코드를 환경변수로 교체했습니다.
    IMP.init(process.env.NEXT_PUBLIC_IAMPORT_MERCHANT_CODE); 

    const data = {
      pg: "kakaopay", // 카카오페이 테스트 모드 (실제 출금 X)
      pay_method: "card",
      merchant_uid: `mid_${new Date().getTime()}`,
      name: item.name,
      amount: 100, // 테스트용 100원 (백엔드 OrderService에서 100원인지 검증함)
      buyer_email: user.email,
      buyer_name: user.nickname,
      buyer_tel: "010-1234-5678",
    };

    // 3. 결제 창 호출
    IMP.request_pay(data, async (rsp: any) => {
      if (rsp.success) {
        try {
            // 4. 백엔드 OrderController로 검증 요청
            // OrderDto 구조에 맞춰 데이터 전송
            const res = await apiFetch("/api/orders/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.userId,
                    impUid: rsp.imp_uid,
                    merchantUid: rsp.merchant_uid,
                    goodsId: item.id,
                    goodsName: item.name, // 백엔드가 이 이름으로 PASS/확성기 구분함
                    amount: 100 // 백엔드 Goods 가격과 일치해야 함
                })
            });

            if (res.ok) {
                // 🔥 [핵심 로직] 결제 성공 시 클라이언트 정보 즉시 업데이트!
                // 백엔드는 이미 DB를 업데이트했으니, 프론트의 localStorage도 맞춰줍니다.
                const updatedUser = { ...user };
                let alertMsg = "아이템 지급이 완료되었습니다.";

                // (1) 멤버십 구매 시: isPremium = true
                if (item.name.toUpperCase().includes("PASS") || item.name.includes("멤버십")) {
                    updatedUser.isPremium = true;
                    alertMsg = "👑 POP-PASS 멤버십이 적용되었습니다!";
                } 
                // (2) 확성기 구매 시: megaphoneCount + 1
                else if (item.name.toUpperCase().includes("MEGAPHONE") || item.name.includes("확성기")) {
                    updatedUser.megaphoneCount = (updatedUser.megaphoneCount || 0) + 1;
                    alertMsg = "📢 확성기가 지급되었습니다!";
                }

                // (3) 변경된 유저 정보를 저장 (새로고침해도 유지되도록)
                localStorage.setItem("user", JSON.stringify(updatedUser));
                setUser(updatedUser);

                notify(`✅ [결제 성공] ${alertMsg}`);
                
                // (4) 페이지 새로고침 (상태 반영 보장)
                window.location.reload(); 
            } else {
                const errorMsg = await res.text();
                notifyError(`DB 반영 실패: ${errorMsg}`);
            }
        } catch(e) {
            console.error(e);
            notifyError("서버 통신 중 오류가 발생했습니다.");
        }
      } else {
        notifyError(`결제 취소/실패: ${rsp.error_msg}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6 relative overflow-hidden">
      <Script src="https://cdn.iamport.kr/v1/iamport.js" />
      
      {/* 배경 효과 */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-lime-300/30 rounded-full blur-[80px] md:blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-lime-300/30 rounded-full blur-[80px] md:blur-[120px]" />

      <header className="relative z-10 flex items-center gap-3 md:gap-4 mb-8 md:mb-12">
        <button onClick={() => router.back()} className="p-1.5 md:p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6"/>
        </button>
        <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter">ITEM SHOP</h1>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 px-2 md:px-0">
        
        {/* 아이템 카드 렌더링 */}
        {items.map((item) => {
            const isPass = item.name.toUpperCase().includes("PASS"); // 대소문자 구분 없이 확인
            return (
                <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border overflow-hidden group cursor-pointer transition-all hover:scale-[1.02]
                        ${isPass 
                            ? "bg-gradient-to-br from-ink-900 to-ink-900 border-lime-300 shadow-[0_0_40px_rgba(79,70,229,0.3)]" 
                            : "bg-white/5 border-white/10 hover:border-white/30"
                        }`}
                >
                    <div className="relative z-10">
                        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-6 
                            ${isPass ? "bg-white text-ink-900" : "bg-white/10 text-white"}`}>
                            {isPass ? <Crown size={20} className="md:w-7 md:h-7"/> : <Megaphone size={20} className="md:w-7 md:h-7"/>}
                        </div>
                        
                        <h2 className="text-xl md:text-2xl font-bold mb-1 md:mb-2">{item.name}</h2>
                        <p className="text-white/60 mb-6 md:mb-8 text-xs md:text-sm min-h-[36px] md:min-h-[48px]">{item.description}</p>
                        
                        {/* 혜택 리스트 (UI 데코레이션) */}
                        <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                            {isPass ? (
                                <>
                                    <li className="flex gap-1.5 md:gap-2 text-xs md:text-sm"><Check size={14} className="md:w-4 md:h-4 text-green-400"/> AI 코스 무제한 저장</li>
                                    <li className="flex gap-1.5 md:gap-2 text-xs md:text-sm"><Check size={14} className="md:w-4 md:h-4 text-green-400"/> 리뷰 시크릿 팁 잠금해제</li>
                                    <li className="flex gap-1.5 md:gap-2 text-xs md:text-sm"><Check size={14} className="md:w-4 md:h-4 text-green-400"/> 프리미엄 뱃지 부여</li>
                                </>
                            ) : (
                                <>
                                    <li className="flex gap-1.5 md:gap-2 text-xs md:text-sm"><Check size={14} className="md:w-4 md:h-4 text-green-400"/> 동행 게시판 상단 고정</li>
                                    <li className="flex gap-1.5 md:gap-2 text-xs md:text-sm"><Check size={14} className="md:w-4 md:h-4 text-green-400"/> 게시글 강조 효과 (Highlight)</li>
                                    <li className="flex gap-1.5 md:gap-2 text-xs md:text-sm"><Check size={14} className="md:w-4 md:h-4 text-green-400"/> 매칭 확률 200% 증가</li>
                                </>
                            )}
                        </ul>

                        <div className="flex items-center justify-between mt-auto">
                            <span className="text-xl md:text-2xl font-black">{item.price.toLocaleString()}원</span>
                            <button 
                                onClick={() => handlePayment(item)}
                                className={`px-4 py-2.5 md:px-6 md:py-3 rounded-lg md:rounded-xl font-bold transition-colors text-sm md:text-base
                                ${isPass 
                                    ? "bg-white text-ink-900 hover:bg-gray-200" 
                                    : "bg-white/10 text-white hover:bg-white hover:text-black border border-white/20"
                                }`}
                            >
                                구매하기
                            </button>
                        </div>
                    </div>

                    {/* 배경 이미지 은은하게 깔기 */}
                    <Image src={item.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="absolute top-0 right-0 object-cover opacity-20 pointer-events-none mix-blend-overlay" />
                </motion.div>
            )
        })}

      </main>
    </div>
  );
}