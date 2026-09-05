# 可保存的 Codex 事件样本

`success.jsonl` 于 2026-09-05 由真实 `codex-cli 0.153.4` Linux 二进制产生。运行镜像 `sha256:12226892754c245087a7285475dad50d58322e7b9d637ba40850370c37cc5024`，进程退出 0，任务容器清理读回 removed。模型目标为 `gpt-5.6-sol`，实际 Responses 来自 `tests/helpers/model-responses.ts` 的本地协议替身；没有真实模型、身份认证或收费。

thread ID 已替换成 `redacted-fixture-thread`；item ID、事件类型、usage 形状和候选 JSON 保留实际观测值。输入及候选文字均为本仓库自有虚构观测站素材，授权在本项目测试中复制、保存、修改和重放；没有出版者内容、用户秘密或真实模型回复。token 数值由协议替身提供，不代表真实费用或模型用量。运行时原始 stdout、stderr、prompt 和模型请求不进入报告归档。

重放测试从这个文件生成仅测试用的外部进程脚本，仍走容器、真实适配器、Gate 和 SQLite 鉴权读取；不直接测试解析函数。
