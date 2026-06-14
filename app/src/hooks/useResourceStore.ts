import { useState, useCallback, useEffect } from 'react';
import type { Resource } from '@/types';
import { saveFileToDB, getFileFromDB, deleteFileFromDB } from '@/lib/fileStorage';

const API = '/api/resources';
const TOKEN_KEY = 'mathhub_token';

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── 将后端 row 转为前端 Resource 类型 ───
function rowToResource(r: any): Resource {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    category: r.category as Resource['category'],
    subject: r.subject as Resource['subject'],
    grade: r.grade as Resource['grade'],
    fileSize: r.file_size,
    downloadCount: r.download_count,
    uploadDate: r.upload_date,
    uploader: r.uploader,
    uploaderId: r.uploader_id,
    tags: typeof r.tags === 'string' ? (() => { try { return JSON.parse(r.tags); } catch { return []; } })() : (r.tags || []),
    previewUrl: r.preview_url || undefined,
  };
}

export function useResourceStore() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载资料列表
  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      if (data.resources) {
        setResources(data.resources.map(rowToResource));
      }
    } catch (e) {
      console.error('加载资料失败', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  // 添加/更新资料
  const addResource = useCallback(async (res: Resource, file?: File) => {
    let resourceData = { ...res };
    if (file) {
      // 上传文件到服务器 E 盘
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload/resources', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        resourceData.previewUrl = uploadData.url;
      } else {
        // 降级到 IndexedDB
        await saveFileToDB(res.id, file);
      }
    }
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(resourceData),
    });
    await fetchResources();
  }, [fetchResources]);

  // 删除资料
  const removeResource = useCallback(async (id: string, previewUrl?: string) => {
    // 如果文件存在服务器上，一起删除
    if (previewUrl && previewUrl.startsWith('/uploads/')) {
      await fetch('/api/uploads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ filepath: previewUrl }),
      });
    } else {
      await deleteFileFromDB(id);
    }
    await fetch(API + '/' + id, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    await fetchResources();
  }, [fetchResources]);

  // 下载次数 +1
  const incrementDownload = useCallback(async (id: string) => {
    await fetch(API + '/' + id + '/download', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    setResources(prev => prev.map(r => r.id === id ? { ...r, downloadCount: r.downloadCount + 1 } : r));
  }, []);

  // 下载文件
  const downloadResource = useCallback(async (res: Resource): Promise<boolean> => {
    if (res.previewUrl && res.previewUrl.startsWith('/uploads/')) {
      // 新版：从服务器下载
      const a = document.createElement('a');
      a.href = res.previewUrl;
      a.download = res.title;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      incrementDownload(res.id);
      return true;
    }
    // 兼容旧版 IndexedDB
    const fileRecord = await getFileFromDB(res.id);
    if (fileRecord) {
      const { blob, name } = fileRecord;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      incrementDownload(res.id);
      return true;
    }
    return false;
  }, [incrementDownload]);

  // 更新资料
  const updateResource = useCallback(async (id: string, updates: Partial<Resource>) => {
    const existing = resources.find(r => r.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updated),
    });
    await fetchResources();
  }, [resources, fetchResources]);

  return { resources, addResource, removeResource, incrementDownload, downloadResource, updateResource, loading, refetch: fetchResources };
}
