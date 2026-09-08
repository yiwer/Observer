# 本机每日六栏邮件定时任务

Owner 于2026-09-08要求按既定时间启用每日任务。这是新增真实自动发信授权，承接现有[六栏HTML流程](daily-html.md)，不是旧容器/Android定时链的验收。

## 计划与输入

- Windows任务名：`Observer-Daily-0730`，每天北京时间07:30；新闻窗口前一天00:00至当天07:30，启动略晚也不推迟新闻截止。行情/GitHub为本轮实际观察快照，分别标明时间。
- 生成后立即发送，08:30为截止目标；六栏各一封给每个订阅者，当前私有配置2位，即每天12封。保留每条AI影响解读和财经11项行情。
- 本机Codex `gpt-6-astra / medium`，最多2个并行；既有Windows User/Process环境密钥和 `data/operator/daily-mail.json`，不把秘密写入任务定义。
- 当前用户Interactive、Limited运行；需要开机、网络可用、用户保持登录，锁屏可。任务请求WakeToRun，实际唤醒受硬件及Windows电源策略影响；关机不能唤醒。不选择S4U，因为其没有网络/加密文件访问；见[Microsoft登录类型说明](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskfolder-registertask)。

## 安装与只读查看

```powershell
node scripts/daily-scheduled.mjs --check
powershell.exe -NoProfile -File scripts/install-daily-scheduled.ps1
Get-ScheduledTask -TaskName Observer-Daily-0730
Get-ScheduledTaskInfo -TaskName Observer-Daily-0730
```

安装器要求本机 `China Standard Time`，固定实际Node路径/工作目录，以隐藏PowerShell启动。若同名任务已存在会停止，不覆盖未知任务。不会立即运行或补发今天日报。禁用可执行 `Disable-ScheduledTask -TaskName Observer-Daily-0730`，保留代码、日志与已发记录。

## 故障与恢复

每天固定run为`YYYY-MM-DD-scheduled`；`data/operator/schedule/YYYY-MM-DD.json`独占创建，任何已有声明都不自动重跑，崩溃后留下running也须检查，不按PID/超时擅自解锁。原`SMTP-attempt`机制继续保护每栏每位收件者。日志为同目录`YYYY-MM-DD.log`，收件地址和秘密不输出。

某栏Codex失败不丢其它栏目：该栏说明本次整理未完成，财经仍展示可用行情及解读缺口。完整源失败会保留覆盖警告，不用旧内容补齐。08:30前不足6分钟不启动新的5分钟模型调用；SMTP使用截止AbortSignal，超时未知回执不重试。任务整体最长1小时，外部延迟/主机问题仍可能导致失败，日志不能被描述成准点送达保证。

早于07:30/晚于或等于08:30的启动只记skipped，不采集、不调用模型、不发信；错过的日报需另行明确处理，不自动晚间补发。任务同时设置IgnoreNew与每日持久声明；不设置自动重试。成功只代表SMTP accepted，真实收件仍由邮箱端确认。

## 验证记录

本轮按快速V1策略仅本地只读前置检查、注册后读取Windows任务定义/下次运行时间及静态review；不执行完整新闻重采、模型、SMTP或回归。首次真实定时投递尚待下一个07:30，不提前宣称通过。

已实际注册并读回：`Observer-Daily-0730`为Ready、启用，每1日一次；StartBoundary为`2026-09-09T07:30:00+08:00`，NextRunTime为北京时间2026-09-09 07:30:00。Interactive/Limited、WakeToRun/StartWhenAvailable为true、IgnoreNew、执行上限PT1H。前置检查Node24.18.0、Codex可执行文件、SMTP/Tavily/Exa凭据存在与2订阅者配置均通过；未读取密钥值到输出。LastTaskResult为267011（尚未运行），不是投递成功记录。

## Standards

固定差异`2d170a1...e80723f`：0项P1/P2、0项可确认硬标准违反；未发现值得为当前V1新增修改的启发式问题。已核对当前用户/隐藏启动、截止取消、每日与SMTP独占声明、秘密保护及不自动重试。

## Spec

同一固定差异：0项P1/P2，无未请求范围扩展。已核对07:30固定新闻截止、08:30投递目标/超时控制、六栏各收件者独立发信、单栏失败显式降级、当前用户登录条件及首次投递尚未验证的准确表述。

汇总：Standards 0；Spec 0。两轴均为静态审阅，未触发任务、网络、模型、SMTP或测试回归。
