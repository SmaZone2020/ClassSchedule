# ClassScheduleWidget

桌面课表小组件：贴在壁纸上的玻璃面板，开机即在，永不抢焦点。

[![CI](https://github.com/SmaZone2020/ClassSchedule/actions/workflows/ci.yml/badge.svg)](https://github.com/SmaZone2020/ClassSchedule/actions/workflows/ci.yml)
[![Release](https://github.com/SmaZone2020/ClassSchedule/actions/workflows/release.yml/badge.svg)](https://github.com/SmaZone2020/ClassSchedule/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg)]()

一款用 Tauri v2 + React 编写的 Windows 桌面课表。窗口固定在桌面层、不占任务栏、不抢焦点，鼠标可以直接穿过面板操作桌面图标；需要改课表时再进入编辑模式。

## 特性

**桌面融合**

- 固定桌面底层，无任务栏图标，托盘常驻
- 磨砂 / 液态玻璃两种面板，按屏幕坐标裁剪桌面壁纸并与壁纸对齐
- 阴影强度与尺寸可调，面板四周预留透明边距避免阴影被裁切
- 鼠标穿透：不点击时窗口完全透明于桌面上
- 开机自启动

**课表视图**

- 5 天 / 7 天 / 自动 / 仅当天四种模式
- 自动模式：周末无课只显示 5 天；本周课程全部结束后收成单日尺寸
- 当前节次高亮、今日日期标记、周次切换、日期区间居中显示
- 滚轮左右切换（5 天与仅当天模式）
- 课程全名 / 简称切换，节次时间可显示

**就地编辑**

- 单击课程编辑，hover 左上角删除，右下角拖动改时长
- 拖动课程可预览落点，落点与时长均做碰撞检测
- 空白处单节新增，拖动框选多节时段新增
- 编辑态课程轻微抖动提示，hover 立刻停抖
- `Esc` 退出编辑并回滚全部改动，`✓` 才写入磁盘
- 右键菜单：课程 → 编辑 / 删除；空白 → 新增课程

**其它**

- 中国天气网实况与五天预报，按 IP 定位到省市区，无课时展示天气与温度曲线
- 无课时用随机诗句替换状态文字，点击换一句
- 喜鹊儿教务导入（学校 / 账号 / 密码登录，选择学期一键导入）
- 全局字体（系统字体全量列表 + 自定义字体目录）
- 高级 CSS 注入，可覆盖面板与课程卡片样式
- 亮 / 暗 / 跟随系统主题、强调色可调

## 安装

前往 [Releases](https://github.com/SmaZone2020/ClassSchedule/releases) 下载：

| 文件 | 说明 |
| --- | --- |
| `ClassScheduleWidget_*_x64-setup.exe` | NSIS 安装包，推荐 |
| `ClassScheduleWidget-portable.exe` | 单可执行文件，免安装 |

首次启动后不会出现窗口 —— 请查看系统托盘图标。

## 使用

### 托盘

| 菜单项 | 作用 |
| --- | --- |
| 显示 / 隐藏 | 切换课表可见性 |
| 设置 | 打开设置窗口 |
| 退出 | 结束进程 |

### 课表操作

| 操作 | 结果 |
| --- | --- |
| 单击课程 | 查看详情；编辑模式下打开编辑表单 |
| 单击日期表头 | 进入该日单日视图，再次点击返回 |
| 滚轮横滑 | 5 天 / 仅当天模式切换日期 |
| 右键课程 | 编辑、删除 |
| 右键空白 | 在该节新增课程 |
| 拖动课程 | 移动课程，实时预览落点 |
| 拖动右下角把手 | 调整课程节数 |
| 拖选空白节次 | 框选多节后新增课程 |
| 点击右上角铅笔 | 进入编辑模式 |
| 编辑时 `Esc` | 取消并回滚；再按一次退出编辑 |

编辑期间的所有改动都只存在于内存，点击 `✓` 才保存；按 `Esc` 会恢复到进入编辑模式时的快照。

### 设置项

| 分组 | 内容 |
| --- | --- |
| 外观 | 主题、强调色、玻璃风格、透明度、模糊、圆角、间隙、阴影 |
| 字体 | 系统字体列表、自定义字体目录 |
| 布局 | 位置、缩放、显示天数、对齐方式、面板元素显隐 |
| 课表 | 导入 / 导出模板 / 清空、喜鹊儿导入 |
| 作息 | 每节课的开始与结束时间 |
| 高级 | 自定义 CSS、开机自启动、鼠标穿透 |

## 数据位置

所有配置保存在 `%APPDATA%\com.classschedule.widget\`：

```
settings.json      设置
schedule.json      课表
wallpaper.<ext>    自定义壁纸
```

## 从源码构建

### 环境

- Node.js 20+
- Rust 1.77.2+
- Windows 10/11，WebView2 运行时

### 命令

```bash
npm install
npm run dev:app     # 开发模式（Vite 端口 1420）
npm run build:app   # 生成安装包与可执行文件
npm run build       # 仅类型检查 + 前端构建
npm run icons       # 重新生成应用图标
```

构建产物位于 `src-tauri/target/release/`：

```
ClassScheduleWidget.exe                       免安装可执行文件
bundle/nsis/ClassScheduleWidget_*_x64-setup.exe   安装包
```

## 课表格式

`schedule.json` 以周为单位组织，日期是唯一键：

```json
{
  "meta": { "semester": "2026 秋季学期" },
  "courses": [
    { "name": "高等数学", "shortName": "高数", "color": "#4f8ef7" }
  ],
  "weeks": [
    {
      "week": 1,
      "startDate": "2026-09-07",
      "days": [
        {
          "weekday": "周一",
          "date": "2026-09-07",
          "sessions": [
            { "course": "高等数学", "periods": [1, 2], "location": "A101" }
          ]
        }
      ]
    }
  ]
}
```

`periods` 为连续节次数组。设置页「导出模板」会生成带示例数据的完整结构，可对照修改后导入。

## 项目结构

```
src/
  widget/         课表窗口：布局、编辑、拖拽、天气、右键菜单
  settings/       设置窗口：beUI 组件组合
  components/     beUI 组件（motion / charts）与图标封装
  styles/         基础样式、组件窗口、设置窗口
src-tauri/src/
  window_ops.rs   窗口尺寸、位置、置底、鼠标穿透
  platform.rs     Win32 窗口样式（WS_EX_NOACTIVATE 等）
  tray.rs         托盘菜单
  schedule.rs     课表校验与扁平化
  xiqueer.rs      喜鹊儿登录与课表抓取
  weather.rs      中国天气网实况与预报
  daily_word.rs   诗词接口
  autostart.rs    注册表开机自启动
.github/workflows CI 与自动发布
scripts/          图标生成、beUI 同步、构建辅助
```

## 技术栈

Tauri v2 · React 18 · TypeScript · Vite · Tailwind CSS v4 · beUI · @gravity-ui/icons

## 已知限制

- 仅支持 Windows（依赖 `WS_EX_NOACTIVATE` 与注册表自启动）
- 天气定位依赖 IP，代理或 VPN 下可能定位到错误城市
- 喜鹊儿接口非公开 API，学校侧升级后可能需要同步调整

## 致谢

- [Tauri](https://tauri.app/)
- [beUI](https://beui.dev/)
- [Gravity UI Icons](https://github.com/gravity-ui/icons)
- [中国天气网](https://www.weather.com.cn/) 提供天气数据
- [MSN Weather](https://www.msn.com/weather) 图标集

## 许可

[MIT](LICENSE)
