export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xl font-black text-gray-800 mb-4">K-Global Portal</h3>
            <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
              전 세계 한인 교민을 위한 가장 빠르고 정확한 정보 포털. 
              구인/구직, 업체목록, 사고팔고, 커뮤니티까지 하나의 플랫폼에서 해결하세요.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 mb-4">바로가기</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-blue-600 transition-colors">공지사항</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">광고 문의</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">제휴 제안</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 mb-4">고객지원</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-blue-600 transition-colors">이용약관</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">개인정보처리방침</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">고객센터</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-12 pt-8 text-center text-sm text-gray-400">
          &copy; 2026 K-Global Portal. All rights reserved.
        </div>
      </div>
    </footer>
  );
}