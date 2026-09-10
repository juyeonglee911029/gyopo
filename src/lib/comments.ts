export const POST_COLLECTIONS = ['posts', 'jobs', 'directories', 'marketItems'] as const;
export type PostCollection = (typeof POST_COLLECTIONS)[number];

export function isPostCollection(collection: string): collection is PostCollection {
  return POST_COLLECTIONS.some((value) => value === collection);
}

export function isThreadKey(value: string): boolean {
  return value.length <= 512 && /^(posts|jobs|directories|marketItems|source):[^\s/:]+$/.test(value);
}

export function postThreadKey(collection: string, id: string, sourceContentId?: string): string {
  const key = sourceContentId ? `source:${sourceContentId}` : `${collection}:${id}`;
  return isThreadKey(key) ? key : '';
}

export const COMMENT_MAX_LENGTH = 2000;

export function validCommentBody(body: string): boolean {
  return body.trim().length > 0 && body.length <= COMMENT_MAX_LENGTH;
}

export type PostComment = {
  id: string;
  targetKey: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  deleted: boolean;
  deletedAt?: string;
};

export function flattenComments(comments: PostComment[], threadKey: string) {
  const sorted = comments.filter((comment) => comment.targetKey === threadKey).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const byId = new Map(sorted.map((comment) => [comment.id, comment]));
  const children = new Map<string, PostComment[]>();
  const roots: PostComment[] = [];
  for (const comment of byId.values()) {
    if (comment.parentId && comment.parentId !== comment.id && byId.has(comment.parentId)) {
      const siblings = children.get(comment.parentId) || [];
      siblings.push(comment);
      children.set(comment.parentId, siblings);
    } else {
      roots.push(comment);
    }
  }
  const result: Array<{ comment: PostComment; depth: number; parent?: PostComment }> = [];
  const seen = new Set<string>();
  // Iteration avoids a stack overflow on deep replies; malformed legacy cycles stay visible once.
  for (const root of [...roots, ...byId.values()]) {
    const stack = [{ comment: root, depth: 0 }];
    while (stack.length) {
      const row = stack.pop()!;
      if (seen.has(row.comment.id)) continue;
      seen.add(row.comment.id);
      result.push({ ...row, parent: byId.get(row.comment.parentId || '') });
      const replies = children.get(row.comment.id) || [];
      for (let index = replies.length - 1; index >= 0; index -= 1) {
        stack.push({ comment: replies[index], depth: row.depth + 1 });
      }
    }
  }
  return result;
}
