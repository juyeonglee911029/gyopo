export default function TermsPage() {
  return <article className="container mx-auto max-w-3xl px-4 py-12 text-slate-100">
    <p className="text-xs font-black uppercase tracking-[.24em] text-rose-300">Community Rules</p>
    <h1 className="mt-3 text-3xl font-black">이용약관 및 랜덤채팅 안전규칙</h1>
    <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
      <section><h2 className="text-lg font-black text-white">1. 18세 이상 서비스</h2><p className="mt-2">랜덤 화상채팅과 GYOPO의 영상채팅은 만 18세 이상 인증 회원만 이용할 수 있습니다. 나이를 속이거나 타인의 계정을 사용하는 행위는 금지되며, 미성년자 접근 또는 미성년자와의 부적절한 접촉이 의심되면 즉시 연결이 종료되고 운영자 검토 대상이 됩니다.</p></section>
      <section><h2 className="text-lg font-black text-white">2. 금지 행위</h2><p className="mt-2">성적·착취·불법 콘텐츠, 협박·괴롭힘·차별, 실명·전화번호·주소·이메일 공개, 외부 연락처 도배, 사기·피싱·악성 링크, 자동화·스크래핑·서비스 공격을 금지합니다.</p></section>
      <section><h2 className="text-lg font-black text-white">3. 신고와 운영 조치</h2><p className="mt-2">이용자는 상대방을 신고하거나 차단할 수 있습니다. 운영자는 신고 내용을 검토해 메시지 제거, 매칭 제한, 일시 정지, 영구 정지, 관련 기록 보존 및 필요한 경우 관계 기관 협조를 할 수 있습니다.</p></section>
      <section><h2 className="text-lg font-black text-white">4. 자동화된 안전 조치</h2><p className="mt-2">서비스는 개인정보·링크·도배를 자동 필터링하고 IP·세션 요청 제한과 봇 방지를 적용합니다. 자동 판정이 항상 정확하지 않을 수 있으므로 이용자는 안전한 상황에서만 카메라·마이크를 켜고, 위험하면 즉시 종료·차단·신고해야 합니다.</p></section>
      <section><h2 className="text-lg font-black text-white">5. 출시 전 검토</h2><p className="mt-2">영상채팅을 일반 공개하기 전 운영자는 서비스 제공 국가별 법률, 아동 안전 신고 절차, 개인정보 영향, 불법 콘텐츠 보존·제출 의무와 24시간 대응 체계를 검토하고 필요한 담당자와 외부 전문기관을 지정해야 합니다.</p></section>
    </div>
  </article>;
}
