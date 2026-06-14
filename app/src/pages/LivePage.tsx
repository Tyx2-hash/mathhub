import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Radio, Clock, Users, Calendar, Bell, BellRing, Play, Eye,
  Monitor, Video, Settings, Copy, Check, MessageCircle, Send,
  Volume2, VolumeX, Maximize, Pause
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { LiveStream } from '@/types';

const TOKEN_KEY = 'mathhub_token';
function getAuthHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function LivePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [showStreamSetup, setShowStreamSetup] = useState(false);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState('');
  const [isWatchingLive, setIsWatchingLive] = useState(false);
  const [isLivePlaying, setIsLivePlaying] = useState(true);
  const [isLiveMuted, setIsLiveMuted] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ user: string; msg: string; time: string }[]>([
    { user: '小明', msg: '老师讲得太好了！', time: '20:01' },
    { user: '数学迷', msg: '这个解题方法太妙了', time: '20:03' },
    { user: '高考加油', msg: '请问这个知识点高考常考吗？', time: '20:05' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);

  // ─── 加载直播列表 ───
  const fetchStreams = useCallback(async () => {
    try {
      const res = await fetch('/api/live');
      const data = await res.json();
      if (data.streams && data.streams.length > 0) {
        setStreams(data.streams.map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          teacher: r.teacher,
          coverImage: r.cover_image,
          category: r.category,
          scheduledAt: r.scheduled_at,
          duration: r.duration,
          status: r.status,
          rtmpUrl: r.rtmp_url,
          hlsUrl: r.hls_url,
          streamKey: r.stream_key,
          viewerCount: r.viewer_count,
          isReserved: !!r.is_reserved,
          recordingUrl: r.recording_url,
        })));
      } else {
        setStreams([]);
      }
    } catch (e) { console.error('加载直播失败', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStreams(); }, [fetchStreams]);

  // ─── 倒计时 ───
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const newCountdowns: Record<string, string> = {};
      streams.forEach(s => {
        if (s.status === 'upcoming') {
          const diff = new Date(s.scheduledAt).getTime() - now;
          if (diff <= 0) { newCountdowns[s.id] = '即将开始'; return; }
          const d = Math.floor(diff / 86400000);
          const h = Math.floor((diff % 86400000) / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const sec = Math.floor((diff % 60000) / 1000);
          newCountdowns[s.id] = d > 0 ? `${d}天${h}时${m}分` : `${h}时${m}分${sec}秒`;
        }
      });
      setCountdowns(newCountdowns);
    }, 1000);
    return () => clearInterval(timer);
  }, [streams]);

  const filteredStreams = streams.filter(s => {
    if (activeTab === 'all') return true;
    return s.status === activeTab;
  });

  const reserveStream = (id: string) => {
    if (!user) { navigate('/login'); return; }
    setStreams(prev => prev.map(s => s.id === id ? { ...s, isReserved: !s.isReserved } : s));
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopiedField(field); setTimeout(() => setCopiedField(''), 1500); });
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, {
      user: user?.displayName || '我',
      msg: chatInput,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }]);
    setChatInput('');
  };

  const liveStream = streams.find(s => s.status === 'live');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Radio className="w-5 h-5 text-red-600" />
            </div>
            直播中心
          </h1>
          <p className="text-gray-500 mt-1">RTMP 推流 · HLS 播放 · 直播预约 · 互动答疑</p>
        </div>
        {user?.role === 'admin' && (
          <Button className="bg-red-600 hover:bg-red-700 rounded-xl px-6" onClick={() => setShowStreamSetup(true)}>
            <Monitor className="w-4 h-4 mr-2" />推流设置
          </Button>
        )}
      </div>

      {liveStream && !isWatchingLive && (
        <Card className="mb-6 bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 shadow-lg rounded-xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 bg-white rounded-full animate-pulse" /><span className="text-sm font-bold">正在直播</span></div>
                <h2 className="text-2xl font-bold mb-2">{liveStream.title}</h2>
                <div className="flex items-center gap-4 text-sm text-red-100"><span className="flex items-center gap-1"><Users className="w-4 h-4" />{liveStream.viewerCount} 人观看</span><span>{liveStream.teacher} 老师</span></div>
              </div>
              <Button size="lg" className="bg-white text-red-600 hover:bg-red-50 rounded-xl font-bold shadow-lg" onClick={() => { if (user) setIsWatchingLive(true); else navigate('/login'); }}>
                <Play className="w-5 h-5 mr-2" />进入直播间
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isWatchingLive && liveStream && (
        <Card className="mb-6 shadow-lg border-0 rounded-xl overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            <div className="flex-1">
              <div className="bg-gray-900 aspect-video relative flex items-center justify-center">
                <div className="text-center"><Radio className="w-20 h-20 mx-auto mb-3 animate-pulse text-red-400" /><p className="text-lg font-medium text-white/80">{liveStream.title}</p><p className="text-sm text-white/50 mt-1">{liveStream.teacher} 老师</p></div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-white text-xs font-medium">直播中</span><span className="text-white/60 text-xs">· {liveStream.viewerCount} 人观看</span></div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="text-white h-7 w-7 p-0 hover:bg-white/20" onClick={() => setIsLivePlaying(!isLivePlaying)}>{isLivePlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Button>
                      <Button size="sm" variant="ghost" className="text-white h-7 w-7 p-0 hover:bg-white/20" onClick={() => setIsLiveMuted(!isLiveMuted)}>{isLiveMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</Button>
                      <Button size="sm" variant="ghost" className="text-white h-7 w-7 p-0 hover:bg-white/20 lg:hidden" onClick={() => setShowChat(!showChat)}><MessageCircle className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-gray-800 flex items-center justify-between"><span className="text-white/60 text-xs">HLS 低延迟直播</span><Button size="sm" variant="ghost" className="text-white/60 hover:text-white text-xs h-7" onClick={() => setIsWatchingLive(false)}>退出直播间</Button></div>
            </div>
            <div className={`w-full lg:w-80 border-l bg-white flex flex-col ${showChat ? '' : 'hidden lg:flex'}`} style={{ maxHeight: '500px' }}>
              <div className="p-3 border-b bg-gray-50 flex items-center justify-between"><span className="font-medium text-sm">直播间互动</span><span className="text-xs text-gray-400">{chatMessages.length} 条消息</span></div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '350px' }}>
                {chatMessages.map((msg, i) => (<div key={i} className="text-sm"><span className="font-medium text-blue-600">{msg.user}</span><span className="text-gray-400 text-xs ml-2">{msg.time}</span><p className="text-gray-700 mt-0.5">{msg.msg}</p></div>))}
              </div>
              <div className="p-3 border-t"><div className="flex gap-2"><Input placeholder="发送消息..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(); }} className="rounded-lg h-9 text-sm" /><Button size="sm" className="rounded-lg bg-red-500 hover:bg-red-600 h-9" onClick={sendChatMessage}><Send className="w-3 h-3" /></Button></div></div>
            </div>
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-gray-100 rounded-xl p-1">
          <TabsTrigger value="all" className="rounded-lg">全部直播</TabsTrigger>
          <TabsTrigger value="live" className="rounded-lg">正在直播</TabsTrigger>
          <TabsTrigger value="upcoming" className="rounded-lg">即将直播</TabsTrigger>
          <TabsTrigger value="ended" className="rounded-lg">精彩回放</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStreams.map(s => (
            <Card key={s.id} className="hover:shadow-xl transition-all duration-300 border-0 shadow-sm rounded-xl overflow-hidden group">
              <div className={`h-40 flex items-center justify-center relative ${
                s.status === 'live' ? 'bg-gradient-to-br from-red-500 to-orange-500' :
                s.status === 'upcoming' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' :
                'bg-gradient-to-br from-gray-500 to-gray-600'
              }`}>
                {s.status === 'live' ? <Radio className="w-14 h-14 text-white/60" /> : s.status === 'upcoming' ? <Calendar className="w-14 h-14 text-white/60" /> : <Video className="w-14 h-14 text-white/60" />}
                <div className="absolute top-3 left-3 flex gap-2">
                  {s.status === 'live' && <Badge className="bg-red-600 text-white text-xs animate-pulse">直播中</Badge>}
                  {s.status === 'upcoming' && <Badge className="bg-blue-500 text-white text-xs">预告</Badge>}
                  {s.status === 'ended' && <Badge className="bg-gray-600 text-white text-xs">回放</Badge>}
                </div>
                {s.status === 'live' && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1 text-white/90 text-xs bg-black/30 rounded-full px-2 py-1"><Eye className="w-3 h-3" />{s.viewerCount}</div>
                )}
              </div>
              <CardHeader className="pb-2"><CardTitle className="text-base font-bold group-hover:text-blue-600 transition-colors line-clamp-2">{s.title}</CardTitle></CardHeader>
              <CardContent className="pt-0 pb-4">
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{s.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3"><Clock className="w-3 h-3" />{new Date(s.scheduledAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-4"><Users className="w-3 h-3" />{s.teacher} 老师 · {s.duration}分钟</div>
                {s.status === 'live' && (
                  <Button className="w-full bg-red-500 hover:bg-red-600 rounded-lg" onClick={() => { if (user) setIsWatchingLive(true); else navigate('/login'); }}><Play className="w-4 h-4 mr-2" />进入直播间</Button>
                )}
                {s.status === 'upcoming' && (
                  <div className="space-y-2">
                    <div className="bg-blue-50 text-blue-700 text-sm font-medium rounded-lg p-2 text-center"><Clock className="w-3 h-3 inline mr-1" />{countdowns[s.id] || '计算中...'}</div>
                    <Button variant="outline" className={`w-full rounded-lg ${s.isReserved ? 'border-green-300 text-green-600 bg-green-50' : ''}`} onClick={() => reserveStream(s.id)}>
                      {s.isReserved ? <><BellRing className="w-4 h-4 mr-2" />已预约</> : <><Bell className="w-4 h-4 mr-2" />预约直播</>}
                    </Button>
                  </div>
                )}
                {s.status === 'ended' && (
                  <Button variant="outline" className="w-full rounded-lg"><Play className="w-4 h-4 mr-2" />观看回放</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stream Setup Dialog */}
      <Dialog open={showStreamSetup} onOpenChange={setShowStreamSetup}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />推流设置</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">RTMP 推流地址</label><div className="flex gap-2"><code className="flex-1 bg-gray-100 p-2.5 rounded-lg text-sm text-gray-600 font-mono select-all">rtmp://live.mathhub.cn/live</code><Button size="sm" variant="outline" className="rounded-lg shrink-0" onClick={() => copyToClipboard('rtmp://live.mathhub.cn/live', 'rtmp')}>{copiedField === 'rtmp' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</Button></div></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">推流密钥</label><div className="flex gap-2"><code className="flex-1 bg-gray-100 p-2.5 rounded-lg text-sm text-gray-600 font-mono select-all">sk-math-{streams.length + 1}-live-key</code><Button size="sm" variant="outline" className="rounded-lg shrink-0" onClick={() => copyToClipboard(`sk-math-${streams.length + 1}-live-key`, 'key')}>{copiedField === 'key' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</Button></div></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">HLS 播放地址</label><div className="flex gap-2"><code className="flex-1 bg-gray-100 p-2.5 rounded-lg text-sm text-gray-600 font-mono select-all break-all">https://live.mathhub.cn/live/stream{streams.length + 1}/index.m3u8</code><Button size="sm" variant="outline" className="rounded-lg shrink-0" onClick={() => copyToClipboard(`https://live.mathhub.cn/live/stream${streams.length + 1}/index.m3u8`, 'hls')}>{copiedField === 'hls' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</Button></div></div>
            <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-700">请使用 OBS 或其他推流软件，将 RTMP 地址和密钥填入推流设置中即可开始直播。</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
