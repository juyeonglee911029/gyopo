import Link from 'next/link';

export default function BannerAd({ type = 'horizontal' }: { type?: 'horizontal' | 'vertical' | 'square' }) {
  const baseClasses = "bg-gray-100 border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden rounded-xl shadow-inner group transition-all hover:border-blue-300";
  const textClasses = "text-gray-400 font-bold uppercase tracking-widest text-sm z-10 mb-2";
  
  const sizeClasses = {
    horizontal: "w-full h-24 md:h-32",
    vertical: "w-full md:w-64 h-96",
    square: "w-full aspect-square max-w-sm"
  };

  return (
    <div className={`${baseClasses} ${sizeClasses[type]}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-100 opacity-50 group-hover:opacity-10 transition-opacity duration-300"></div>
      <span className={textClasses}>Advertisement Space</span>
      
      <Link href="/ads" className="z-20 bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:bg-blue-700 transition opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0">
        광고 등록하기 (60 USDT/일)
      </Link>
      
      <div className="absolute bottom-2 right-2 bg-black/10 text-[10px] px-2 py-0.5 rounded text-gray-500 font-bold">AD</div>
    </div>
  );
}