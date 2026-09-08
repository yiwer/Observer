# Observer

私人 Daily Brief 服务端。已接通六栏研究路由、持久日调度、恢复补齐、私有归档/设备同步、中文 PDF、同版本邮件、更正/撤稿、七日来源巡检及到期/来源权利清理。研究调度、邮件、更正与巡检默认关闭；整期无可信内容时不发空刊。生产入口不提供测试归档内容，真实上线与外部质量验收尚未完成；当前实施票见[执行记录](docs/planning/v1/EXECUTION.md)。

## 快速开始与检查策略

需要 Node **24.18.0 或较新的 24.x**、npm，依赖版本见 `package-lock.json`。安装和构建服务：

```sh
npm ci
npm run build
```

按 [Owner 最新策略](docs/planning/v1/OWNER-INPUTS.md#v1-快速交付策略覆盖旧测试流程)，V1 按完整功能块实现和简短 review，不做开发验收 hash 校验、不逐小步回归，不默认扩充夹具或运行全量测试。需要时只在块末进行类型检查或一条核心路径验证；未测范围如实记录。类型检查命令为：

```sh
npm run typecheck
```

测试与源码都使用显式 `.ts` 导入，构建重写为 `.js`；生产包 `dist/` 不包含 `tests/`。

<details>
<summary>保留的历史扩展检查（不是当前 V1 交付门槛）</summary>

显式选择扩展检查时，仍需按相应票的旧说明准备本机 Linux/amd64 Docker Engine、curl、tar、GPG 和 Codex/Claude 测试运行时。准备脚本不会启动 Docker 或调用模型；没有运行它们的默认要求。GPG 不在 PATH 时可用 `OBSERVER_GPG_PATH`，详见 [V1-05](docs/implementation/v1-05.md)。

```sh
npm run prepare:codex
npm run prepare:claude
npm run check
npm run smoke
```

`check` 执行类型检查、构建和全部业务测试，包括隔离容器/CLI 与无凭证模型替身；`smoke` 是其中的进程/HTTP子集，不等于真实上线验收。现有准备脚本的包签名及完整性功能保留，不作为新的开发取证任务。`npm ci` 和首次准备 CLI 依赖需要网络；测试用 `example.org` 是固定出处，不代表真实新闻来源。

</details>

## 私有读取启动

先运行 `npm run build`，再通过环境设置 `OBSERVER_OWNER_TOKEN`（至少 32 字节的 Owner 随机密钥）。可选 `OBSERVER_DATABASE_PATH` 默认 `data/observer.sqlite`，`OBSERVER_PORT` 默认 `3000`；然后 `npm start`。不要把密钥提交到 Git、放在 URL 或写进报告。

原生监听默认 `127.0.0.1`；容器部署可显式设置 `OBSERVER_BIND_HOST=0.0.0.0`，不要直接向公网发布应用端口。可用 `OBSERVER_OWNER_TOKEN_FILE` 指向受控秘密文件，配置后读取失败不回退旧环境值。V1-17 已提供设备配对/撤销、持久增量同步、完整历史与短期签名下载；本地管理命令和稳定 API 见 [V1-17](docs/implementation/v1-17.md)，无 GMS 客户端可参考 [HTTP 样例](examples/device-sync.mjs)。[单节点 Linux 部署与 HTTPS 入口](docs/implementation/v1-23.md)已交付，实际容器启动、远程 TLS 和公网部署仍未执行。

原精确报告 GET 路由继续保留，要求 `Authorization: Bearer <Owner 或设备凭证>` 并返回 `Cache-Control: no-store`；支持 vN，新增归档/同步路由见 V1-17：

| 路由 | 返回 |
|---|---|
| `/v1/reports/YYYY-MM-DD-v1` | 同一版本的 `version`、`record`、`canonicalMarkdown` JSON |
| `/v1/reports/YYYY-MM-DD-v1/markdown` | 已保存的 Canonical Markdown，UTF-8 |

无有效凭证为 401；未知版本为 404；生产读取已知 fixture 仍为 404。已撤销的旧正文及其签名下载返回 410，新的安全撤稿说明版本仍可读。未启用研究调度时不会生成普通新刊，但默认 PDF 后台仍会为已有报告转换；单独启用的更正/巡检也有独立处理入口，因此这不是纯只读进程。

维护会按权威来源配置执行 TTL 与撤销清理；明确移除来源可能永久清除受影响正文/产物。未提供来源配置不等同于明确空配置，不据此删除历史内容，但需要策略的读取会拒绝。已发送邮件无法从收件箱撤回；旧备份恢复前必须先应用最新删除契约和来源策略，不能用配置回退解除封禁。

设置 `OBSERVER_RUNTIME_CONFIG` 指向 [运行配置](config/runtime.example.v1.json)，将其中 `schedule.enabled` 显式设为 `true`，即可在北京时间每天 07:30 冻结并运行。配置中的路径相对于该文件。`collect: false` 只消费已有采集缓存；`collect: true` 启用经 Source Policy 授权的 RSS/Atom、可选 GitHub 与 Mastodon 采集。Provider 需要单独的启用、资格及凭据配置；有可信材料时可发布缺栏/合规链接降级版，整期为空则有界恢复，不发空刊。调度用法见 [V1-15](docs/implementation/v1-15.md)，午前恢复和 Completion 见 [V1-16](docs/implementation/v1-16.md)。

已交付能力的入口：

- [私有归档、设备配对/撤销和同步](docs/implementation/v1-17.md)：V1 是服务端契约，无 Android UI 或推送。
- [中文 PDF](docs/implementation/v1-18.md)：只转换同版本已有 Markdown，后台默认开启，失败不影响 MD；部署需保留 `assets/fonts/`。
- [QQ SMTP 邮件](docs/implementation/v1-19.md)：安全 HTML 总览、有限 PDF 附件、24小时对象下载链接和持久交付状态。默认禁用；实际地址放受控运行配置，授权码仅通过 `QQ_SMTP_KEY` 注入。SMTP受理不等于实际收件，未知结果不自动重发。
- [更正与可读撤稿版本](docs/implementation/v1-20.md)：给定信号经过独立证据门后生成新版本，撤销失效旧正文访问，复用 PDF 和重大更正通知；不提供人工编辑界面。
- [最近七日来源巡检](docs/implementation/v1-21.md)：复查已报道的获准精确 URL，持久记录任务、缺口与候选信号；正常页面变化或 404 不自动判作事实错误。默认06:00–07:15巡查，保护07:30冻结及08:30可读时段；排队不代表已完成纠错。
- [到期清理与来源撤销](docs/implementation/v1-22.md)：清理关联正文、PDF、缓存与任务，保留允许的墓碑和邮件去重身份；GitHub 历史压缩保留发布依赖。提供受控维护与删除契约导出/应用命令，实际 Owner 数据尚未运行清理。
- [单节点 Linux 运行与运维](docs/implementation/v1-23.md)：应用/HTTPS 部署配置、秘密文件、受控状态命令、有界 Agent 与看门狗、升级回滚。app 的 Docker socket 是高权限管理面，不交给 Agent；资源预算尚未实测。
- [节点外备份与受控恢复](docs/implementation/v1-24.md)：私有对象存储上的单代完整加密快照、秘密独立恢复、最新删除契约优先及历史邮件围栏。提供演练计时入口，尚未实测存储私有性和 RPO/RTO。

技术选择见 [ADR-0004](docs/adr/0004-start-with-typescript-and-atomic-sqlite-report-archive.md)，公共契约及证据见 [V1-01 实现说明](docs/implementation/v1-01.md)。

## 受来源政策约束的采集

V1-02 增加独立的持续 RSS/Atom 采集进程：`npm run build` 后，设置 `OBSERVER_SOURCE_CONFIG` 指向 Owner 审阅的 JSON 配置，再运行 `npm run collect`；`-- --once` 只执行一轮。缓存路径由 `OBSERVER_COLLECTION_DATABASE_PATH` 配置，默认 `data/collection.sqlite`，必须与不可变报告数据库分开。

[示例配置](config/sources.example.v1.json) 默认待审、禁用，只有许可明确的自有测试数据；没有启用真实出版者、FRED、行情或社交源。来源政策分别限制采集、保存、模型输入和分发，过期原文不会复制进永久报告。运行方式、Bundle v2 兼容语义、实际验证范围和来源启用记录见 [V1-02 实现说明](docs/implementation/v1-02.md)。真实研究与生产发布仍未启用。

## 隔离 Codex 候选研究

V1-04 的 `createCodexRunner` 实现共有 `AgentRunner`：单栏 Bundle 经固定 Codex CLI 0.153.4 的完整终态输出进入现有 Gate 和私有归档。容器禁止外部网络、宿主凭证和执行工具；模型请求只通过宿主固定 Responses 通道。测试替身有显式 provenance，生产入口仍拒绝发布和读取测试归档。真实模型认证、地域资格、事实质量和费用均未实测。

运行参数、安全层、事件样本许可、已实现的授权接入代码与尚未验证的部署资格见 [V1-04 实现说明](docs/implementation/v1-04.md)。

## GitHub 元数据观察

V1-11 提供有限官方 Search/仓库 GET、小时 xx:25 观察、独立 SQLite、稳定 node 身份和真实双快照净变化。Request 7 的确定性 Watch Item 与其他五栏普通新闻共存，不接纳模型自报计数。来源/PAT 仍须 Owner 单独批准，当前没有启用真实采集或生产调度。装配接口、来源授权、保留边界和复跑方式见 [V1-11 实现说明](docs/implementation/v1-11.md)。

## 隔离 Claude 候选研究

V1-05 的 `createClaudeRunner` 使用同一 `AgentRunner` 和 Gate：固定 Claude Code 2.1.252、模型标识 `claude-sonnet-4-6`，通过非交互 CLI 的 `StructuredOutput` 数据工具返回单栏候选。独立校验进程退出、最终结构与终态；复用整容器回收，并在宿主模型边界拒绝执行工具、远程 MCP 和过期 Evidence。真实 CLI 与无凭证 Messages 替身已可贯通 SQLite 报告；实际账户、地域、付费模型、质量和生产发布仍未验证或启用。详见 [实现及复跑说明](docs/implementation/v1-05.md)。

## Observer GitHub Heat

V1-12 的 Request 8 从完整有界观察候选中按语言/年龄 cohort、实测动量或冷启动代理、显式 topic 与真实出版历史选择项目。保存固定公式、全部排名/落选理由和可独立重算输入，七天冷却、随后三十天恢复及最终实际位置的新颖性配额均为确定规则；热度不代表代码质量或安全。旧 Request 7 Watch Item 与旧刊正文不重排。详见 [技术规格与边界](docs/implementation/v1-12.md) 和 [参数比较](docs/implementation/v1-12-parameters/README.md)。真实 GitHub 与生产发布仍未启用。
