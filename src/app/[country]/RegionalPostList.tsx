import Link from 'next/link';
import type { RegionalPost } from '@/lib/regionalContent';
import { regionalPostHref } from '@/lib/regionRoutes';
import { seoExcerpt } from '@/lib/seo';

export default function RegionalPostList({ posts }: { posts: RegionalPost[] }) {
  return (
    <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[.025]">
      {posts.map((post) => (
        <li key={`${post.collection}:${post.id}`} className="p-5 sm:p-6">
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>{post.sourceName || post.author || post.country.label}</span>
            {post.createdAt && <time dateTime={post.createdAt}>{post.createdAt.slice(0, 10)}</time>}
          </div>
          <h3 className="break-words text-lg font-bold text-white">
            <Link href={regionalPostHref(post.country, post.category, post.id)} className="hover:text-teal-200">{post.title}</Link>
          </h3>
          {post.body && <p className="mt-3 break-words text-sm leading-7 text-slate-300">{seoExcerpt(post.body, 320)}</p>}
          {post.facts.length > 0 && <p className="mt-3 text-xs leading-6 text-slate-400">{post.facts.map((fact) => `${fact.label}: ${fact.value}`).join(' / ')}</p>}
        </li>
      ))}
    </ul>
  );
}
