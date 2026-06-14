import type { Resource, Course, LiveStream } from '@/types';

const TOKEN_KEY = 'mathhub_token';

function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

/**
 * 检测浏览器中是否有旧版localStorage数据
 */
export function hasOldData(): boolean {
  const checks = [
    'mathhub_resources',
    'mathhub_courses',
    'mathhub_lives',
    'mathhub_enrollments',
  ];
  return checks.some(k => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch { return false; }
  });
}

/**
 * 一键迁移所有旧数据到后端
 */
export async function migrateAll(onProgress?: (msg: string) => void): Promise<{ ok: number; fail: number; errors: string[] }> {
  let ok = 0;
  let fail = 0;
  const errors: string[] = [];

  const report = (msg: string) => { if (onProgress) onProgress(msg); };

  // 1. 资源
  try {
    const raw = localStorage.getItem('mathhub_resources');
    if (raw) {
      const resources: Resource[] = JSON.parse(raw);
      report(`📄 正在迁移 ${resources.length} 份资料...`);
      for (const r of resources) {
        try {
          await fetch('/api/resources', { method: 'POST', headers: authHeaders(), body: JSON.stringify(r) });
          ok++;
        } catch (e) {
          fail++;
          errors.push(`资源 ${r.title}: ${e}`);
        }
      }
      report(`✅ 资料迁移完成`);
    }
  } catch {}

  // 2. 课程
  try {
    const raw = localStorage.getItem('mathhub_courses');
    if (raw) {
      const courses: Course[] = JSON.parse(raw);
      report(`📺 正在迁移 ${courses.length} 门课程...`);
      for (const c of courses) {
        try {
          await fetch('/api/courses', { method: 'POST', headers: authHeaders(), body: JSON.stringify(c) });
          ok++;
        } catch (e) {
          fail++;
          errors.push(`课程 ${c.title}: ${e}`);
        }
      }
      report(`✅ 课程迁移完成`);
    }
  } catch {}

  // 3. 直播
  try {
    const raw = localStorage.getItem('mathhub_lives');
    if (raw) {
      const streams: LiveStream[] = JSON.parse(raw);
      report(`📡 正在迁移 ${streams.length} 场直播...`);
      for (const s of streams) {
        try {
          await fetch('/api/live', { method: 'POST', headers: authHeaders(), body: JSON.stringify(s) });
          ok++;
        } catch (e) {
          fail++;
          errors.push(`直播 ${s.title}: ${e}`);
        }
      }
      report(`✅ 直播迁移完成`);
    }
  } catch {}

  // 4. 报名记录
  try {
    const raw = localStorage.getItem('mathhub_enrollments');
    if (raw) {
      const enrollments: any[] = JSON.parse(raw);
      report(`📋 正在迁移 ${enrollments.length} 条报名记录...`);
      for (const e of enrollments) {
        try {
          await fetch('/api/enrollments', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ courseId: e.courseId }) });
          ok++;
        } catch (err) {
          fail++;
          errors.push(`报名 ${e.courseId}: ${err}`);
        }
      }
      report(`✅ 报名记录迁移完成`);
    }
  } catch {}

  report(`🎉 迁移完成！成功 ${ok} 项，失败 ${fail} 项`);

  // 迁移完成后标记旧数据已迁移（不清除，用户可手动清理）
  localStorage.setItem('mathhub_migrated', 'true');

  return { ok, fail, errors };
}

/**
 * 清空所有数据（后端DB + IndexedDB + localStorage旧数据）
 */
export async function cleanupAll(onProgress?: (msg: string) => void): Promise<{ ok: boolean; message: string }> {
  const report = (msg: string) => { if (onProgress) onProgress(msg); };

  report('🗑️ 清空服务器数据...');
  try {
    await fetch('/api/admin/cleanup', { method: 'DELETE', headers: authHeaders() });
  } catch (e) { console.error('清理后端失败', e); }

  report('🗑️ 清空本地视频文件...');
  try {
    if (typeof indexedDB !== 'undefined') {
      const dbs = await indexedDB.databases?.() || [];
      for (const d of dbs) {
        if (d.name?.startsWith('mathhub')) {
          indexedDB.deleteDatabase(d.name);
          report(`  已删除数据库: ${d.name}`);
        }
      }
    }
  } catch (e) { console.error('清理IndexedDB失败', e); }

  report('🗑️ 清空浏览器缓存...');
  const keys = ['mathhub_resources', 'mathhub_courses', 'mathhub_lives', 'mathhub_enrollments',
    'mathhub_users', 'mathhub_auth', 'mathhub_deleted_ids', 'mathhub_migrated',
    'mathhub_token'];
  keys.forEach(k => { try { localStorage.removeItem(k); } catch {} });

  report('✅ 清理完成！所有课程、资料、视频记录已删除');
  return { ok: true, message: '所有数据已清空' };
}
