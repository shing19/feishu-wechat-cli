# @shing19/feishu-wechat-cli

把飞书文档一键发布到微信公众号草稿箱的 CLI。

安装：

```bash
npm install -g @shing19/feishu-wechat-cli
```

支持：
- 从飞书 `wiki/docx` 抓取 Markdown
- 自动下载飞书正文图片并上传到微信素材库
- 发布到微信公众号草稿箱
- 可选自动生成封面图

## 快速开始

安装完成后，直接执行：

```bash
feishu-wechat publish \
  --feishu "https://my.feishu.cn/wiki/xxxxxxxx"
```

如果你要连封面一起生成：

```bash
feishu-wechat publish \
  --feishu "https://my.feishu.cn/wiki/xxxxxxxx" \
  --auto-cover
```

## 安装与配置

### 1. 安装飞书官方 CLI

本项目依赖飞书官方开源工具 **`larksuite/cli`** 来抓取文档和下载图片。

仓库：<https://github.com/larksuite/cli>

安装：

```bash
npm install -g @larksuite/cli
```

### 2. 绑定飞书配置

飞书 CLI 安装完成后，必须先执行：

```bash
lark-cli config init --new
```

完成飞书账号或应用配置绑定。

如果这一步没做，后面的飞书文档抓取和图片下载都无法工作。

### 3. 安装本工具

```bash
npm install -g @shing19/feishu-wechat-cli
```

安装后确认：

```bash
feishu-wechat --help
```

### 4. 配置环境变量

在你的工作目录里新建 `.env`：

```bash
cat > .env <<'EOF'
WECHAT_APP_ID=你的公众号AppID
WECHAT_APP_SECRET=你的公众号AppSecret
IMAGE_API_KEY=你的图片模型Key
IMAGE_BASE_URL=你的图片模型BaseURL
EOF
```

如果你这次先只测正文发布，不测自动封面，也可以只写：

```bash
cat > .env <<'EOF'
WECHAT_APP_ID=你的公众号AppID
WECHAT_APP_SECRET=你的公众号AppSecret
EOF
```

## 使用

### 从飞书直接发布

```bash
feishu-wechat publish \
  --feishu "https://my.feishu.cn/wiki/xxxxxxxx" \
  --article-author "Your Name"
```

### 从飞书直接发布，并自动生成封面

```bash
feishu-wechat publish \
  --feishu "https://my.feishu.cn/wiki/xxxxxxxx" \
  --auto-cover
```

### 发布本地 Markdown

```bash
feishu-wechat publish -f ./article.md
```

## 说明

- 本项目只读取当前目录下的 `.env`
- 微信配置使用：`WECHAT_APP_ID`、`WECHAT_APP_SECRET`
- 自动封面使用：`IMAGE_API_KEY`、`IMAGE_BASE_URL`
- 飞书文档抓取与图片下载依赖 `lark-cli`
- 当前自动封面依赖外部生图服务，可能遇到 429 限流
- 要让公众号自动发布成功，你需要把**当前机器的出口 IP**加入微信公众号后台的 IP 白名单，否则微信接口会拒绝请求
