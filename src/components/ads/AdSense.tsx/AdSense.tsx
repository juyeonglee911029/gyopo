import Script from 'next/script';

const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export function AdSenseScript() {
  if (!clientId) return null;
  return <Script async src={'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + clientId} crossOrigin="anonymous" strategy="afterInteractive" />;
}

export default function AdSenseSlot({ slot, format = 'auto' }: { slot?: string; format?: string }) {
  if (!clientId || !slot) return null;
  return <div className="min-h-[90px] w-full overflow-hidden"><ins className="adsbygoogle block" style={{ display: 'block' }} data-ad-client={clientId} data-ad-slot={slot} data-ad-format={format} data-full-width-responsive="true" /><script dangerouslySetInnerHTML={{ __html: '(window.adsbygoogle = window.adsbygoogle || []).push({});' }} /></div>;
}
