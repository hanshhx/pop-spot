'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Thermometer, Users, Clock, MapPin, RefreshCw, CloudRain } from 'lucide-react';
import CongestionChart from './CongestionChart';
import { apiUrl } from '@/lib/api';
import { useLocale, localizedStatus, type MessageKey } from '@/lib/i18n';

import type { CongestionData } from '@/types/popup';

interface Props {
  /** 모달이 처음 열릴 때 보여줄 초기 데이터. 탭 전환 시 새로 fetch 한다. */
  data: CongestionData;
  onClose: () => void;
}

/**
 * 6대 핫플레이스 정의.
 *
 * <p>{@code key} 는 백엔드가 받는 지역 코드라 <b>절대 건드리지 않는다</b> — 화면에 보이는 이름만
 * 사전에서 꺼낸다. 모듈 최상단이라 훅을 부를 수 없어 키만 들고 있다가 그리는 쪽에서 t() 로 푼다.
 */
const HOTSPOTS: ReadonlyArray<{ key: string; labelKey: MessageKey }> = [
  { key: 'SEONGSU', labelKey: 'airep.tabSeongsu' },
  { key: 'YEOUIDO', labelKey: 'airep.tabYeouido' },
  { key: 'HONGDAE', labelKey: 'airep.tabHongdae' },
  { key: 'GANGNAM', labelKey: 'airep.tabGangnam' },
  { key: 'YONGSAN', labelKey: 'airep.tabYongsan' },
  { key: 'MYEONGDONG', labelKey: 'airep.tabMyeongdong' },
];

export default function AIReportModal({ data: initialData, onClose }: Props) {
  // 혼잡도 값(여유·보통·혼잡)은 아래 분기에 그대로 쓰이므로 locale 은 표시할 때만 쓴다.
  const { t, locale } = useLocale();
  // [로직] 현재 사용자가 선택한 지역 탭 상태 (기본값: 성수)
  const [activeTab, setActiveTab] = useState('SEONGSU');
  // [로직] 화면에 렌더링할 리포트 데이터 상태
  const [reportData, setReportData] = useState<CongestionData>(initialData);
  // [로직] API 호출 중임을 나타내는 로딩 상태
  const [loading, setLoading] = useState(false);

  // 🔄 [로직] 탭이 바뀔 때마다 백엔드에서 해당 지역의 실시간 데이터를 가져옵니다.
  useEffect(() => {
    // [최적화] 첫 렌더링이고 초기 데이터가 성수라면 중복 호출 방지를 위해 스킵합니다.
    if (activeTab === 'SEONGSU' && initialData?.areaName?.includes('성수')) {
      setReportData(initialData);
      return;
    }

    setLoading(true);
    // 상대 경로 → 동일 출처 리라이트(별도 TLS 핸드셰이크·preflight 회피)
    fetch(apiUrl(`/api/congestion?area=${activeTab}`))
      .then((res) => res.json())
      .then((result) => {
        setReportData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error('데이터 로딩 실패', err);
        setLoading(false);
      });
  }, [activeTab, initialData]);

  // 데이터가 로딩 중도 아니고 값도 없다면 아무것도 그리지 않습니다.
  if (!reportData && !loading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 배경 (클릭 시 모달 닫힘) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 본체 */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-white dark:bg-ink-700 rounded-[2rem] shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]"
      >
        {/* 헤더 섹션: 제목 및 지역 선택 탭 (반응형 패딩 조절) */}
        <div className="p-4 md:p-6 pb-2 flex flex-col gap-3 md:gap-4 bg-white dark:bg-ink-700 sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] md:text-xs font-bold text-lime-500 bg-lime-300/10 px-2.5 py-1 md:px-3 md:py-1 rounded-full mb-1.5 md:mb-2 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-lime-300 rounded-full animate-pulse" /> LIVE DATA
              </span>
              <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
                {t('airep.title')}
              </h2>
              <p className="text-xs md:text-sm text-gray-500 dark:text-cream-200/60 mt-0.5">
                {t('airep.subtitle')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 md:p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:rotate-90 transition-transform"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5 md:w-5 md:h-5 text-gray-900 dark:text-white" />
            </button>
          </div>

          {/* 지역 선택 탭 리스트 (반응형 여백 및 글씨 조절) */}
          <div className="flex gap-1.5 md:gap-2 overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
            {HOTSPOTS.map((spot) => (
              <button
                key={spot.key}
                onClick={() => setActiveTab(spot.key)}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap transition-all border ${
                  activeTab === spot.key
                    ? 'bg-lime-300 text-ink-900 border-lime-300 shadow-md scale-105'
                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-cream-200/40 dark:border-white/5 hover:bg-gray-100'
                }`}
              >
                {t(spot.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* 컨텐츠 섹션 (스크롤 가능, 반응형 패딩 조절) */}
        <div className="p-4 md:p-6 pt-2 space-y-4 md:space-y-6 overflow-y-auto">
          {loading ? (
            // 로딩 인디케이터
            <div className="flex flex-col items-center justify-center py-16 md:py-20 gap-3 md:gap-4 opacity-50">
              <RefreshCw className="animate-spin text-lime-500 w-8 h-8 md:w-10 md:h-10" />
              <p className="text-xs md:text-sm font-bold text-gray-500">{t('airep.loading')}</p>
            </div>
          ) : (
            <>
              {/* 1. 현재 혼잡도 요약 카드 */}
              <div
                className={`p-4 md:p-6 rounded-2xl border-2 transition-colors ${
                  reportData.level === '여유'
                    ? 'border-green-500/20 bg-green-50/50 dark:bg-green-900/10'
                    : reportData.level === '보통'
                      ? 'border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-900/10'
                      : 'border-red-500/20 bg-red-50/50 dark:bg-red-900/10'
                }`}
              >
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <div className="flex items-center gap-1.5 md:gap-2 text-gray-500 dark:text-cream-200/60 text-xs md:text-sm font-medium">
                    <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" /> {reportData.areaName}
                  </div>
                  <span className="text-[9px] md:text-xs bg-white dark:bg-black/30 px-1.5 py-0.5 md:px-2 md:py-1 rounded border border-black/5 dark:border-white/10">
                    {t('airep.updatedLive')}
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-cream-200/60 mb-0.5 md:mb-1">
                      {t('airep.currentLevel')}
                    </p>
                    <h3
                      className={`text-3xl md:text-4xl font-black ${
                        reportData.level === '여유'
                          ? 'text-green-600 dark:text-green-400'
                          : reportData.level === '보통'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {localizedStatus(reportData.level, locale)}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] md:text-xs text-gray-400 mb-0.5 md:mb-1">
                      {t('airep.livePop')}
                    </p>
                    <p className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                      {reportData.minPop?.toLocaleString()}
                      {t('airep.popUnit')}
                    </p>
                  </div>
                </div>
                <p className="mt-3 md:mt-4 text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-white/50 dark:bg-black/20 p-2.5 md:p-3 rounded-lg md:rounded-xl">
                  {reportData.message}
                </p>
              </div>

              {/* 2. 날씨 및 방문자 통계 그리드 (반응형 갭 조절) */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 dark:border-white/5 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 text-blue-600 dark:text-blue-400 font-bold text-xs md:text-sm">
                    <Thermometer className="w-3.5 h-3.5 md:w-4 md:h-4" /> {t('airep.weather')}
                  </div>
                  <div className="flex items-end gap-1.5 md:gap-2">
                    <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                      {reportData.temp}°
                    </p>
                    <span className="text-xs md:text-sm text-gray-500 mb-0.5 md:mb-1">
                      {reportData.sky}
                    </span>
                  </div>
                  <div className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-blue-500 flex items-center gap-1">
                    <CloudRain className="w-3 h-3 md:w-3 md:h-3" /> {t('airep.rainChance')}{' '}
                    {reportData.rainChance}%
                  </div>
                </div>
                <div className="p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 dark:border-white/5 bg-lime-300/10/50 dark:bg-ink-800/50">
                  <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 text-lime-500 font-bold text-xs md:text-sm">
                    <Users className="w-3.5 h-3.5 md:w-4 md:h-4" /> {t('airep.topAge')}
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                    {/* '20s' · '30s' 는 백엔드 응답의 키다 — 표시 문구만 사전에서 꺼낸다. */}
                    {reportData.ageRates?.['20s'] > reportData.ageRates?.['30s']
                      ? t('airep.age20s')
                      : t('airep.age30s')}
                  </p>
                  <p className="text-[10px] md:text-xs text-gray-500 mt-1.5 md:mt-2">
                    {t('airep.age20s')} {reportData.ageRates?.['20s']}%, {t('airep.age30s')}{' '}
                    {reportData.ageRates?.['30s']}%
                  </p>
                </div>
              </div>

              {/* 3. 시간대별 혼잡도 예측 그래프 */}
              <div>
                <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4">
                  <Clock className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-400" />
                  <h4 className="font-bold text-sm md:text-base text-gray-900 dark:text-white">
                    {t('airep.hourlyForecast')}
                  </h4>
                </div>

                <div className="text-black overflow-hidden">
                  <CongestionChart data={reportData.forecasts || reportData.forecast || []} />
                </div>
              </div>

              {/*
                AI 기반 커스텀 한줄 코멘트.

                지역명이 문장 어디에 오는지가 언어마다 달라(한국어는 조사 앞, 영어는 문장 맨 앞)
                한 문장으로 두면 옮길 수 없다. 앞·중간·뒤 세 조각으로 끊어 지역명을 끼워 넣는다.
              */}
              <div className="bg-gray-900 dark:bg-white text-white dark:text-black p-4 md:p-5 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium text-center shadow-lg leading-relaxed">
                &ldquo;{t('airep.commentPrefix')}
                {reportData.areaName}
                {t('airep.commentMid')}
                <strong>{localizedStatus(reportData.level, locale)}</strong>
                {t('airep.commentSuffix')}
                <br />
                {/* 분기 기준은 백엔드가 주는 원본 값이라 한국어 그대로 둔다. */}
                {reportData.level === '여유' ? t('airep.commentQuiet') : t('airep.commentBusy')}
                &rdquo;
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
