# Contributing

## 30 秒上手

```bash
git clone <repo-url>
cd ai-image-studio
npm install
npm run dev
```

如果当前分支还没有 `dev` 脚本，用 `npm start` 启动本地服务。第一次开发前先读 `README.md`，确认目录结构、环境变量、Canvas v2 状态和 smoke 测试说明。

## 分支与提交规范

- 默认协作分支是 `main`，可按任务直接推进；推送前先执行 `git pull --rebase origin main`。
- 提交信息使用前缀：`feat:`、`fix:`、`refactor:`、`docs:`、`test:`、`chore:`。
- 涉及 Trellis 任务时，在提交标题或正文带上 `AIS-RLS-XXX`，例如 `docs: update contributor guide (AIS-RLS-131)`。
- 每个提交只覆盖一个清晰主题；文档、测试和运行时代码尽量分开提交，便于审计和回滚。

## 验证命令

提交前至少运行与改动范围匹配的命令：

```bash
npm run check
npm run frontend:build
npm run smoke:public -- http://localhost:3000
npm run smoke:auth-admin
npm run smoke:data
npm run smoke:gallery-images
npm run smoke:mobile-layout
npm run smoke:canvas-v2:static
npm run smoke:canvas-v2:entry
npm run smoke:visual-regression
npm run test --prefix packages/agent-core
npm run test --prefix packages/canvas-core
```

- 后端、路由、数据访问或公共入口改动：优先跑 `npm run check`、`npm run smoke:public` 和对应路由 smoke。
- 前端样式或交互改动：补跑 `npm run frontend:build`、`npm run smoke:mobile-layout`、`npm run smoke:visual-regression`。
- Canvas v2 改动：补跑 `npm run canvas:v2:check`、`npm run canvas:v2:build` 和 Canvas smoke。
- `packages/*-core` 改动：进入对应包或用 `--prefix` 跑 `npm run test`，必要时同时跑包内 `npm run check`。

## 隐私边界

- 禁止提交真实服务器 IP、服务器主机名、账号、密钥、会话信息、数据库连接串或后台入口凭据。
- `docs/private/*` 只用于本地私有记录，内容永不外传，也不摘录到公开文档。
- `.env`、本地数据库、上传文件、生成图片、部署归档和运行日志只保存在本地或服务器运行环境，不进入 Git。
- 公开文档只写用户可感知变化、验证结论和可复现命令；部署机器、内部路径、密钥轮换和账号信息写入私有记录。
- 提交前用搜索确认没有泄露真实凭据、IPv4 地址、私有主机名或本机绝对路径。
