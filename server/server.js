import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ───
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'mathhub_secret_key_2026';

// ─── File Upload Config ───
const UPLOAD_DIR = (() => {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  // Windows本地优先用E盘
  try { if (process.platform === 'win32' && fs.existsSync('E:/')) return 'E:/mathhub-videos'; } catch {}
  return path.join(process.cwd(), 'uploads');
})();
const UPLOAD_LESSONS_DIR = path.join(UPLOAD_DIR, 'lessons');
const UPLOAD_MATERIALS_DIR = path.join(UPLOAD_DIR, 'materials');
const UPLOAD_RESOURCES_DIR = path.join(UPLOAD_DIR, 'resources');
[UPLOAD_DIR, UPLOAD_LESSONS_DIR, UPLOAD_MATERIALS_DIR, UPLOAD_RESOURCES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'lessons';
    const dirMap = { lessons: UPLOAD_LESSONS_DIR, materials: UPLOAD_MATERIALS_DIR, resources: UPLOAD_RESOURCES_DIR };
    cb(null, dirMap[type] || UPLOAD_LESSONS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    cb(null, `${name}-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2048 * 1024 * 1024 }, // 2GB
});

// ─── Database ───
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'mathhub.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    avatar TEXT DEFAULT '',
    enrolled_courses TEXT DEFAULT '[]',
    completed_lessons TEXT DEFAULT '[]',
    study_hours REAL DEFAULT 0,
    streak INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    file_size TEXT DEFAULT '',
    download_count INTEGER DEFAULT 0,
    upload_date TEXT NOT NULL,
    uploader TEXT DEFAULT '',
    uploader_id TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    preview_url TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    teacher TEXT DEFAULT '',
    cover_image TEXT DEFAULT '',
    category TEXT DEFAULT '',
    grade TEXT DEFAULT '',
    price REAL DEFAULT 0,
    original_price REAL DEFAULT 0,
    enrolled_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    total_hours INTEGER DEFAULT 0,
    level TEXT DEFAULT '',
    start_date TEXT DEFAULT '',
    is_enrolled INTEGER DEFAULT 0,
    chapters TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS live_streams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    teacher TEXT DEFAULT '',
    cover_image TEXT DEFAULT '',
    category TEXT DEFAULT '',
    scheduled_at TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    status TEXT DEFAULT 'upcoming',
    rtmp_url TEXT DEFAULT '',
    hls_url TEXT DEFAULT '',
    stream_key TEXT DEFAULT '',
    viewer_count INTEGER DEFAULT 0,
    is_reserved INTEGER DEFAULT 0,
    recording_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    enrolled_at TEXT DEFAULT (datetime('now')),
    completed_lessons TEXT DEFAULT '[]',
    study_minutes INTEGER DEFAULT 0,
    UNIQUE(user_id, course_id)
  );
`);

// Seed default users
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const seedUsers = [
    { id: 'u1', username: 'student', password: '123456', displayName: '张同学', role: 'user' },
    { id: 'u2', username: 'teacher', password: '123456', displayName: '李老师', role: 'user' },
    { id: 'a1', username: 'admin',   password: 'admin123', displayName: '系统管理员', role: 'admin' },
  ];
  const ins = db.prepare(`INSERT INTO users (id,username,password_hash,display_name,role) VALUES (?,?,?,?,?)`);
  for (const u of seedUsers) ins.run(u.id, u.username, bcrypt.hashSync(u.password, 10), u.displayName, u.role);
  console.log('✅ 默认用户已创建');
}

// ─── Express ───
const app = express();
app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, '..', 'app', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
// 提供上传文件访问 /uploads/*
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── Auth Middleware ───
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'token无效' }); }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

// ─── Helper: parse JSON field ───
function j(v) { try { return JSON.parse(v); } catch { return v; } }

// ============================================================
// AUTH ROUTES
// ============================================================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.json({ success: false, error: '用户名或密码错误' });
  }
  const user = {
    id: row.id, username: row.username, displayName: row.display_name, role: row.role,
    avatar: row.avatar || '', enrolledCourses: j(row.enrolled_courses), completedLessons: j(row.completed_lessons),
    studyHours: row.study_hours, streak: row.streak,
  };
  const token = jwt.sign({ id: row.id, username: row.username, role: row.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, user, token });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password || !displayName) return res.json({ success: false, error: '请填写所有字段' });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.json({ success: false, error: '用户名已存在' });
  }
  const id = 'u' + Date.now();
  db.prepare(`INSERT INTO users (id,username,password_hash,display_name,role) VALUES (?,?,?,?,?)`)
    .run(id, username, bcrypt.hashSync(password, 10), displayName, 'user');
  const user = { id, username, displayName, role: 'user', avatar: '', enrolledCourses: [], completedLessons: [], studyHours: 0, streak: 0 };
  const token = jwt.sign({ id, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, user, token });
});

app.get('/api/auth/me', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: '用户不存在' });
  res.json({ user: {
    id: row.id, username: row.username, displayName: row.display_name, role: row.role,
    avatar: row.avatar || '', enrolledCourses: j(row.enrolled_courses), completedLessons: j(row.completed_lessons),
    studyHours: row.study_hours, streak: row.streak,
  }});
});

app.put('/api/auth/profile', auth, (req, res) => {
  const { displayName, avatar, enrolledCourses, completedLessons, studyHours, streak } = req.body;
  const sets = [], vals = [];
  if (displayName !== undefined) { sets.push('display_name = ?'); vals.push(displayName); }
  if (avatar !== undefined) { sets.push('avatar = ?'); vals.push(avatar); }
  if (enrolledCourses !== undefined) { sets.push('enrolled_courses = ?'); vals.push(JSON.stringify(enrolledCourses)); }
  if (completedLessons !== undefined) { sets.push('completed_lessons = ?'); vals.push(JSON.stringify(completedLessons)); }
  if (studyHours !== undefined) { sets.push('study_hours = ?'); vals.push(studyHours); }
  if (streak !== undefined) { sets.push('streak = ?'); vals.push(streak); }
  if (sets.length) {
    vals.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, user: {
    id: row.id, username: row.username, displayName: row.display_name, role: row.role,
    avatar: row.avatar || '', enrolledCourses: j(row.enrolled_courses), completedLessons: j(row.completed_lessons),
    studyHours: row.study_hours, streak: row.streak,
  }});
});

// ============================================================
// RESOURCES ROUTES
// ============================================================

// GET /api/resources
app.get('/api/resources', (req, res) => {
  const rows = db.prepare('SELECT * FROM resources ORDER BY upload_date DESC').all();
  res.json({ resources: rows.map(r => ({ ...r, tags: j(r.tags) })) });
});

// POST /api/resources
app.post('/api/resources', auth, (req, res) => {
  const resource = req.body;
  if (!resource.id || !resource.title) return res.status(400).json({ error: '缺少必要字段' });
  const exists = db.prepare('SELECT id FROM resources WHERE id = ?').get(resource.id);
  if (exists) {
    db.prepare(`UPDATE resources SET title=?,description=?,type=?,category=?,subject=?,grade=?,file_size=?,upload_date=?,uploader=?,uploader_id=?,tags=?,preview_url=?,download_count=? WHERE id=?`)
      .run(resource.title, resource.description, resource.type, resource.category, resource.subject, resource.grade, resource.fileSize, resource.uploadDate, resource.uploader, resource.uploaderId, JSON.stringify(resource.tags), resource.previewUrl, resource.downloadCount, resource.id);
  } else {
    db.prepare(`INSERT INTO resources (id,title,description,type,category,subject,grade,file_size,download_count,upload_date,uploader,uploader_id,tags,preview_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(resource.id, resource.title, resource.description, resource.type, resource.category, resource.subject, resource.grade, resource.fileSize, resource.downloadCount || 0, resource.uploadDate, resource.uploader, resource.uploaderId, JSON.stringify(resource.tags), resource.previewUrl);
  }
  res.json({ success: true });
});

// DELETE /api/resources/:id
app.delete('/api/resources/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/resources/:id/download
app.post('/api/resources/:id/download', auth, (req, res) => {
  db.prepare('UPDATE resources SET download_count = download_count + 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// COURSES ROUTES
// ============================================================

// GET /api/courses
app.get('/api/courses', (req, res) => {
  const rows = db.prepare('SELECT * FROM courses ORDER BY created_at DESC').all();
  res.json({ courses: rows.map(r => ({ ...r, chapters: j(r.chapters) })) });
});

// POST /api/courses
app.post('/api/courses', auth, adminOnly, (req, res) => {
  const course = req.body;
  if (!course.id || !course.title) return res.status(400).json({ error: '缺少必要字段' });
  const exists = db.prepare('SELECT id FROM courses WHERE id = ?').get(course.id);
  if (exists) {
    db.prepare(`UPDATE courses SET title=?,description=?,teacher=?,cover_image=?,category=?,grade=?,price=?,original_price=?,enrolled_count=?,rating=?,total_hours=?,level=?,start_date=?,is_enrolled=?,chapters=? WHERE id=?`)
      .run(course.title, course.description, course.teacher, course.coverImage, course.category, course.grade, course.price, course.originalPrice, course.enrolledCount, course.rating, course.totalHours, course.level, course.startDate, course.isEnrolled ? 1 : 0, JSON.stringify(course.chapters), course.id);
  } else {
    db.prepare(`INSERT INTO courses (id,title,description,teacher,cover_image,category,grade,price,original_price,enrolled_count,rating,total_hours,level,start_date,is_enrolled,chapters)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(course.id, course.title, course.description, course.teacher, course.coverImage, course.category, course.grade, course.price, course.originalPrice, course.enrolledCount, course.rating, course.totalHours, course.level, course.startDate, course.isEnrolled ? 1 : 0, JSON.stringify(course.chapters));
  }
  res.json({ success: true });
});

// DELETE /api/courses/:id
app.delete('/api/courses/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// ENROLLMENTS ROUTES
// ============================================================

// GET /api/enrollments/my
app.get('/api/enrollments/my', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM enrollments WHERE user_id = ?').all(req.user.id);
  res.json({ enrollments: rows.map(r => ({ ...r, completedLessons: j(r.completed_lessons) })) });
});

// POST /api/enrollments
app.post('/api/enrollments', auth, (req, res) => {
  const { courseId } = req.body;
  if (!courseId) return res.status(400).json({ error: '缺少courseId' });
  try {
    db.prepare(`INSERT INTO enrollments (id,user_id,course_id,completed_lessons,study_minutes) VALUES (?,?,?,?,?)`)
      .run('e' + Date.now(), req.user.id, courseId, '[]', 0);
  } catch (e) { /* already enrolled */ }
  // Increment enrolled_count
  db.prepare('UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = ?').run(courseId);
  res.json({ success: true });
});

// DELETE /api/enrollments/:courseId
app.delete('/api/enrollments/:courseId', auth, (req, res) => {
  db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(req.user.id, req.params.courseId);
  db.prepare('UPDATE courses SET enrolled_count = MAX(0, enrolled_count - 1) WHERE id = ?').run(req.params.courseId);
  res.json({ success: true });
});

// ============================================================
// LIVE STREAMS ROUTES
// ============================================================

// GET /api/live
app.get('/api/live', (req, res) => {
  const rows = db.prepare('SELECT * FROM live_streams ORDER BY created_at DESC').all();
  res.json({ streams: rows.map(r => ({ ...r, isReserved: !!r.is_reserved })) });
});

// POST /api/live
app.post('/api/live', auth, adminOnly, (req, res) => {
  const stream = req.body;
  if (!stream.id || !stream.title) return res.status(400).json({ error: '缺少必要字段' });
  const exists = db.prepare('SELECT id FROM live_streams WHERE id = ?').get(stream.id);
  if (exists) {
    db.prepare(`UPDATE live_streams SET title=?,description=?,teacher=?,cover_image=?,category=?,scheduled_at=?,duration=?,status=?,rtmp_url=?,hls_url=?,stream_key=?,viewer_count=?,is_reserved=?,recording_url=? WHERE id=?`)
      .run(stream.title, stream.description, stream.teacher, stream.coverImage, stream.category, stream.scheduledAt, stream.duration, stream.status, stream.rtmpUrl, stream.hlsUrl, stream.streamKey, stream.viewerCount, stream.isReserved ? 1 : 0, stream.recordingUrl, stream.id);
  } else {
    db.prepare(`INSERT INTO live_streams (id,title,description,teacher,cover_image,category,scheduled_at,duration,status,rtmp_url,hls_url,stream_key,viewer_count,is_reserved,recording_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(stream.id, stream.title, stream.description, stream.teacher, stream.coverImage, stream.category, stream.scheduledAt, stream.duration, stream.status, stream.rtmpUrl, stream.hlsUrl, stream.streamKey, stream.viewerCount, stream.isReserved ? 1 : 0, stream.recordingUrl);
  }
  res.json({ success: true });
});

// DELETE /api/live/:id
app.delete('/api/live/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM live_streams WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// ADMIN CLEANUP
// ============================================================

// DELETE /api/admin/cleanup — 清空所有非用户数据（数据库+上传文件）
app.delete('/api/admin/cleanup', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM resources').run();
  db.prepare('DELETE FROM courses').run();
  db.prepare('DELETE FROM live_streams').run();
  db.prepare('DELETE FROM enrollments').run();
  // 清空E盘上传文件
  try {
    [UPLOAD_LESSONS_DIR, UPLOAD_MATERIALS_DIR, UPLOAD_RESOURCES_DIR].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(f => {
          const fp = path.join(dir, f);
          try { fs.unlinkSync(fp); } catch {}
        });
      }
    });
  } catch (e) { console.error('清理上传文件失败', e); }
  res.json({ success: true, message: '所有课程、资料、直播、报名记录及上传文件已清空' });
});

// ============================================================
// FILE UPLOADS
// ============================================================

// POST /api/upload/lessons — 上传课时视频
app.post('/api/upload/lessons', auth, adminOnly, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '未选择文件' });
    res.json({ success: true, url: `/uploads/lessons/${req.file.filename}`, filename: req.file.filename, size: req.file.size });
  });
});

// POST /api/upload/materials — 上传课时资料
app.post('/api/upload/materials', auth, adminOnly, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '未选择文件' });
    res.json({ success: true, url: `/uploads/materials/${req.file.filename}`, filename: req.file.filename, size: req.file.size });
  });
});

// POST /api/upload/resources — 上传资料库文件
app.post('/api/upload/resources', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '未选择文件' });
    res.json({ success: true, url: `/uploads/resources/${req.file.filename}`, filename: req.file.filename, size: req.file.size });
  });
});

// DELETE /api/uploads — 删除上传文件
app.delete('/api/uploads', auth, adminOnly, (req, res) => {
  const { filepath } = req.body;
  if (!filepath) return res.status(400).json({ error: '缺少文件路径' });
  const absPath = path.join(UPLOAD_DIR, filepath.replace(/^\/uploads\//, ''));
  try {
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '删除失败' });
  }
});

// ─── SPA Fallback ───
if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Start ───
app.listen(PORT, () => {
  console.log(`🚀 后端已启动: http://localhost:${PORT}`);
});
