"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/Ui/layout";
import { Button } from "@/components/Ui/buttons";
import Link from "next/link";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Canvas AI</h1>
              <p className="text-lg text-muted-foreground">AI 기반 업무 협업 플랫폼</p>
            </div>
          </div>
          
          <h2 className="text-5xl font-bold text-foreground mb-6">
            지식과 AI가 만나는 <br />
            <span className="text-primary">스마트한 업무 공간</span>
          </h2>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            개인 지식, 할일, 메모를 한 곳에 모아 AI와 실시간으로 소통하며 
            더 효율적인 업무 협업을 경험해보세요.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="text-left">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <CardTitle className="text-xl">통합 지식 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                PDF, 유튜브 영상, 웹사이트를 업로드하고 
                개인 지식, 할일, 메모를 체계적으로 관리하세요.
              </p>
            </CardContent>
          </Card>

          <Card className="text-left">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <CardTitle className="text-xl">AI와 실시간 소통</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                저장된 지식을 바탕으로 AI와 자연스럽게 대화하며 
                업무에 필요한 인사이트와 솔루션을 얻으세요.
              </p>
            </CardContent>
          </Card>

          <Card className="text-left">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <CardTitle className="text-xl">스마트한 협업</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                AI가 당신의 업무 패턴을 학습하여 
                더 효율적인 작업 방식을 제안합니다.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
              >
                무료로 시작하기
              </Button>
            </Link>
            
            <Link href="/sign-in">
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6"
              >
                로그인
              </Button>
            </Link>
          </div>
          
          <p className="text-sm text-muted-foreground">
            무료로 시작하세요.
          </p>
        </div>
      </div>
    </div>
  );
}