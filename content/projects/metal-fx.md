---
{
  "id": "metal-fx",
  "slug": "metal-fx",
  "blockType": "project",
  "title": "metal-fx",
  "status": "active",
  "tags": [],
  "sourceUrl": "https://github.com/Jakubantalik/metal-fx",
  "payload": {
    "summary": {
      "en": "Wrap React elements in an animated metal ring; one shared WebGL context and single rAF loop power every instance, SSR-safe.",
      "zh": "WebGL 金属环包裹按钮，整页共享上下文，单一渲染循环。"
    },
    "body": "一个 React 组件，把按钮、徽章、图标包进一圈实时动画的液态金属边框里——类似 Apple 发布会那种金属反光质感。覆盖层是 `pointer-events: none`，子元素照常可点击。\n\n## 原理\n\n- 整页共享一个 WebGL context，所有挂载的 `<MetalFx>` 实例复用同一个\n- 单个 `requestAnimationFrame` 循环驱动全部实例，不是每个实例各跑一个\n- `IntersectionObserver` 在实例滚出视口时暂停该实例\n- SSR 阶段渲染透明占位，hydration 之后才挂载 WebGL 管线\n\n## 运行方式\n\n```\nnpm install metal-fx\n```\n\n```jsx\nimport { MetalFx } from 'metal-fx';\n\n<MetalFx variant=\"button\">\n  <button>Upgrade to Pro</button>\n</MetalFx>\n```\n\nvariant 有 `button` / `circle` 两种，预设 `chromatic` / `silver` / `gold`，支持明暗主题自动切换，`strength`、`borderRadius`、`paused` 可调，`reflectionTargets` 能让邻近元素带上金属反射。\n\n## 适用与限制\n\n落地页主 CTA、定价页按钮这类想突出「贵气」的场合。纯装饰组件，不是通用动画库；需要 React 环境和支持 WebGL 的浏览器。MIT 协议，TypeScript 编写。",
    "links": [
      {
        "label": "Live demo",
        "url": "https://metal.jakubantalik.com/",
        "kind": "official"
      },
      {
        "label": "GitHub 仓库",
        "url": "https://github.com/Jakubantalik/metal-fx",
        "kind": "repository"
      }
    ]
  }
}
---

一个 React 组件，把按钮、徽章、图标包进一圈实时动画的液态金属边框里——类似 Apple 发布会那种金属反光质感。覆盖层是 `pointer-events: none`，子元素照常可点击。

## 原理

- 整页共享一个 WebGL context，所有挂载的 `<MetalFx>` 实例复用同一个
- 单个 `requestAnimationFrame` 循环驱动全部实例，不是每个实例各跑一个
- `IntersectionObserver` 在实例滚出视口时暂停该实例
- SSR 阶段渲染透明占位，hydration 之后才挂载 WebGL 管线

## 运行方式

```
npm install metal-fx
```

```jsx
import { MetalFx } from 'metal-fx';

<MetalFx variant="button">
  <button>Upgrade to Pro</button>
</MetalFx>
```

variant 有 `button` / `circle` 两种，预设 `chromatic` / `silver` / `gold`，支持明暗主题自动切换，`strength`、`borderRadius`、`paused` 可调，`reflectionTargets` 能让邻近元素带上金属反射。

## 适用与限制

落地页主 CTA、定价页按钮这类想突出「贵气」的场合。纯装饰组件，不是通用动画库；需要 React 环境和支持 WebGL 的浏览器。MIT 协议，TypeScript 编写。
