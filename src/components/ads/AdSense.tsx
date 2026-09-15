import Script from 'next/script';

export const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-9753593382546704';

export function AdSenseScript() {
  return <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`} crossOrigin="anonymous" strategy="afterInteractive" />;
}

export default function AdSenseSlot({ slot, format = 'auto' }: { slot?: string; format?: string }) {
  if (!slot) return null;
  return <div className="min-h-[90px] w-full overflow-hidden"><ins className="adsbygoogle block" style={{ display: 'block' }} data-ad-client={adsenseClientId} data-ad-slot={slot} data-ad-format={format} data-full-width-responsive="true" /><script dangerouslySetInnerHTML={{ __html: '(window.adsbygoogle = window.adsbygoogle || []).push({});' }} /></div>;
}
