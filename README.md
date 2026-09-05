# Observer

私人 Daily Brief 服务端。当前完成 V1-01 的固定数据闭环：一条有来源故事、六栏总览、五个 Coverage Gap、不可变归档和鉴权读取。固定数据和替身只用于自动化测试；当前生产启动入口禁用发布，也不提供测试归档内容。

## 本地检查

需要 Node **24.18.0 或较新的 24.x**、npm。完整检查还需要本机 Linux/amd64 Docker Engine、curl、tar、GPG，以及一次显式准备 Codex/Claude 测试运行时；准备脚本不会启动 Docker 或调用模型。锁定依赖已写入 `package-lock.json`。GPG 不在 PATH 时可用 `OBSERVER_GPG_PATH` 指向本机已有程序，详见 [V1-05 实现说明](docs/implementation/v1-05.md)。

```sh
npm ci
npm run prepare:codex
npm run prepare:claude
npm run check
npm run smoke
```

`check` 独立执行 `tsc --noEmit`，构建 `dist/`，再运行全部业务测试（包括真实隔离容器和 Codex/Claude CLI，但模型 API 是无凭证协议替身）。`smoke` 是其中 3 个进程／HTTP 测试的子集，不额外增加覆盖数，也不需要 Docker。准备后检查不需要外网或模型凭证；`npm ci` 和首次准备 CLI 依赖需要网络。Codex 包校验 SHA-512；Claude 校验官方 manifest 签名、固定签名指纹及二进制 SHA-256；两者使用固定 Python 基础镜像。Codex 压缩包约 129 MB、镜像约 459 MB；Claude 二进制约 214 MB、镜像约 339 MB。测试用的 `example.org` 来源只作为不可联网的固定出处。

```sh
npm run typecheck
node --test tests/brief.test.ts
npm run build
```

测试与源码都使用显式 `.ts` 导入，构建重写为 `.js`；生产包 `dist/` 不包含 `tests/`。

## 私有读取启动

先运行 `npm run build`，再通过环境设置 `OBSERVER_OWNER_TOKEN`（至少 32 字节的 Owner 随机密钥）。可选 `OBSERVER_DATABASE_PATH` 默认 `data/observer.sqlite`，`OBSERVER_PORT` 默认 `3000`；然后 `npm start`。不要把密钥提交到 Git、放在 URL 或写进报告。

监听地址固定为 `127.0.0.1`。远程 TLS 接入、短期签名链接、完整配对和撤销将在后续票实现；本票没有公网部署。

当前只提供两个 GET 路由，均要求 `Authorization: Bearer <Owner 密钥>` 并返回 `Cache-Control: no-store`：

| 路由 | 返回 |
|---|---|
| `/v1/reports/YYYY-MM-DD-v1` | 同一版本的 `version`、`record`、`canonicalMarkdown` JSON |
| `/v1/reports/YYYY-MM-DD-v1/markdown` | 已保存的 Canonical Markdown，UTF-8 |

无有效凭证为 401；未知版本为 404；其他方法为 405。生产入口不会采集、调用 Agent、创建报告或返回 fixture 报告，所以本票生产入口合法读取已知 fixture 也为 404。成功读取的本地能力由测试专用装配验证。

技术选择见 [ADR-0004](docs/adr/0004-start-with-typescript-and-atomic-sqlite-report-archive.md)，公共契约及证据见 [V1-01 实现说明](docs/implementation/v1-01.md)。

## 受来源政策约束的采集

V1-02 增加独立的持续 RSS/Atom 采集进程：`npm run build` 后，设置 `OBSERVER_SOURCE_CONFIG` 指向 Owner 审阅的 JSON 配置，再运行 `npm run collect`；`-- --once` 只执行一轮。缓存路径由 `OBSERVER_COLLECTION_DATABASE_PATH` 配置，默认 `data/collection.sqlite`，必须与不可变报告数据库分开。

[示例配置](config/sources.example.v1.json) 默认待审、禁用，只有许可明确的自有测试数据；没有启用真实出版者、FRED、行情或社交源。来源政策分别限制采集、保存、模型输入和分发，过期原文不会复制进永久报告。运行方式、Bundle v2 兼容语义、实际验证范围和来源启用记录见 [V1-02 实现说明](docs/implementation/v1-02.md)。真实研究与生产发布仍未启用。

## 隔离 Codex 候选研究

V1-04 的 `createCodexRunner` 实现共有 `AgentRunner`：单栏 Bundle 经固定 Codex CLI 0.153.4 的完整终态输出进入现有 Gate 和私有归档。容器禁止外部网络、宿主凭证和执行工具；模型请求只通过宿主固定 Responses 通道。测试替身有显式 provenance，生产入口仍拒绝发布和读取测试归档。真实模型认证、地域资格、事实质量和费用均未实测。

运行参数、安全层、事件样本许可、已实现的授权接入代码与尚未验证的部署资格见 [V1-04 实现说明](docs/implementation/v1-04.md)。

## 隔离 Claude 候选研究

V1-05 的 `createClaudeRunner` 使用同一 `AgentRunner` 和 Gate：固定 Claude Code 2.1.252、模型标识 `claude-sonnet-4-6`，通过非交互 CLI 的 `StructuredOutput` 数据工具返回单栏候选。独立校验进程退出、最终结构与终态；复用整容器回收，并在宿主模型边界拒绝执行工具、远程 MCP 和过期 Evidence。真实 CLI 与无凭证 Messages 替身已可贯通 SQLite 报告；实际账户、地域、付费模型、质量和生产发布仍未验证或启用。详见 [实现及复跑说明](docs/implementation/v1-05.md)。
