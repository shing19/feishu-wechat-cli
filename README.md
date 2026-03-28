# feishu-wechat-cli

把飞书文档一键发布到微信公众号草稿箱的 CLI。

支持：
- 从飞书 `wiki/docx` 抓取 Markdown
- 自动下载飞书正文图片并上传到微信素材库
- 发布到微信公众号草稿箱
- 可选自动生成封面图

## 安装

### 1. 安装项目依赖

```bash
pnpm install
pnpm build
```

### 2. 安装飞书官方 CLI（必需）

本项目依赖飞书官方开源工具 **`larksuite/cli`** 来抓取文档和下载图片。

仓库：<https://github.com/larksuite/cli>

安装方式示例：

```bash
npm install -g @larksuiteoapi/cli
lark-cli --help
```

如果 `lark-cli --help` 能正常输出，说明依赖已安装完成。

## 环境变量

复制一份本地配置：

```bash
cp .env.example .env
```

最少需要配置：

```env
WECHAT_APP_ID=your_wechat_appid
WECHAT_APP_SECRET=your_wechat_appsecret
```

如果你要用自动封面：

```env
IMAGE_API_KEY=...
IMAGE_BASE_URL=...
```

## 用法

### 1. 从飞书直接发布

```bash
feishu-wechat publish \
  --feishu "https://my.feishu.cn/wiki/xxxxxxxx" \
  --article-author "Your Name"
```

### 2. 从飞书直接发布，并自动生成封面

```bash
feishu-wechat publish \
  --feishu "https://my.feishu.cn/wiki/xxxxxxxx" \
  --auto-cover
```

### 3. 发布本地 Markdown

```bash
feishu-wechat publish -f ./article.md
```

## 开源配置设计

本项目只读取当前目录下的 `.env`。

微信配置只保留一套命名：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`

飞书抓取与图片下载默认内建使用 `lark-cli`，不做额外 provider 配置。
封面生成也内建在本仓库 `scripts/generate-cover.py` 中，只通过环境变量提供模型访问配置：

- `IMAGE_API_KEY`
- `IMAGE_BASE_URL`

## 验证

### 本地测试

```bash
pnpm test
```

### 真实端到端测试

```bash
feishu-wechat publish --feishu "https://my.feishu.cn/wiki/xxxxxxxx"
```

验收方式：
- 去微信公众号后台草稿箱确认草稿已生成
- 检查标题是否正确
- 检查正文图片是否完整
- 如果启用 `--auto-cover`，检查封面是否生成并上传成功

## 注意事项

- `.env` 已被 git ignore，不会进公开仓库
- `.env.example` 可以安全提交
- 当前自动封面依赖外部生图服务，可能遇到 429；建议后续补重试和降级策略
