/**
 * 우리다운 통합 개인정보처리방침 (전체 서비스: 알림장 + AI 웨딩스냅).
 * PIPA(개인정보보호법) 기준 항목 반영.
 */

export const metadata = {
  title: '개인정보처리방침 — 우리다운',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 text-[#3D2E1F]">
      <h1 className="mb-2 text-2xl font-semibold">개인정보처리방침</h1>
      <p className="mb-6 text-xs text-[#8B7355]">시행일: 2026-06-01</p>

      <Section title="1. 총칙">
        <p>
          우리다운(이하 &ldquo;회사&rdquo;)은 「개인정보 보호법」 등 관련 법령을 준수하며,
          이용자의 개인정보를 보호하기 위해 본 처리방침을 수립·공개합니다. 본 방침은 회사가
          제공하는 알림장 및 AI 웨딩스냅 서비스 전반에 적용됩니다.
        </p>
      </Section>

      <Section title="2. 수집하는 개인정보 항목">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>가입·계정</strong>: 소셜 로그인(네이버) 식별자, 이메일, 닉네임, 접근·갱신
            토큰
          </li>
          <li>
            <strong>알림장 작성 정보</strong>: 신랑·신부 및 가족 이름, 예식일, 업로드 사진,
            계좌 정보(선택), 인사말 등 이용자가 입력한 콘텐츠
          </li>
          <li>
            <strong>AI 웨딩스냅</strong>: 이용자가 업로드하는 사진(셀카·커플 사진, 안면 정보
            포함) 및 AI 합성 결과 이미지
          </li>
          <li>
            <strong>게스트 콘텐츠</strong>: 하객이 입력한 이름·메시지·서명 등(작성자 동의에 기반)
          </li>
          <li>
            <strong>결제·주문</strong>: 결제는 <strong>네이버 스마트스토어</strong>에서
            이루어지며 회사는 카드 등 결제정보를 수집하지 않습니다. 크레딧 적립을 위해
            주문번호·주문자 연락처 등 주문 확인에 필요한 정보만 처리합니다.
          </li>
          <li>
            <strong>자동 수집</strong>: 접속 IP, 브라우저·기기 정보, 이용 기록, 동의 시점
            (부정 사용 방지·감사 추적)
          </li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 수집·이용 목적">
        <ul className="ml-5 list-disc space-y-1">
          <li>회원 식별·인증 및 서비스 제공(알림장 제작·발행, AI 스냅 생성)</li>
          <li>크레딧 적립·환불 처리 및 네이버 스마트스토어 주문 검증</li>
          <li>고객 문의 대응 및 분쟁 처리</li>
          <li>부정 이용 방지·보안·서비스 품질 개선(식별 정보 제거 후 통계 분석)</li>
          <li>법령상 의무 이행</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 보유 및 이용 기간">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>가입 정보</strong>: 회원 탈퇴 시까지(탈퇴 시 지체 없이 파기, 법령상 보존
            의무 정보 제외)
          </li>
          <li>
            <strong>발행 알림장</strong>: 유효기간(발행일+최소 30일, 예식일 기준 등) 또는
            영구소장 적용 시까지 보관. 서비스 종료 시 삭제될 수 있음
          </li>
          <li>
            <strong>AI 스냅 업로드 원본</strong>: 합성 완료 후 30일 보관 후 삭제(재생성·문의
            대응). 결과 이미지는 이용자 삭제 또는 탈퇴 시까지
          </li>
          <li>
            <strong>결제·거래 기록</strong>: 전자상거래법에 따라 5년
          </li>
          <li>
            <strong>동의 기록</strong>: 철회 시점 기준 3년(감사·분쟁 대응)
          </li>
        </ul>
      </Section>

      <Section title="5. 개인정보의 제3자 제공 및 처리위탁">
        <p>회사는 원칙적으로 동의 없이 제3자에게 제공하지 않으며, 서비스 제공을 위해 다음과 같이 처리를 위탁합니다.</p>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#D4C5B0]">
              <th className="py-2 text-left">수탁자</th>
              <th className="py-2 text-left">위탁 업무</th>
              <th className="py-2 text-left">처리 위치</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#E8DCC9]">
              <td className="py-2">fal.ai, Inc.</td>
              <td className="py-2">AI 이미지 합성/업스케일</td>
              <td className="py-2">미국</td>
            </tr>
            <tr className="border-b border-[#E8DCC9]">
              <td className="py-2">Supabase Inc.</td>
              <td className="py-2">데이터베이스/스토리지</td>
              <td className="py-2">대한민국/미국</td>
            </tr>
            <tr className="border-b border-[#E8DCC9]">
              <td className="py-2">Vercel Inc.</td>
              <td className="py-2">웹 애플리케이션 호스팅</td>
              <td className="py-2">미국</td>
            </tr>
            <tr>
              <td className="py-2">네이버(주)</td>
              <td className="py-2">소셜 로그인·스마트스토어 결제/주문 확인</td>
              <td className="py-2">대한민국</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-[#8B7355]">
          위탁 시 개인정보는 최소한으로 전달되며, 수탁자는 회사와 동등한 보안 의무를 부담합니다.
        </p>
      </Section>

      <Section title="6. 개인정보의 국외 이전">
        <p>
          위 표의 fal.ai(미국), Supabase 일부 리전(미국), Vercel(미국)은 국외에서 데이터를
          처리합니다. 이용자는 본 방침에 동의함으로써 서비스 제공에 필요한 범위의 국외 이전에
          동의하는 것으로 봅니다.
        </p>
      </Section>

      <Section title="7. 개인정보의 파기">
        <p>
          보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적
          파일은 복구 불가능한 방법으로 삭제하고, 출력물은 분쇄·소각합니다.
        </p>
      </Section>

      <Section title="8. 정보주체(이용자)의 권리와 행사 방법">
        <ul className="ml-5 list-disc space-y-1">
          <li>개인정보 열람·정정·삭제·처리정지 요구</li>
          <li>동의 철회(철회 시 서비스 일부/전부 이용이 제한될 수 있음)</li>
          <li>회원 탈퇴(법령상 보존 의무 정보 제외하고 파기)</li>
        </ul>
        <p className="mt-2 text-xs">
          권리 행사는 서비스 내 마이페이지 또는 제10조의 연락처로 요청할 수 있으며, 회사는 지체
          없이 처리합니다.
        </p>
      </Section>

      <Section title="9. 안전성 확보 조치">
        <ul className="ml-5 list-disc space-y-1">
          <li>업로드 사진은 비공개(non-public) 스토리지에 격리 보관, 접근 시 만료형 서명 URL 발급</li>
          <li>전송 구간 TLS 암호화, 접근권한 최소화 및 RLS(행 수준 보안) 적용</li>
          <li>접근 기록 관리 및 부정 사용 모니터링</li>
        </ul>
      </Section>

      <Section title="10. 개인정보 보호책임자 및 문의">
        <ul className="ml-5 list-disc space-y-1">
          <li>개인정보 보호책임자: 강일훈(대표)</li>
          <li>이메일: kohkhj902@google.com</li>
          <li>사업장 주소: 인천광역시 서구 크리스탈로 100, 708-씨 51호</li>
          <li>
            문의 채널:{' '}
            <a
              href="https://talk.naver.com/ct/wiq8nf0"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              네이버 톡톡
            </a>
          </li>
        </ul>
        <p className="mt-2 text-xs text-[#8B7355]">
          개인정보 침해 신고·상담은 개인정보침해신고센터(privacy.kisa.or.kr, 118), 대검찰청·경찰청
          사이버수사 등에 문의할 수 있습니다.
        </p>
      </Section>

      <Section title="11. 처리방침의 변경">
        <p>본 방침이 변경되는 경우 시행일·변경 내용을 서비스 내 공지하며, 중요한 변경은 사전 고지합니다.</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-semibold text-[#3D2E1F]">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-[#5C4633]">{children}</div>
    </section>
  );
}
