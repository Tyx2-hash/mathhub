import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  GraduationCap, Shield, User, Lock, LogIn, UserPlus, Eye, EyeOff, Sparkles, Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { loginFn, registerFn, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'user' | 'admin'>('user');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect
  if (user) {
    navigate(user.role === 'admin' ? '/admin' : '/');
    return null;
  }

  const handleLogin = async () => {
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setSubmitting(true);
    const result = await loginFn(username, password);
    setSubmitting(false);
    if (result.success) {
      navigate(tab === 'admin' ? '/admin' : '/');
    } else {
      setError(result.error || '登录失败');
    }
  };

  const handleRegister = async () => {
    setError('');
    setSuccess('');
    if (!username.trim() || !password.trim() || !displayName.trim()) {
      setError('请填写所有字段');
      return;
    }
    setSubmitting(true);
    const result = await registerFn(username, password, displayName);
    setSubmitting(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || '注册失败');
    }
  };

  const quickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">高中数学资料库</h1>
          <p className="text-gray-500 mt-1">登录以使用完整功能</p>
        </div>

        <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
          {/* User / Admin Tab */}
          <Tabs value={tab} onValueChange={v => { setTab(v as 'user' | 'admin'); setError(''); setSuccess(''); }}>
            <TabsList className="w-full rounded-none bg-gray-100 h-12 p-1 gap-1">
              <TabsTrigger value="user" className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm h-9 gap-2">
                <GraduationCap className="w-4 h-4" />用户登录
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm h-9 gap-2">
                <Shield className="w-4 h-4" />管理员登录
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <CardContent className="p-6">
            {/* Login / Register Toggle */}
            {tab === 'user' && (
              <div className="flex mb-5 bg-gray-100 rounded-xl p-1">
                <button
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'login' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                >
                  <LogIn className="w-4 h-4 inline mr-1" />登录
                </button>
                <button
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'register' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                >
                  <UserPlus className="w-4 h-4 inline mr-1" />注册
                </button>
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>
            )}
            {success && (
              <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3 mb-4">{success}</div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {mode === 'register' && tab === 'user' && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">显示名称</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="你的昵称" value={displayName} onChange={e => setDisplayName(e.target.value)}
                      className="pl-10 rounded-xl h-11" />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-gray-700">用户名</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder={tab === 'admin' ? '管理员账号' : '用户名'} value={username}
                    onChange={e => setUsername(e.target.value)} className="pl-10 rounded-xl h-11"
                    onKeyDown={e => { if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleRegister(); }} />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">密码</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input type={showPassword ? 'text' : 'password'} placeholder="请输入密码" value={password}
                    onChange={e => setPassword(e.target.value)} className="pl-10 pr-10 rounded-xl h-11"
                    onKeyDown={e => { if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleRegister(); }} />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button className="w-full rounded-xl h-11 text-base font-medium" onClick={mode === 'login' ? handleLogin : handleRegister}
                disabled={submitting}
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{mode === 'login' ? '登录中...' : '注册中...'}</>
                ) : mode === 'login' ? (
                  <><LogIn className="w-4 h-4 mr-2" />{tab === 'admin' ? '管理员登录' : '登录'}</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" />注册</>
                )}
              </Button>
            </div>

            {/* Quick Login Hints */}
            {mode === 'login' && (
              <div className="mt-5 pt-4 border-t">
                <p className="text-xs text-gray-400 mb-3">快速体验账号：</p>
                {tab === 'user' ? (
                  <div className="space-y-2">
                    <button className="w-full text-left bg-blue-50 hover:bg-blue-100 rounded-lg p-2.5 transition-colors flex items-center justify-between"
                      onClick={() => quickLogin('student', '123456')}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center"><GraduationCap className="w-3.5 h-3.5 text-white" /></div>
                        <div><div className="text-sm font-medium text-gray-800">张同学</div><div className="text-xs text-gray-400">student / 123456</div></div>
                      </div>
                      <Badge variant="outline" className="text-blue-600 text-[10px]">学生</Badge>
                    </button>
                    <button className="w-full text-left bg-green-50 hover:bg-green-100 rounded-lg p-2.5 transition-colors flex items-center justify-between"
                      onClick={() => quickLogin('teacher', '123456')}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center"><User className="w-3.5 h-3.5 text-white" /></div>
                        <div><div className="text-sm font-medium text-gray-800">李老师</div><div className="text-xs text-gray-400">teacher / 123456</div></div>
                      </div>
                      <Badge variant="outline" className="text-green-600 text-[10px]">教师</Badge>
                    </button>
                  </div>
                ) : (
                  <button className="w-full text-left bg-purple-50 hover:bg-purple-100 rounded-lg p-2.5 transition-colors flex items-center justify-between"
                    onClick={() => quickLogin('admin', 'admin123')}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-white" /></div>
                      <div><div className="text-sm font-medium text-gray-800">系统管理员</div><div className="text-xs text-gray-400">admin / admin123</div></div>
                    </div>
                    <Badge variant="outline" className="text-purple-600 text-[10px]">管理员</Badge>
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
