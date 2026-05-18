/**
 * AI 웨딩스냅 개인정보 처리방침 (표준 템플릿 초안 v1).
 *
 * 본 문서는 표준 템플릿이며, 실제 서비스 출시 전 변호사 검토 권장.
 * 안면 정보 + 제3자 처리(fal.ai) + AI 합성 + (옵션) 외부 채널 배포까지
 * 한국 PIPA 기준으로 명시.
 */

export const metadata = {
  title: 'AI 웨딩스냅 개인정보 처리방침',
};

export default function SnapPrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 text-[#3D2E1F]">
      <h1 className="mb-2 text-2xl font-semibold">개인정보 처리방침 — AI 웨딩스냅</h1>
      <p className="mb-6 text-xs text-[#8B7355]">
        시행일: 2025-01-01 · 버전 v1
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <p>회사는 AI 웨딩스냅 서비스 제공을 위해 다음 정보를 수집합니다.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>이용자가 업로드하는 사진</strong> (셀카·커플 사진) — 안면
            정보 포함
          </li>
          <li>
            <strong>AI 합성 결과 이미지</strong>
          </li>
          <li>이용자 식별자(이메일 등 가입 정보)와 결제 내역</li>
          <li>
            서비스 이용 기록(IP, 브라우저, 동의 시점 등) — 부정 사용 방지 / 감사
            추적
          </li>
        </ul>
      </Section>

      <Section title="2. 개인정보 수집 및 이용 목적">
        <ul className="ml-5 list-disc space-y-1">
          <li>업로드 사진을 기반으로 AI 합성 결과 이미지 생성</li>
          <li>결과 이미지 저장·다운로드 제공</li>
          <li>크레딧 결제·환불 처리</li>
          <li>서비스 품질 개선(식별 정보 제거 후 통계 분석)</li>
          <li>법령상 의무 이행 및 분쟁 대응</li>
        </ul>
      </Section>

      <Section title="3. 개인정보 보유 및 이용 기간">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            업로드 원본 사진: 합성 완료 후 <strong>30일</strong> 보관 후 삭제
            (재생성·문의 대응 기간)
          </li>
          <li>
            합성 결과 이미지: 이용자가 직접 삭제하기 전까지 보관 (계정 탈퇴 시
            삭제)
          </li>
          <li>
            결제·이용 기록: 전자상거래법 등 관련 법령에 따라{' '}
            <strong>5년</strong> 보관
          </li>
          <li>
            동의 기록: 동의 철회 시점 기준 <strong>3년</strong> 보관
            (감사·분쟁 대응)
          </li>
        </ul>
      </Section>

      <Section title="4. 개인정보 제3자 제공 및 처리 위탁">
        <p>회사는 다음 업무를 외부에 위탁합니다.</p>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#D4C5B0]">
              <th className="py-2 text-left">수탁자</th>
              <th className="py-2 text-left">위탁 업무</th>
              <th className="py-2 text-left">데이터 처리 위치</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#E8DCC9]">
              <td className="py-2">fal.ai, Inc.</td>
              <td className="py-2">AI 이미지 합성 / 업스케일 / 얼굴 검출</td>
              <td className="py-2">미국</td>
            </tr>
            <tr className="border-b border-[#E8DCC9]">
              <td className="py-2">Supabase Inc.</td>
              <td className="py-2">데이터베이스 / 스토리지 호스팅</td>
              <td className="py-2">대한민국 / 미국</td>
            </tr>
            <tr className="border-b border-[#E8DCC9]">
              <td className="py-2">Vercel Inc.</td>
              <td className="py-2">웹 애플리케이션 호스팅</td>
              <td className="py-2">미국</td>
            </tr>
            <tr>
              <td className="py-2">포트원 / 토스페이먼츠</td>
              <td className="py-2">결제 처리</td>
              <td className="py-2">대한민국</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-[#8B7355]">
          위탁 업무 처리 시 개인정보는 최소한으로 전달되며, 수탁자는 회사와
          동등한 수준의 보안 의무를 부담합니다.
        </p>
      </Section>

      <Section title="5. 국외 이전">
        <p>
          위 표의 fal.ai (미국), Supabase 일부 리전 (미국), Vercel (미국) 은
          국외에서 데이터를 처리합니다. 이용자는 본 처리방침에 동의함으로써
          국외 이전에 동의하는 것으로 봅니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리">
        <ul className="ml-5 list-disc space-y-1">
          <li>개인정보 열람 / 정정 / 삭제 / 처리 정지 요구</li>
          <li>동의 철회 (단, 철회 시 서비스 일부 또는 전부 이용 제한)</li>
          <li>회원 탈퇴 시 즉시 처리 (법령상 보존 의무가 있는 정보 제외)</li>
        </ul>
        <p className="mt-2 text-xs">
          위 권리 행사는 서비스 내 마이페이지 또는 별도 안내된 연락처로 요청
          가능합니다.
        </p>
      </Section>

      <Section title="7. 안전성 확보 조치">
        <ul className="ml-5 list-disc space-y-1">
          <li>이용자 업로드 사진은 사설(non-public) 스토리지에 격리 보관</li>
          <li>접근 시 서명 URL 발급 (만료 시간 적용)</li>
          <li>전송 구간 TLS / 저장 구간 암호화</li>
          <li>RLS(Row-Level Security) 정책으로 사용자별 데이터 격리</li>
        </ul>
      </Section>

      <Section title="8. 외부 채널 배포 (선택 동의)">
        <p>
          이용자가 명시적으로 동의한 경우에 한해, 회사는 결과 이미지를
          공식 SNS·마켓플레이스 등 외부 채널에 노출할 수 있습니다.
          이용자는 이 동의를 언제든 철회할 수 있으며, 철회 시 회사는 합리적
          기간 내에 노출을 중단합니다.
        </p>
      </Section>

      <Section title="9. 처리방침 변경">
        <p>
          본 방침이 변경되는 경우, 서비스 내 공지 및 재동의 절차를 거칩니다.
        </p>
      </Section>
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
