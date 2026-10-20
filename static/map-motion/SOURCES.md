# 地图动效来源与改写

本轮基于实验 3 中用户认可的 04、07 继续做局部适配。既有源码研究固定在 2026-10-18 的提交；本轮没有重新下载原作工程，没有使用作者的模型、照片、HDR 或音频。

| 来源 | 固定提交 | 本轮使用 |
| --- | --- | --- |
| Cullen Webber, [Skeleton Fluid Reveal](https://github.com/cullenwebber/three-skull/tree/5c5d6f84c424e2a5f83dfe7440089d167d0b0530) | `5c5d6f84c424e2a5f83dfe7440089d167d0b0530` | 经实验 3 `surfaces.js` 接续的噪声边缘用于开场与选点。用户本轮取消游墨，双缓冲反馈和笔触注入已移除 |
| Jatin Chopra, [Emissive Dissolve](https://github.com/JatinChopra/emissive-dissolve-effect/tree/9a913c840beb6b9e979f43ed07f35ec44cb95f2e) | `9a913c840beb6b9e979f43ed07f35ec44cb95f2e` | 实验 3 `dissolve.js` 的共享噪声阈值和粒子出生带，改为平面纸层、9,350 个采样点和克制的青灰纸屑 |

`field.js` 是原生 Three.js / GLSL 实现；开场和点击扩散使用程序噪声，不称作“物理流体”。风化纸面与粒子在同一 `paperField` 上取样。没有搬用原作者整站布局，也不宣称逐像素复刻。

实验 3 对这两份源码的记录为：README 声明或链接 MIT，但没有独立 LICENSE 文件。沿用其研究证据和 Codrops 可下载示例的 MIT 文本，保留在 `vendor/RESEARCH-SOURCES.json`、`vendor/CODROPS-LICENSE.txt`；不把这记为新找到的仓库许可证。

Three.js 沿用实验 3 的固定版本 0.186.1；源码 URL、文件 SHA256 和 MIT 文本在 `vendor/THREE-SOURCES.json`、`vendor/THREE-LICENSE.txt`。浏览器只加载本地静态资源。

实验分支 `codex/实验-地图模块`（提交 `0a3bdc8`）原来使用 JPG 底图。本目录现为主线适配，保留其纸墨显影、选点回声及同噪声纸屑机制；不带入实验页面、选型控件、数据或布局。

主线底图是 `static/maps/china-provinces.geojson` 的现有 34 省 SVG，地图来源和文件校验见 `static/maps/SOURCE.md`。省名、选中状态及点击由原 SVG 承担。不加载旧 JPG，不裁切旧图例位置，不改变省域轮廓、岛屿或投影。短暂的墨迹、粒子和界面连接线不代表行政边界、方言分区或地理路径。

主线节奏：首次进入开图 2400ms；点击扩散按用户最新反馈延长至 2200ms，引导线仍为 1200ms；资料就绪后的纸层消散延长至 2200ms（原 1100ms 的两倍）。鼠标经过地图不启动动效。扩散起点取实际地图点击位置，初始中心光晕和环宽收小；键盘和目录选择仍使用省域锚点。任一点击、键盘聚焦、右栏滚轮阅读立即结束覆盖层。减少动态不创建 WebGL，离屏或页面隐藏时停止；初始化失败或上下文丢失保留原生地图导航。
