# V1-23 — 单节点 Linux 运行与可观测运维

状态：ready-for-agent · 已发布：[GitHub #23](https://github.com/yiwer/Observer/issues/23)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-23 -->

规划 ID：V1-23 · 类型：implementation

## What to build

在云厂商中立的单节点 Linux 环境启动私人日报服务，持久状态跨重启保存，Owner 可查看任务、报告、Provider 和邮件的分立状态。

## Acceptance criteria

- [ ] 容器化服务与必要持久化组件可在干净 Linux 测试环境重复启动、升级和回滚；不引入 Kubernetes、多节点 HA 或自动接管。
- [ ] HTTPS 与鉴权保护公开访问面；应用、Agent、持久数据与秘密的挂载/网络权限分开，秘密不进入镜像、报告或普通日志。
- [ ] Provider 资格检查、任务轮数/时长/并发/重试保护可配置并可观测；容量测试给出初始值及 07:30–08:30 预算依据，不设产品成本硬限。
- [ ] Owner 可通过受控命令/状态接口区分采集、冻结、研究、可读报告、PDF、邮件受理/投递、缺刊和失败，无需 Web 管理台。
- [ ] 重启、磁盘空间不足、进程卡死、凭证不可用和网络故障形成明确运行状态，不泄漏秘密或使重复发布失控。
- [ ] 交付单节点部署与回滚说明及本地/CI Linux 检查证据；实际 VPS 购买、迁移、真实凭证与对外部署需要独立授权。

## Blocked by

- #16 — V1-16 — 降级、迟到、缺刊与午前补齐
- #19 — V1-19 — 同版本邮件交付与未知受理对账

## Scope boundary

可部署的软件和运维闭环；节点外灾备由下一票，真实服务器能力由实测门验证。

## Decisions and evidence

云厂商中立；供应商支持地域中新加坡优先、东京备选，VPN 限安全管理而非改变 Provider 出口身份。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-68、US-69。
- PRD 行为验收：AC-18。
- 参考分支：D7、D10、ADR-0002、research:deployment。
