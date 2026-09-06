# 首版 Heat 参数比较与精度回放

本材料是 **Owned 合成设计偏好**，不是来自 GitHub 的真实观察，不是 175 项产品测试，也不证明真实满意度、公平性或最佳参数。产品测试另见 [实现说明](../v1-12.md)。预先写下的排序/排除/配额方向用于检测设计偏差；不是用所选分数公式重算 expected 再自证。

## 可复放材料

- `compare-v2.mjs`：保留先于精度冻结的 25 组完整展开输入与 7 个单参数候选，输出全部排名/入选/分数/偏差；原输入提案 `expectations.json` 也保留。v2 中两组实测 delta 可超过其抽象 stock 默认值，不能声称其全部直接映射真实双快照。
- `compare-v3.mjs`：在 v2 偏好期待不变的前提下，使用固定 1e12 排序键、Unicode 码点序、整数毫秒恢复和实际间隔速率。输出 25 组 baseline 的完整 synthetic saved input、实际公开 `rankGitHub` 结果及字段级差异，再输出 7 候选的模拟结果。
- `fixed-input.mjs`：构造明确标记 Owned 的固定详情/运行收据和虚构历史引用，仅用于纯重算，不作为真实已出版历史或外部获取证据。生产 `produce` 不接受这些输入注入。fixture 摘要只使数据自洽，不证明外部真实性。

运行 `node docs/implementation/v1-12-parameters/compare-v2.mjs` 或 `compare-v3.mjs`，stdout 为完整 JSON。v3 与产品结果有差异则退出 1；偏好偏差另行报告，不被伪装成产品测试失败。

v3 的可实现计数修正只影响 measured rows：令当前 stars≥正 starsDelta、forks≥正 forksDelta，不改 signed delta、interval、cold、期望。具体为 uneven-languages 的 Python-1…11 及 uneven-ages 的 mature-1…11：stock 从 100 分别变成 1200、1100、1000、900、800、700、600、500、400、300、200；第 12 项仍 100。两组共 22 项，forks 不变。由于 measured 不用存量评分，此修正不改变先前偏好比较；输出保存修正后的全部值，而不是隐瞒负历史计数。

## 固定期待与取舍

25 场景包括：单一 stars 尖峰与 stars/forks 平衡信号、增加 12 个零变化候选、2 人小 cohort 与精确同分、仅改变大存量、4 Rust 对 12 Python / 4 young 对 12 mature、未知语言、正零负净增、cold 门槛、显式 topic、1 次与 4 次报道、3 novel 对 7 repeat 的质量配额、零 novel、相同 delta 的 23/25 小时，以及 7/30/37/90 天关键端点（原 v2 10 个历史场景）。方向偏好不是客观真值：例如偏好双信号项目不过度被单一 stars 尖峰压制，是本版设计选择。

| 参数候选（其余不变） | 预设偏好差异数 | 解释 |
| --- | ---: | --- |
| stars/forks .60/.40；topic .15；frequency .25；cold 10 stars 或 2 forks；实际间隔 | 0 | 采用的工程默认 |
| stars .75 | 1 | stars 尖峰超过预设偏好的平衡项目 |
| stars .50 | 2 | 两组出现与预设 mid/balanced 顺序不同的结果 |
| topic .30 | 0 | 这些宽方向期待无法区分 .15 与 .30 |
| frequency .50 | 0 | 这些期待无法区分 .25 与 .50 |
| cold 5 stars 或 1 fork | 1 | 额外选入被预先视作关注不足的 5-star 项 |
| 未按实际间隔标准化 | 1 | 相同 delta 的 23h/25h 没体现平均速率方向 |

.30 topic / .50 frequency 同样 0 差异；选择较小干预是工程默认，证据不唯一支持 .15/.25 最优。minimum cohort 4 未作统计校准；无需因此添加语言覆盖配额。候选数量改变、不同 cohort 不平衡、bot stars、未发现项目、持续窗口采样和真实阅读偏差均未被这些偏好穷尽。

精度规则不会抹掉低正信号的资格。v2 的 small-cohort-tie 两项数学均 .45，原值分别 .45000000000000007 / .44999999999999996；v3 二者 sortKey 同为 450000000000，再按 opaque node 码点序决定顺序。原 score 保留，score>0 判定不量化。参数模拟中的 ASCII tie 不是 Unicode 业务测试的替代；后者已由公开真实出版测试覆盖。

## 原始作者执行证据

作者路径均相对 `O:/GenesisCode/Observer-worktrees/v1-12`，data 为忽略的本地执行产物。原提案 `data/parameter-proposal/expectations.json` SHA-256 `41ad8312dce52fe0ed5aa24771f97db29062d9d7ad6232dd10c8c18ff88db872`；原 v2 JSON SHA-256 `54eef194f57605501a98068bf470f0e7ec16857f6425a6269ca40aecc22683e5`。

`comparison-v3.json` 首次输出实际为独立 import 初始化循环失败；`comparison-v3-2.json` 是旧抽象输入映射负历史 stock 被真实 schema 拒绝。均保留，不称为成功 JSON、不覆盖失败。修复公开纯入口及上述 fixture 后，`comparison-v3-3.json` 成功，SHA-256 `9c503adae5c93e5a96a9eeb7deccf6e4acfc15fb89a2d159e49d9781441b2135`。25 baseline 场景的原 score/sortKey/base/recovery/frequency/count90/novel 严格数值一致，全部总序与入选一致；不是仅保存 hash 或比较最后分数。此 SHA 对应当时 WIP 完整审计输出；后续落选理由细化会产生新的完整输出，不篡改该文件。最终 clean 候选需再次回放并绑定真实 SHA。
