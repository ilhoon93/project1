/**
 * 우리다운 통합 서비스 이용약관 (전체 서비스: 알림장 + AI 웨딩스냅).
 * AI 웨딩스냅 단독 약관(동의 버전 관리)은 /legal/snap-terms 를 함께 유지한다.
 */

export const metadata = {
  title: '이용약관 — 우리다운',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 text-[#3D2E1F]">
      <h1 className="mb-2 text-2xl font-semibold">우리다운 서비스 이용약관</h1>
      <p className="mb-6 text-xs text-[#8B7355]">시행일: 2026-06-01</p>

      <Section title="제1조 (목적)">
        <p>
          이 약관은 우리다운(이하 &ldquo;회사&rdquo;)이 제공하는 모바일 청첩장·알림장
          제작·발행 서비스 및 AI 웨딩스냅 서비스(이하 통칭 &ldquo;서비스&rdquo;)의 이용
          조건과 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (정의)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>&ldquo;이용자&rdquo;란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
          <li>&ldquo;알림장&rdquo;이란 이용자가 제작하는 모바일 청첩장 콘텐츠를 말합니다.</li>
          <li>
            &ldquo;발행&rdquo;이란 알림장을 공개 URL로 게시해 제3자(하객)가 열람할 수
            있게 하는 것을, &ldquo;하객용 URL&rdquo;·&ldquo;소장용 URL&rdquo;이란 각각
            하객 열람용·이용자 보관용 링크를 말합니다.
          </li>
          <li>
            &ldquo;크레딧&rdquo;이란 발행권·영구소장·AI 스냅 등 서비스 이용에 사용되는
            유·무료 이용권을 말합니다.
          </li>
          <li>
            &ldquo;게스트 콘텐츠&rdquo;란 하객 등 제3자가 방명록·서명·투표 등으로 입력한
            게시물을 말합니다.
          </li>
        </ol>
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>본 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이 발생합니다.</li>
          <li>
            회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시
            적용일·사유를 명시해 적용일 7일(이용자에게 불리한 변경은 30일) 전부터
            서비스 내 공지합니다.
          </li>
          <li>
            이용자가 변경 약관에 동의하지 않을 경우 이용을 중단하고 탈퇴할 수 있습니다.
            공지 후 별도 거부 의사 없이 서비스를 계속 이용하면 변경에 동의한 것으로 봅니다.
          </li>
        </ol>
      </Section>

      <Section title="제4조 (서비스의 내용)">
        <ul className="ml-5 list-disc space-y-1">
          <li>모바일 알림장 제작·편집·발행 및 하객용/소장용 URL 제공</li>
          <li>방명록·서명·투표·갤러리 등 알림장 부가 기능</li>
          <li>업로드 사진 기반 AI 웨딩스냅 이미지 생성 및 알림장 내 활용</li>
          <li>크레딧(발행권·영구소장·AI 스냅 등) 결제 및 환불 처리</li>
        </ul>
      </Section>

      <Section title="제5조 (회원가입 및 계정)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>이용자는 네이버 등 제휴 소셜 로그인을 통해 가입·이용합니다.</li>
          <li>계정 정보의 관리 책임은 이용자에게 있으며, 계정의 부정 사용을 인지한 경우 즉시 회사에 통지해야 합니다.</li>
          <li>회사는 타인 명의 도용, 허위 정보 기재, 부정 이용 등의 경우 이용을 제한할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제6조 (크레딧 및 결제)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            유료 크레딧은 <strong>네이버 스마트스토어</strong>를 통해 구매하며, 결제·취소는
            네이버 스마트스토어의 결제 절차와 정책에 따릅니다. 회사 사이트 내 자체 결제는
            제공하지 않습니다.
          </li>
          <li>구매한 주문 정보를 서비스에 등록하면 해당 크레딧이 계정에 적립됩니다.</li>
          <li>가입 시 제공되는 무료 크레딧 등 프로모션 혜택의 조건·유효기간은 별도 고지에 따릅니다.</li>
          <li>크레딧은 현금으로 환급되지 않으며, 환불은 제7조에 따릅니다.</li>
        </ol>
      </Section>

      <Section title="제7조 (청약철회 및 환불)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            결제·취소·환불은 <strong>네이버 스마트스토어를 통해</strong> 이루어지며, 구매일로부터
            7일 이내에 <strong>사용하지 않은</strong> 크레딧에 대해 청약을 철회(주문 취소)할 수
            있습니다.
          </li>
          <li>
            디지털 콘텐츠의 특성상 이미 <strong>사용·제공이 개시된</strong> 분(알림장 발행, AI
            스냅 생성 등 결과물이 제공된 경우)은 청약철회가 제한됩니다(전자상거래법 제17조 및
            콘텐츠 관련 법령에 따름).
          </li>
          <li>시스템 오류 등 회사 귀책으로 정상 제공되지 못한 경우 해당 크레딧은 자동 환원됩니다.</li>
          <li>
            환불·취소 문의는 네이버 스마트스토어 또는 제13조의 연락처(네이버 톡톡)로 접수합니다.
          </li>
        </ol>
      </Section>

      <Section title="제8조 (알림장 발행·유효기간·영구소장)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            발행된 알림장의 공개 URL 유효기간은 <strong>발행일로부터 최소 30일</strong>이며,
            예식일이 설정된 경우 <strong>예식일로부터 30일</strong>과 비교해 더 늦은 시점까지
            유지됩니다(예: 예식일이 없으면 발행일+30일).
          </li>
          <li>
            <strong>영구소장</strong>을 적용한 경우 위 유효기간과 무관하게 하객용·소장용 URL이
            유지됩니다. 다만 제9조의 서비스 변경·중단·종료의 경우에는 영향을 받을 수 있습니다.
          </li>
          <li>발행하지 않은 임시저장 알림장은 일정 기간(예: 14일) 미수정 시 정리될 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제9조 (서비스의 변경·중단·종료)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>회사는 운영·기술상 필요에 따라 서비스의 전부 또는 일부를 변경·중단할 수 있습니다.</li>
          <li>
            회사가 서비스를 <strong>종료</strong>하는 경우, 종료 예정일로부터 <strong>최소 30일
            전</strong>에 서비스 내 공지 등으로 안내합니다. <strong>서비스 종료 시 영구소장을
            포함한 모든 알림장 URL과 데이터는 더 이상 제공되지 않으며 삭제될 수 있습니다.</strong>
            이용자는 필요한 콘텐츠를 사전에 저장(다운로드)하여야 합니다.
          </li>
          <li>천재지변, 제3자 서비스(호스팅·결제·AI 등) 장애 등 불가항력 사유로 인한 중단에 대해 회사는 책임을 지지 않습니다.</li>
        </ol>
      </Section>

      <Section title="제10조 (이용자의 의무)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>본인 또는 적법한 동의를 받은 제3자의 사진·정보만 업로드해야 합니다.</li>
          <li>타인의 초상권·저작권·개인정보 등 권리를 침해하는 콘텐츠를 업로드·게시해서는 안 됩니다.</li>
          <li>음란·불법·허위·혐오 콘텐츠 생성 및 결과물의 불법적 이용을 금지합니다.</li>
          <li>크레딧 부정 취득, 시스템 취약점 악용, 자동화 도구를 통한 비정상 이용을 금지합니다.</li>
        </ol>
      </Section>

      <Section title="제11조 (게스트 콘텐츠)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>방명록·서명·투표 등 게스트 콘텐츠의 작성 책임은 해당 작성자에게 있습니다.</li>
          <li>회사 및 알림장 소유 이용자는 불법·권리침해·부적절한 게스트 콘텐츠를 사전 통지 없이 삭제·차단할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제12조 (콘텐츠의 권리)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>이용자가 업로드한 콘텐츠 및 본인 사진으로 생성한 AI 결과물의 사용권은 이용자에게 귀속됩니다.</li>
          <li>회사는 서비스 제공·품질 개선을 위해 식별 정보를 제거한 통계·메타데이터를 활용할 수 있습니다.</li>
          <li>서비스 자체(소프트웨어·디자인·상표·템플릿 등)에 대한 지식재산권은 회사에 귀속됩니다.</li>
          <li>AI 합성 결과물에는 AI 생성임을 나타내는 표시(워터마크·메타데이터)가 포함될 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제13조 (회사의 책임과 면책)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>회사는 관련 법령과 본 약관에 따라 안정적인 서비스 제공을 위해 노력합니다.</li>
          <li>
            AI 합성 결과의 품질은 입력 사진의 조건 및 모델 응답에 영향을 받으므로 회사는 절대적
            만족을 보장하지 않으며, 합리적 범위에서 품질 유지를 위해 노력합니다.
          </li>
          <li>
            회사는 이용자의 귀책, 제3자 서비스 장애, 불가항력으로 발생한 손해에 대해 책임을 지지
            않습니다. 또한 회사가 통제할 수 없는 사유로 인한 데이터 손실에 대비해 이용자가 콘텐츠를
            백업할 책임이 있습니다.
          </li>
          <li>
            회사의 손해배상 책임은 관련 법령이 허용하는 범위에서 제한되며, 회사의 고의 또는
            중대한 과실이 없는 한 간접·특별·결과적 손해에 대해서는 책임을 지지 않습니다. (본 조항은
            법령상 소비자에게 보장된 권리를 배제하지 않습니다.)
          </li>
        </ol>
      </Section>

      <Section title="제14조 (개인정보 보호)">
        <p>
          개인정보의 수집·이용·보관·제3자 제공·처리위탁 등에 관한 사항은 별도의{' '}
          <a href="/legal/privacy" className="underline">
            개인정보처리방침
          </a>
          에 따릅니다.
        </p>
      </Section>

      <Section title="제15조 (분쟁 해결 및 준거법)">
        <ol className="ml-5 list-decimal space-y-1">
          <li>본 약관 및 서비스에는 대한민국 법령이 적용됩니다.</li>
          <li>서비스 이용과 관련한 분쟁은 상호 신의성실의 원칙에 따라 협의로 해결하며, 협의가 어려운 경우 관련 법령(전자상거래 등에서의 소비자보호에 관한 법률 등)이 정한 절차 및 관할 법원에 따릅니다.</li>
        </ol>
      </Section>

      <Section title="제16조 (사업자 정보 및 문의)">
        <ul className="ml-5 list-disc space-y-1">
          <li>상호: 우리다운 · 대표: 강일훈</li>
          <li>사업자등록번호: 431-07-03350</li>
          <li>주소: 인천광역시 서구 크리스탈로 100, 708-씨 51호</li>
          <li>이메일: kohkhj902@gmail.com</li>
          <li>
            문의:{' '}
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
      </Section>

      <div className="mt-10 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-4 text-xs text-[#5C4633]">
        <p className="font-medium">부칙</p>
        <p className="mt-1">본 약관은 2026-06-01부터 시행합니다.</p>
        <p className="mt-2">관련 문서:</p>
        <ul className="ml-5 list-disc">
          <li>
            <a href="/legal/privacy" className="underline">
              개인정보처리방침
            </a>
          </li>
          <li>
            <a href="/legal/snap-terms" className="underline">
              AI 웨딩스냅 이용약관
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
      <div className="space-y-2 text-sm leading-relaxed text-[#5C4633]">{children}</div>
    </section>
  );
}
