import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'mathhub-db';
const DB_VERSION = 2;

const STORES = [
  'files',
  'announcements',
  'favorites',
  'comments',
  'studyProgress',
  'tags',
  'downloadRecords',
  'courses',
  'liveStreams',
  'chatHistory',
  'userSettings',
];

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) {
            const s = db.createObjectStore(store, { keyPath: 'id' });
            if (store === 'favorites') {
              s.createIndex('userId', 'userId', { unique: false });
              s.createIndex('resourceId', 'resourceId', { unique: false });
            }
            if (store === 'comments') {
              s.createIndex('resourceId', 'resourceId', { unique: false });
            }
            if (store === 'studyProgress') {
              s.createIndex('userId', 'userId', { unique: false });
              s.createIndex('courseId', 'courseId', { unique: false });
            }
            if (store === 'downloadRecords') {
              s.createIndex('userId', 'userId', { unique: false });
              s.createIndex('resourceId', 'resourceId', { unique: false });
            }
          }
        }
      },
    });
  }
  return dbPromise;
}

// ============= Generic CRUD =============
export async function dbGet<T>(store: string, id: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(store, id) as Promise<T | undefined>;
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await getDB();
  return db.getAll(store) as Promise<T[]>;
}

export async function dbPut(store: string, value: unknown): Promise<string> {
  const db = await getDB();
  return db.put(store, value) as Promise<string>;
}

export async function dbDelete(store: string, id: string): Promise<void> {
  const db = await getDB();
  return db.delete(store, id);
}

export async function dbGetByIndex<T>(store: string, indexName: string, value: unknown): Promise<T[]> {
  const db = await getDB();
  return db.getAllFromIndex(store, indexName, value as IDBValidKey) as Promise<T[]>;
}

// ============= File Storage =============
interface FileRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
}

export async function saveFileToDB(id: string, file: File): Promise<boolean> {
  try {
    const db = await getDB();
    const data = await file.arrayBuffer();
    await db.put('files', { id, name: file.name, type: file.type || 'application/octet-stream', size: file.size, data });
    return true;
  } catch (e) {
    console.error('saveFileToDB failed:', e);
    return false;
  }
}

export async function getFileFromDB(id: string): Promise<{ blob: Blob; name: string } | null> {
  try {
    const db = await getDB();
    const record: FileRecord | undefined = await db.get('files', id);
    if (!record) return null;
    const blob = new Blob([record.data], { type: record.type });
    return { blob, name: record.name };
  } catch (e) {
    console.error('getFileFromDB failed:', e);
    return null;
  }
}

export async function deleteFileFromDB(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('files', id);
  } catch (e) {
    console.error('deleteFileFromDB failed:', e);
  }
}

export async function hasFileInDB(id: string): Promise<boolean> {
  try {
    const db = await getDB();
    const record = await db.get('files', id);
    return !!record;
  } catch {
    return false;
  }
}

// ============= Announcements =============
export async function getAnnouncements() {
  const all = await dbGetAll<import('@/types').Announcement>('announcements');
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function addAnnouncement(a: import('@/types').Announcement) {
  return dbPut('announcements', a);
}

// ============= Favorites =============
export async function getUserFavorites(userId: string) {
  return dbGetByIndex<import('@/types').Favorite>('favorites', 'userId', userId);
}

export async function toggleFavorite(userId: string, resourceId: string) {
  const existing = await getUserFavorites(userId);
  const found = existing.find(f => f.resourceId === resourceId);
  if (found) {
    await dbDelete('favorites', found.id);
    return false; // removed
  }
  await dbPut('favorites', {
    id: `fav_${userId}_${resourceId}`,
    userId,
    resourceId,
    createdAt: new Date().toISOString(),
  });
  return true; // added
}

export async function isFavorited(userId: string, resourceId: string) {
  const favs = await getUserFavorites(userId);
  return favs.some(f => f.resourceId === resourceId);
}

// ============= Comments =============
export async function getResourceComments(resourceId: string) {
  const all = await dbGetByIndex<import('@/types').Comment>('comments', 'resourceId', resourceId);
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function addComment(c: import('@/types').Comment) {
  return dbPut('comments', c);
}

// ============= Study Progress =============
export async function getStudyProgress(userId: string, courseId: string) {
  const all = await dbGetByIndex<import('@/types').StudyProgress>('studyProgress', 'userId', userId);
  return all.find(p => p.courseId === courseId) || null;
}

export async function updateStudyProgress(progress: import('@/types').StudyProgress) {
  return dbPut('studyProgress', progress);
}

export async function getAllUserStudyProgress(userId: string) {
  return dbGetByIndex<import('@/types').StudyProgress>('studyProgress', 'userId', userId);
}

// ============= Tags =============
export async function getAllTags() {
  return dbGetAll<import('@/types').Tag>('tags');
}

export async function upsertTag(tag: import('@/types').Tag) {
  return dbPut('tags', tag);
}

// ============= Chat History =============
export async function getChatHistory(userId: string) {
  const record = await dbGet<{ id: string; messages: import('@/types').ChatMessage[] }>('chatHistory', userId);
  return record?.messages || [];
}

export async function saveChatHistory(userId: string, messages: import('@/types').ChatMessage[]) {
  return dbPut('chatHistory', { id: userId, messages });
}

// ============= Download Records =============
export async function recordDownload(userId: string, resourceId: string) {
  return dbPut('downloadRecords', {
    id: `dl_${Date.now()}`,
    userId,
    resourceId,
    downloadedAt: new Date().toISOString(),
  });
}

export async function getUserDownloadCount(userId: string) {
  const records = await dbGetByIndex<import('@/types').DownloadRecord>('downloadRecords', 'userId', userId);
  return records.length;
}

// ============= Init Default Announcements =============
export async function initDefaultData() {
  const existing = await getAnnouncements();
  if (existing.length === 0) {
    await addAnnouncement({
      id: 'ann1',
      title: '高考冲刺直播课已上线',
      content: '张明远老师的高考数学冲刺直播课已开放预约，6月12日晚8点准时开播，欢迎预约！',
      type: 'event',
      createdAt: '2026-06-10T10:00:00',
      isRead: false,
    });
    await addAnnouncement({
      id: 'ann2',
      title: '资料库新增500+份高考真题',
      content: '我们已上传2026年全国各卷高考真题及详细解析，快去资料库搜索下载吧！',
      type: 'update',
      createdAt: '2026-06-09T14:00:00',
      isRead: false,
    });
    await addAnnouncement({
      id: 'ann3',
      title: '系统维护通知',
      content: '6月15日凌晨2:00-4:00将进行系统维护升级，届时部分功能暂不可用，请提前做好准备。',
      type: 'system',
      createdAt: '2026-06-08T09:00:00',
      isRead: true,
    });
  }
}
