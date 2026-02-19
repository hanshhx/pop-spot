"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Calendar, Users, CheckCircle, AlertCircle, RefreshCw, Ticket, ArrowRight, Play } from "lucide-react";

interface Props {
  userId: string;
}

// 시뮬레이션 단계 정의
type Step = "INTRO" | "QUEUE" | "SELECT" | "PAYMENT" | "RESULT_UX" | "RESULT_REAL";

export default function TicketingSimulation({ userId }: Props) {
  const [step, setStep] = useState<Step>("INTRO");
  const [stock, setStock] = useState(30);
  const [queueNum, setQueueNum] = useState(500); // 가상 대기열 수
  const [selectedDate, setSelectedDate] = useState("");
  const [result, setResult] = useState<"SUCCESS" | "FAIL" | null>(null);

  // 시뮬레이션용 아이템 ID
  const ITEM_ID = "simulation_item_01";
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 1. 시뮬레이션 시작 (START)
  const handleStart = async () => {
    try {
      // 백엔드에 "게임 시작" 알림 -> 이때부터 봇들이 재고를 까기 시작함
      await fetch(`http://localhost:8080/api/game/start?itemId=${ITEM_ID}`, { method: "POST" });
      
      setStep("QUEUE");
      startStockPolling(); // 재고 실시간 확인 시작
      runQueueSimulation(); // 대기열 줄어드는 효과
    } catch (e) {
      alert("서버 연결 실패");
    }
  };

  // 2. 재고 폴링 (1초마다 확인) - 봇들이 얼마나 샀는지 확인용
  const startStockPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    // 🔥 100ms마다 재고 확인 (실시간 광클 느낌)
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/game/stock?itemId=${ITEM_ID}`);
        const count = await res.text();
        const numStock = parseInt(count);
        setStock(numStock);
        
        // 재고가 0이 되면 즉시 종료
        if (numStock <= 0) {
            clearInterval(pollingRef.current!);
            setStock(0); // 0으로 고정
            
            // 만약 내가 아직 '결제 완료' 단계가 아니라면 실패 처리
            if (step !== "RESULT_UX" && step !== "RESULT_REAL") {
                 setResult("FAIL");
                 // 약간의 딜레이 후 실패 화면 전환 (사용자가 당황할 시간 부여)
                 setTimeout(() => setStep("RESULT_REAL"), 500);
            }
        }
      } catch (e) {}
    }, 100); // 🔥 여기가 핵심 속도 조절
  };

  // 가상 대기열 시뮬레이션
  const runQueueSimulation = () => {
    setQueueNum(Math.floor(Math.random() * 300) + 200); // 200~500명
    const interval = setInterval(() => {
        setQueueNum((prev) => {
            const next = prev - Math.floor(Math.random() * 50); // 팍팍 줄어듦
            if (next <= 0) {
                clearInterval(interval);
                setStep("SELECT"); // 대기열 끝나면 선택 화면으로
                return 0;
            }
            return next;
        });
    }, 500);
  };

  // 3. 결제 버튼 클릭 (최종 요청)
  const handlePayment = async () => {
    setStep("RESULT_UX"); // "결제 처리중..." 화면

    setTimeout(async () => {
        // 실제 API 호출 (이때 재고가 남아있어야 성공)
        try {
            const res = await fetch(`http://localhost:8080/api/game/reserve?userId=${userId}&itemId=${ITEM_ID}`, { method: "POST" });
            const data = await res.json();
            
            if (data.result === "SUCCESS") setResult("SUCCESS");
            else setResult("FAIL");
            
            setStep("RESULT_REAL");
            if (pollingRef.current) clearInterval(pollingRef.current); // 폴링 중단
        } catch(e) {
            setResult("FAIL");
            setStep("RESULT_REAL");
        }
    }, 1500); // 결제 로딩 1.5초 (이 시간 동안에도 봇들은 재고를 깜)
  };

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
      return () => {
          if (pollingRef.current) clearInterval(pollingRef.current);
      }
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      
      {/* 🟢 실시간 현황판 (항상 떠있음) */}
      {step !== "INTRO" && (
          <div className="flex items-center justify-between bg-black/80 border border-indigo-500/50 p-4 rounded-2xl mb-6 shadow-lg sticky top-4 z-50 backdrop-blur-md">
              <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-white font-bold">LIVE STOCK</span>
              </div>
              <div className="text-right">
                  <span className={`text-3xl font-mono font-black ${stock < 5 ? 'text-red-500' : 'text-white'}`}>
                      {stock}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">/ 30</span>
              </div>
          </div>
      )}

      <div className="relative bg-white dark:bg-[#1a1a1a] rounded-[2.5rem] border border-gray-200 dark:border-white/10 overflow-hidden shadow-2xl min-h-[500px] flex flex-col">
        
        {/* === STEP 1: 인트로 === */}
        {step === "INTRO" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
                    <Ticket size={40} />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">티켓팅 시뮬레이션</h2>
                    <p className="text-gray-500 dark:text-white/60 text-sm">
                        대기열부터 결제까지, 실제 티켓팅 과정을 체험하세요.<br/>
                        시작 버튼을 누르는 순간, <strong className="text-red-500">다른 경쟁자(봇)</strong>들도 예매를 시작합니다.
                    </p>
                </div>
                <button onClick={handleStart} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                    <Play size={20} fill="currentColor"/> 시뮬레이션 시작
                </button>
            </div>
        )}

        {/* === STEP 2: 대기열 (Queue) === */}
        {step === "QUEUE" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/90 text-white">
                <Users size={60} className="text-yellow-400 mb-6 animate-pulse" />
                <h3 className="text-2xl font-bold mb-2">접속 대기 중...</h3>
                <p className="text-white/50 text-sm mb-8">잠시만 기다려주세요. 새로고침하면 대기열이 초기화됩니다.</p>
                
                <div className="w-full bg-white/10 rounded-full h-2 mb-4 overflow-hidden">
                    <motion.div 
                        className="h-full bg-yellow-400"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3, ease: "linear" }} // 대기열 줄어드는 시간 시각화
                    />
                </div>
                <p className="text-xl font-mono">내 앞 대기: <strong className="text-yellow-400">{queueNum}</strong>명</p>
            </div>
        )}

        {/* === STEP 3: 옵션 선택 === */}
        {step === "SELECT" && (
            <div className="flex-1 p-8 flex flex-col">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Calendar className="text-indigo-500"/> 날짜/회차 선택
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-auto">
                    {["3월 1일 (토)", "3월 2일 (일)", "3월 8일 (토)", "3월 9일 (일)"].map((date) => (
                        <button 
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`p-4 rounded-xl border text-sm font-bold transition-all ${
                                selectedDate === date 
                                ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300" 
                                : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100"
                            }`}
                        >
                            {date}
                        </button>
                    ))}
                </div>

                <button 
                    onClick={() => {
                        if(!selectedDate) return alert("날짜를 선택해주세요");
                        setStep("PAYMENT");
                    }}
                    disabled={!selectedDate}
                    className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black font-bold rounded-xl mt-6 disabled:opacity-50"
                >
                    좌석 선택 완료 (다음)
                </button>
            </div>
        )}

        {/* === STEP 4: 가상 결제 === */}
        {step === "PAYMENT" && (
            <div className="flex-1 p-8 flex flex-col">
                 <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <CreditCard className="text-indigo-500"/> 결제 정보 입력
                </h3>

                <div className="space-y-4 mb-auto">
                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                        <p className="text-xs text-gray-500 mb-1">예매 정보</p>
                        <p className="font-bold text-gray-900 dark:text-white">성수 팝업 프리패스 - {selectedDate}</p>
                    </div>
                    <div className="flex gap-2">
                        <input type="checkbox" id="agree" className="w-5 h-5 accent-indigo-600" defaultChecked />
                        <label htmlFor="agree" className="text-sm text-gray-600 dark:text-white/70">취소/환불 규정에 동의합니다 (필수)</label>
                    </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4 flex items-center gap-2 text-xs text-red-600 dark:text-red-300">
                    <AlertCircle size={16}/> 주의: 결제 버튼을 누르는 순간 재고가 차감됩니다.
                </div>

                <button 
                    onClick={handlePayment}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95"
                >
                    결제하기 (최종)
                </button>
            </div>
        )}

        {/* === STEP 5: 결제 진행 중 (UX) === */}
        {step === "RESULT_UX" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <RefreshCw size={50} className="text-indigo-500 animate-spin mb-6" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">결제 승인 요청 중...</h3>
                <p className="text-gray-500 text-sm mt-2">창을 닫지 마세요.</p>
            </div>
        )}

        {/* === STEP 6: 최종 결과 (REAL) === */}
        {step === "RESULT_REAL" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-black/50">
                {result === "SUCCESS" ? (
                    <motion.div initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="text-center">
                        <CheckCircle size={80} className="text-green-500 mx-auto mb-6" />
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">예매 성공!</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8">
                            봇들의 공격을 뚫고 {selectedDate} 티켓을 확보했습니다.<br/>
                            (남은 재고: {stock})
                        </p>
                    </motion.div>
                ) : (
                    <motion.div initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="text-center">
                        <AlertCircle size={80} className="text-red-500 mx-auto mb-6" />
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">예매 실패 (매진)</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8">
                            결제하는 동안 재고가 모두 소진되었습니다.<br/>
                            조금만 더 서둘러주세요!
                        </p>
                    </motion.div>
                )}

                <button 
                    onClick={() => {
                        setStep("INTRO");
                        setStock(30);
                    }} 
                    className="px-8 py-3 bg-white border border-gray-300 dark:bg-white/10 dark:border-white/20 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors"
                >
                    다시 시도하기
                </button>
            </div>
        )}

      </div>
    </div>
  );
}