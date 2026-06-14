export interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'pdf' | 'doc' | 'ppt' | 'xls' | 'zip' | 'video' | 'image' | 'audio' | 'other';
  category: '教材' | '试卷' | '笔记' | '公式' | '竞赛' | '其他';
  subject: '代数' | '几何' | '三角函数' | '概率统计' | '数列' | '函数' | '其他';
  grade: '高一' | '高二' | '高三' | '通用';
  fileSize: string;
  downloadCount: number;
  uploadDate: string;
  uploader: string;
  uploaderId: string;
  tags: string[];
  previewUrl?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  teacher: string;
  coverImage: string;
  category: '代数' | '几何' | '三角函数' | '概率统计' | '数列' | '函数' | '其他';
  grade: '高一' | '高二' | '高三' | '通用';
  price: number;
  originalPrice: number;
  enrolledCount: number;
  rating: number;
  totalHours: number;
  chapters: Chapter[];
  level: '基础' | '提高' | '竞赛';
  startDate: string;
  isEnrolled: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  videoUrl: string;
  isFree: boolean;
  isCompleted?: boolean;
  openAt?: string; // 定时开放时间，ISO格式，留空则立即开放
  materialIds?: string[]; // 本课时关联的资料ID列表
  materialFileId?: string; // 本课时上传的资料文件在IndexedDB中的ID
  materialFileName?: string; // 本课时资料文件名
}

export interface LiveStream {
  id: string;
  title: string;
  description: string;
  teacher: string;
  coverImage: string;
  category: '代数' | '几何' | '三角函数' | '概率统计' | '数列' | '函数' | '其他';
  scheduledAt: string;
  duration: number;
  status: 'upcoming' | 'live' | 'ended';
  rtmpUrl: string;
  hlsUrl: string;
  streamKey: string;
  viewerCount: number;
  isReserved: boolean;
  recordingUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: string;
  result: string;
  status: 'running' | 'completed' | 'error';
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'user' | 'admin';
  avatar: string;
  enrolledCourses: string[];
  completedLessons: string[];
  studyHours: number;
  streak: number;
}

export interface AdminStats {
  totalUsers: number;
  totalResources: number;
  totalCourses: number;
  totalLiveStreams: number;
  todayVisits: number;
  weeklyGrowth: number;
  popularSubjects: { name: string; count: number }[];
  dailyActiveUsers: { date: string; count: number }[];
  resourceDownloads: { date: string; count: number }[];
  courseEnrollments: { date: string; count: number }[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'system' | 'update' | 'event';
  createdAt: string;
  isRead: boolean;
}

export interface Favorite {
  id: string;
  userId: string;
  resourceId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  resourceId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface StudyProgress {
  userId: string;
  courseId: string;
  completedLessons: string[];
  totalStudyMinutes: number;
  lastStudyAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface DownloadRecord {
  id: string;
  userId: string;
  resourceId: string;
  downloadedAt: string;
}
