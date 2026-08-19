'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { googleClientId, loadGoogleIdentityScript, signInWithGoogleCredential } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useGlobalStore((state) => state.setUser);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            setLoading(true);
            setError('');
            try {
              const user = await signInWithGoogleCredential(credential);
              setUser(user);
              router.push('/');
            } catch {
              setError('Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
              setLoading(false);
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 360,
          locale: 'ko',
        });
        setLoading(false);
      })
      .catch(() => {
        setError('Google 로그인 서비스를 불러오지 못했습니다.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, setUser]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center mx-auto text-2xl font-black shadow-lg">
            G
          </div>
          <h1 className="mt-6 text-3xl font-black text-gray-900 tracking-tight">GLOBAL 교포</h1>
          <p className="mt-2 text-sm text-gray-600">전 세계 교민을 연결하는 안전한 포털</p>
        </div>

        <div className="mt-8 flex justify-center min-h-11">
          {loading && <span className="text-sm text-gray-400 self-center">Google 로그인 준비 중...</span>}
          <div ref={buttonRef} className={loading ? 'hidden' : ''} />
        </div>

        {error && <p className="mt-4 text-center text-sm font-bold text-red-600">{error}</p>}

        <div className="mt-8 bg-blue-50 text-blue-800 p-4 rounded-2xl flex gap-3 text-xs font-medium items-start leading-relaxed">
          <ShieldCheck size={18} className="shrink-0 mt-0.5" />
          <span>Google 계정으로만 가입하며, 게시글 작성과 채팅에는 로그인 인증이 필요합니다.</span>
        </div>
      </div>
    </div>
  );
}
