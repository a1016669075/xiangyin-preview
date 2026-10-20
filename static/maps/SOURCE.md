# 中国地图来源

## 2026-10-20 当前省域导航

`china-provinces.geojson` 从阿里云 DataV.GeoAtlas 的原始接口直接下载，文件字节未修改。

- [原始数据](https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json)
- [范围选择器](https://datav.aliyun.com/portal/school/atlas/area_selector)
- [阿里云官方工具说明](https://help.aliyun.com/zh/datav/datav-7-0/user-guide/datav-geoatlas-widgets/)
- [范围选择器官方说明](https://help.aliyun.com/zh/datav/datav-7-0/user-guide/introduction-to-features-of-a-range-selector)
- 下载日期：2026-10-20；582522 字节。
- SHA256：`99adfeded5223848bbe37a0a12f8023e11ee12161c7800521c27db42fdeac275`。
- 35 个要素：34 个省级行政区与 `100000_JD` 海界补充几何。

`catalog/geography.py` 将原始坐标投影到 SVG。逐个保留全部多边形及其环，不简化、不裁切、不人工描画省界；低于北纬18°的完整岛屿及海界多边形放入右下南海附图。主图采用经纬线等距投影、标准纬度约36°的长宽比例，附图独立缩尺。省名使用省级简称，不显示省会名称；小地区名称采用引线。点击省域沿用既有地区请求与历史控制器，没有资料的省份只显示空态，不创建资料或数据库地区。

官方说明的数据来源是高德开放平台，并限定学习、交流用途；生产公开使用及版权条件仍应向高德核实。本轮只用于本机体验，不将该数据视为取得公网商业使用许可，也不沿用旧 JPG 的 `GS(2019)1823` 标识。正式上线前应完成相应地图使用确认或切换至获准的数据。2026-10-20 按用户要求移除地图下方的来源入口和导航说明，来源证据保留于本文档。

## 历史栅格底图（保留原件）

`china-gs-2019-1823.jpg` 是自然资源部标准地图服务系统现可下载的原始 JPG，未裁切、改色、重采样或修改地理内容。

- 图名：中国地图 1:4800万 64开，界线版、无邻国、线划一。
- 审图号：GS(2019)1823号。此标识是原图版本，不代表本项目另获生产地图审核。
- 原始尺寸：1417 × 1083；315123 字节。
- SHA256：`56a0cf7b8d5e97c7e6488666b2f74c0736c4a0a90761bb060b703178201aeb84`。
- [官方浏览页](http://bzdt.ch.mnr.gov.cn/browse.html?picId=4o28b0625501ad13015501ad2bfc0256)
- [官方原图](https://bzdt-sbsm.obs.cn-north-4.myhuaweicloud.com/prototype/64/4o28b0625501ad13015501ad2bfc0256.jpg)
- [官网使用说明](http://bzdt.ch.mnr.gov.cn/view/index/silder.html)

官网允许公众免费浏览、下载标准地图，直接使用应标注审图号；编辑地图内容（包括放大、缩小和裁切）后公开使用前须送自然资源主管部门审核。本轮仅实现本机展示，最终网页缩放及交互入口叠加的公开使用条件在上线前核实。

显示时保留完整矩形、原图纵横比、地理内容和南海诸岛插图。2026-10-17 根据用户要求，网页用两个白色遮罩隐藏左上“中国地图”及左下图例、比例尺和原图署名文字；遮罩只覆盖地图外的留白区域，JPG 原件不变。图下继续显示可读来源与审图号，并可打开完整原图。入口仅用于导航行政地区资料，不代表方言分区。

来源和下载链、ZIP CRC、字节一致性检查及导航锚点记录在 `reports/alignment-motion-20261017/map-source.json`。
