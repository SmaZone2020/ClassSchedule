# MSN 天气图标（Condition_Card）

共 **57** 个唯一图标，覆盖 **75** 个天气代码。
来源：`https://assets.msn.cn/weathermapdata/1/static/weather/Icons/taskbar_v10/Condition_Card/`

## 怎么用

天气代码（`d000`~`d907` 为白天，`n000`~`n907` 为夜间）→ 文件名，查 `msn_icon/_manifest.json` 的 `codes` 字段：

```ts
import manifest from "./msn_icon/_manifest.json";

const icon = (code: string) =>
  new URL(`./msn_icon/${manifest.codes[code]?.file ?? "CloudyV3.svg"}`, import.meta.url).href;
```

重复图案已经合并成一个文件，被合并的名字仍保留在 `aliases` 里。
所以 `d320` 会自动指向 `LightRainShowerDay.svg`，不需要你手工删文件或改代码。

## 重新同步

```bash
node scripts/msn-icons.mjs            # 下载缺失 + 去重 + 重写清单/预览
node scripts/msn-icons.mjs --dry-run  # 只看会做什么
```

## 图标 → 天气代码

| 文件 | 天气代码 |
| --- | --- |
| `BlowingHailV2` | `d705` `d905` `n605` `n705` `n905` |
| `BlowingSnowV2` | — |
| `ClearNightV3` | `n000` |
| `CloudyV3` | `d400` `n400` |
| `D200PartlySunnyV2` | `d200` |
| `D210LightRainShowersV2` | `d210` |
| `D211LightRainSowShowersV2` | `d211` |
| `D212LightSnowShowersV2` | `d212` |
| `D221RainSnowShowersV2` | `d221` `d311` `d321` |
| `D240TstormsV2` | `d240` |
| `D310LightRainShowersV2` | `d310` |
| `D340TstormsV2` | `d340` |
| `Fair` | — |
| `FogV2` | `d600` `n600` |
| `FreezingRainV2` | `d603` `n603` |
| `HailDayV2` | — |
| `HailNightV2` | — |
| `Haze` | `d900` `d907` |
| `Hazy-Night` | `n900` `n907` |
| `HazySmokeV2` | — |
| `HeavyDrizzle` | `d420` `n420` |
| `HeavySnowV2` | `d432` `n432` |
| `IcePellets` | — |
| `IcePelletsV2` | `d605` |
| `LightRainShowerDay` | `d220` `d320` |
| `LightRainShowerNight` | `n220` `n320` |
| `LightRainV3` | `d410` `n410` |
| `LightSnowShowersDay` | `d312` |
| `LightSnowShowersNight` | `n312` |
| `LightSnowV2` | `d412` `n412` |
| `ModerateRainV2` | `d430` `n430` |
| `MostlyClearNight` | `n100` |
| `MostlyCloudyDayV2` | `d300` `d500` |
| `MostlyCloudyNightV2` | `n300` |
| `MostlySunnyDay` | `d100` |
| `N210LightRainShowersV2` | `n210` |
| `N211LightRainSnowShowersV2` | `n211` |
| `N212LightSnowShowersV2` | `n212` |
| `N221RainSnowShowersV2` | `n221` `n311` `n321` |
| `N222SnowShowersV2` | `n222` |
| `N240TstormsV2` | `n240` |
| `N310LightRainShowersV2` | `n310` |
| `N322SnowShowersV2` | `n322` |
| `N340TstormsV2` | `n340` |
| `N422SnowV2` | `n422` |
| `PartlyCloudyDayV3` | — |
| `PartlyCloudyNightV2` | `n200` `n500` |
| `RainSnowV2` | `d411` `d421` `d431` `n411` `n421` `n431` |
| `SmokeNight` | — |
| `Snow` | `d422` |
| `SnowShowersDayV2` | `d222` `d322` |
| `SnowShowersNightV2` | — |
| `SunnyDayV3` | `d000` |
| `Thunderstorm` | `d440` `n440` |
| `Thunderstorms` | — |
| `ThunderstormsV2` | — |
| `WindyV2` | `xxxx1` |

## 已合并的重复名

| 被合并的名字 | 实际使用 |
| --- | --- |
| `D311LightRainSnowShowersV2` | `D221RainSnowShowersV2` |
| `D321RainSnowShowersV2` | `D221RainSnowShowersV2` |
| `Dust` | `BlowingHailV2` |
| `Dust1` | `BlowingHailV2` |
| `LightRainV2` | `LightRainV3` |
| `N311LightRainSnowShowersV2` | `N221RainSnowShowersV2` |
| `N321RainSnowShowersV2` | `N221RainSnowShowersV2` |
| `RainShowersDayV2` | `LightRainShowerDay` |
| `RainShowersNightV2` | `LightRainShowerNight` |
| `RainSnowShowersNightV2` | `RainSnowV2` |

> 这些图案在 MSN 侧本身就是同一张图（例如 `d221`/`d311`/`d321` 共用一份图形），
> 不是下载错误。合并只删物理文件，不丢代码映射。
