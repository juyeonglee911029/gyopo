'use client';
import { useState } from 'react';
import { useGlobalStore } from '@/store/useGlobalStore';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Phone } from 'lucide-react';

export default function LoginPage() {
  const { setUser } = useGlobalStore();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const handleGoogleLogin = () => {
    // 1단계: 구글 로그인 완료 후 2단계 전화번호 인증으로 이동
    setStep(2);
  };

  const handleSendCode = () => {
    if (phone.length < 10) return alert("올바른 전화번호를 입력하세요.");
    setCodeSent(true);
    alert(`[시스템] ${phone} 번호로 인증번호가 발송되었습니다. (테스트용: 아무 번호나 입력)`);
  };

  const handleVerifyAndLogin = () => {
    if (!code) return alert("인증번호를 입력하세요.");
    
    // Mocking OAuth + Phone logic
    setUser({
      id: 'user_99887',
      name: '새로운교민',
      email: 'newuser@gmail.com',
      image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
      usdtBalance: 0.0,
      isSubscribed: false,
    });
    alert("[시스템] 보안 인증이 완료되었습니다. 환영합니다!");
    router.push('/');
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
        
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h2 className="mt-6 text-3xl font-black text-gray-900 tracking-tighter">GLOBAL 교포</h2>
              <p className="mt-2 text-sm text-gray-600">안전한 생태계를 위해 구글 계정으로 시작합니다.</p>
            </div>
            
            <div className="mt-8 space-y-4">
              <button 
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-4 py-4 text-gray-700 font-bold hover:bg-gray-50 hover:border-blue-500 transition-all shadow-sm"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-lg">Google 계정으로 계속하기</span>
              </button>

              <div className="bg-red-50 text-red-700 p-3 rounded-xl flex gap-2 text-xs font-bold items-start">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <span>
                  중복 가입 방지 및 어뷰징 방지를 위해 이메일/비밀번호 가입은 전면 차단되었습니다.
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
             <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone size={28} />
                </div>
                <h2 className="text-2xl font-black text-gray-900">전화번호 1차 인증</h2>
                <p className="mt-2 text-sm text-gray-500">안전한 P2P 송금과 장터 이용을 위해<br/>최초 1회 본인 인증이 필요합니다.</p>
             </div>

             <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">휴대폰 번호 (국가코드 포함)</label>
                  <div className="flex gap-2">
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+82 10 1234 5678" 
                      className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold tracking-wider"
                    />
                    <button onClick={handleSendCode} className="bg-gray-900 text-white px-4 rounded-xl font-bold text-sm hover:bg-gray-800 transition">인증발송</button>
                  </div>
                </div>

                {codeSent && (
                  <div className="animate-in fade-in duration-300">
                    <label className="block text-sm font-bold text-gray-700 mb-1">인증 번호</label>
                    <input 
                      type="number" 
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="6자리 숫자" 
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-center text-lg font-black tracking-[0.5em]"
                    />
                  </div>
                )}

                <button 
                  onClick={handleVerifyAndLogin}
                  disabled={!codeSent}
                  className={`w-full mt-6 py-4 rounded-xl font-bold text-white shadow-md transition ${codeSent ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
                >
                  인증 완료 및 로그인
                </button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}