import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, User, Sparkles, Loader2, Lightbulb, Calculator, BookOpen, Wrench, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ChatMessage, ToolCall } from '@/types';

const quickQuestions = [
  '如何求函数的定义域？',
  '三角函数诱导公式怎么记？',
  '数列求和有哪些方法？',
  '椭圆的离心率怎么求？',
  '条件概率和独立事件有什么区别？',
  '导数在求单调区间中的应用',
];

const mathResponses: Record<string, { content: string; tools?: ToolCall[] }> = {
  '定义域': {
    content: `## 函数定义域的求法 📐

函数定义域是自变量 $x$ 的取值范围，常见限制条件：

### 1. 分式函数
分母 ≠ 0

**例：** $f(x) = \\frac{1}{x-2}$，定义域：$x \\neq 2$

### 2. 根式函数
偶次根号下 ≥ 0

**例：** $f(x) = \\sqrt{x-1}$，定义域：$x \\geq 1$

### 3. 对数函数
真数 > 0

**例：** $f(x) = \\log_2(x+3)$，定义域：$x > -3$

### 4. 复合函数
取各部分交集

**例：** $f(x) = \\frac{\\sqrt{x+1}}{x-2}$
- $x+1 \\geq 0$ → $x \\geq -1$
- $x \\neq 2$
- 定义域：$[-1, 2) \\cup (2, +\\infty)$

> 💡 **技巧：** 求定义域时，先列出所有限制条件，再取交集。`,
    tools: [
      { id: 'tool_1', name: 'search_knowledge_base', args: '{"query": "函数定义域 求法", "subject": "函数"}', result: '找到 15 篇相关资料', status: 'completed' },
      { id: 'tool_2', name: 'find_similar_problems', args: '{"topic": "定义域", "difficulty": "高考"}', result: '找到 23 道相关练习题', status: 'completed' },
    ],
  },
  '三角函数': {
    content: `## 三角函数诱导公式记忆法 🎯

### 核心口诀
**"奇变偶不变，符号看象限"**

### 诱导公式表

| 角度 | sin | cos |
|------|-----|-----|
| -α | -sinα | cosα |
| π-α | sinα | -cosα |
| π+α | -sinα | -cosα |
| 2π-α | -sinα | cosα |
| π/2-α | cosα | sinα |
| π/2+α | cosα | -sinα |

### 记忆技巧
1. **奇偶判断**：看 $\\frac{kπ}{2}$ 中的 $k$
   - $k$ 为奇数：sin↔cos 互换
   - $k$ 为偶数：函数名不变
2. **符号判断**：把 $α$ 当成锐角，看原角所在象限原函数的符号

> 💡 **推荐：** 多做练习形成肌肉记忆，公式不需要死记硬背！`,
    tools: [
      { id: 'tool_1', name: 'search_knowledge_base', args: '{"query": "三角函数 诱导公式", "subject": "三角函数"}', result: '找到 12 篇相关资料', status: 'completed' },
    ],
  },
  '数列': {
    content: `## 数列求和七大方法 📊

### 1. 公式法
等差数列：$S_n = \\frac{n(a_1+a_n)}{2}$
等比数列：$S_n = \\frac{a_1(1-q^n)}{1-q}$

### 2. 倒序相加法
适用于"首末等距项之和相等"的数列

### 3. 错位相减法
适用于 $a_n = b_n \\cdot c_n$（一个等差×一个等比）

### 4. 裂项相消法
$\\frac{1}{n(n+1)} = \\frac{1}{n} - \\frac{1}{n+1}$

### 5. 分组求和法
将数列拆分为若干可求和的子列

### 6. 并项求和法
相邻项配对求和

### 7. 数学归纳法
先猜后证

> 💡 **高频考点：** 错位相减法和裂项相消法是高考必考方法！`,
    tools: [
      { id: 'tool_1', name: 'search_knowledge_base', args: '{"query": "数列求和 方法", "subject": "数列"}', result: '找到 18 篇相关资料', status: 'completed' },
      { id: 'tool_2', name: 'generate_practice', args: '{"topic": "数列求和", "method": "错位相减法", "count": 3}', result: '生成 3 道练习题', status: 'completed' },
    ],
  },
  '椭圆': {
    content: `## 椭圆离心率的求法 🔵

### 定义
$e = \\frac{c}{a}$，其中 $0 < e < 1$

### 常见求法

**1. 直接计算法**
已知 $a, c$ 直接代入 $e = c/a$

**2. 方程法**
已知椭圆方程 $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$
→ $c^2 = a^2 - b^2$ → $e = \\frac{\\sqrt{a^2-b^2}}{a}$

**3. 几何条件法**
利用焦点三角形、弦长等几何关系列方程

**4. 焦点弦法**
过焦点的弦 $|PF_1| + |PF_2| = 2a$

> 💡 **关键：** 离心率越接近0越圆，越接近1越扁`,
    tools: [
      { id: 'tool_1', name: 'search_knowledge_base', args: '{"query": "椭圆离心率", "subject": "几何"}', result: '找到 9 篇相关资料', status: 'completed' },
    ],
  },
  '概率': {
    content: `## 条件概率与独立事件 🎲

### 条件概率
$P(A|B) = \\frac{P(AB)}{P(B)}$

**含义：** 在B已发生的条件下A发生的概率

### 独立事件
若 $P(AB) = P(A) \\cdot P(B)$，则A、B独立

### 关键区别
- **条件概率**：已知一个事件发生，求另一个事件的概率
- **独立事件**：一个事件的发生不影响另一个事件的概率

### 易错点
1. 互斥 ≠ 独立（互斥事件一定不独立）
2. 独立判断要用定义验证 $P(AB) = P(A)P(B)$
3. 条件概率中 $P(A|B) \\neq P(B|A)$`,
    tools: [
      { id: 'tool_1', name: 'search_knowledge_base', args: '{"query": "条件概率 独立事件", "subject": "概率统计"}', result: '找到 11 篇相关资料', status: 'completed' },
    ],
  },
  '导数': {
    content: `## 导数与单调性 📈

### 判定方法
- $f'(x) > 0$ → $f(x)$ 单调递增
- $f'(x) < 0$ → $f(x)$ 单调递减

### 解题步骤
1. 求 $f'(x)$
2. 解不等式 $f'(x) > 0$ 和 $f'(x) < 0$
3. 写出单调区间

### 注意事项
- 端点处 $f'(x) = 0$ 不影响单调性
- 单调区间用逗号或"和"连接，不用"∪"
- 含参数时需分类讨论

### 高考常见题型
1. 已知单调性求参数范围
2. 讨论含参函数的单调性
3. 利用单调性证明不等式`,
    tools: [
      { id: 'tool_1', name: 'search_knowledge_base', args: '{"query": "导数 单调性", "subject": "函数"}', result: '找到 20 篇相关资料', status: 'completed' },
      { id: 'tool_2', name: 'find_similar_problems', args: '{"topic": "导数单调性", "difficulty": "高考"}', result: '找到 31 道相关练习题', status: 'completed' },
    ],
  },
};

function getAIResponse(question: string): { content: string; tools: ToolCall[] } {
  for (const [key, response] of Object.entries(mathResponses)) {
    if (question.includes(key)) {
      return { content: response.content, tools: response.tools || [] };
    }
  }
  if (question.includes('求') || question.includes('怎么') || question.includes('如何')) {
    return {
      content: `## 关于"${question}"的回答 🤔

这是一个很好的数学问题！让我从以下几个方面来分析：

### 基本概念
该问题的关键在于理解核心数学概念，建立正确的数学模型。

### 解题思路
1. **审题**：明确已知条件和求解目标
2. **建模**：将问题转化为数学表达式
3. **求解**：选择合适的方法进行计算
4. **验证**：检查结果是否合理

### 常见误区
- 忽略隐含条件（如定义域限制）
- 计算过程中的符号错误
- 混淆相近概念

> 💡 建议结合课本例题和练习题进行巩固，如有疑问可以继续提问！`,
      tools: [
        { id: 'tool_general', name: 'search_knowledge_base', args: `{"query": "${question}"}`, result: '搜索完成，找到相关资料', status: 'completed' },
      ],
    };
  }
  return {
    content: `你好！我是数学AI助手，可以帮你解答高中数学的各类问题 🎓

你可以问我关于：
- **函数与导数**：定义域、值域、单调性、极值
- **三角函数**：公式、图像、变换
- **数列**：等差等比、求和方法
- **解析几何**：直线、圆、圆锥曲线
- **概率统计**：排列组合、概率计算
- **立体几何**：证明、计算

请输入具体的数学问题，我会为你详细解答！`,
    tools: [],
  };
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-1.5 rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden">
      <button className="w-full px-3 py-2 flex items-center gap-2 text-xs text-blue-700 hover:bg-blue-100/50 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        {toolCall.status === 'running' ? (
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
        ) : toolCall.status === 'completed' ? (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        ) : (
          <AlertCircle className="w-3 h-3 text-red-500" />
        )}
        <Wrench className="w-3 h-3" />
        <span className="font-mono font-medium">{toolCall.name}</span>
        {expanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 text-xs">
          <div>
            <span className="text-gray-500 font-medium">参数：</span>
            <code className="bg-white/80 px-1.5 py-0.5 rounded text-gray-700 break-all">{toolCall.args}</code>
          </div>
          {toolCall.result && (
            <div>
              <span className="text-gray-500 font-medium">结果：</span>
              <span className="text-green-700">{toolCall.result}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: '你好！我是你的数学AI助手 🤖🎓\n\n我可以帮你解答高中数学的各类问题，包括函数、导数、三角函数、数列、几何、概率统计等。\n\n你可以直接输入问题，或者点击下方的快捷问题开始！',
      timestamp: new Date().toISOString(),
      toolCalls: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingTools, setStreamingTools] = useState<ToolCall[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingTools]);

  const sendMessage = (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const { content, tools } = getAIResponse(text);
    const assistantId = (Date.now() + 1).toString();

    // Phase 1: Show tool calls with running status
    setStreamingTools(tools.map(t => ({ ...t, status: 'running' as const })));

    // Phase 2: Complete tool calls one by one
    tools.forEach((tool, i) => {
      setTimeout(() => {
        setStreamingTools(prev => prev.map((t, j) => j <= i ? { ...t, status: 'completed' as const } : t));
      }, 500 * (i + 1));
    });

    // Phase 3: Start streaming text after tools complete
    setTimeout(() => {
      setStreamingTools([]);
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        toolCalls: tools,
      }]);

      let i = 0;
      const streamInterval = setInterval(() => {
        if (i >= content.length) {
          clearInterval(streamInterval);
          setIsStreaming(false);
          return;
        }
        const chunkSize = Math.min(3, content.length - i);
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + content.slice(i, i + chunkSize) } : m
        ));
        i += chunkSize;
      }, 20);
    }, 500 * tools.length + 800);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          AI 数学助手
        </h1>
        <p className="text-gray-500 mt-1">流式回答 · 工具调用可视化 · 数学公式 · 智能解题</p>
      </div>

      <Card className="border-0 shadow-lg rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
        <div className="flex flex-col h-full">
          {/* Messages */}
          <ScrollArea className="flex-1 p-6" ref={scrollRef}>
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-blue-500' : 'bg-purple-100'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-purple-600" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mb-2">
                        {msg.toolCalls.map(tc => (
                          <ToolCallCard key={tc.id} toolCall={tc} />
                        ))}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content || (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Loader2 className="w-3 h-3 animate-spin" />思考中...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Streaming tool calls */}
              {isStreaming && streamingTools.length > 0 && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="max-w-[80%] bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                      <Loader2 className="w-3 h-3 animate-spin" />正在调用工具...
                    </div>
                    {streamingTools.map(tc => (
                      <ToolCallCard key={tc.id} toolCall={tc} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div className="px-6 pb-3">
              <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto">
                {quickQuestions.map(q => (
                  <Button key={q} variant="outline" size="sm" className="rounded-full text-xs"
                    onClick={() => sendMessage(q)}>
                    <Sparkles className="w-3 h-3 mr-1 text-purple-500" />{q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-4 bg-gray-50/50">
            <div className="flex gap-3 max-w-3xl mx-auto">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage(input); }}
                placeholder="输入数学问题，如：如何求函数的定义域？"
                className="flex-1 rounded-xl h-11"
                disabled={isStreaming}
              />
              <Button className="bg-purple-600 hover:bg-purple-700 rounded-xl h-11 px-6"
                onClick={() => sendMessage(input)} disabled={isStreaming || !input.trim()}>
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
