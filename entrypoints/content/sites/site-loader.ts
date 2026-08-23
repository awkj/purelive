import type { SiteAdapter } from './types';
import { DOUYU_LIVE } from './douyu-live';
import { DOUYU_VOD } from './douyu-vod';
import { HUYA_LIVE } from './huya-live';
import { MATCH_PATTERNS } from './site-patterns';

// 注册表 —— 顺序决定匹配优先级（多个 adapter 匹配同一 URL 时第一个胜出）。
const ADAPTERS: SiteAdapter[] = [DOUYU_LIVE, DOUYU_VOD, HUYA_LIVE];

// 顶层常量：所有 adapter 的 host 转成 manifest match pattern。
// 同时被 content script entry 的 matches 和 wxt.config 的 host_permissions 使用，
// 确保两者一致（Chrome MV3 要求 content script matches 必须被 host_permissions 覆盖）。
export { MATCH_PATTERNS } from './site-patterns';

export function getCurrentAdapter(): SiteAdapter | null {
  const { hostname, pathname } = location;
  for (const a of ADAPTERS) {
    if (!a.match.hosts.includes(hostname)) continue;
    if (a.match.path && !a.match.path.test(pathname)) continue;
    return a;
  }
  return null;
}

export function getAllMatchPatterns(): string[] {
  return MATCH_PATTERNS;
}
