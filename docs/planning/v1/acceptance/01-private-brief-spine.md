# V1-01 orchestrator 验收

结论：**本地实现验收通过**。这不是生产准入，也不是代码已 push 的声明。

- 范围：[GitHub #1](https://github.com/yiwer/Observer/issues/1)、[本地 ticket](../tickets/01-private-brief-spine.md)。
- 固定起点：`99d7fb5fd3873786d2510fc6ccbf230997a07374`。
- 实施提交：`35c647c40ef569453dc1edcc0a15b488150d3f05`，分支 `ticket/v1-01`。
- 集成提交：`179861356306ace135b5e731e0655e272df1b1b6`，本地 `master`。
- 验收时间：2026-09-05；[Issue 验收回写](https://github.com/yiwer/Observer/issues/1#issuecomment-5549947823)，已读回 CLOSED。

## Standards

独立 reviewer 在固定实施提交审查：0 项文档标准违例，1 项非阻塞判断。`tests/brief.test.ts` 第一条及 Runner 拒绝测试重复临时归档 setup/cleanup，属于 Possible Duplicated Code；建议后续复用已有 helper。测试遵守 PRD T1 公共业务 seam。Orchestrator 接受其为维护建议，不为此改动已冻结版本。

## Spec

独立 reviewer 核对 GitHub #1、本地 ticket、PRD D1/D2/D3/D9/T1、ADR-0001：0 项发现，没有缺失、越界或错误实现。Orchestrator 另行阅读契约、生产入口、归档逻辑、HTTP 和进程测试，没有发现本票阻断项。

两轴汇总：Standards 0 阻塞 / 1 非阻塞建议；Spec 0 发现。

## 验收证据

Orchestrator 在独立 detached 工作区固定到实施提交，再在集成提交重跑；两处均得到以下结果，测试后 Git 工作区干净。

| 检查 | 结果 |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | 锁定的 4 个依赖安装成功 |
| `npm run check` | typecheck、构建、13/13 测试通过 |
| `npm run smoke` | 构建、2/2 真实进程测试通过 |
| 实施差异 `git diff --check` | 通过 |

13 个测试已包含 2 个 smoke；不得相加宣称有 15 个不同测试。环境为 Windows、Node 24.18.0、npm 11.16.0。实施 subagent 的逐切片红绿记录见[实现说明](../../../implementation/v1-01.md)。

| Ticket 验收条件 | 独立核对 |
|---|---|
| 整期入口、私有读取及进程重启 | 固定业务日期产出一个故事；无效凭证被拒；写入子进程退出，新读取进程得到相同版本和正文 |
| 最小版本化契约 | 来源关联、UTC、配置/任务/Bundle 关联、终态、失败分类及可选用量均有运行时校验 |
| 最小技术决策 | Node/TypeScript、单节点 SQLite、初始迁移和测试理由记于 ADR-0004 |
| 确定性与隔离 | 独立归档内容相同；重复出版不覆盖；五栏缺口可见；生产入口禁止发布并拒绝 fixture JSON/MD |
| 干净构建与 smoke | 独立安装、构建和真实 HTTP 进程检查通过 |

## 边界与接续

本票只证明固定材料和替身下的本地闭环。来源事实支持、真实模型、真实采集、六栏选题、PDF、邮件、调度、设备配对、Linux 部署及生产准入尚未验证。生产入口当前有意不提供可发布真实日报的能力。代码尚未 push，Issue 关闭仅记录本地实现验收。

下一票 V1-02 从已验收集成状态开始，须保持 fixture 与真实来源资格分离，不能因采集成功自动扩大 Source Policy 权限。
