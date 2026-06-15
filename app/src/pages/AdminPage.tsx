import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  LayoutDashboard, Users, FileText, Video, Radio, Settings,
  TrendingUp, Download, Eye, Edit, Trash2, Plus, Search,
  BarChart3, Clock, BookOpen, Activity, Shield, LogOut, Upload,
  Play, Save, X, CheckCircle2, FileUp, Calendar, Timer
} from 'lucide-react';
import { mockAdminStats } from '@/data/mock';
import { useAuth } from '@/hooks/useAuth';
import { useResourceStore } from '@/hooks/useResourceStore';
import { hasOldData, migrateAll, cleanupAll } from '@/lib/migration';
import type { Course, Chapter, Lesson, LiveStream } from '@/types';

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

function getAuthHeaders() {
  const t = localStorage.getItem('mathhub_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function fetchCoursesAPI(): Promise<Course[]> {
  try {
    const res = await fetch('/api/courses');
    const data = await res.json();
    if (data.courses) {
      return data.courses.map((r: any) => ({
        id: r.id, title: r.title, description: r.description, teacher: r.teacher,
        coverImage: r.cover_image, category: r.category, grade: r.grade,
        price: r.price, originalPrice: r.original_price, enrolledCount: r.enrolled_count,
        rating: r.rating, totalHours: r.total_hours, level: r.level,
        startDate: r.start_date, isEnrolled: !!r.is_enrolled,
        chapters: typeof r.chapters === 'string' ? (() => { try { return JSON.parse(r.chapters); } catch { return []; } })() : (r.chapters || []),
      }));
    }
  } catch {}
  return [];
}

async function fetchLivesAPI(): Promise<LiveStream[]> {
  try {
    const res = await fetch('/api/live');
    const data = await res.json();
    if (data.streams) {
      return data.streams.map((r: any) => ({
        id: r.id, title: r.title, description: r.description, teacher: r.teacher,
        coverImage: r.cover_image, category: r.category, scheduledAt: r.scheduled_at,
        duration: r.duration, status: r.status, rtmpUrl: r.rtmp_url, hlsUrl: r.hls_url,
        streamKey: r.stream_key, viewerCount: r.viewer_count, isReserved: !!r.is_reserved,
        recordingUrl: r.recording_url,
      }));
    }
  } catch {}
  return [];
}

async function syncCourseToAPI(c: Course) {
  await fetch('/api/courses', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(c) });
}

async function deleteCourseFromAPI(id: string) {
  await fetch('/api/courses/' + id, { method: 'DELETE', headers: getAuthHeaders() });
}

async function syncLiveToAPI(s: LiveStream) {
  await fetch('/api/live', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(s) });
}

async function deleteLiveFromAPI(id: string) {
  await fetch('/api/live/' + id, { method: 'DELETE', headers: getAuthHeaders() });
}

// ---------- Enrollment data synced with user-side ----------
interface Enrollment {
  userId: string;
  courseId: string;
  enrolledAt: string;
  completedLessons: string[];
  studyMinutes: number;
}

interface UserLearningData {
  id: string;
  displayName: string;
  enrolledCourses: string[];
  completedLessons: string[];
  studyHours: number;
  streak: number;
  lastLoginAt: string;
}

function loadEnrollments(): Enrollment[] {
  return [];
}

function buildUserLearningData(): UserLearningData[] {
  return [];
}

export default function AdminPage() {
  const { user, logoutFn } = useAuth();
  const navigate = useNavigate();
  const { resources, removeResource } = useResourceStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Course management state
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: '', description: '', teacher: '', category: '函数' as Course['category'],
    grade: '通用' as Course['grade'], level: '基础' as Course['level'],
    price: 0, originalPrice: 0, totalHours: 0,
  });
  const [courseChapters, setCourseChapters] = useState<Chapter[]>([{ id: 'ch_new_1', title: '第一章', lessons: [] }]);
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingMaterial, setUploadingMaterial] = useState<string | null>(null);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentFile: '', pct: undefined as number | undefined });
  const [batchChapterId, setBatchChapterId] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);
  const batchVideoInputRef = useRef<HTMLInputElement>(null);
  const materialInputRef = useRef<HTMLInputElement>(null);

  // Live management state
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [livesLoading, setLivesLoading] = useState(true);
  const [showLiveDialog, setShowLiveDialog] = useState(false);
  const [editingLive, setEditingLive] = useState<LiveStream | null>(null);
  const [liveForm, setLiveForm] = useState({
    title: '', description: '', teacher: '', category: '函数' as LiveStream['category'],
    scheduledAt: '', duration: 60,
  });
  const [showRecordingDialog, setShowRecordingDialog] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState('');

  // User management
  const [userLearningData, setUserLearningData] = useState<UserLearningData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserLearningData | null>(null);

  // Load data from API
  useEffect(() => {
    fetchCoursesAPI().then(c => { setCourses(c); setCoursesLoading(false); });
    fetchLivesAPI().then(l => { setLiveStreams(l); setLivesLoading(false); });
  }, []);

  // Admin guard
  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">需要管理员权限</h2>
        <p className="text-gray-500 mb-6">请使用管理员账号登录后访问</p>
        <Button onClick={() => navigate('/login')} className="rounded-xl bg-blue-600 hover:bg-blue-700">前往登录</Button>
      </div>
    );
  }

  // ─── 旧数据迁移 ───
  const [showMigration, setShowMigration] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState('');
  const [migrateDone, setMigrateDone] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [cleanupMsg, setCleanupMsg] = useState('');
  useEffect(() => {
    if (!showMigration && hasOldData() && !localStorage.getItem('mathhub_migrated')) {
      setShowMigration(true);
    }
  }, []);
  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateMsg('正在迁移数据...');
    const result = await migrateAll((msg) => setMigrateMsg(msg));
    setMigrateDone(true);
    setMigrating(false);
    // 迁移完成后刷新页面数据
    fetchCoursesAPI().then(c => setCourses(c));
    fetchLivesAPI().then(l => setLiveStreams(l));
    setTimeout(() => { setShowMigration(false); }, 8000);
  };
  const handleCleanup = async () => {
    setCleanupStatus('running');
    setCleanupMsg('正在清空数据...');
    await cleanupAll((msg) => setCleanupMsg(msg));
    setCleanupStatus('done');
    setCourses([]);
    setLiveStreams([]);
  };

  const filteredResources = resources.filter(r =>
    !searchQuery || r.title.includes(searchQuery) || r.description.includes(searchQuery)
  );

  const handleDeleteResource = (id: string) => {
    const res = resources.find(r => r.id === id);
    removeResource(id, res?.previewUrl);
    setDeleteConfirm(null);
  };

  // Persist courses & lives on change - sync to backend
  useEffect(() => { if (courses.length > 0) courses.forEach(syncCourseToAPI); }, [courses]);
  useEffect(() => { if (liveStreams.length > 0) liveStreams.forEach(syncLiveToAPI); }, [liveStreams]);

  // ===== Course CRUD =====
  const resetCourseForm = () => {
    setCourseForm({ title: '', description: '', teacher: '', category: '函数', grade: '通用', level: '基础', price: 0, originalPrice: 0, totalHours: 0 });
    setCourseChapters([{ id: 'ch_new_1', title: '第一章', lessons: [] }]);
    setEditingCourse(null);
  };

  const openNewCourseDialog = () => {
    resetCourseForm();
    setShowCourseDialog(true);
  };

  const openEditCourseDialog = (c: Course) => {
    setEditingCourse(c);
    setCourseForm({
      title: c.title, description: c.description, teacher: c.teacher,
      category: c.category, grade: c.grade, level: c.level,
      price: c.price, originalPrice: c.originalPrice, totalHours: c.totalHours,
    });
    setCourseChapters(c.chapters.length > 0 ? c.chapters : [{ id: 'ch_new_1', title: '第一章', lessons: [] }]);
    setShowCourseDialog(true);
  };

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim() || !courseForm.teacher.trim()) return;
    if (editingCourse) {
      const updated = { ...editingCourse, ...courseForm, chapters: courseChapters };
      await syncCourseToAPI(updated);
      setCourses(prev => prev.map(c => c.id === editingCourse.id ? updated : c));
    } else {
      const newCourse: Course = {
        id: 'c' + Date.now(),
        ...courseForm,
        coverImage: '',
        enrolledCount: 0, rating: 0,
        startDate: new Date().toISOString().split('T')[0],
        isEnrolled: false,
        chapters: courseChapters,
      };
      await syncCourseToAPI(newCourse);
      setCourses(prev => [...prev, newCourse]);
    }
    setShowCourseDialog(false);
    resetCourseForm();
  };

  const handleDeleteCourse = async (id: string) => {
    await deleteCourseFromAPI(id);
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  const addChapter = () => {
    setCourseChapters(prev => [...prev, { id: 'ch_' + Date.now(), title: `第${prev.length + 1}章`, lessons: [] }]);
  };

  const removeChapter = (chId: string) => {
    setCourseChapters(prev => prev.filter(ch => ch.id !== chId));
  };

  const addLesson = (chId: string) => {
    setCourseChapters(prev => prev.map(ch => {
      if (ch.id !== chId) return ch;
      const lessonNum = ch.lessons.length + 1;
      return { ...ch, lessons: [...ch.lessons, { id: 'l_' + Date.now() + '_' + lessonNum, title: `${lessonNum}.1 新课时`, duration: '30:00', videoUrl: '', isFree: false }] };
    }));
  };

  const removeLesson = (chId: string, lessonId: string) => {
    setCourseChapters(prev => prev.map(ch => {
      if (ch.id !== chId) return ch;
      return { ...ch, lessons: ch.lessons.filter(l => l.id !== lessonId) };
    }));
  };

  const updateLesson = (chId: string, lessonId: string, updates: Partial<Lesson>) => {
    setCourseChapters(prev => prev.map(ch => {
      if (ch.id !== chId) return ch;
      return { ...ch, lessons: ch.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l) };
    }));
  };

  const updateChapterTitle = (chId: string, title: string) => {
    setCourseChapters(prev => prev.map(ch => ch.id === chId ? { ...ch, title } : ch));
  };

  const getAuthHeaders = () => {
    const t = localStorage.getItem('mathhub_token');
    return { ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  };

  const handleVideoUpload = async (lessonId: string, file: File) => {
    setUploadingVideo(lessonId);
    setUploadProgress(5);
    try {
      // Detect video duration via HTML5 Video API
      const durationStr = await new Promise<string>((resolve) => {
        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        const objUrl = URL.createObjectURL(file);
        videoEl.onloadedmetadata = () => {
          URL.revokeObjectURL(objUrl);
          const dur = videoEl.duration;
          if (!isFinite(dur) || dur === 0) { resolve('00:00'); return; }
          const h = Math.floor(dur / 3600);
          const m = Math.floor((dur % 3600) / 60);
          const s = Math.floor(dur % 60);
          const pad = (n: number) => String(n).padStart(2, '0');
          resolve(h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
        };
        videoEl.onerror = () => { URL.revokeObjectURL(objUrl); resolve('00:00'); };
        videoEl.src = objUrl;
      });

      setUploadProgress(10);

      // 上传到后端
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/lessons', {
        method: 'POST', headers: getAuthHeaders(), body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '上传失败');
      setUploadProgress(90);

      for (const ch of courseChapters) {
        const lesson = ch.lessons.find(l => l.id === lessonId);
        if (lesson) {
          updateLesson(ch.id, lessonId, { videoUrl: data.url, duration: durationStr });
          // 同步到后端
          const course = courses.find(c => c.chapters?.some(cch => cch.id === ch.id));
          if (course) {
            syncCourseToAPI(course);
            setUploadProgress(100);
            setTimeout(() => {
              setUploadingVideo(null);
              setUploadProgress(0);
            }, 800);
            return;
          }
        }
      }
    } catch (e) {
      console.error('Video upload failed:', e);
    }
    setTimeout(() => {
      setUploadingVideo(null);
      setUploadProgress(0);
    }, 500);
  };

  // Batch upload: add multiple videos as new lessons with auto-naming from file name
  const handleBatchVideoUpload = async (chId: string, files: FileList) => {
    if (files.length === 0) return;
    setBatchUploading(true);
    setBatchProgress({ current: 0, total: files.length, currentFile: '' });

    const newLessons: Lesson[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const titleFromName = file.name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim();
      const lessonId = 'l_batch_' + Date.now() + '_' + i;
      setBatchProgress({ current: i, total: totalFiles, currentFile: file.name });

      try {
        // Detect duration
        const durationStr = await new Promise<string>((resolve) => {
          const videoEl = document.createElement('video');
          videoEl.preload = 'metadata';
          const objUrl = URL.createObjectURL(file);
          videoEl.onloadedmetadata = () => {
            URL.revokeObjectURL(objUrl);
            const dur = videoEl.duration;
            if (!isFinite(dur) || dur === 0) { resolve('00:00'); return; }
            const h = Math.floor(dur / 3600);
            const m = Math.floor((dur % 3600) / 60);
            const s = Math.floor(dur % 60);
            const pad = (n: number) => String(n).padStart(2, '0');
            resolve(h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
          };
          videoEl.onerror = () => { URL.revokeObjectURL(objUrl); resolve('00:00'); };
          videoEl.src = objUrl;
        });

        // 上传到后端
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload/lessons', {
          method: 'POST', headers: getAuthHeaders(), body: formData,
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '上传失败');
        const videoUrl = data.url || '';
        setBatchProgress(prev => ({ ...prev, current: i + 1, pct: Math.round(((i + 1) / totalFiles) * 100) }));

        newLessons.push({
          id: lessonId,
          title: titleFromName || `课时 ${i + 1}`,
          duration: durationStr,
          videoUrl: videoUrl,
          isFree: i === 0,
        });
      } catch (e) {
        console.error('Batch upload failed for', file.name, e);
        newLessons.push({
          id: lessonId,
          title: titleFromName || `课时 ${i + 1}`,
          duration: '00:00',
          videoUrl: '',
          isFree: false,
        });
      }
    }

    // Add all new lessons to the chapter and sync to backend
    const newChapters = courseChapters.map(ch => {
      if (ch.id !== chId) return ch;
      return { ...ch, lessons: [...ch.lessons, ...newLessons] };
    });
    setCourseChapters(newChapters);

    // 同步到后端
    const course = courses.find(c => c.chapters?.some(cch => cch.id === chId));
    if (course) {
      const updatedCourse = { ...course, chapters: newChapters };
      syncCourseToAPI(updatedCourse);
    }

    setBatchUploading(false);
    setBatchProgress({ current: 0, total: 0, currentFile: '' });
  };

  const handleMaterialUpload = async (lessonId: string, file: File) => {
    setUploadingMaterial(lessonId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/materials', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '上传失败');
      for (const ch of courseChapters) {
        const lesson = ch.lessons.find(l => l.id === lessonId);
        if (lesson) {
          updateLesson(ch.id, lessonId, { materialFileId: data.url, materialFileName: file.name });
          // 同步到后端
          const course = courses.find(c => c.chapters?.some(cch => cch.id === ch.id));
          if (course) syncCourseToAPI(course);
        }
      }
    } catch (e) {
      console.error('Material upload failed:', e);
    }
    setUploadingMaterial(null);
  };

  // ===== Live CRUD =====
  const resetLiveForm = () => {
    setLiveForm({ title: '', description: '', teacher: '', category: '函数', scheduledAt: '', duration: 60 });
    setEditingLive(null);
  };

  const openNewLiveDialog = () => {
    resetLiveForm();
    setShowLiveDialog(true);
  };

  const openEditLiveDialog = (s: LiveStream) => {
    setEditingLive(s);
    setLiveForm({ title: s.title, description: s.description, teacher: s.teacher, category: s.category, scheduledAt: s.scheduledAt, duration: s.duration });
    setShowLiveDialog(true);
  };

  const handleSaveLive = async () => {
    if (!liveForm.title.trim() || !liveForm.teacher.trim() || !liveForm.scheduledAt) return;
    const newId = 'ls' + Date.now();
    if (editingLive) {
      const updated = { ...editingLive, ...liveForm, scheduledAt: liveForm.scheduledAt };
      await syncLiveToAPI(updated);
      setLiveStreams(prev => prev.map(s => s.id === editingLive.id ? updated : s));
    } else {
      const newStream: LiveStream = {
        id: newId,
        ...liveForm,
        coverImage: '',
        status: 'upcoming',
        rtmpUrl: `rtmp://live.mathhub.cn/live/stream${newId}`,
        hlsUrl: `https://live.mathhub.cn/live/stream${newId}/index.m3u8`,
        streamKey: `sk-math-${newId}-live-key`,
        viewerCount: 0,
        isReserved: false,
      };
      await syncLiveToAPI(newStream);
      setLiveStreams(prev => [...prev, newStream]);
    }
    setShowLiveDialog(false);
    resetLiveForm();
  };

  const handleDeleteLive = async (id: string) => {
    await deleteLiveFromAPI(id);
    setLiveStreams(prev => prev.filter(s => s.id !== id));
  };

  const handleSaveRecording = (streamId: string) => {
    setLiveStreams(prev => prev.map(s => s.id === streamId ? { ...s, recordingUrl } : s));
    setShowRecordingDialog(null);
    setRecordingUrl('');
  };

  // Helper: get course name by id
  const getCourseName = (courseId: string) => {
    const c = courses.find(x => x.id === courseId);
    return c ? c.title : courseId;
  };

  // Helper: get total lessons for a course
  const getCourseTotalLessons = (courseId: string) => {
    const c = courses.find(x => x.id === courseId);
    if (!c) return 0;
    return c.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-indigo-600" />
            </div>
            管理后台
          </h1>
          <p className="text-gray-500 mt-1">资料管理 · 课程管理 · 直播管理 · 用户管理 · 学习统计</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-purple-100 text-purple-700 text-xs">
            <Shield className="w-3 h-3 mr-1" />{user.displayName}
          </Badge>
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => { logoutFn(); navigate('/'); }}>
            <LogOut className="w-3 h-3 mr-1" />退出
          </Button>
        </div>
      </div>

      {/* 旧数据迁移提示 */}
      {showMigration && (
        <div className={`mb-6 rounded-xl p-4 border ${migrateDone ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${migrateDone ? 'bg-green-100' : 'bg-blue-100'}`}>
              {migrateDone ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Upload className="w-4 h-4 text-blue-600" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-800 mb-1">
                {migrateDone ? '✅ 数据迁移完成！' : '📦 发现旧版本地数据'}
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                {migrating ? migrateMsg : migrateDone
                  ? '数据已成功迁移到服务器，请重新加载页面查看。此提示8秒后自动关闭。'
                  : '系统检测到浏览器中仍存有旧版数据（资料、课程、直播、报名记录）。点击下方按钮将其迁移到服务器，之后所有设备均可共享。'}
              </p>
              {!migrating && !migrateDone && (
                <div className="flex gap-2">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-lg text-xs h-8" onClick={handleMigrate}>
                    <Upload className="w-3 h-3 mr-1" />一键迁移到服务器
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={() => setShowMigration(false)}>
                    稍后再说
                  </Button>
                </div>
              )}
              {migrating && (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                  {migrateMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); }}>
        <TabsList className="bg-gray-100 rounded-xl p-1 mb-6 flex flex-wrap">
          <TabsTrigger value="overview" className="rounded-lg text-xs sm:text-sm">
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />总览
          </TabsTrigger>
          <TabsTrigger value="resources" className="rounded-lg text-xs sm:text-sm">
            <FileText className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />资料管理
          </TabsTrigger>
          <TabsTrigger value="courses" className="rounded-lg text-xs sm:text-sm">
            <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />课程管理
          </TabsTrigger>
          <TabsTrigger value="lives" className="rounded-lg text-xs sm:text-sm">
            <Radio className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />直播管理
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg text-xs sm:text-sm">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />用户管理
          </TabsTrigger>
          <TabsTrigger value="stats" className="rounded-lg text-xs sm:text-sm">
            <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />学习统计
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: '总用户数', value: userLearningData.length.toString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: '资料总数', value: resources.length.toString(), icon: FileText, color: 'text-green-500', bg: 'bg-green-50' },
              { label: '课程总数', value: courses.length.toString(), icon: Video, color: 'text-purple-500', bg: 'bg-purple-50' },
              { label: '今日访问', value: mockAdminStats.todayVisits.toLocaleString(), icon: Eye, color: 'text-orange-500', bg: 'bg-orange-50' },
            ].map(stat => (
              <Card key={stat.label} className="border-0 shadow-sm rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      <TrendingUp className="w-3 h-3 mr-0.5" />+{mockAdminStats.weeklyGrowth}%
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-base">每日活跃用户</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={mockAdminStats.dailyActiveUsers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-base">热门学科分布</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={mockAdminStats.popularSubjects} cx="50%" cy="50%" outerRadius={90} dataKey="count" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#999' }}>
                      {mockAdminStats.popularSubjects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 数据清理 */}
          <div className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50">
              <div className="flex items-start gap-3">
                <Trash2 className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-800 mb-1">危险操作</h4>
                  <p className="text-xs text-red-600 mb-3">清空所有课程、资料、直播记录（包括服务器数据、本地缓存和视频文件），此操作不可恢复！</p>
                  {cleanupStatus === 'done' ? (
                    <div className="text-xs text-green-700 font-medium">✅ 清理完成！请刷新页面。</div>
                  ) : cleanupStatus === 'running' ? (
                    <div className="flex items-center gap-2 text-xs text-red-600">
                      <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                      {cleanupMsg}
                    </div>
                  ) : (
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 rounded-lg text-xs h-8" onClick={handleCleanup}>
                      <Trash2 className="w-3 h-3 mr-1" />清空所有数据
                    </Button>
                  )}
                </div>
              </div>
            </div>
        </TabsContent>

        {/* Resources Management */}
        <TabsContent value="resources">
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">资料管理（共 {resources.length} 份）</CardTitle>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-lg" onClick={() => navigate('/resources')}>
                <Plus className="w-4 h-4 mr-1" />添加资料
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="搜索资料..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-lg" />
                </div>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>标题</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>学科</TableHead>
                      <TableHead>年级</TableHead>
                      <TableHead>格式</TableHead>
                      <TableHead>下载量</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium max-w-[180px] truncate">{r.title}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                        <TableCell><Badge className="bg-blue-100 text-blue-700 text-xs">{r.subject}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.grade}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{r.type.toUpperCase()}</Badge></TableCell>
                        <TableCell>{r.downloadCount}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDeleteConfirm(r.id)}>
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Courses Management */}
        <TabsContent value="courses">
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">课程管理（共 {courses.length} 门）</CardTitle>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 rounded-lg" onClick={openNewCourseDialog}>
                <Plus className="w-4 h-4 mr-1" />创建课程
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>课程名称</TableHead>
                      <TableHead>教师</TableHead>
                      <TableHead>学科</TableHead>
                      <TableHead>年级</TableHead>
                      <TableHead>难度</TableHead>
                      <TableHead>价格</TableHead>
                      <TableHead>报名数</TableHead>
                      <TableHead>课时</TableHead>
                      <TableHead>视频/资料</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map(c => {
                      const totalLessons = c.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
                      const videoCount = c.chapters.reduce((s, ch) => s + ch.lessons.filter(l => l.videoUrl && l.videoUrl.startsWith('indexeddb://')).length, 0);
                      const materialCount = c.chapters.reduce((s, ch) => s + ch.lessons.filter(l => l.materialFileId).length, 0);
                      const realEnrolledCount = loadEnrollments().filter(e => e.courseId === c.id).length;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium max-w-[140px] truncate">{c.title}</TableCell>
                          <TableCell>{c.teacher}</TableCell>
                          <TableCell><Badge className="bg-green-100 text-green-700 text-xs">{c.category}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{c.grade}</Badge></TableCell>
                          <TableCell><Badge className={`text-xs text-white ${c.level === '竞赛' ? 'bg-red-500' : c.level === '提高' ? 'bg-orange-500' : 'bg-blue-500'}`}>{c.level}</Badge></TableCell>
                          <TableCell>¥{c.price}</TableCell>
                          <TableCell>{realEnrolledCount}</TableCell>
                          <TableCell>{totalLessons}节</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Badge className={videoCount > 0 ? 'bg-green-100 text-green-700 text-xs' : 'bg-gray-100 text-gray-400 text-xs'}>
                                视频{videoCount}/{totalLessons}
                              </Badge>
                              <Badge className={materialCount > 0 ? 'bg-blue-100 text-blue-700 text-xs' : 'bg-gray-100 text-gray-400 text-xs'}>
                                资料{materialCount}/{totalLessons}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs rounded" onClick={() => openEditCourseDialog(c)} title="编辑课程"><Edit className="w-3 h-3" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteCourse(c.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Management */}
        <TabsContent value="lives">
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">直播管理（共 {liveStreams.length} 场）</CardTitle>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 rounded-lg" onClick={openNewLiveDialog}>
                <Plus className="w-4 h-4 mr-1" />创建直播
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>直播标题</TableHead>
                      <TableHead>教师</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>计划时间</TableHead>
                      <TableHead>时长</TableHead>
                      <TableHead>观看数</TableHead>
                      <TableHead>回放</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveStreams.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium max-w-[180px] truncate">{s.title}</TableCell>
                        <TableCell>{s.teacher}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs text-white ${s.status === 'live' ? 'bg-red-500' : s.status === 'upcoming' ? 'bg-blue-500' : 'bg-gray-500'}`}>
                            {s.status === 'live' ? '直播中' : s.status === 'upcoming' ? '预告' : '已结束'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 text-xs">{new Date(s.scheduledAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell>{s.duration}分钟</TableCell>
                        <TableCell>{s.viewerCount}</TableCell>
                        <TableCell>
                          {s.status === 'ended' ? (
                            s.recordingUrl ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">有回放</Badge>
                            ) : (
                              <Button size="sm" variant="outline" className="h-6 text-xs rounded" onClick={() => { setShowRecordingDialog(s.id); setRecordingUrl(''); }}>
                                上传回放
                              </Button>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditLiveDialog(s)}><Edit className="w-3 h-3 text-gray-500" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteLive(s.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management */}
        <TabsContent value="users">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* User List */}
            <Card className="border-0 shadow-sm rounded-xl lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />用户列表（{userLearningData.length}人）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {userLearningData.map(u => (
                    <button key={u.id}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${selectedUser?.id === u.id ? 'bg-blue-50 border-blue-200 border' : 'hover:bg-gray-50 border border-transparent'}`}
                      onClick={() => setSelectedUser(u)}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                          {u.displayName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{u.displayName}</div>
                          <div className="text-xs text-gray-400">{u.enrolledCourses.length}门课程 · {u.studyHours}h学习</div>
                        </div>
                        {u.streak > 0 && (
                          <Badge className="bg-orange-100 text-orange-600 text-[10px] shrink-0">
                            连续{u.streak}天
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Detail */}
            <Card className="border-0 shadow-sm rounded-xl lg:col-span-2">
              {selectedUser ? (
                <>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                        {selectedUser.displayName[0]}
                      </div>
                      {selectedUser.displayName} 的学习情况
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Stats cards */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{selectedUser.enrolledCourses.length}</div>
                        <div className="text-xs text-gray-500">报名课程</div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{selectedUser.completedLessons.length}</div>
                        <div className="text-xs text-gray-500">完成课时</div>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-purple-600">{selectedUser.studyHours}h</div>
                        <div className="text-xs text-gray-500">学习时长</div>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-orange-600">{selectedUser.streak}</div>
                        <div className="text-xs text-gray-500">连续天数</div>
                      </div>
                    </div>

                    {/* Course learning details */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-700">课程学习详情</h4>
                      {selectedUser.enrolledCourses.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">暂未报名任何课程</p>
                      ) : (
                        selectedUser.enrolledCourses.map(courseId => {
                          const total = getCourseTotalLessons(courseId);
                          const completed = total > 0 ? Math.min(Math.round(selectedUser.completedLessons.length / Math.max(1, selectedUser.enrolledCourses.length)), total) : 0;
                          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                          return (
                            <div key={courseId} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">{getCourseName(courseId)}</span>
                                <Badge className={pct >= 100 ? 'bg-green-100 text-green-700 text-xs' : 'bg-blue-100 text-blue-700 text-xs'}>
                                  {completed}/{total} 课时
                                </Badge>
                              </div>
                              <Progress value={pct} className="h-2 rounded-full" />
                              <div className="text-xs text-gray-400 mt-1 text-right">{pct}% 完成</div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Last login */}
                    <div className="mt-4 text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      最后登录：{new Date(selectedUser.lastLoginAt).toLocaleString('zh-CN')}
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="py-20 text-center text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p>点击左侧用户查看学习详情</p>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Statistics */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-base">资料下载趋势</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={mockAdminStats.resourceDownloads}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-base">课程报名趋势</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={mockAdminStats.courseEnrollments}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-base">活跃用户趋势</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={mockAdminStats.dailyActiveUsers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-base">学科热度分布</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={mockAdminStats.popularSubjects} cx="50%" cy="50%" outerRadius={100} dataKey="count" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {mockAdminStats.popularSubjects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader><DialogTitle>确认删除</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 mt-2">确定要删除这份资料吗？此操作不可撤销。</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 rounded-lg"
              onClick={() => { if (deleteConfirm) handleDeleteResource(deleteConfirm); }}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Create/Edit Dialog */}
      <Dialog open={showCourseDialog} onOpenChange={v => { setShowCourseDialog(v); if (!v) resetCourseForm(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingCourse ? '编辑课程' : '创建课程'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">课程名称 *</Label><Input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} className="rounded-lg mt-1" placeholder="输入课程名称" /></div>
              <div><Label className="text-sm">讲师 *</Label><Input value={courseForm.teacher} onChange={e => setCourseForm(p => ({ ...p, teacher: e.target.value }))} className="rounded-lg mt-1" placeholder="输入讲师姓名" /></div>
            </div>
            <div><Label className="text-sm">课程描述</Label><Textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} className="rounded-lg mt-1 min-h-[60px]" /></div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-sm">学科</Label>
                <Select value={courseForm.category} onValueChange={v => setCourseForm(p => ({ ...p, category: v as Course['category'] }))}>
                  <SelectTrigger className="rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="函数">函数</SelectItem><SelectItem value="几何">几何</SelectItem>
                    <SelectItem value="三角函数">三角函数</SelectItem><SelectItem value="概率统计">概率统计</SelectItem>
                    <SelectItem value="数列">数列</SelectItem><SelectItem value="代数">代数</SelectItem><SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">年级</Label>
                <Select value={courseForm.grade} onValueChange={v => setCourseForm(p => ({ ...p, grade: v as Course['grade'] }))}>
                  <SelectTrigger className="rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="高一">高一</SelectItem><SelectItem value="高二">高二</SelectItem>
                    <SelectItem value="高三">高三</SelectItem><SelectItem value="通用">通用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">难度</Label>
                <Select value={courseForm.level} onValueChange={v => setCourseForm(p => ({ ...p, level: v as Course['level'] }))}>
                  <SelectTrigger className="rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="基础">基础</SelectItem><SelectItem value="提高">提高</SelectItem><SelectItem value="竞赛">竞赛</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-sm">总课时</Label><Input type="number" value={courseForm.totalHours} onChange={e => setCourseForm(p => ({ ...p, totalHours: +e.target.value }))} className="rounded-lg mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">价格 (¥)</Label><Input type="number" value={courseForm.price} onChange={e => setCourseForm(p => ({ ...p, price: +e.target.value }))} className="rounded-lg mt-1" /></div>
              <div><Label className="text-sm">原价 (¥)</Label><Input type="number" value={courseForm.originalPrice} onChange={e => setCourseForm(p => ({ ...p, originalPrice: +e.target.value }))} className="rounded-lg mt-1" /></div>
            </div>

            {/* Chapters & Lessons */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-bold">课时管理</Label>
                <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={addChapter}>
                  <Plus className="w-3 h-3 mr-1" />添加章节
                </Button>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {courseChapters.map((ch, ci) => (
                  <div key={ch.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Input value={ch.title} onChange={e => updateChapterTitle(ch.id, e.target.value)} className="rounded-lg h-8 text-sm font-medium" />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeChapter(ch.id)}><X className="w-3 h-3 text-red-400" /></Button>
                    </div>
                    {ch.lessons.map((lesson, li) => (
                      <div key={lesson.id} className="ml-4 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input value={lesson.title} onChange={e => updateLesson(ch.id, lesson.id, { title: e.target.value })} className="rounded-lg h-7 text-xs flex-1 min-w-[120px]" />
                          <Button size="sm" variant={lesson.isFree ? 'default' : 'outline'} className="h-7 text-xs rounded px-2"
                            onClick={() => updateLesson(ch.id, lesson.id, { isFree: !lesson.isFree })}>
                            {lesson.isFree ? '免费' : '收费'}
                          </Button>
                          {/* Video upload button */}
                          <Button size="sm"
                            className={`h-7 text-xs rounded px-2 ${lesson.videoUrl && lesson.videoUrl.startsWith('indexeddb://') ? 'bg-green-50 text-green-600 border-green-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
                            variant="outline"
                            onClick={() => { setUploadingVideo(lesson.id); setUploadProgress(0); videoInputRef.current?.click(); }}>
                            {lesson.videoUrl && lesson.videoUrl.startsWith('indexeddb://') ? (
                              <><CheckCircle2 className="w-3 h-3 mr-1" />视频</>
                            ) : (
                              <><Video className="w-3 h-3 mr-1" />视频</>
                            )}
                          </Button>
                          {/* Material upload button */}
                          <Button size="sm"
                            className={`h-7 text-xs rounded px-2 ${lesson.materialFileId ? 'bg-green-50 text-green-600 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}
                            variant="outline"
                            onClick={() => { setUploadingMaterial(lesson.id); materialInputRef.current?.click(); }}>
                            {lesson.materialFileId ? (
                              <><CheckCircle2 className="w-3 h-3 mr-1" />资料</>
                            ) : (
                              <><FileUp className="w-3 h-3 mr-1" />资料</>
                            )}
                          </Button>
                          {/* Open time */}
                          <div className="flex items-center gap-1">
                            <Timer className="w-3 h-3 text-gray-400" />
                            <Input type="datetime-local" value={lesson.openAt || ''}
                              onChange={e => updateLesson(ch.id, lesson.id, { openAt: e.target.value })}
                              className="rounded-lg h-7 text-xs w-[150px]" placeholder="定时开放" />
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeLesson(ch.id, lesson.id)}>
                            <X className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                        {/* Upload progress */}
                        {uploadingVideo === lesson.id && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <Progress value={uploadProgress} className="h-2 flex-1" />
                            <span className="text-[11px] text-gray-500 w-8 text-right">{uploadProgress}%</span>
                          </div>
                        )}
                        {uploadingMaterial === lesson.id && (
                          <div className="mt-1.5 text-xs text-amber-600 animate-pulse">资料上传中...</div>
                        )}
                        {/* Show material file name */}
                        {lesson.materialFileName && (
                          <div className="mt-1 text-[11px] text-gray-400 flex items-center gap-1">
                            <FileUp className="w-3 h-3" />{lesson.materialFileName}
                          </div>
                        )}
                      </div>
                    ))}
                    <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f && uploadingVideo) handleVideoUpload(uploadingVideo, f);
                      e.target.value = '';
                    }} />
                    <input ref={batchVideoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={e => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        // Find the chapter for this batch input - store chId in a ref
                        handleBatchVideoUpload(batchChapterId, files);
                      }
                      e.target.value = '';
                    }} />
                    <input ref={materialInputRef} type="file" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f && uploadingMaterial) handleMaterialUpload(uploadingMaterial, f);
                      e.target.value = '';
                    }} />
                    {/* Batch upload progress overlay */}
                    {batchUploading && batchProgress.total > 0 && (
                      <div className="ml-4 mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-medium text-blue-700">
                            {batchProgress.pct !== undefined
                              ? `上传中 ${batchProgress.pct}% (${batchProgress.current}/${batchProgress.total})`
                              : `批量上传中 ${batchProgress.current}/${batchProgress.total}`
                            }
                          </span>
                        </div>
                        <Progress value={batchProgress.pct ?? Math.round((batchProgress.current / batchProgress.total) * 100)} className="h-2" />
                        <div className="text-[11px] text-blue-500 mt-1 truncate">{batchProgress.currentFile}</div>
                      </div>
                    )}
                    <div className="ml-4 flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="text-xs text-blue-600" onClick={() => addLesson(ch.id)}>
                        <Plus className="w-3 h-3 mr-1" />添加课时
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100 rounded-lg"
                        onClick={() => { setBatchChapterId(ch.id); batchVideoInputRef.current?.click(); }}>
                        <Upload className="w-3 h-3 mr-1" />批量上传视频
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => { setShowCourseDialog(false); resetCourseForm(); }}>取消</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg" onClick={handleSaveCourse} disabled={!courseForm.title.trim() || !courseForm.teacher.trim()}>
                <Save className="w-4 h-4 mr-2" />{editingCourse ? '保存修改' : '创建课程'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Live Create/Edit Dialog */}
      <Dialog open={showLiveDialog} onOpenChange={v => { setShowLiveDialog(v); if (!v) resetLiveForm(); }}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingLive ? '编辑直播' : '创建直播'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label className="text-sm">直播标题 *</Label><Input value={liveForm.title} onChange={e => setLiveForm(p => ({ ...p, title: e.target.value }))} className="rounded-lg mt-1" placeholder="输入直播标题" /></div>
            <div><Label className="text-sm">直播描述</Label><Textarea value={liveForm.description} onChange={e => setLiveForm(p => ({ ...p, description: e.target.value }))} className="rounded-lg mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">讲师 *</Label><Input value={liveForm.teacher} onChange={e => setLiveForm(p => ({ ...p, teacher: e.target.value }))} className="rounded-lg mt-1" /></div>
              <div>
                <Label className="text-sm">学科</Label>
                <Select value={liveForm.category} onValueChange={v => setLiveForm(p => ({ ...p, category: v as LiveStream['category'] }))}>
                  <SelectTrigger className="rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="函数">函数</SelectItem><SelectItem value="几何">几何</SelectItem>
                    <SelectItem value="三角函数">三角函数</SelectItem><SelectItem value="概率统计">概率统计</SelectItem>
                    <SelectItem value="数列">数列</SelectItem><SelectItem value="代数">代数</SelectItem><SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">计划时间 *</Label><Input type="datetime-local" value={liveForm.scheduledAt} onChange={e => setLiveForm(p => ({ ...p, scheduledAt: e.target.value }))} className="rounded-lg mt-1" /></div>
              <div><Label className="text-sm">时长（分钟）</Label><Input type="number" value={liveForm.duration} onChange={e => setLiveForm(p => ({ ...p, duration: +e.target.value }))} className="rounded-lg mt-1" /></div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => { setShowLiveDialog(false); resetLiveForm(); }}>取消</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 rounded-lg" onClick={handleSaveLive} disabled={!liveForm.title.trim() || !liveForm.teacher.trim()}>
                <Save className="w-4 h-4 mr-2" />{editingLive ? '保存修改' : '创建直播'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recording Upload Dialog */}
      <Dialog open={!!showRecordingDialog} onOpenChange={() => setShowRecordingDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader><DialogTitle>上传回放地址</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label className="text-sm">回放视频URL</Label><Input value={recordingUrl} onChange={e => setRecordingUrl(e.target.value)} className="rounded-lg mt-1" placeholder="输入视频回放地址" /></div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setShowRecordingDialog(null)}>取消</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg" onClick={() => showRecordingDialog && handleSaveRecording(showRecordingDialog)}>
                <CheckCircle2 className="w-4 h-4 mr-2" />保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
