# V1-12 作者逐片执行索引

注册 UTC：2026-09-06T03:30:12.164Z。本表是工具输出之后登记的文件 SHA/mtime 与原生测试摘要，**不是原生实时捕获的执行开始/结束时间或 clean SHA 验收**。02–20 全部是 dirty WIP；表中 mtime 是文件系统观察，退出码未嵌入旧原日志，不据文件名猜 PASS。具体命令为 `node --test tests/github-ranking.test.ts`；`*-typecheck*.log` 为 `npm run typecheck`；12-github-regression 为旧四 GitHub suites 加 ranking；20-local-regression 为实现说明列出的八文件局部回归。各命令使用该 worktree 的 `data/author-tmp` 作为 TEMP/TMP。

首片只有原工具终端：RED `1bdc34` 0/1，274.6889 ms；GREEN+typecheck `3411c3` 1/1，334.614 ms，工具退出 0，无补写原日志。17 是首次即 GREEN 的并发 characterization。02/07 首次 green 命名的日志实际失败；19 首次 typecheck 实际失败，第二次才成功。clean 提交的全量、smoke、参数回放由新 wrapper 单独保存真实进程时间、命令、SHA、exit 和原生流，Root 另记正式验收。

所有路径相对作者工作树 `data/v1-12-slices/`。

| 原日志 | 文件 mtime UTC | 原生摘要 | SHA-256 |
| --- | --- | --- | --- |
| 02-cohort-green-2.log | 2026-09-06T02:45:20.662Z | ℹ tests 2; ℹ pass 2; ℹ fail 0; ℹ duration_ms 368.6348 | `6d9d38f48139bcc30062b268464e9000760544dadea5741aa773391d1ff072dd` |
| 02-cohort-green.log | 2026-09-06T02:45:04.675Z | ℹ tests 2; ℹ pass 0; ℹ fail 2; ℹ duration_ms 371.4027 | `50f94b165425c0c6fef571d23150efe81e5f5de5f009190215d4cda945e88e16` |
| 02-cohort-red.log | 2026-09-06T02:44:29.904Z | ℹ tests 2; ℹ pass 1; ℹ fail 1; ℹ duration_ms 365.89 | `4dd5ca2b6c51ac77ba52c8dd25de38e3af605afe5b0caccaaa89c0eae66c8a40` |
| 02-typecheck.log | 2026-09-06T02:45:20.985Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 03-replay-green.log | 2026-09-06T02:46:33.691Z | ℹ tests 3; ℹ pass 3; ℹ fail 0; ℹ duration_ms 406.7615 | `a80b8eede41e057768b2dc6b138f71ad50688efcbfa3982d06f2a0d8e1b1ffb3` |
| 03-replay-red.log | 2026-09-06T02:46:01.291Z | ℹ tests 3; ℹ pass 2; ℹ fail 1; ℹ duration_ms 422.0762 | `4e14548ad9dbb381265bdc05852172b56c11ddca48c89b46673a0d10d0906214` |
| 03-typecheck.log | 2026-09-06T02:46:33.986Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 04-history-green.log | 2026-09-06T02:49:42.852Z | ℹ tests 4; ℹ pass 4; ℹ fail 0; ℹ duration_ms 494.1627 | `56f52f3ca300c1a0cfb56de2be7378b8f687a8e28833ed01cdb666a82769e2e2` |
| 04-history-red.log | 2026-09-06T02:48:13.611Z | ℹ tests 4; ℹ pass 2; ℹ fail 2; ℹ duration_ms 505.3907 | `14a638572dae8db2a6610030c5e07d06dac0be41ec54d8a70965327d63371119` |
| 04-typecheck.log | 2026-09-06T02:49:43.176Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 05-recovery-green.log | 2026-09-06T02:52:25.272Z | ℹ tests 5; ℹ pass 5; ℹ fail 0; ℹ duration_ms 573.3547 | `25eac4d8dca962b35d51c6957103fda636496becc2f6bf886f1a26a5c5a58614` |
| 05-recovery-red.log | 2026-09-06T02:51:56.562Z | ℹ tests 5; ℹ pass 4; ℹ fail 1; ℹ duration_ms 598.6257 | `9830cf78c7e628c8bbe0410c3c77d7a7aa657317b54412cd390ad8b6566463e2` |
| 06-quota-green.log | 2026-09-06T02:53:34.770Z | ℹ tests 6; ℹ pass 6; ℹ fail 0; ℹ duration_ms 682.3533 | `f6c454c985ba99e6dda1c7f75cfefecbf8145dc532e8207e7a9cd9258bb9a5af` |
| 06-quota-red.log | 2026-09-06T02:52:54.944Z | ℹ tests 6; ℹ pass 5; ℹ fail 1; ℹ duration_ms 671.8883 | `7ae4d6f594094f6057a252c95a60b729592139ef743049958dfd52be8a881fb6` |
| 06-typecheck.log | 2026-09-06T02:53:35.106Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 07-cold-green-2.log | 2026-09-06T02:55:19.222Z | ℹ tests 7; ℹ pass 7; ℹ fail 0; ℹ duration_ms 697.0922 | `0025ab96f19175c2e608394c4e09988b3e9be50d89e4fe14c5c05e54b40bae5d` |
| 07-cold-green.log | 2026-09-06T02:55:02.194Z | ℹ tests 7; ℹ pass 6; ℹ fail 1; ℹ duration_ms 711.2072 | `3e8a07f7e5f3d2b78ad096515387fabb2b1ef7dc83326941967e3325c321832d` |
| 07-cold-red.log | 2026-09-06T02:54:15.553Z | ℹ tests 7; ℹ pass 6; ℹ fail 1; ℹ duration_ms 693.883 | `c8fe96d33c86b771ce9ebd7570a93dcfa66ff4ae2d7294c361850e0c20b12c4e` |
| 07-typecheck.log | 2026-09-06T02:55:19.541Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 08-history-expiry-green.log | 2026-09-06T02:56:21.561Z | ℹ tests 8; ℹ pass 8; ℹ fail 0; ℹ duration_ms 808.8981 | `9ef2db2de11473b6263518d13aa12c552569eb528e535f9b881818c9b20d6ae4` |
| 08-history-expiry-red.log | 2026-09-06T02:56:05.318Z | ℹ tests 8; ℹ pass 7; ℹ fail 1; ℹ duration_ms 804.2044 | `a3b74a768a1ce709cc3a68a1bb8cd99b22e7795d7dc0804d82ea4886d3bda432` |
| 09-history-gap-green.log | 2026-09-06T02:57:17.450Z | ℹ tests 9; ℹ pass 9; ℹ fail 0; ℹ duration_ms 848.8474 | `d0fec7e7e8b4bedc214c2365b4507aac153041c1200e1508f5adde5d45f87ac6` |
| 09-history-gap-red.log | 2026-09-06T02:56:45.939Z | ℹ tests 9; ℹ pass 8; ℹ fail 1; ℹ duration_ms 817.5242 | `2fa73050b127b37845d1480cc54be91a100a9f79352e81124972591f4ef1837d` |
| 09-typecheck.log | 2026-09-06T02:57:17.762Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 10-topic-green.log | 2026-09-06T02:58:53.485Z | ℹ tests 10; ℹ pass 10; ℹ fail 0; ℹ duration_ms 907.7822 | `2e364cbaa2a93b31798c2fc642cfc9ded1c606a61df1b83a43dea77224916964` |
| 10-topic-red.log | 2026-09-06T02:58:14.203Z | ℹ tests 10; ℹ pass 9; ℹ fail 1; ℹ duration_ms 874.7588 | `7b3b1eea21646c7a8732d29af4e773d607bce9c81ce28774d204d801ae00f3ed` |
| 10-typecheck.log | 2026-09-06T02:58:53.798Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 11-age-green.log | 2026-09-06T03:00:23.714Z | ℹ tests 11; ℹ pass 11; ℹ fail 0; ℹ duration_ms 915.2704 | `d52987f0d52d75151e93440458d023a5a6a4cd413beff6a93bf8f74ca015fb81` |
| 11-age-red.log | 2026-09-06T02:59:29.847Z | ℹ tests 11; ℹ pass 10; ℹ fail 1; ℹ duration_ms 896.0299 | `52653df603d889630282a89c2e79b4cb5da13095cc8a44572f71a967930748c2` |
| 11-typecheck.log | 2026-09-06T03:00:24.034Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 12-github-regression.log | 2026-09-06T03:04:34.341Z | ℹ tests 72; ℹ pass 72; ℹ fail 0; ℹ duration_ms 3025.6637 | `66de30c40dcb0f264ae6c5fc9505d2f117d45c7455150de9925e6e23184f3f53` |
| 12-interval-green.log | 2026-09-06T03:04:10.651Z | ℹ tests 12; ℹ pass 12; ℹ fail 0; ℹ duration_ms 1007.5381 | `656b48b7694cf83772d24bbce9c3531e2590651721b1a76a1a5cdc18fe9ba5f0` |
| 12-interval-red.log | 2026-09-06T03:03:47.466Z | ℹ tests 12; ℹ pass 11; ℹ fail 1; ℹ duration_ms 1005.2141 | `32b62bc90675002553f605b15c9cafaeea52a30811883716fa2f9e2b72c450b4` |
| 12-typecheck.log | 2026-09-06T03:04:10.974Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 13-score-key-green.log | 2026-09-06T03:06:30.457Z | ℹ tests 13; ℹ pass 13; ℹ fail 0; ℹ duration_ms 1040.9366 | `5bc11d2c9b4f9ae39431124adbe467adcc08f8b9d2dbd23050c84266cb747435` |
| 13-score-key-red.log | 2026-09-06T03:06:10.093Z | ℹ tests 13; ℹ pass 12; ℹ fail 1; ℹ duration_ms 1069.3006 | `fe654d0729170f24e4f097aba5486dd2ded181a230cdf1d2ba9c951eeb62db56` |
| 13-typecheck.log | 2026-09-06T03:06:30.796Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 14-unicode-green.log | 2026-09-06T03:08:06.513Z | ℹ tests 14; ℹ pass 14; ℹ fail 0; ℹ duration_ms 1093.0744 | `79eb4e1179f951c7569c8973dff6b3f810c66d9032cdd81e6ad173929dcae038` |
| 14-unicode-red.log | 2026-09-06T03:07:50.258Z | ℹ tests 14; ℹ pass 13; ℹ fail 1; ℹ duration_ms 1069.0729 | `9cd9d8604ffef8827b462390e6a3e508f146e33e6f9c3e6937ca123949b8a8be` |
| 15-corrupt-history-green.log | 2026-09-06T03:12:43.003Z | ℹ tests 15; ℹ pass 15; ℹ fail 0; ℹ duration_ms 1123.9895 | `01fbe4729b3beaa94bb794c907251b85acd31bbda1c19bdadfe4a3dc4900cb0f` |
| 15-corrupt-history-red.log | 2026-09-06T03:12:21.863Z | ℹ tests 15; ℹ pass 14; ℹ fail 1; ℹ duration_ms 1155.7079 | `f6aa1dba81d729dffea2c3cfaf2d4b3f43a35a855544b980874a070f1530c80c` |
| 15-typecheck.log | 2026-09-06T03:12:43.305Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 16-audit-green.log | 2026-09-06T03:15:41.206Z | ℹ tests 16; ℹ pass 16; ℹ fail 0; ℹ duration_ms 1169.305 | `c16c4a4280e94ce88d87a3f31f7e673032376c1b4e96e006a951ea2554806602` |
| 16-audit-red.log | 2026-09-06T03:13:48.440Z | ℹ tests 16; ℹ pass 15; ℹ fail 1; ℹ duration_ms 1159.4786 | `2a12fd095892684c74000f32a8aa9ad8782856683f8e033980c440450e842530` |
| 16-typecheck.log | 2026-09-06T03:15:41.511Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 17-concurrent-characterization.log | 2026-09-06T03:16:53.835Z | ℹ tests 17; ℹ pass 17; ℹ fail 0; ℹ duration_ms 1270.9041 | `b1f3280449c0969e9067c380db43de686f27693f6b51252ae9873da34e1f7b78` |
| 18-standalone-green.log | 2026-09-06T03:20:19.033Z | ℹ tests 18; ℹ pass 18; ℹ fail 0; ℹ duration_ms 1546.0268 | `fbbb599ab1d7d6db902825b47200a5a4e2d24b67dfe6f3f943852d39aa933f4d` |
| 18-standalone-red.log | 2026-09-06T03:19:56.752Z | ℹ tests 18; ℹ pass 17; ℹ fail 1; ℹ duration_ms 1590.3943 | `cebc3ae63c972c51dc59bce6ab5ec6bdba0570001336c6b808ae011d27df4890` |
| 18-typecheck.log | 2026-09-06T03:20:19.342Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 19-history-dependency-green.log | 2026-09-06T03:23:00.228Z | ℹ tests 19; ℹ pass 19; ℹ fail 0; ℹ duration_ms 1672.2819 | `ad3bb31eef52c8eca9c0cd5926812dc11ba345ff7e5ca55a68dcf9092a7b538f` |
| 19-history-dependency-red.log | 2026-09-06T03:22:44.678Z | ℹ tests 19; ℹ pass 18; ℹ fail 1; ℹ duration_ms 1681.7236 | `6b4360cad703721c82c9c0975b27a2db275ac7213082452cc2dd37c14279158b` |
| 19-typecheck-2.log | 2026-09-06T03:23:12.559Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 19-typecheck.log | 2026-09-06T03:23:02.431Z | TS2339（退出 2 见原工具输出） | `4c519204eaa8237f5d1da4e903b6352b2accef082a221fdf5b1b9db89d175f0f` |
| 20-local-regression.log | 2026-09-06T03:28:42.774Z | ℹ tests 143; ℹ pass 143; ℹ fail 0; ℹ duration_ms 4224.9348 | `9fbb5e85d6b299562664f7b49598099b0410df08cf83bfdce48cbf9ab739c785` |
| 20-omission-green.log | 2026-09-06T03:24:25.399Z | ℹ tests 20; ℹ pass 20; ℹ fail 0; ℹ duration_ms 1734.6755 | `df8a6456b31c56e7636f85afe2f3aa65fc7c6e71da7e1dc20b846c2c704a11e9` |
| 20-omission-red.log | 2026-09-06T03:24:23.184Z | ℹ tests 20; ℹ pass 19; ℹ fail 1; ℹ duration_ms 1706.8505 | `bad9fe254dd459f41f7b034375efff3224db2bab5365a5e954fe6cd8d97d602b` |
| 20-typecheck.log | 2026-09-06T03:24:25.730Z | typecheck 原命令输出，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |


## 独立 Spec P2 的窄修（21–24）

原 e461739 候选因栏目级选择 Gap 遗漏未获接受；此前 clean 全量/参数/smoke 原件保留，不替代新候选验收。本段注册 UTC 2026-09-06T03:45:08.142Z，mtime 是后登记文件系统观察，非原生实时执行时刻。命令均 `node --test tests/github-ranking.test.ts`，typecheck 文件为 `npm run typecheck`；21 真实 RED→GREEN，22–24 分别在既有修复上首次 GREEN，不伪造 RED。

| 原日志 | 文件 mtime UTC | 原生摘要 | SHA-256 |
| --- | --- | --- | --- |
| 21-selection-gap-green.log | 2026-09-06T03:42:48.268Z | ℹ tests 21; ℹ pass 21; ℹ fail 0; ℹ duration_ms 1805.5718 | `a695cd585a757f77fa8f84d2e0521e27f1b65633fd231aca1fddd1397023c68b` |
| 21-selection-gap-red.log | 2026-09-06T03:42:14.098Z | ℹ tests 21; ℹ pass 20; ℹ fail 1; ℹ duration_ms 1808.9823 | `b31c3b9f6a140f69ae365e0b8a9d9887de5b885fb5cb06d5ea7d6df6a5022d92` |
| 21-typecheck.log | 2026-09-06T03:42:48.564Z | typecheck，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
| 22-sparse-gap-characterization.log | 2026-09-06T03:43:24.424Z | ℹ tests 22; ℹ pass 22; ℹ fail 0; ℹ duration_ms 1836.4264 | `5cd08d5abeb318958c457de73d907b321ac6aaf354c90f6a100bfd9ca78b7e96` |
| 23-source-gap-characterization.log | 2026-09-06T03:43:50.764Z | ℹ tests 23; ℹ pass 23; ℹ fail 0; ℹ duration_ms 1950.7594 | `39a9a650768145d97a7f0c4ceccb4fcaa816dd1577cc6d0797011b8dbbd40080` |
| 24-full-selection-characterization.log | 2026-09-06T03:44:17.223Z | ℹ tests 24; ℹ pass 24; ℹ fail 0; ℹ duration_ms 1982.5993 | `d6e3effa2ac4f4250dc252f7da5252febd23ddd6eb7f7da6b3f4cd7c671732b5` |
| 24-typecheck.log | 2026-09-06T03:44:17.536Z | typecheck，无测试计数 | `95f5ed32e27f7d7006236e8548b4e3f3fc22de6a069d6843b45a3e8f358477ad` |
