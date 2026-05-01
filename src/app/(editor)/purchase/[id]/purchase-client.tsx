'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as PortOne from '@portone/browser-sdk/v2';
import { Button } from '@/components/ui/button';

interface InvitationSummary {
  id: string;
  slug: string;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  paidAt: string | null;
  totalPrice: number;
}

interface Props {
  invitation: InvitationSummary;
  userEmail: string | null;
  userName: string | null;
  portoneStoreId: string;
  portoneChannelKey: string;
}

type Stage = 'idle' | 'preparing' | 'paying' | 'verifying' | 'paid' | 'publishing' | 'error';

export function PurchaseClient({
  invitation,
  userEmail,
  userName,
  portoneStoreId,
  portoneChannelKey,
}: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(invitation.paidAt ? 'paid' : 'idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const configMissing = !portoneStoreId || !portoneChannelKey;

  const handlePay = async () => {
    if (configMissing) {
      setErrorMsg('결제가 아직 설정되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setErrorMsg(null);
    setStage('preparing');

    let paymentId: string;
    let amount: number;
    let productName: string;
    try {
      const res = await fetch('/api/payment/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invitationId: invitation.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      paymentId = data.paymentId;
      amount = data.amount;
      productName = data.productName;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '결제 준비 실패');
      setStage('error');
      return;
    }

    setStage('paying');
    try {
      // The SDK's TS types incorrectly mark `alipayPlus` as required on the
      // payment-method union. We're using CARD; cast to the function's
      // parameter type to satisfy the compiler. (Tracked upstream — when the
      // SDK fixes the type, this assertion can be removed.)
      const response = await PortOne.requestPayment({
        storeId: portoneStoreId,
        channelKey: portoneChannelKey,
        paymentId,
        orderName: productName,
        totalAmount: amount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customer: {
          fullName: userName ?? `${invitation.groomName} ${invitation.brideName}`,
          email: userEmail ?? undefined,
        },
      } as Parameters<typeof PortOne.requestPayment>[0]);

      if (response?.code) {
        // user cancelled or payment failed
        if (response.code === 'FAILURE_TYPE_PG' || response.code === 'CANCEL') {
          setErrorMsg(response.message ?? '결제가 취소되었습니다');
        } else {
          setErrorMsg(response.message ?? `결제 실패 (${response.code})`);
        }
        setStage('error');
        return;
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '결제 진행 중 오류');
      setStage('error');
      return;
    }

    setStage('verifying');
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    } catch (e) {
      setErrorMsg(
        `결제 검증 실패: ${e instanceof Error ? e.message : 'unknown'}. 영업시간 내 문의해주세요.`,
      );
      setStage('error');
      return;
    }

    setStage('paid');
  };

  const handlePublish = async () => {
    setErrorMsg(null);
    setStage('publishing');
    try {
      const res = await fetch(`/api/publish/${invitation.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/${data.slug}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '발행 실패');
      setStage('error');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
      <header className="mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          ← 돌아가기
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">결제 후 발행</h1>
      </header>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">상품</h2>
        <p className="mt-1 text-base">미니멈 웨딩 스튜디오 — 알림장</p>

        <ul className="mt-4 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>· 8개 슬라이드 알림장 발행 (모바일 가로 스와이프)</li>
          <li>· AI 메인 사진 1장 (배경/의상 변환)</li>
          <li>· 하객 서명 · 퀴즈 · 투표 · 방명록 수집</li>
          <li>· 결혼식 후 30일간 공개</li>
        </ul>

        <div className="mt-5 flex items-baseline justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">결제 금액</span>
          <span className="text-2xl font-semibold">
            {invitation.totalPrice.toLocaleString('ko-KR')}원
          </span>
        </div>
      </section>

      <section className="mt-6 flex flex-col gap-3">
        {stage === 'paid' && !invitation.paidAt && (
          // We just paid in this session
          <p className="text-center text-sm text-emerald-600">
            ✓ 결제가 완료되었습니다. 발행 버튼을 눌러 공개해주세요.
          </p>
        )}
        {stage === 'paid' && invitation.paidAt && (
          <p className="text-center text-sm text-muted-foreground">
            결제가 완료된 알림장입니다. 발행 버튼을 눌러 공개해주세요.
          </p>
        )}

        {stage !== 'paid' && stage !== 'publishing' && (
          <Button
            type="button"
            onClick={handlePay}
            disabled={stage === 'preparing' || stage === 'paying' || stage === 'verifying'}
            className="h-12"
          >
            {stage === 'idle' || stage === 'error'
              ? `${invitation.totalPrice.toLocaleString('ko-KR')}원 결제하기`
              : stage === 'preparing'
                ? '주문 준비 중...'
                : stage === 'paying'
                  ? '결제 진행 중...'
                  : '결제 검증 중...'}
          </Button>
        )}

        {(stage === 'paid' || stage === 'publishing') && (
          <Button
            type="button"
            onClick={handlePublish}
            disabled={stage === 'publishing'}
            className="h-12"
          >
            {stage === 'publishing' ? '발행 중...' : '발행하기'}
          </Button>
        )}

        {errorMsg && (
          <p role="alert" className="text-center text-sm text-destructive">
            {errorMsg}
          </p>
        )}

        {configMissing && (
          <p className="text-center text-xs text-muted-foreground">
            (포트원 환경변수가 설정되지 않았습니다)
          </p>
        )}
      </section>

      <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
        결제 시 알림장 발행권 2개가 지급됩니다. 발행 후에도 편집 가능하며, 새 URL로 다시 발행할 수 있어요.
      </p>
    </main>
  );
}
