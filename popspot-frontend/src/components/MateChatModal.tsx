'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {
  Send,
  X,
  Paperclip,
  LogOut,
  Trash2,
  Calendar,
  MapPin,
  Clock,
  CalendarPlus,
  Check,
  Minimize2,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import Image from 'next/image';
import { apiFetch, SOCKET_BASE_URL, API_BASE_URL } from '../lib/api';
import { getAuthToken } from '../lib/authStorage';
import { notify, notifyError, confirmAction } from '@/lib/notify';
import { addPromiseToCalendar } from '@/lib/calendar';
import { useLocale } from '@/lib/i18n';

const COPY = {
  ko: {
    unread: (n: number) => `새 메시지 ${n}개`,
    leaveConfirm: '채팅방에서 나가시겠습니까?',
    deleteConfirm: '정말 폭파하시겠습니까? 팀원들의 채팅방도 모두 삭제됩니다.',
    deleted: '채팅방이 폭파되었습니다.',
    deleteError: '삭제 중 오류가 발생했습니다.',
    uploadError: '파일 전송 실패',
    calendarTitle: (place: string) => `팝스팟 동행 · ${place || '약속'}`,
    calendarOpened: (p: PromiseData) =>
      `📅 캘린더 앱을 열었습니다.\n\n날짜: ${p.date}\n시간: ${p.time}\n장소: ${p.location}`,
    invalidDate: '날짜·시간이 올바르지 않아 캘린더에 추가하지 못했습니다.',
    subtitle: '실시간 동행 채팅',
    close: '닫기',
    meetLead: '우리 여기서',
    meetTail: '만나는 거 어때요?',
    accept: '일정 수락하고 저장하기',
    imageAlt: '채팅 이미지',
    location: '장소 입력 (예: 더현대 서울 팝업 앞)',
    sendInvite: '초대장 발송하기',
    cancel: '취소',
    message: '메시지를 입력하세요...',
    send: '메시지 전송',
    plan: '동행 약속잡기',
    leave: '나가기',
    leaveAria: '채팅방 나가기',
    destroy: '폭파하기',
  },
  en: {
    unread: (n: number) => `${n} new ${n === 1 ? 'message' : 'messages'}`,
    leaveConfirm: 'Leave this chat room?',
    deleteConfirm: 'Delete this room for everyone? All members will lose access to the chat.',
    deleted: 'The chat room was deleted.',
    deleteError: 'Could not delete the chat room.',
    uploadError: 'Could not send the file.',
    calendarTitle: (place: string) => `POP-SPOT meetup · ${place || 'Meetup'}`,
    calendarOpened: (p: PromiseData) =>
      `📅 Opened your calendar.\n\nDate: ${p.date}\nTime: ${p.time}\nPlace: ${p.location}`,
    invalidDate: 'The date or time is invalid, so it could not be added to your calendar.',
    subtitle: 'Live meetup chat',
    close: 'Close',
    meetLead: 'How about meeting',
    meetTail: 'here?',
    accept: 'Accept and save to calendar',
    imageAlt: 'Chat image',
    location: 'Meeting place (e.g. outside The Hyundai Seoul pop-up)',
    sendInvite: 'Send invitation',
    cancel: 'Cancel',
    message: 'Write a message…',
    send: 'Send message',
    plan: 'Plan a meetup',
    leave: 'Leave',
    leaveAria: 'Leave chat room',
    destroy: 'Delete room',
  },
  ja: {
    unread: (n: number) => `新着メッセージ ${n}件`,
    leaveConfirm: 'チャットルームから退出しますか？',
    deleteConfirm:
      'このルームを全員から削除しますか？メンバー全員がチャットを利用できなくなります。',
    deleted: 'チャットルームを削除しました。',
    deleteError: 'チャットルームを削除できませんでした。',
    uploadError: 'ファイルを送信できませんでした。',
    calendarTitle: (place: string) => `POP-SPOT同行 · ${place || '待ち合わせ'}`,
    calendarOpened: (p: PromiseData) =>
      `📅 カレンダーを開きました。\n\n日付: ${p.date}\n時間: ${p.time}\n場所: ${p.location}`,
    invalidDate: '日付または時刻が正しくないため、カレンダーに追加できませんでした。',
    subtitle: 'リアルタイム同行チャット',
    close: '閉じる',
    meetLead: 'ここで',
    meetTail: '会いませんか？',
    accept: '承認してカレンダーに保存',
    imageAlt: 'チャット画像',
    location: '待ち合わせ場所（例：ザ・ヒュンダイ・ソウルのポップアップ前）',
    sendInvite: '招待を送る',
    cancel: 'キャンセル',
    message: 'メッセージを入力…',
    send: 'メッセージを送信',
    plan: '待ち合わせを決める',
    leave: '退出',
    leaveAria: 'チャットルームから退出',
    destroy: 'ルームを削除',
  },
} as const;

interface MateChatModalProps {
  postId: number;
  postTitle: string;
  nickname: string;
  userId: string;
  isAuthor: boolean;
  onClose: () => void;
  onDeleteSuccess: () => void;
}

interface Message {
  sender: string;
  message: string;
  type: 'TALK' | 'IMAGE' | 'FILE' | 'PROMISE' | 'JOIN' | 'LEAVE';
  sendTime: string;
  fileUrl?: string;
}

interface PromiseData {
  date: string;
  time: string;
  location: string;
}

export default function MateChatModal({
  postId,
  postTitle,
  nickname,
  onClose,
  userId,
  isAuthor,
  onDeleteSuccess,
}: MateChatModalProps) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showPromiseForm, setShowPromiseForm] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);

  const dragControls = useDragControls();
  const isDraggingRef = useRef(false);
  const [promiseDetails, setPromiseDetails] = useState<PromiseData>({
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    location: 'The Hyundai Seoul',
  });

  const client = useRef<Client | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const constraintsRef = useRef(null);

  useEffect(() => {
    if (unreadCount > 0) {
      const originalTitle = document.title;
      document.title = `(${copy.unread(unreadCount)}) POP-SPOT`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [unreadCount, copy]);

  useEffect(() => {
    if (!isMinimized) {
      setUnreadCount(0);
    }
  }, [isMinimized]);

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString(
        locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US',
        { hour: '2-digit', minute: '2-digit' },
      );
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    apiFetch(`/api/mates/${postId}/chat`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
        else setMessages([]);
      })
      .catch((err) => {
        console.error('채팅 로드 실패:', err);
        setMessages([]);
      });

    // 보안: 핸드셰이크에서 서버가 신원을 확인하도록 JWT 를 ?token= 으로 전달(sender 사칭 차단).
    const wsToken = getAuthToken();
    const socket = new SockJS(`${SOCKET_BASE_URL}/ws-stomp`);

    client.current = new Client({
      webSocketFactory: () => socket,
      connectHeaders: wsToken ? { Authorization: `Bearer ${wsToken}` } : {},
      debug: () => {},
      onConnect: () => {
        client.current?.subscribe(`/sub/mate/chat/${postId}`, (res) => {
          const newMsg = JSON.parse(res.body);
          setMessages((prev) => [...prev, newMsg]);

          // 창이 최소화되어 있고, 내가 보낸 메시지가 아닐 때만 카운트 증가
          // useRef를 쓰지 않고 useState 상태를 직접 참조하기 위해 함수형 업데이트 내 로직 활용은 어려우므로
          // 이 콜백이 불리는 시점의 isMinimized를 클로저로 잡거나 전역 상태를 씁니다.
          // 여기서는 실시간으로 반영되도록 로직을 추가합니다.
          if (document.title.includes('POP-SPOT')) {
            // 단순 체크용
            // 실제 렌더링 시점에 판단하기 위해 아래에서 처리해도 되지만 여기서 직접 처리
          }
        });
      },
    });

    client.current.activate();
    return () => {
      client.current?.deactivate();
    };
  }, [postId, nickname]);

  // 메시지 리스트가 업데이트될 때 최소화 상태라면 카운트 업!
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      // 내가 보낸 게 아니고, 창이 닫혀 있을 때
      if (lastMsg.sender !== nickname && isMinimized) {
        setUnreadCount((prev) => prev + 1);
        // 브라우저 기본 알림음 (선택사항)
        const audio = new Audio('https://t1.daumcdn.net/mesng/resource/sound/new_msg.mp3');
        audio.play().catch(() => {}); // 브라우저 정책상 차단될 수 있음
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !client.current?.connected) return;
    const payload = {
      sender: nickname,
      message: input,
      type: 'TALK',
      sendTime: new Date().toISOString(),
    };
    client.current.publish({
      destination: `/pub/mate/chat/${postId}`,
      body: JSON.stringify(payload),
    });
    setInput('');
  };

  const sendPromise = () => {
    if (!client.current?.connected) return;
    const promiseStr = `📅약속|${promiseDetails.date}|${promiseDetails.time}|${promiseDetails.location}`;
    const payload = {
      sender: nickname,
      message: promiseStr,
      type: 'PROMISE',
      sendTime: new Date().toISOString(),
    };
    client.current.publish({
      destination: `/pub/mate/chat/${postId}`,
      body: JSON.stringify(payload),
    });
    setShowPromiseForm(false);
  };

  const handleLeaveChat = async () => {
    if (!(await confirmAction({ text: copy.leaveConfirm }))) return;
    onClose();
  };

  const handleDeleteRoom = async () => {
    if (!(await confirmAction({ text: copy.deleteConfirm }))) return;
    try {
      const res = await apiFetch(`/api/mates/${postId}?userId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        notify(copy.deleted);
        onDeleteSuccess();
      }
    } catch (e) {
      notifyError(copy.deleteError);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client.current?.connected) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch(`/api/chat/upload`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('업로드 실패');
      const data = await res.json();

      let savedFileName = data.fileUrl;
      if (data.fileUrl && data.fileUrl.includes('/uploads/')) {
        savedFileName = data.fileUrl.split('/uploads/')[1];
      }
      const isImage = file.type.startsWith('image/');
      const fileMessage = {
        sender: nickname,
        message: savedFileName,
        type: isImage ? 'IMAGE' : 'FILE',
        // 업로드 응답(data.fileUrl)은 "https://호스트/uploads/파일명" 절대 URL 인데, 서버는 채팅 첨부를
        // 상대 경로만 받는다(MateService.normalizeFileUrl). 절대 URL 을 그대로 보내면 저장 단계에서
        // 거부돼 이미지 전송이 통째로 실패했다.
        //
        // 서버 검증을 푸는 대신 여기서 경로만 보낸다 — 그 검증은 채팅에 외부 주소를 심는 것을 막는
        // 장치라, 절대 URL 을 허용하려면 호스트 허용목록이 따로 필요해진다.
        // 표시 쪽(getImageUrl)은 이미 상대 경로를 API_BASE_URL 과 합쳐 처리한다.
        fileUrl: savedFileName ? `/uploads/${savedFileName}` : null,
        sendTime: new Date().toISOString(),
      };
      client.current.publish({
        destination: `/pub/mate/chat/${postId}`,
        body: JSON.stringify(fileMessage),
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      notifyError(copy.uploadError);
    }
  };

  const parsePromiseData = (msg: string) => {
    const parts = msg.split('|');
    return { date: parts[1] || '', time: parts[2] || '', location: parts[3] || '' };
  };

  const checkIsSystem = (msg: string) => msg.includes('입장') || msg.includes('퇴장');
  const checkIsImage = (msg: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(msg);

  const getImageUrl = (msg: Message) => {
    const rawUrl = msg.fileUrl || `${API_BASE_URL}/uploads/${msg.message}`;
    if (msg.fileUrl && msg.fileUrl.startsWith('http')) return msg.fileUrl;
    const parts = rawUrl.split('/uploads/');
    if (parts.length === 2) {
      const filename = parts[1];
      try {
        const safeFilename = encodeURIComponent(decodeURIComponent(filename));
        return `${API_BASE_URL}/uploads/${safeFilename}`;
      } catch (e) {
        return `${API_BASE_URL}/uploads/${encodeURIComponent(filename)}`;
      }
    }
    return rawUrl;
  };

  const addToCalendar = (p: { date: string; time: string; location: string }) => {
    // 실제로 캘린더에 등록한다. 예전엔 아무것도 안 하고 성공 메시지만 띄우는 가짜 버튼이었다.
    const ok = addPromiseToCalendar({
      title: copy.calendarTitle(p.location),
      date: p.date,
      time: p.time,
      location: p.location,
    });
    if (ok) {
      notify(copy.calendarOpened(p));
    } else {
      notify(`⚠️ ${copy.invalidDate}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex justify-center items-end sm:items-auto"
      ref={constraintsRef}
    >
      <AnimatePresence mode="wait">
        {!isMinimized ? (
          <motion.div
            key="maximized"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragConstraints={constraintsRef}
            onDragStart={() => (isDraggingRef.current = true)}
            onDragEnd={() => (isDraggingRef.current = false)}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-4 right-0 left-0 mx-auto w-[95%] h-[80vh] sm:m-0 sm:bottom-10 sm:right-10 sm:left-auto sm:w-[400px] sm:h-[600px] bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col pointer-events-auto"
          >
            {/* 헤더 영역 */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="bg-lime-300 p-3 sm:p-4 text-white flex items-center justify-between cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg">
                  <MessageCircle size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[180px]">
                    {postTitle}
                  </h3>
                  <p className="text-xs opacity-80">{copy.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 sm:p-1.5 hover:bg-white/10 rounded-md transition-colors"
                >
                  <Minimize2 size={14} className="sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1 sm:p-1.5 hover:bg-white/10 rounded-md transition-colors"
                  aria-label={copy.close}
                >
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
            </div>

            {/* 채팅창 영역 */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-[#121212] custom-scrollbar"
            >
              {messages.map((msg, idx) => {
                const isMe = msg.sender === nickname;
                const isSystem = checkIsSystem(msg.message);
                const isImage = msg.type === 'IMAGE' || checkIsImage(msg.message);
                const isPromise = msg.type === 'PROMISE' || msg.message.startsWith('📅약속|');

                if (isSystem) {
                  return (
                    <div key={idx} className="flex justify-center my-2">
                      <span className="bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs px-2.5 sm:px-3 py-1 rounded-full">
                        {msg.message}
                      </span>
                    </div>
                  );
                }

                if (isPromise) {
                  const p = parsePromiseData(msg.message);
                  return (
                    <div key={idx} className="flex justify-center my-3 sm:my-4 w-full">
                      <div className="relative bg-gradient-to-br from-lime-300/10 to-lime-300/15 dark:from-ink-900/30 dark:to-ink-900/30 border border-lime-300/30 dark:border-lime-300/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg w-full max-w-[260px] sm:max-w-[300px] overflow-hidden group">
                        <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 text-lime-500/10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                          <Calendar size={80} className="sm:w-[100px] sm:h-[100px]" />
                        </div>
                        <div className="relative z-10">
                          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-lime-300/15 dark:bg-lime-300/30 text-lime-500 dark:text-lime-400 text-xs font-black tracking-wider mb-3 sm:mb-4 uppercase">
                            <Sparkles size={10} className="sm:w-3 sm:h-3" /> POP-SPOT INVITATION
                          </div>
                          <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-white mb-3 sm:mb-4 leading-tight">
                            {copy.meetLead}
                            <br />
                            {copy.meetTail}
                          </h4>
                          <div className="space-y-2 mb-4 sm:mb-5 bg-white/60 dark:bg-black/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-white/50 dark:border-white/5">
                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-lime-300/15 dark:bg-ink-900/50 flex items-center justify-center text-lime-500">
                                <Calendar size={12} className="sm:w-3.5 sm:h-3.5" />
                              </div>
                              <span className="font-bold text-gray-800 dark:text-gray-200">
                                {p.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-lime-300/15 dark:bg-ink-900/50 flex items-center justify-center text-lime-500">
                                <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
                              </div>
                              <span className="font-bold text-gray-800 dark:text-gray-200">
                                {p.time}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-hot-100 dark:bg-hot-900/50 flex items-center justify-center text-hot-500 dark:text-hot-400">
                                <MapPin size={12} className="sm:w-3.5 sm:h-3.5" />
                              </div>
                              <span className="font-bold text-gray-800 dark:text-gray-200">
                                {p.location}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => addToCalendar(p)}
                            className="w-full py-2.5 sm:py-3 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white rounded-lg sm:rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                          >
                            <Check size={12} className="sm:w-3.5 sm:h-3.5" /> {copy.accept}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} my-1`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}
                    >
                      {!isMe && (
                        <span className="text-xs text-gray-500 mb-0.5 sm:mb-1 ml-1">
                          {msg.sender}
                        </span>
                      )}
                      {isImage ? (
                        <div className="rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white dark:border-[#333] shadow-sm">
                          <Image
                            src={getImageUrl(msg)}
                            alt={copy.imageAlt}
                            width={300}
                            height={200}
                            unoptimized
                            loading="lazy"
                            className="max-w-full max-h-[150px] sm:max-h-[200px] object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                            onClick={() => window.open(getImageUrl(msg), '_blank')}
                          />
                        </div>
                      ) : (
                        <div
                          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-sm ${isMe ? 'bg-lime-300 text-ink-900 rounded-tr-none' : 'bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-white rounded-tl-none'}`}
                        >
                          {msg.message}
                        </div>
                      )}
                      <span className="text-xs text-gray-400 mt-1 mx-1">
                        {formatTime(msg.sendTime)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 입력 영역 */}
            <div className="p-3 sm:p-4 bg-white dark:bg-[#1e1e1e] border-t border-gray-100 dark:border-white/5 space-y-2 sm:space-y-3">
              {showPromiseForm && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-2 sm:p-3 bg-gray-50 dark:bg-black/20 rounded-xl sm:rounded-2xl border border-dashed border-lime-300/30 dark:border-lime-300/30 space-y-1.5 sm:space-y-2"
                >
                  <div className="flex gap-1.5 sm:gap-2">
                    <input
                      type="date"
                      value={promiseDetails.date}
                      onChange={(e) =>
                        setPromiseDetails({ ...promiseDetails, date: e.target.value })
                      }
                      className="flex-1 text-xs p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-white dark:bg-[#333] border border-gray-200 dark:border-white/10 focus:ring-2 ring-lime-300 outline-none text-gray-900 dark:text-white"
                    />
                    <input
                      type="time"
                      value={promiseDetails.time}
                      onChange={(e) =>
                        setPromiseDetails({ ...promiseDetails, time: e.target.value })
                      }
                      className="flex-1 text-xs p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-white dark:bg-[#333] border border-gray-200 dark:border-white/10 focus:ring-2 ring-lime-300 outline-none text-gray-900 dark:text-white"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder={copy.location}
                    value={promiseDetails.location}
                    onChange={(e) =>
                      setPromiseDetails({ ...promiseDetails, location: e.target.value })
                    }
                    className="w-full text-xs p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-white dark:bg-[#333] border border-gray-200 dark:border-white/10 focus:ring-2 ring-lime-300 outline-none text-gray-900 dark:text-white"
                  />
                  <div className="flex gap-1.5 sm:gap-2 mt-1 sm:mt-2">
                    <button
                      onClick={sendPromise}
                      className="flex-1 py-2 sm:py-2.5 bg-lime-300 hover:bg-lime-400 text-ink-900 text-xs font-bold rounded-lg sm:rounded-xl transition-colors shadow-lg"
                    >
                      {copy.sendInvite}
                    </button>
                    <button
                      onClick={() => setShowPromiseForm(false)}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-[#444] dark:hover:bg-[#555] text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg sm:rounded-xl transition-colors"
                    >
                      {copy.cancel}
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-lime-500 transition-colors"
                >
                  <Paperclip size={18} className="sm:w-5 sm:h-5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={copy.message}
                  className="flex-1 bg-gray-100 dark:bg-black/30 border border-transparent dark:border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:border-lime-300 dark:text-white transition-colors"
                />
                <button
                  onClick={sendMessage}
                  aria-label={copy.send}
                  className="p-2 sm:p-2.5 bg-lime-300 hover:bg-lime-400 text-ink-900 rounded-lg sm:rounded-xl transition-all shadow-lg active:scale-95"
                >
                  <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>

              <div className="flex items-center justify-between px-1">
                <button
                  onClick={() => setShowPromiseForm(!showPromiseForm)}
                  className="text-xs font-bold text-lime-500 hover:text-lime-700 dark:text-lime-300 dark:hover:text-lime-400 flex items-center gap-1 sm:gap-1.5 transition-colors bg-lime-300/10 dark:bg-ink-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg"
                >
                  <CalendarPlus size={12} className="sm:w-3.5 sm:h-3.5" /> {copy.plan}
                </button>
                <div className="flex gap-2 sm:gap-4">
                  <button
                    onClick={handleLeaveChat}
                    className="text-xs font-medium text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                    aria-label={copy.leaveAria}
                  >
                    <LogOut size={12} /> {copy.leave}
                  </button>
                  {isAuthor && (
                    <button
                      onClick={handleDeleteRoom}
                      className="text-xs text-red-500 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-900/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-bold flex items-center gap-1 transition-all"
                    >
                      <Trash2 size={12} /> {copy.destroy}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* 최소화 상태 버튼 — 안 읽은 메시지 배지 포함. */
          <motion.div
            key="minimized"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => setIsMinimized(false)}
            className="absolute bottom-4 right-4 sm:bottom-10 sm:right-10 w-12 h-12 sm:w-16 sm:h-16 bg-lime-300 hover:bg-lime-400 text-ink-900 rounded-full shadow-[0_10px_25px_rgba(79,70,229,0.5)] flex items-center justify-center cursor-pointer hover:scale-110 transition-all pointer-events-auto"
          >
            <MessageCircle size={24} className="sm:w-7 sm:h-7" />

            {unreadCount > 0 ? (
              <div className="absolute -top-1 -right-1 bg-hot-400 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-[#1e1e1e] animate-bounce shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            ) : (
              <div className="absolute top-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-hot-400 rounded-full border-2 border-white dark:border-[#1e1e1e] flex items-center justify-center animate-pulse"></div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
