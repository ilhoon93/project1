/**
 * AI 웨딩스냅 이용약관 (표준 템플릿 초안 v1).
 *
 * 본 문서는 표준 템플릿이며, 실제 서비스 출시 전 변호사 검토 권장.
 * 약관 본문 변경 시 src/lib/snap/consent.ts 의 SNAP_CONSENT_VERSION 도 같이 증가.
 */

export const metadata = {
  title: 'AI 웨딩스냅 이용약관',
};

export default function SnapTermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 text-[#3D2E1F]">
      <h1 className="mb-2 text-2xl font-semibold">AI 웨딩스냅 이용약관</h1>
      <p className="mb-6 text-xs text-[#8B7355]">
        시행일: 2025-01-01 · 버전 v1
      </p>

      <Section title="제1조 (목적)">
        <p>
          이 약관은 우리다운(이하 &ldquo;회사&rdquo;)이 제공하는 AI 웨딩스냅
          서비스(이하 &ldquo;서비스&rdquo;)의 이용 조건과 절차, 회사와 이용자의
          권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (서비스 내용)">
        <p>회사는 다음 서비스를 제공합니다.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>이용자가 업로드한 사진을 기반으로 AI 합성 웨딩 사진 생성</li>
          <li>생성된 이미지의 다운로드, 청첩장 알림장 내 활용</li>
          <li>크레딧 결제 / 환불 처리</li>
        </ul>
      </Section>

      <Section title="제3조 (이용자의 의무)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>본인 또는 동의를 받은 제3자의 사진만 업로드해야 합니다.</li>
          <li>
            타인의 초상권·저작권을 침해하는 이미지를 업로드해서는 안 됩니다.
          </li>
          <li>
            생성된 이미지를 음란물·범죄 도용·허위 정보 유포 등 불법적 목적으로
            사용해서는 안 됩니다.
          </li>
          <li>
            크레딧을 부정 취득하거나 시스템 취약점을 악용해서는 안 됩니다.
          </li>
        </ol>
      </Section>

      <Section title="제4조 (회사의 의무)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            이용자의 개인정보 및 업로드 사진을 별도의 개인정보처리방침에 따라
            안전하게 관리합니다.
          </li>
          <li>
            AI 처리 과정에서 발생하는 일시적 데이터는 결과 생성 후 합리적 기간
            내에 삭제하거나 익명화합니다.
          </li>
          <li>
            서비스 장애 발생 시 이용자에게 합리적 범위에서 안내합니다.
          </li>
        </ol>
      </Section>

      <Section title="제5조 (AI 합성 결과물의 권리)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            이용자가 본인 사진을 업로드해 생성한 결과물의 사용권은 이용자에게
            귀속됩니다.
          </li>
          <li>
            회사는 서비스 품질 개선 / 기술 연구 목적으로 식별 정보를 제거한
            상태의 통계·메타데이터를 활용할 수 있습니다.
          </li>
          <li>
            결과물에는 AI 합성임을 표시하는 워터마크 또는 메타데이터가 포함될
            수 있습니다.
          </li>
        </ol>
      </Section>

      <Section title="제6조 (크레딧 및 환불)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>유료 크레딧 구매 후 사용하지 않은 분은 7일 내 환불 가능합니다.</li>
          <li>
            시스템 오류로 생성에 실패한 경우 해당 크레딧은 자동 환불됩니다.
          </li>
          <li>
            이미 사용된 크레딧(결과물이 생성된 경우) 은 환불 대상이 아닙니다.
          </li>
        </ol>
      </Section>

      <Section title="제7조 (책임 제한)">
        <p>
          AI 합성 특성상 결과 품질은 입력 사진의 조건(조명·해상도·각도 등)
          및 모델 응답에 영향을 받습니다. 회사는 결과 품질에 대한 절대적
          만족을 보장하지 않으나, 합리적 품질 유지를 위해 지속 개선합니다.
        </p>
      </Section>

      <Section title="제8조 (약관 변경)">
        <p>
          회사는 필요 시 약관을 변경할 수 있으며, 변경 시 서비스 내 공지 및
          재동의 절차를 통해 이용자에게 알립니다.
        </p>
      </Section>

      <div className="mt-10 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-4 text-xs text-[#5C4633]">
        <p>관련 문서:</p>
        <ul className="ml-5 list-disc">
          <li>
            <a href="/legal/snap-privacy" className="underline">
              개인정보 처리방침
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-semibold text-[#3D2E1F]">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-[#5C4633]">
        {children}
      </div>
    </section>
  );
}
