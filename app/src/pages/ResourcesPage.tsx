import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Search, Download, Upload, FileText, File, Image, Archive, Video,
  Grid3X3, List, Eye, X, CheckCircle2, AlertCircle, FileDown, Trash2,
  Heart, MessageCircle, Music, Send
} from 'lucide-react';
import { useResourceStore } from '@/hooks/useResourceStore';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Resource, Comment } from '@/types';
import { getFileFromDB, toggleFavorite, isFavorited, getResourceComments, addComment } from '@/lib/fileStorage';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText, doc: File, ppt: File, xls: File, zip: Archive, video: Video, image: Image, audio: Music, other: File,
};
const typeColors: Record<string, string> = {
  pdf: 'bg-red-100 text-red-600', doc: 'bg-blue-100 text-blue-600', ppt: 'bg-orange-100 text-orange-600',
  xls: 'bg-green-100 text-green-600', zip: 'bg-purple-100 text-purple-600', video: 'bg-pink-100 text-pink-600',
  image: 'bg-cyan-100 text-cyan-600', audio: 'bg-yellow-100 text-yellow-600', other: 'bg-gray-100 text-gray-600',
};
const subjectColors: Record<string, string> = {
  '函数': 'bg-blue-500', '几何': 'bg-green-500', '三角函数': 'bg-purple-500',
  '概率统计': 'bg-orange-500', '数列': 'bg-pink-500', '代数': 'bg-cyan-500', '其他': 'bg-gray-500',
};

function detectFileType(file: File): Resource['type'] {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['xls', 'xlsx'].includes(ext)) return 'xls';
  if (['zip', 'rar', '7z'].includes(ext)) return 'zip';
  if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) return 'audio';
  return 'other';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
}

export default function ResourcesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resources, addResource, removeResource, downloadResource } = useResourceStore();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState(searchParams.get('subject') || 'all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileSizeError, setFileSizeError] = useState('');

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('');
  const [uploadSubject, setUploadSubject] = useState<string>('');
  const [uploadGrade, setUploadGrade] = useState<string>('通用');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Favorites & Comments state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');

  // Load favorites for current user
  useEffect(() => {
    if (user) {
      const loadFavs = async () => {
        const favMap: Set<string> = new Set();
        for (const r of resources) {
          const f = await isFavorited(user.id, r.id);
          if (f) favMap.add(r.id);
        }
        setFavoriteIds(favMap);
      };
      loadFavs();
    }
  }, [user, resources]);

  // Load comments when preview changes
  useEffect(() => {
    if (previewResource) {
      getResourceComments(previewResource.id).then(setComments);
    }
  }, [previewResource]);

  const loadPreviewBlob = useCallback(async (res: Resource | null) => {
    if (!res) { setPreviewBlobUrl(null); return; }
    if (res.previewUrl && res.previewUrl.startsWith('/uploads/')) {
      // 新版：直接从服务器加载
      setPreviewBlobUrl(res.previewUrl);
      return;
    }
    // 兼容旧版 IndexedDB
    const record = await getFileFromDB(res.id);
    if (record) {
      const url = URL.createObjectURL(record.blob);
      setPreviewBlobUrl(url);
    } else {
      setPreviewBlobUrl(null);
    }
  }, []);

  const handlePreviewChange = (res: Resource | null) => {
    setPreviewResource(res);
    loadPreviewBlob(res);
  };

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setFileSizeError(`文件大小 ${formatFileSize(file.size)} 超过 500MB 限制`);
      return;
    }
    setFileSizeError('');
    setUploadFile(file);
    if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile || !uploadTitle.trim() || !uploadCategory || !uploadSubject || !user) return;
    setUploading(true);
    const newResource: Resource = {
      id: 'r' + Date.now(),
      title: uploadTitle.trim(),
      description: uploadDesc.trim(),
      type: detectFileType(uploadFile),
      category: uploadCategory as Resource['category'],
      subject: uploadSubject as Resource['subject'],
      grade: (uploadGrade || '通用') as Resource['grade'],
      fileSize: formatFileSize(uploadFile.size),
      downloadCount: 0,
      uploadDate: new Date().toISOString().split('T')[0],
      uploader: user.displayName,
      uploaderId: user.id,
      tags: uploadTags.split(/[,，]/).map(t => t.trim()).filter(Boolean),
    };
    await addResource(newResource, uploadFile);
    setUploadSuccess(true);
    setTimeout(() => {
      setUploadOpen(false);
      resetUploadForm();
    }, 1200);
    setUploading(false);
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadDesc('');
    setUploadCategory('');
    setUploadSubject('');
    setUploadGrade('通用');
    setUploadTags('');
    setUploadSuccess(false);
    setUploading(false);
    setFileSizeError('');
  };

  const handlePreviewDownload = async (r: Resource) => {
    const ok = await downloadResource(r);
    if (!ok) {
      alert(`"${r.title}" 暂无真实文件可下载（示例资料）。请上传文件后下载。`);
    }
  };

  const handleToggleFavorite = async (resourceId: string) => {
    if (!user) { navigate('/login'); return; }
    const added = await toggleFavorite(user.id, resourceId);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (added) next.add(resourceId); else next.delete(resourceId);
      return next;
    });
  };

  const handleSendComment = async () => {
    if (!commentInput.trim() || !user || !previewResource) return;
    const c: Comment = {
      id: 'cmt_' + Date.now(),
      resourceId: previewResource.id,
      userId: user.id,
      userName: user.displayName,
      content: commentInput.trim(),
      createdAt: new Date().toISOString(),
    };
    await addComment(c);
    setComments(prev => [c, ...prev]);
    setCommentInput('');
  };

  const filtered = resources.filter(r => {
    if (search && !r.title.includes(search) && !r.description.includes(search) && !r.tags.some(t => t.includes(search))) return false;
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (subjectFilter !== 'all' && r.subject !== subjectFilter) return false;
    if (gradeFilter !== 'all' && r.grade !== gradeFilter) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            资料库
          </h1>
          <p className="text-gray-500 mt-1">全格式上传 · 年级筛选 · 收藏评论 · 下载计数</p>
        </div>
        {user ? (
          <Dialog open={uploadOpen} onOpenChange={v => { setUploadOpen(v); if (!v) resetUploadForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl px-6">
                <Upload className="w-4 h-4 mr-2" />上传资料
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-xl">
              <DialogHeader>
                <DialogTitle>上传资料</DialogTitle>
              </DialogHeader>
              {uploadSuccess ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mb-3" />
                  <p className="text-lg font-medium text-gray-800">上传成功！</p>
                  <p className="text-sm text-gray-500 mt-1">资料已添加到资料库</p>
                </div>
              ) : (
                <div className="space-y-4 mt-4">
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                      uploadFile ? 'border-green-400 bg-green-50' : fileSizeError ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-blue-400'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => {
                      e.preventDefault(); e.stopPropagation();
                      const f = e.dataTransfer.files[0];
                      if (f) handleFileSelect(f);
                    }}
                  >
                    <input ref={fileInputRef} type="file" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }} />
                    {uploadFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-800">{uploadFile.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="ml-2" onClick={e => { e.stopPropagation(); setUploadFile(null); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">拖拽文件到此处或点击上传</p>
                        <p className="text-xs text-gray-400 mt-1">支持 PDF/Word/PPT/Excel/MP4/MP3/图片/压缩包等，最大 500MB</p>
                        {fileSizeError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1 justify-center"><AlertCircle className="w-3 h-3" />{fileSizeError}</p>}
                      </>
                    )}
                  </div>
                  <Input placeholder="资料标题 *" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="rounded-lg" />
                  <Textarea placeholder="资料描述" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} className="rounded-lg min-h-[80px]" />
                  <div className="grid grid-cols-3 gap-3">
                    <Select value={uploadCategory} onValueChange={setUploadCategory}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="分类 *" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="教材">教材</SelectItem><SelectItem value="试卷">试卷</SelectItem>
                        <SelectItem value="笔记">笔记</SelectItem><SelectItem value="公式">公式</SelectItem>
                        <SelectItem value="竞赛">竞赛</SelectItem><SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={uploadSubject} onValueChange={setUploadSubject}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="学科 *" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="代数">代数</SelectItem><SelectItem value="几何">几何</SelectItem>
                        <SelectItem value="三角函数">三角函数</SelectItem><SelectItem value="概率统计">概率统计</SelectItem>
                        <SelectItem value="数列">数列</SelectItem><SelectItem value="函数">函数</SelectItem>
                        <SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={uploadGrade} onValueChange={setUploadGrade}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="年级" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="高一">高一</SelectItem><SelectItem value="高二">高二</SelectItem>
                        <SelectItem value="高三">高三</SelectItem><SelectItem value="通用">通用</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="标签（用逗号分隔）" value={uploadTags} onChange={e => setUploadTags(e.target.value)} className="rounded-lg" />
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg"
                    onClick={handleUploadSubmit}
                    disabled={!uploadFile || !uploadTitle.trim() || !uploadCategory || !uploadSubject || uploading}>
                    <Upload className="w-4 h-4 mr-2" />{uploading ? '上传中...' : '上传'}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        ) : (
          <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl px-6" onClick={() => navigate('/login')}>
            <Upload className="w-4 h-4 mr-2" />登录后上传
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6 shadow-sm border-0 rounded-xl">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="搜索资料名称、描述、标签..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-10 rounded-lg" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-24 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  <SelectItem value="教材">教材</SelectItem><SelectItem value="试卷">试卷</SelectItem>
                  <SelectItem value="笔记">笔记</SelectItem><SelectItem value="公式">公式</SelectItem>
                  <SelectItem value="竞赛">竞赛</SelectItem><SelectItem value="其他">其他</SelectItem>
                </SelectContent>
              </Select>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-24 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部学科</SelectItem>
                  <SelectItem value="代数">代数</SelectItem><SelectItem value="几何">几何</SelectItem>
                  <SelectItem value="三角函数">三角函数</SelectItem><SelectItem value="概率统计">概率统计</SelectItem>
                  <SelectItem value="数列">数列</SelectItem><SelectItem value="函数">函数</SelectItem>
                </SelectContent>
              </Select>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-20 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全年级</SelectItem>
                  <SelectItem value="高一">高一</SelectItem><SelectItem value="高二">高二</SelectItem>
                  <SelectItem value="高三">高三</SelectItem><SelectItem value="通用">通用</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-24 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部格式</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem><SelectItem value="doc">Word</SelectItem>
                  <SelectItem value="ppt">PPT</SelectItem><SelectItem value="xls">Excel</SelectItem>
                  <SelectItem value="zip">压缩包</SelectItem><SelectItem value="video">视频</SelectItem>
                  <SelectItem value="image">图片</SelectItem><SelectItem value="audio">音频</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-lg overflow-hidden">
                <Button size="sm" variant={viewMode === 'grid' ? 'default' : 'ghost'} onClick={() => setViewMode('grid')} className="rounded-none px-3">
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} onClick={() => setViewMode('list')} className="rounded-none px-3">
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="text-sm text-gray-500 mb-4">共找到 {filtered.length} 份资料</div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => {
            const Icon = typeIcons[r.type] || File;
            const isFav = favoriteIds.has(r.id);
            return (
              <Card key={r.id} className="hover:shadow-lg transition-all duration-300 border-0 shadow-sm rounded-xl group cursor-pointer" onClick={() => handlePreviewChange(r)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl ${typeColors[r.type]} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold group-hover:text-blue-600 transition-colors line-clamp-2">{r.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{r.description}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge className={`${subjectColors[r.subject] || 'bg-gray-500'} text-white text-[10px] px-1.5`}>{r.subject}</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5">{r.grade}</Badge>
                    {r.tags.slice(0, 2).map(t => (
                      <Badge key={t} variant="outline" className="text-[10px] px-1.5">{t}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Download className="w-3 h-3" />{r.downloadCount}</span>
                    <span>{r.fileSize}</span>
                    <button className={`transition-colors ${isFav ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                      onClick={e => { e.stopPropagation(); handleToggleFavorite(r.id); }}>
                      <Heart className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const Icon = typeIcons[r.type] || File;
            const isFav = favoriteIds.has(r.id);
            return (
              <Card key={r.id} className="hover:shadow-md transition-all duration-300 border-0 shadow-sm rounded-xl cursor-pointer" onClick={() => handlePreviewChange(r)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg ${typeColors[r.type]} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm group-hover:text-blue-600">{r.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-1">{r.description}</div>
                  </div>
                  <Badge className={`${subjectColors[r.subject] || 'bg-gray-500'} text-white text-xs`}>{r.subject}</Badge>
                  <Badge variant="outline" className="text-xs">{r.grade}</Badge>
                  <Badge variant="outline" className="text-xs">{r.type.toUpperCase()}</Badge>
                  <span className="text-xs text-gray-400 w-16 text-right">{r.fileSize}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1 w-20"><Download className="w-3 h-3" />{r.downloadCount}</span>
                  <button className={`transition-colors ${isFav ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                    onClick={e => { e.stopPropagation(); handleToggleFavorite(r.id); }}>
                    <Heart className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={e => { e.stopPropagation(); handlePreviewDownload(r); }}>
                    <Download className="w-3 h-3 mr-1" />下载
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewResource} onOpenChange={() => handlePreviewChange(null)}>
        <DialogContent className="sm:max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto">
          {previewResource && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{previewResource.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {previewResource.type === 'image' && previewBlobUrl && (
                  <div className="bg-gray-50 rounded-xl p-4 min-h-[200px] flex items-center justify-center">
                    <img src={previewBlobUrl} alt={previewResource.title} className="max-h-[400px] max-w-full object-contain rounded-lg" />
                  </div>
                )}
                {previewResource.type === 'pdf' && previewBlobUrl && (
                  <div className="bg-gray-100 rounded-xl overflow-hidden" style={{ height: '400px' }}>
                    <iframe src={previewBlobUrl} className="w-full h-full border-0" title="PDF预览" />
                  </div>
                )}
                {(previewResource.type === 'video' || previewResource.type === 'audio') && previewBlobUrl && (
                  <div className="bg-black rounded-xl overflow-hidden">
                    {previewResource.type === 'video' ? (
                      <video src={previewBlobUrl} controls className="w-full max-h-[400px]" />
                    ) : (
                      <div className="p-6"><audio src={previewBlobUrl} controls className="w-full" /></div>
                    )}
                  </div>
                )}
                {(!previewBlobUrl || !['image', 'pdf', 'video', 'audio'].includes(previewResource.type)) && (
                  <div className="bg-gray-50 rounded-xl p-8 text-center min-h-[150px] flex items-center justify-center">
                    <div className="text-gray-400">
                      {(() => { const Ic = typeIcons[previewResource.type] || File; return <Ic className="w-14 h-14 mx-auto mb-2" />; })()}
                      <p className="text-sm">{previewResource.type.toUpperCase()} 文件</p>
                      {!previewBlobUrl && <p className="text-xs text-amber-500 mt-1">示例资料，暂无真实文件</p>}
                    </div>
                  </div>
                )}
                <p className="text-sm text-gray-600">{previewResource.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={`${subjectColors[previewResource.subject]} text-white`}>{previewResource.subject}</Badge>
                  <Badge variant="outline">{previewResource.grade}</Badge>
                  <Badge variant="outline">{previewResource.category}</Badge>
                  <Badge variant="outline">{previewResource.type.toUpperCase()}</Badge>
                  {previewResource.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">上传者：</span>{previewResource.uploader}</div>
                  <div><span className="text-gray-500">文件大小：</span>{previewResource.fileSize}</div>
                  <div><span className="text-gray-500">上传日期：</span>{previewResource.uploadDate}</div>
                  <div><span className="text-gray-500">下载次数：</span>{previewResource.downloadCount}</div>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-lg" onClick={() => handlePreviewDownload(previewResource)}>
                    <FileDown className="w-4 h-4 mr-2" />下载资料
                  </Button>
                  <Button variant="outline" className="rounded-lg"
                    onClick={() => handleToggleFavorite(previewResource.id)}>
                    <Heart className={`w-4 h-4 mr-2 ${favoriteIds.has(previewResource.id) ? 'text-red-500 fill-red-500' : ''}`} />
                    {favoriteIds.has(previewResource.id) ? '已收藏' : '收藏'}
                  </Button>
                  {(user?.role === 'admin' || user?.id === previewResource.uploaderId) && (
                    <Button variant="destructive" className="rounded-lg"
                      onClick={() => { setDeleteConfirmId(previewResource.id); handlePreviewChange(null); }}>
                      <Trash2 className="w-4 h-4 mr-2" />删除
                    </Button>
                  )}
                </div>

                {/* Comments Section */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />评论 ({comments.length})
                  </h4>
                  {user && (
                    <div className="flex gap-2 mb-3">
                      <Input placeholder="写下你的评论..." value={commentInput} onChange={e => setCommentInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSendComment(); }}
                        className="rounded-lg h-9 text-sm" />
                      <Button size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 h-9"
                        onClick={handleSendComment} disabled={!commentInput.trim()}>
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {comments.length === 0 && <p className="text-xs text-gray-400 text-center py-2">暂无评论</p>}
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-bold">{c.userName[0]}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">{c.userName}</span>
                            <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString('zh-CN')}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">确定要删除这份资料吗？删除后文件将无法恢复。</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 rounded-lg"
              onClick={async () => {
                if (deleteConfirmId) {
                  await removeResource(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}>确认删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
