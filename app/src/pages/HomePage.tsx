import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Video, Radio, Bot, ArrowRight, Search, Download, Users, Star, TrendingUp, ChevronRight, Sparkles, GraduationCap, Play, Clock,
  Bell, Megaphone, Target, Flame
} from 'lucide-react';
import { mockResources, mockCourses, mockLiveStreams } from '@/data/mock';
import { useAuth } from '@/hooks/useAuth';
import { useResourceStore } from '@/hooks/useResourceStore';
import { getAnnouncements, getAllUserStudyProgress } from '@/lib/fileStorage';
import type { Announcement, StudyProgress } from '@/types';

const subjectColors: Record<string, string> = {
  '函数': 'bg-blue-500', '几何': 'bg-green-500', '三角函数': 'bg-purple-500',
  '概率统计': 'bg-orange-500', '数列': 'bg-pink-500', '代数': 'bg-cyan-500', '其他': 'bg-gray-500',
};

const knowledgePoints = [
  { name: '函数', icon: '📈', desc: '定义域·值域·单调性', color: 'from-blue-500 to-indigo-500' },
  { name: '几何', icon: '📐', desc: '解析·立体·圆锥曲线', color: 'from-green-500 to-emerald-500' },
  { name: '三角函数', icon: '🔄', desc: '诱导公式·图像变换', color: 'from-purple-500 to-violet-500' },
  { name: '概率统计', icon: '🎲', desc: '排列组合·概率计算', color: 'from-orange-500 to-amber-500' },
  { name: '数列', icon: '🔢', desc: '等差等比·求和方法', color: 'from-pink-500 to-rose-500' },
  { name: '代数', icon: '✖️', desc: '不等式·向量·复数', color: 'from-cyan-500 to-teal-500' },
];

const annTypeIcon: Record<string, typeof Bell> = {
  system: Bell,
  update: Megaphone,
  event: Star,
};

const annTypeColor: Record<string, string> = {
  system: 'bg-blue-100 text-blue-700',
  update: 'bg-green-100 text-green-700',
  event: 'bg-orange-100 text-orange-700',
};

function CircularProgress({ value, size = 72, strokeWidth = 6, color = '#3B82F6' }: { value: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
    </svg>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resources } = useResourceStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [countdown, setCountdown] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studyProgress, setStudyProgress] = useState<StudyProgress[]>([]);
  const hotResources = resources.slice(0, 6);

  useEffect(() => {
    const liveStream = mockLiveStreams.find(s => s.status === 'live');
    if (!liveStream) {
      const upcoming = mockLiveStreams.find(s => s.status === 'upcoming');
      if (upcoming) {
        const timer = setInterval(() => {
          const diff = new Date(upcoming.scheduledAt).getTime() - Date.now();
          if (diff <= 0) { setCountdown('直播中'); return; }
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`${h}时${m}分${s}秒`);
        }, 1000);
        return () => clearInterval(timer);
      }
    }
  }, []);

  useEffect(() => {
    getAnnouncements().then(setAnnouncements);
    if (user) {
      getAllUserStudyProgress(user.id).then(setStudyProgress);
    }
  }, [user]);

  const totalDownloadCount = resources.reduce((s, r) => s + r.downloadCount, 0);
  const stats = [
    { icon: Download, label: '资料总数', value: `${resources.length}+`, color: 'text-blue-500' },
    { icon: Video, label: '网课课程', value: `${mockCourses.length}`, color: 'text-green-500' },
    { icon: Users, label: '注册用户', value: '12,850', color: 'text-purple-500' },
    { icon: TrendingUp, label: '总下载量', value: totalDownloadCount > 10000 ? `${(totalDownloadCount / 10000).toFixed(1)}万` : `${totalDownloadCount}`, color: 'text-orange-500' },
  ];

  // Calculate study progress
  const enrolledCourses = mockCourses.filter(c => c.isEnrolled);
  const overallProgress = enrolledCourses.length > 0
    ? Math.round(enrolledCourses.reduce((sum, c) => {
        const total = c.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
        const completed = c.chapters.reduce((s, ch) => s + ch.lessons.filter(l => l.isCompleted).length, 0);
        return sum + (total > 0 ? (completed / total) * 100 : 0);
      }, 0) / enrolledCourses.length)
    : 0;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0zMHY2aDZ2LTZoLTZ6bTAgMTJ2Nmg2di02aC02em0wIDEydjZoNnYtNmgtNnptMC0xMnY2aDZ2LTZoLTZ6bS0xMiAxMnY2aDZ2LTZoLTZ6bTAtMTJ2NmgtNnYtNmg2em0wLTEydjZoNnYtNmgtNnptMCAyNHY2aDZ2LTZoLTZ6bS0xMi0xMnY2aDZ2LTZoLTZ6bTAtMTJ2Nmg2di02aC02em0wIDI0djZoNnYtNmgtNnptMC0xMnY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-medium">AI 驱动 · 全方位高中数学学习平台</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              高中数学资料库
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              集资料分享、网课学习、直播授课、AI智能辅导于一体<br/>
              让数学学习更高效、更有趣
            </p>
            <div className="max-w-xl mx-auto relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="搜索资料、课程、直播..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg bg-white/95 backdrop-blur-sm border-0 shadow-xl rounded-2xl text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/resources"><Button size="lg" className="bg-white text-indigo-700 hover:bg-blue-50 rounded-xl px-8 h-12 font-semibold shadow-lg">
                <BookOpen className="w-5 h-5 mr-2" />浏览资料库
              </Button></Link>
              <Link to="/courses"><Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-xl px-8 h-12 font-semibold backdrop-blur-sm">
                <Play className="w-5 h-5 mr-2" />网课中心
              </Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-white shadow-lg border-0 rounded-xl">
              <CardContent className="p-5 text-center">
                <stat.icon className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Knowledge Point Quick Navigation */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Target className="w-6 h-6 text-indigo-500" />知识点导航
            </h2>
            <p className="text-gray-500 mt-1">快速定位你想学的知识点</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {knowledgePoints.map(kp => (
            <Link key={kp.name} to={`/resources?subject=${kp.name}`}>
              <Card className="hover:shadow-lg transition-all duration-300 border-0 shadow-sm rounded-xl cursor-pointer group overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${kp.color}`} />
                <CardContent className="p-4 text-center">
                  <div className="text-2xl mb-2">{kp.icon}</div>
                  <div className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{kp.name}</div>
                  <div className="text-[11px] text-gray-400 mt-1">{kp.desc}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Announcements + Learning Progress Row */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Announcements */}
          <Card className="lg:col-span-2 border-0 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-orange-500" />公告栏
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {announcements.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无公告</p>
              ) : (
                <div className="space-y-3">
                  {announcements.slice(0, 3).map(ann => {
                    const IconComp = annTypeIcon[ann.type] || Bell;
                    return (
                      <div key={ann.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${annTypeColor[ann.type]}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">{ann.title}</div>
                          <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{ann.content}</div>
                          <div className="text-[11px] text-gray-400 mt-1">
                            {new Date(ann.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Learning Progress */}
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" />学习进度
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {user ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-3">
                    <CircularProgress value={overallProgress} size={80} strokeWidth={7} color="#3B82F6" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-blue-600">{overallProgress}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">总体学习进度</p>
                  <div className="w-full mt-4 space-y-2">
                    {enrolledCourses.slice(0, 3).map(c => {
                      const total = c.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
                      const done = c.chapters.reduce((s, ch) => s + ch.lessons.filter(l => l.isCompleted).length, 0);
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div key={c.id} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-700 truncate">{c.title}</div>
                            <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                              <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                  {user.streak > 0 && (
                    <div className="mt-3 text-xs text-orange-600 flex items-center gap-1">
                      <Flame className="w-3 h-3" />连续学习 {user.streak} 天
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">登录后查看学习进度</p>
                  <Button size="sm" variant="outline" className="mt-3 rounded-lg text-xs"
                    onClick={() => navigate('/login')}>去登录</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Live Stream Banner */}
      {mockLiveStreams.find(s => s.status === 'live') && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <Link to="/live">
            <Card className="bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 shadow-lg rounded-xl overflow-hidden">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Radio className="w-10 h-10" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-pulse" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">{mockLiveStreams.find(s => s.status === 'live')!.title}</div>
                    <div className="text-sm text-red-100">{mockLiveStreams.find(s => s.status === 'live')!.teacher} 老师正在直播中 · {mockLiveStreams.find(s => s.status === 'live')!.viewerCount} 人观看</div>
                  </div>
                </div>
                <Button variant="secondary" className="rounded-xl font-semibold">立即观看</Button>
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      {/* Hot Resources */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-500" />热门资料
            </h2>
            <p className="text-gray-500 mt-1">最受欢迎的学习资料，精选推荐</p>
          </div>
          <Link to="/resources">
            <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
              查看全部 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hotResources.map((r) => (
            <Card key={r.id} className="hover:shadow-lg transition-all duration-300 border-0 shadow-sm rounded-xl group cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge className={`${subjectColors[r.subject] || 'bg-gray-500'} text-white text-xs`}>
                    {r.subject}
                  </Badge>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[10px]">{r.grade}</Badge>
                    <Badge variant="outline" className="text-xs">{r.type.toUpperCase()}</Badge>
                  </div>
                </div>
                <CardTitle className="text-base font-semibold group-hover:text-blue-600 transition-colors line-clamp-2 mt-2">
                  {r.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{r.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" />{r.downloadCount}</span>
                  <span>{r.fileSize}</span>
                  <span>{r.uploadDate}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Popular Courses */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-green-500" />精品网课
            </h2>
            <p className="text-gray-500 mt-1">名师授课，系统提升</p>
          </div>
          <Link to="/courses">
            <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
              查看全部 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockCourses.map((c) => (
            <Card key={c.id} className="hover:shadow-lg transition-all duration-300 border-0 shadow-sm rounded-xl overflow-hidden group cursor-pointer">
              <div className="h-32 bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center relative">
                <BookOpen className="w-12 h-12 text-white/80" />
                {c.isEnrolled && (
                  <Badge className="absolute top-2 right-2 bg-green-500 text-white text-xs">已报名</Badge>
                )}
                <Badge className={`absolute top-2 left-2 text-white text-xs ${c.level === '竞赛' ? 'bg-red-500' : c.level === '提高' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                  {c.level}
                </Badge>
                <Badge className="absolute bottom-2 right-2 bg-black/30 text-white text-[10px]">{c.grade}</Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold group-hover:text-blue-600 transition-colors line-clamp-2">
                  {c.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="text-xs text-gray-500 mb-2">{c.teacher} 老师 · {c.totalHours}课时</div>
                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs font-medium">{c.rating}</span>
                  <span className="text-xs text-gray-400">({c.enrolledCount}人已学)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-red-500">¥{c.price}</span>
                  <span className="text-xs text-gray-400 line-through">¥{c.originalPrice}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Upcoming Live */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Radio className="w-6 h-6 text-red-500" />即将直播
            </h2>
            <p className="text-gray-500 mt-1">预约直播，不错过每一场精彩</p>
          </div>
          <Link to="/live">
            <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
              查看全部 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockLiveStreams.filter(s => s.status !== 'ended').map((s) => (
            <Card key={s.id} className="hover:shadow-lg transition-all duration-300 border-0 shadow-sm rounded-xl overflow-hidden group cursor-pointer">
              <div className="h-28 bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center relative">
                <Radio className="w-10 h-10 text-white/80" />
                {s.status === 'live' ? (
                  <Badge className="absolute top-2 right-2 bg-red-600 text-white text-xs animate-pulse">直播中</Badge>
                ) : (
                  <Badge className="absolute top-2 right-2 bg-blue-500 text-white text-xs">预告</Badge>
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold group-hover:text-blue-600 transition-colors line-clamp-2">
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="text-xs text-gray-500 mb-2">{s.teacher} 老师 · {s.duration}分钟</div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                  <Clock className="w-3 h-3" />
                  {new Date(s.scheduledAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {s.status === 'live' ? (
                  <Button size="sm" className="w-full bg-red-500 hover:bg-red-600 rounded-lg text-xs">
                    立即观看
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full rounded-lg text-xs">
                    预约直播
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 mb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">为什么选择我们？</h2>
          <p className="text-gray-500 mt-2">全方位的数学学习解决方案</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: BookOpen, title: '海量资料', desc: 'PDF、Word、PPT等多格式资料一键上传下载', color: 'from-blue-500 to-cyan-500' },
            { icon: Video, title: '精品网课', desc: '名师录制课程，系统化学习路径', color: 'from-green-500 to-emerald-500' },
            { icon: Radio, title: '实时直播', desc: '互动直播授课，实时答疑解惑', color: 'from-red-500 to-pink-500' },
            { icon: Bot, title: 'AI助手', desc: '智能数学问答，随时解决学习问题', color: 'from-purple-500 to-violet-500' },
          ].map((f) => (
            <Card key={f.title} className="border-0 shadow-sm rounded-xl hover:shadow-lg transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-lg font-bold text-white mb-2">高中数学资料库</div>
          <p className="text-sm">AI驱动的全方位高中数学学习平台</p>
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <Link to="/resources" className="hover:text-white transition-colors">资料库</Link>
            <Link to="/courses" className="hover:text-white transition-colors">网课中心</Link>
            <Link to="/live" className="hover:text-white transition-colors">直播中心</Link>
            <Link to="/ai" className="hover:text-white transition-colors">AI助手</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
