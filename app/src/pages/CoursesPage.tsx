import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play, Clock, Star, Users, BookOpen, ChevronDown, ChevronRight, Lock,
  CheckCircle2, ShoppingCart, Heart, Video, LockIcon, Volume2, VolumeX,
  Pause, Maximize, SkipForward, SkipBack, Timer, FileUp, Download
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getFileFromDB } from '@/lib/fileStorage';
import type { Course, Lesson } from '@/types';

const TOKEN_KEY = 'mathhub_token';

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const categoryColors: Record<string, string> = {
  '函数': 'from-blue-500 to-indigo-500',
  '几何': 'from-green-500 to-emerald-500',
  '三角函数': 'from-purple-500 to-violet-500',
  '概率统计': 'from-orange-500 to-amber-500',
  '数列': 'from-pink-500 to-rose-500',
  '代数': 'from-cyan-500 to-teal-500',
  '其他': 'from-gray-500 to-slate-500',
};

// ─── 后端row转前端Course ───
function rowToCourse(row: any, enrolledCourseIds: Set<string>): Course {
  const chapters = typeof row.chapters === 'string' ? (() => { try { return JSON.parse(row.chapters); } catch { return []; } })() : (row.chapters || []);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    teacher: row.teacher,
    coverImage: row.cover_image,
    category: row.category,
    grade: row.grade,
    price: row.price,
    originalPrice: row.original_price,
    enrolledCount: row.enrolled_count,
    rating: row.rating,
    totalHours: row.total_hours,
    chapters,
    level: row.level,
    startDate: row.start_date,
    isEnrolled: enrolledCourseIds.has(row.id),
  };
}

// Countdown timer hook
function useCountdown(openAt: string | undefined) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!openAt) { setIsReady(true); setRemaining(null); return; }
    const target = new Date(openAt).getTime();
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining(0); setIsReady(true); return true; }
      setRemaining(diff); setIsReady(false); return false;
    };
    update();
    const timer = setInterval(() => { if (update()) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [openAt]);

  const formatCountdown = useCallback((ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (d > 0) return `${d}天 ${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, []);

  return { remaining, isReady, formatCountdown };
}

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(['ch1']));
  const [activeTab, setActiveTab] = useState('all');
  const [playingLesson, setPlayingLesson] = useState<Lesson | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ─── 加载课程列表 ───
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      if (data.courses && data.courses.length > 0) {
        const mapped = data.courses.map((r: any) => rowToCourse(r, enrolledIds));
        setCourses(mapped);
      } else {
        setCourses([]);
      }
    } catch (e) { console.error('加载课程失败', e); }
    finally { setLoading(false); }
  }, [enrolledIds]);

  // ─── 加载报名记录 ───
  const fetchEnrollments = useCallback(async () => {
    if (!user) { setEnrolledIds(new Set()); return; }
    try {
      const res = await fetch('/api/enrollments/my', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.enrollments) {
        setEnrolledIds(new Set(data.enrollments.map((e: any) => e.course_id)));
      }
    } catch (e) { console.error('加载报名记录失败', e); }
  }, [user]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);
  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // ─── Countdown ───
  const { remaining: countdownRemaining, isReady: countdownReady, formatCountdown } = useCountdown(playingLesson?.openAt);
  const autoPlayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (countdownReady && playingLesson && playingLesson.openAt && autoPlayedRef.current !== playingLesson.id) {
      autoPlayedRef.current = playingLesson.id;
      loadVideo(playingLesson);
    }
  }, [countdownReady, playingLesson]);

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) return;
    await fetch('/api/enrollments', {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ courseId }),
    });
    setEnrolledIds(prev => new Set([...prev, courseId]));
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, isEnrolled: true, enrolledCount: c.enrolledCount + 1 } : c));
  };

  const handleCancelEnroll = async (courseId: string) => {
    if (!user) return;
    await fetch(`/api/enrollments/${courseId}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    setEnrolledIds(prev => { const next = new Set(prev); next.delete(courseId); return next; });
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, isEnrolled: false, enrolledCount: Math.max(0, c.enrolledCount - 1) } : c));
  };

  const loadVideo = async (lesson: Lesson) => {
    setVideoUrl(null);
    if (lesson.videoUrl && lesson.videoUrl.startsWith('indexeddb://')) {
      // 兼容旧版 IndexedDB 存储的视频
      setVideoLoading(true);
      try {
        const key = lesson.videoUrl.replace('indexeddb://', '');
        const result = await getFileFromDB(key);
        if (result) setVideoUrl(URL.createObjectURL(result.blob));
      } catch (e) { console.error('Failed to load video:', e); }
      setVideoLoading(false);
    } else if (lesson.videoUrl) {
      // 新版：视频存在服务器 E盘
      setVideoLoading(true);
      setVideoUrl(lesson.videoUrl);
      setVideoLoading(false);
    }
  };

  const handlePlayLesson = async (lesson: Lesson, course: Course) => {
    if (!course.isEnrolled && !lesson.isFree) return;
    setPlayingLesson(lesson); setIsPlaying(true); setProgress(0); autoPlayedRef.current = null;
    if (lesson.openAt && new Date(lesson.openAt).getTime() > Date.now()) {
      setVideoUrl(null); setVideoLoading(false); return;
    }
    await loadVideo(lesson);
  };

  const handleDownloadMaterial = async (lesson: Lesson) => {
    if (!lesson.materialFileId) return;
    try {
      if (lesson.materialFileId.startsWith('/uploads/')) {
        // 新版：服务器文件，直接下载
        const a = document.createElement('a');
        a.href = lesson.materialFileId;
        a.download = lesson.materialFileName || '资料';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } else {
        // 兼容旧版 IndexedDB
        const result = await getFileFromDB(lesson.materialFileId);
        if (result) {
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url; a.download = lesson.materialFileName || '资料';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) { console.error('Failed to download material:', e); }
  };

  useEffect(() => { return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }; }, [videoUrl]);
  useEffect(() => { if (videoRef.current) { if (isPlaying) videoRef.current.play().catch(() => {}); else videoRef.current.pause(); } }, [isPlaying]);
  useEffect(() => { if (videoRef.current) videoRef.current.muted = isMuted; }, [isMuted]);

  const handleMarkComplete = (lessonId: string) => {
    if (!selectedCourse || !user) return;
    setCourses(prev => prev.map(c => {
      if (c.id !== selectedCourse.id) return c;
      return {
        ...c,
        chapters: c.chapters.map(ch => ({
          ...ch,
          lessons: ch.lessons.map(l =>
            l.id === lessonId ? { ...l, isCompleted: !l.isCompleted } : l
          ),
        })),
      };
    }));
  };

  const filteredCourses = courses.filter(c => {
    if (activeTab === 'all') return true;
    if (activeTab === 'enrolled') return c.isEnrolled;
    return c.category === activeTab;
  });

  const isLessonOpen = (lesson: Lesson): boolean => {
    if (!lesson.openAt) return true;
    return Date.now() >= new Date(lesson.openAt).getTime();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Video className="w-5 h-5 text-green-600" />
            </div>
            网课中心
          </h1>
          <p className="text-gray-500 mt-1">课程浏览 · 报名学习 · 定时开放 · 视频防盗链</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-gray-100 rounded-xl p-1">
          <TabsTrigger value="all" className="rounded-lg">全部课程</TabsTrigger>
          <TabsTrigger value="enrolled" className="rounded-lg">我的课程</TabsTrigger>
          <TabsTrigger value="函数" className="rounded-lg">函数</TabsTrigger>
          <TabsTrigger value="几何" className="rounded-lg">几何</TabsTrigger>
          <TabsTrigger value="概率统计" className="rounded-lg">概率统计</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map(c => {
            const totalLessons = c.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
            const completedLessons = c.chapters.reduce((s, ch) => s + ch.lessons.filter(l => l.isCompleted).length, 0);
            const progressPct = c.isEnrolled ? Math.round((completedLessons / totalLessons) * 100) : 0;
            const scheduledLessons = c.chapters.reduce((s, ch) => s + ch.lessons.filter(l => l.openAt && !isLessonOpen(l)).length, 0);
            return (
              <Card key={c.id} className="hover:shadow-xl transition-all duration-300 border-0 shadow-sm rounded-xl overflow-hidden group cursor-pointer"
                onClick={() => { setSelectedCourse(c); setExpandedChapters(new Set([c.chapters[0]?.id])); }}>
                <div className={`h-40 bg-gradient-to-br ${categoryColors[c.category] || categoryColors['其他']} flex flex-col items-center justify-center relative p-4`}>
                  <BookOpen className="w-14 h-14 text-white/60" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge className={`text-white text-xs ${c.level === '竞赛' ? 'bg-red-500' : c.level === '提高' ? 'bg-orange-500' : 'bg-blue-500'}`}>{c.level}</Badge>
                    {c.isEnrolled && <Badge className="bg-green-500 text-white text-xs">已报名</Badge>}
                  </div>
                  <div className="absolute top-3 right-3">
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>
                  {scheduledLessons > 0 && (
                    <div className="absolute bottom-3 left-3">
                      <Badge className="bg-yellow-500 text-white text-xs"><Timer className="w-3 h-3 mr-1" />{scheduledLessons}节定时开放</Badge>
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2"><CardTitle className="text-base font-bold group-hover:text-blue-600 transition-colors line-clamp-2">{c.title}</CardTitle></CardHeader>
                <CardContent className="pt-0 pb-4">
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{c.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.teacher}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.totalHours}课时</span>
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{c.rating}</span>
                  </div>
                  {c.isEnrolled && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">学习进度</span><span className="text-blue-600 font-medium">{progressPct}%</span></div>
                      <Progress value={progressPct} className="h-2 rounded-full" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-xl font-bold text-red-500">¥{c.price}</span><span className="text-xs text-gray-400 line-through">¥{c.originalPrice}</span></div>
                    <span className="text-xs text-gray-400">{c.enrolledCount}人已学</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Course Detail Dialog */}
      <Dialog open={!!selectedCourse} onOpenChange={() => { setSelectedCourse(null); setPlayingLesson(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] rounded-xl">
          {selectedCourse && (
            <>
              <DialogHeader><DialogTitle className="text-xl">{selectedCourse.title}</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-5">
                  <div className={`h-32 rounded-xl bg-gradient-to-br ${categoryColors[selectedCourse.category]} flex items-center justify-center`}>
                    <BookOpen className="w-16 h-16 text-white/60" />
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1 text-gray-600"><Users className="w-4 h-4" />{selectedCourse.teacher} 老师</span>
                    <span className="flex items-center gap-1 text-gray-600"><Clock className="w-4 h-4" />{selectedCourse.totalHours} 课时</span>
                    <span className="flex items-center gap-1 text-gray-600"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />{selectedCourse.rating} 分</span>
                    <span className="flex items-center gap-1 text-gray-600"><ShoppingCart className="w-4 h-4" />{selectedCourse.enrolledCount} 人已学</span>
                  </div>
                  <p className="text-sm text-gray-600">{selectedCourse.description}</p>
                  <div className="flex gap-3">
                    {selectedCourse.isEnrolled ? (
                      <>
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg" onClick={() => { const first = selectedCourse.chapters[0]?.lessons[0]; if (first) handlePlayLesson(first, selectedCourse); }}>
                          <Play className="w-4 h-4 mr-2" />继续学习
                        </Button>
                        <Button variant="outline" className="rounded-lg" onClick={() => handleCancelEnroll(selectedCourse.id)}>取消报名</Button>
                      </>
                    ) : (
                      <>
                        <Button className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-lg" onClick={() => handleEnroll(selectedCourse.id)}>
                          <ShoppingCart className="w-4 h-4 mr-2" />立即报名 ¥{selectedCourse.price}
                        </Button>
                        <Button variant="outline" className="rounded-lg"><Heart className="w-4 h-4 mr-2" />收藏</Button>
                      </>
                    )}
                  </div>

                  {/* Video Player */}
                  {playingLesson && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-base">正在播放：{playingLesson.title}</h3>
                        {playingLesson.materialFileId && (
                          <Button size="sm" variant="outline" className="text-xs rounded-lg h-7" onClick={() => handleDownloadMaterial(playingLesson)}>
                            <Download className="w-3 h-3 mr-1" />下载课时资料
                          </Button>
                        )}
                      </div>
                      <div className="bg-gray-900 rounded-xl aspect-video relative overflow-hidden">
                        {playingLesson.openAt && !countdownReady ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
                            <div className="text-center">
                              <Timer className="w-16 h-16 mx-auto mb-4 text-yellow-400 animate-pulse" />
                              <p className="text-white/90 text-lg font-bold mb-2">定时开放</p>
                              <p className="text-white/50 text-sm mb-4">开放时间：{new Date(playingLesson.openAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                              <div className="inline-flex gap-3">
                                {countdownRemaining !== null && countdownRemaining > 0 && (() => {
                                  const totalSec = Math.floor(countdownRemaining / 1000);
                                  const d = Math.floor(totalSec / 86400);
                                  const h = Math.floor((totalSec % 86400) / 3600);
                                  const m = Math.floor((totalSec % 3600) / 60);
                                  const s = totalSec % 60;
                                  const pad = (n: number) => String(n).padStart(2, '0');
                                  const blocks = d > 0 ? [String(d), pad(h), pad(m), pad(s)] : [pad(h), pad(m), pad(s)];
                                  const labels = d > 0 ? ['天', '时', '分', '秒'] : ['时', '分', '秒'];
                                  return blocks.map((val, i) => (
                                    <div key={i} className="text-center">
                                      <div className="w-14 h-14 bg-white/10 rounded-lg flex items-center justify-center text-2xl font-bold text-white tabular-nums border border-white/20">{val}</div>
                                      <div className="text-[10px] text-white/40 mt-1">{labels[i]}</div>
                                    </div>
                                  ));
                                })()}
                              </div>
                              <p className="text-white/30 text-xs mt-4">倒计时结束将自动播放视频</p>
                            </div>
                          </div>
                        ) : videoUrl ? (
                          <video ref={videoRef} src={videoUrl} className="w-full h-full object-contain" controls autoPlay
                            onContextMenu={e => e.preventDefault()}
                            onTimeUpdate={e => { const v = e.currentTarget; if (v.duration) setProgress((v.currentTime / v.duration) * 100); }}
                            onEnded={() => setIsPlaying(false)} />
                        ) : videoLoading ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-white/60"><div className="w-10 h-10 border-4 border-white/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-white/70">视频加载中...</p></div>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-white/60"><Video className="w-20 h-20 mx-auto mb-3 text-blue-400/60" /><p className="text-base font-medium text-white/80">{playingLesson.title}</p><p className="text-sm text-white/50 mt-1">{playingLesson.duration}</p><p className="text-xs text-white/40 mt-2">暂无视频，请联系管理员上传</p></div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400 flex items-center gap-1"><LockIcon className="w-3 h-3" />视频已启用防盗链保护，仅限已报名用户观看</p>
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-lg" onClick={() => handleMarkComplete(playingLesson.id)}>
                          {playingLesson.isCompleted ? <><CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />已完成</> : '标记完成'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Chapters */}
                  <div className="border-t pt-4">
                    <h3 className="font-bold text-lg mb-3">课程目录</h3>
                    <div className="space-y-2">
                      {selectedCourse.chapters.map(ch => {
                        const isExpanded = expandedChapters.has(ch.id);
                        return (
                          <div key={ch.id} className="border rounded-xl overflow-hidden">
                            <button className="w-full p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors" onClick={() => toggleChapter(ch.id)}>
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                              <span className="font-medium text-sm">{ch.title}</span>
                              <Badge variant="outline" className="text-xs ml-auto">{ch.lessons.length}节</Badge>
                            </button>
                            {isExpanded && (
                              <div className="border-t bg-gray-50/50">
                                {ch.lessons.map(lesson => {
                                  const canPlay = selectedCourse.isEnrolled || lesson.isFree;
                                  const isOpen = isLessonOpen(lesson);
                                  const hasScheduled = lesson.openAt && !isOpen;
                                  return (
                                    <div key={lesson.id} className={`px-4 py-2.5 flex items-center gap-3 transition-colors ${canPlay && isOpen ? 'hover:bg-gray-100/80 cursor-pointer' : 'opacity-60'}`}
                                      onClick={() => { if (canPlay && isOpen) handlePlayLesson(lesson, selectedCourse); }}>
                                      {lesson.isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : hasScheduled ? <Timer className="w-4 h-4 text-yellow-500 shrink-0" /> : lesson.isFree ? <Play className="w-4 h-4 text-blue-500 shrink-0" /> : <Lock className="w-4 h-4 text-gray-300 shrink-0" />}
                                      <span className={`text-sm flex-1 ${lesson.isCompleted ? 'text-gray-400' : ''}`}>{lesson.title}</span>
                                      {lesson.isFree && <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5">免费</Badge>}
                                      {hasScheduled && (
                                        <Badge className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5">
                                          <Timer className="w-2.5 h-2.5 mr-0.5" />
                                          {new Date(lesson.openAt!).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}开放
                                        </Badge>
                                      )}
                                      {lesson.materialFileId && <FileUp className="w-3 h-3 text-blue-400 shrink-0" title="有课时资料" />}
                                      <span className="text-xs text-gray-400">{lesson.duration}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
