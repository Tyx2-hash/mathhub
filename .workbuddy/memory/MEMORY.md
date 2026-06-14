# 高中数学资料库 - 项目记忆

## 技术栈
- React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- IndexedDB (idb库) 用于持久化二进制文件和多表数据
- localStorage 用于元数据和删除ID追踪
- Recharts 用于管理端统计图表
- React Router DOM v7

## 核心架构
- `src/types/index.ts` - 所有类型定义（Resource, Course, LiveStream, ChatMessage, ToolCall, Announcement, Favorite, Comment, StudyProgress, Tag, DownloadRecord）
- `src/lib/fileStorage.ts` - IndexedDB统一持久层，11张表：files, announcements, favorites, comments, studyProgress, tags, downloadRecords, courses, liveStreams, chatHistory, userSettings
- `src/hooks/useResourceStore.ts` - 资源状态管理（deleted IDs模式防止mock数据回弹）
- `src/hooks/useAuth.tsx` - 认证上下文（预设student/123456, teacher/123456, admin/admin123）
- `src/data/mock.ts` - 所有mock数据，Resource增加grade字段，LiveStream增加streamKey字段

## 已完成功能
1. 首页：知识点快速导航、公告栏（IndexedDB）、学习进度环形图
2. 资料库：年级筛选、500MB上传限制、音频类型支持、收藏（IndexedDB favorites表）、评论（IndexedDB comments表）
3. 管理端：课程创建/编辑（含章节课时管理+视频上传入口）、直播创建/编辑/回放管理
4. AI助手：工具调用可视化（ToolCall类型，search_knowledge_base/find_similar_problems/generate_practice工具模拟）
5. 数据持久化：11张IndexedDB表（files/announcements/favorites/comments/studyProgress/tags/downloadRecords/courses/liveStreams/chatHistory/userSettings）

## 重要修复历史
- 文件下载损坏：引入IndexedDB持久化文件二进制
- 删除不持久化：deleted IDs tracking模式
- Blob URL刷新失效：改用IndexedDB读取

## 部署
- CloudStudio: 通过 workbuddy_cloudstudio_deploy 工具部署 dist 目录
