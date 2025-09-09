/**
 * Landing - 메인 랜딩 페이지 컴포넌트
 * 
 * 주요 역할:
 * 1. 서비스 소개 및 주요 기능 설명
 * 2. 사용자 등록/로그인 유도
 * 3. 가격 정책 및 FAQ 제공
 * 
 * 핵심 특징:
 * - 두더지웍스 브랜딩 및 Canvas AI 소개
 * - 반응형 디자인으로 모바일/데스크톱 최적화
 * - Clerk 인증 시스템과 연동된 회원가입/로그인
 * 
 * 주의사항:
 * - 모든 버튼은 Clerk 인증 페이지로 연결
 * - 브랜드 컬러는 navy-900 기준으로 통일
 * - 성능 최적화를 위해 이미지는 Next.js Image 컴포넌트 사용
 */

"use client";

import { Button } from "@/components/Ui/buttons";
import Link from "next/link";
import Image from "next/image";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-20 sm:pb-32">
          <div className="text-center">
            <div className="flex items-center justify-center mb-8 sm:mb-12">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-navy-900 rounded-2xl flex items-center justify-center shadow-2xl">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                  <path d="M2 17L12 22L22 17"/>
                  <path d="M2 12L12 17L22 12"/>
                </svg>
              </div>
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-navy-900 mb-6 sm:mb-8 leading-tight px-4">
              수익이 안 나오는<br />
              단 하나의 이유,<br />
              <span className="text-blue-600">구조의 부재</span>입니다.
            </h1>
            
            <p className="text-base sm:text-lg text-slate-600 mb-3 sm:mb-4 max-w-4xl mx-auto leading-relaxed px-4">
              아이디어는 이미 충분합니다.
            </p>
            <p className="text-base sm:text-lg text-slate-600 mb-12 sm:mb-16 max-w-4xl mx-auto leading-relaxed px-4">
              <strong>캔버스AI</strong>는 그 아이디어를 실행 가능한 수익 구조로 만들어드립니다.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mb-16 sm:mb-20 px-4">
              <Link href="/sign-up">
                <Button 
                  size="lg" 
                  className="text-base sm:text-lg px-8 sm:px-12 py-4 sm:py-6 bg-navy-900 hover:bg-navy-800 text-white font-bold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200 rounded-xl"
                >
                  👉 지금 바로 Canvas AI 시작하기
                </Button>
              </Link>
            </div>

            {/* Canvas AI Demo Video */}
            <div className="relative px-4">
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 max-w-6xl mx-auto border-2 border-slate-100">
                <div className="aspect-video rounded-xl sm:rounded-2xl overflow-hidden border-2 border-slate-200">
                  <iframe
                    src="https://www.youtube.com/embed/eE1EsQkgy-A"
                    title="Canvas AI 실제 화면 데모"
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="text-center mt-4 sm:mt-6">
                  <h3 className="text-navy-900 text-xl sm:text-2xl font-bold mb-2">Canvas AI 실제 화면</h3>
                  <p className="text-slate-500 text-base sm:text-lg">드래그 앤 드롭으로 수익 구조를 시각화하세요</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Problem Section */}
      <div className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-4 sm:mb-6 px-4">이런 적, 있으신가요?</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <span className="text-2xl sm:text-3xl">💭</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-2 sm:mb-4 leading-tight">아이디어는 넘치는데,<br />정리가 안되네</h3>
            </div>

            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <span className="text-2xl sm:text-3xl">📈</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-2 sm:mb-4 leading-tight">콘텐츠는 쌓이는데,<br />수익으로는 연결이 안되네</h3>
            </div>

            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg text-center sm:col-span-2 lg:col-span-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <span className="text-2xl sm:text-3xl">👥</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-2 sm:mb-4 leading-tight">기획은 잡혀가는데,<br />팀원들한테 설명이 잘 안되네</h3>
            </div>
          </div>

          <div className="text-center px-4">
            <p className="text-lg sm:text-xl font-bold text-navy-900">
              문제는 아이디어가 아니라, <span className="text-blue-600">구조</span>입니다.
            </p>
          </div>
        </div>
      </div>

      {/* Solution Section */}
      <div className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-4 sm:mb-6 px-4">캔버스AI는 &apos;구조&apos;를 만듭니다</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <span className="text-3xl sm:text-4xl">🎨</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-3 sm:mb-4">AI 화이트보드</h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                머릿속 그림을 구조로 시각화
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <span className="text-3xl sm:text-4xl">🧠</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-3 sm:mb-4">전문 지식 내장</h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                콘텐츠/비즈니스/마케팅 전략을 다방면으로 학습한 AI
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 text-center sm:col-span-2 lg:col-span-1">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <span className="text-3xl sm:text-4xl">⚡</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-3 sm:mb-4">실행까지 직결</h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                아이디어 → 콘텐츠 → 팬덤 → 브랜드 → 수익화 플로우 자동 설계
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-4 sm:mb-6 px-4">자주 묻는 질문</h2>
            <p className="text-base sm:text-lg text-slate-600 px-4">Canvas AI에 대해 궁금한 점들을 모았습니다</p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* FAQ 1 */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-100">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 font-bold text-xs sm:text-sm">Q</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-2 sm:mb-3">Miro 쓰면 되잖아요?</h3>
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 font-bold text-xs sm:text-sm">A</span>
                    </div>
                    <div className="text-slate-700 leading-relaxed text-sm sm:text-base">
                      <p className="mb-2 sm:mb-3">Miro는 범용 협업툴입니다. <strong>Canvas AI는 그 이상입니다.</strong></p>
                      <p className="mb-2 sm:mb-3">두더지웍스가 1년간 쌓은 비즈니스·콘텐츠·퍼널 노하우를 AI에 학습시켰습니다.</p>
                      <p className="mb-2 sm:mb-3">사용자가 전략을 설계하면 AI가 실질적인 조언을 줍니다.</p>
                      <p>유튜브 링크, PDF, 텍스트 파일을 학습시켜 당신만의 비즈니스 파트너가 됩니다.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-100">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 font-bold text-xs sm:text-sm">Q</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-2 sm:mb-3">아이디어는 내가 직접 정리할 수 있어요</h3>
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 font-bold text-xs sm:text-sm">A</span>
                    </div>
                    <div className="text-slate-700 leading-relaxed text-sm sm:text-base">
                      <p><strong>콘텐츠 → 팬덤 형성 → 사업화까지 한 눈에 보이는 퍼널로 &apos;구조&apos;를 설계하세요</strong></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-100">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 font-bold text-xs sm:text-sm">Q</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-2 sm:mb-3">툴만으로 충분할까요?</h3>
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 font-bold text-xs sm:text-sm">A</span>
                    </div>
                    <div className="text-slate-700 leading-relaxed text-sm sm:text-base">
                      <p className="mb-2 sm:mb-3">Canvas AI는 툴을 넘어 <strong>커뮤니티와 실행 지원까지 제공</strong>합니다.</p>
                      <p>희망자에 한해 콘텐츠/비즈니스/마케팅 전문가들과 함께하는 디스코드 커뮤니티에 초대합니다.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-4 sm:mb-6">주요 기능</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl">🚀</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-2 sm:mb-3">시각적인 플로우 생성</h3>
              <p className="text-slate-600 text-sm sm:text-base">내 머릿 속의 기획이 자리잡힌 구조로 구현</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl">📋</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-2 sm:mb-3">전문 AI 조교</h3>
              <p className="text-slate-600 text-sm sm:text-base">브랜드 구축, 팬덤 형성, 퍼널 설계를 위해 실질적인 도움을 주는 AI 조교가 24시간 곁에</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl">👥</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-2 sm:mb-3">팀 협업</h3>
              <p className="text-slate-600 text-sm sm:text-base">코멘트, 태스크 배정, 실행 로드맵 공유</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl">🧠</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-2 sm:mb-3">나만의 데이터 학습</h3>
              <p className="text-slate-600 text-sm sm:text-base">유튜브, PDF, 텍스트 학습으로 맞춤형 AI</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl">📤</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-2 sm:mb-3">즉시 내보내기</h3>
              <p className="text-slate-600 text-sm sm:text-base">공유링크로 즉시 내보내기</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl">⚡</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-2 sm:mb-3">할 일 체크리스트</h3>
              <p className="text-slate-600 text-sm sm:text-base">체크리스트 기능, 메모장 기능</p>
            </div>
          </div>
        </div>
      </div>

      {/* Strengths Section */}
      <div className="py-16 sm:py-24 bg-navy-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">강점</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📊</div>
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">구조만 잡히면 수익은 3배</h3>
              <p className="text-slate-300 text-sm sm:text-base">한 눈에 보이는 시각적인 퍼널 설계</p>
            </div>

            <div className="text-center">
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🎯</div>
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">상상력을 넓히는 화이트보드</h3>
              <p className="text-slate-300 text-sm sm:text-base">빈 화면에 막히지 않음</p>
            </div>

            <div className="text-center sm:col-span-2 lg:col-span-1">
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🤖</div>
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">전문 AI</h3>
              <p className="text-slate-300 text-sm sm:text-base">콘텐츠 비즈니스 특화 AI로 보조</p>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Materials Section */}
      <div className="py-16 sm:py-24 bg-navy-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="flex flex-col sm:flex-row items-center justify-center mb-6 sm:mb-8">
              <Image 
                src="/images/dothegy-logo.png" 
                alt="두더지웍스 로고" 
                width={48}
                height={48}
                className="h-10 sm:h-12 w-auto mb-3 sm:mb-0 sm:mr-4"
              />
              <h2 className="text-2xl sm:text-3xl font-bold">캔버스AI에 내장된 자료들</h2>
            </div>
            <p className="text-base sm:text-xl text-slate-300 leading-relaxed max-w-4xl mx-auto mb-6 sm:mb-8 px-4">
              크리에이터 기획사 <strong>두더지웍스</strong>가 쌓은 경험을 전부 캔버스AI에 학습시켰습니다.<br className="hidden sm:block" />
              <span className="sm:hidden"> </span>여기에 나만의 데이터까지 학습시켜서 나한테 최적화된 AI로 활용하세요
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 max-w-4xl mx-auto mb-6 sm:mb-8">
              <div className="flex items-center justify-center space-x-3 sm:space-x-4 bg-slate-800 rounded-2xl p-4 sm:p-6">
                <div className="text-3xl sm:text-4xl">📺</div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-400">100만+</div>
                  <div className="text-xs sm:text-sm text-slate-300">콘텐츠 기획</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-3 sm:space-x-4 bg-slate-800 rounded-2xl p-4 sm:p-6">
                <div className="text-3xl sm:text-4xl">💰</div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-green-400">3억+</div>
                  <div className="text-xs sm:text-sm text-slate-300">매출 발생</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-3 sm:space-x-4 bg-slate-800 rounded-2xl p-4 sm:p-6">
                <div className="text-3xl sm:text-4xl">🏢</div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-purple-400">30개+</div>
                  <div className="text-xs sm:text-sm text-slate-300">브랜드 구축</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8 text-blue-400">자료 中 일부</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-slate-300 text-sm sm:text-base">유튜브, 인스타그램 채널 기획서 템플릿 다수</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-slate-300 text-sm sm:text-base">수익화를 위한 콘텐츠 유형 정리본 PDF</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-slate-300 text-sm sm:text-base">콘텐츠 기반 비즈니스 퍼널 설계법 PDF</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-slate-300 text-sm sm:text-base">오픈채팅방 운영 매뉴얼</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-slate-300 text-sm sm:text-base">세일즈 & 리드 제너레이션 통합 가이드</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-slate-300 text-sm sm:text-base">상세페이지 제작 가이드</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-4 sm:mb-6 px-4">간단한 요금제</h2>
            <p className="text-base sm:text-lg text-slate-600 px-4">무료로 시작해서 필요할 때 업그레이드하세요</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-lg border-2 border-slate-100">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-navy-900 mb-2">무료 플랜</h3>
                <div className="text-3xl sm:text-4xl font-bold text-slate-600 mb-3 sm:mb-4">₩0</div>
                <p className="text-slate-500 text-sm sm:text-base">영원히 무료</p>
              </div>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>노드 10개</strong> (메모, 할일 포함)</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>협업자 추가 기능</strong> 제한</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>AI 질문 5개</strong> 제한</span>
                </li>
              </ul>
              <Link href="/sign-up">
                <Button 
                  className="w-full bg-slate-100 text-navy-900 hover:bg-slate-200 font-semibold text-sm sm:text-base py-2 sm:py-3"
                >
                  무료로 시작하기
                </Button>
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-navy-900 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl sm:transform sm:scale-105">
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-block bg-blue-500 text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-bold mb-3 sm:mb-4">
                  인기
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">Pro 플랜</h3>
                <div className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">₩9,900</div>
                <p className="opacity-90 text-sm sm:text-base">월 구독</p>
              </div>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>무제한 노드</strong> 생성</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>무제한 협업자</strong> 초대</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>무제한 AI 질문</strong></span>
                </li>
              </ul>
              <Link href="/sign-up">
                <Button 
                  className="w-full bg-white text-navy-900 hover:bg-slate-50 font-semibold shadow-lg text-sm sm:text-base py-2 sm:py-3"
                >
                  Pro로 업그레이드
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="py-20 sm:py-32 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-6 sm:mb-8 px-4 leading-tight">
            아이디어는 충분합니다.<br />
            이제는 <span className="text-blue-600">구조</span>가 필요합니다.
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mb-12 sm:mb-16 px-4">
            <Link href="/sign-up">
              <Button 
                size="lg" 
                className="text-base sm:text-lg px-8 sm:px-12 py-4 sm:py-6 bg-navy-900 hover:bg-navy-800 text-white font-bold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200 rounded-xl"
              >
                👉 Canvas AI 시작하기
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-slate-500">
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-base sm:text-lg">신용카드 불필요</span>
            </div>
            <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-slate-500">
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-base sm:text-lg">30초 만에 시작</span>
            </div>
            <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-slate-500">
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-base sm:text-lg">언제든 업그레이드</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-300 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="text-base sm:text-lg font-semibold text-white">주식회사 두더지</div>
            <div className="text-xs sm:text-sm leading-relaxed">
              <p>서울특별시 성동구 왕십리로 326, 6층 R637호(도선동)</p>
              <p className="mt-1 sm:mt-2">대표자명 : 김태민<br className="sm:hidden" /> <span className="hidden sm:inline">&nbsp;&nbsp;|&nbsp;&nbsp;</span> 
                <a href="#" className="hover:text-white transition-colors">이용약관</a><br className="sm:hidden" /> <span className="hidden sm:inline">&nbsp;&nbsp;|&nbsp;&nbsp;</span> 
                <a href="#" className="hover:text-white transition-colors">개인정보처리방침</a>
              </p>
              <p className="mt-1 sm:mt-2">
                문의 : <a href="mailto:dothegy2021@gmail.com" className="hover:text-white transition-colors">dothegy2021@gmail.com</a>
              </p>
              <p className="mt-1 sm:mt-2">
                사업자 번호 : 763-86-02516<br className="sm:hidden" /> <span className="hidden sm:inline"> / </span>통신판매등록번호 : 제 2021-서울서대문-1805호
              </p>
            </div>
            <div className="pt-3 sm:pt-4 border-t border-slate-600 text-xs text-slate-400">
              Copyright © 주식회사 두더지 Corp. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
