---
{
  "id": "shadcn-ui",
  "slug": "shadcn-ui",
  "blockType": "project",
  "title": "shadcn/ui",
  "status": "active",
  "tags": [],
  "sourceUrl": "https://ui.shadcn.com/",
  "payload": {
    "summary": {
      "en": "CLI drops component source into your project; you own and edit it. Open, cross-framework.",
      "zh": "CLI 把组件源码分发进项目，代码归你随便改；跨框架，开源。"
    },
    "body": "## 它是什么\n\nshadcn/ui 通过 CLI 把组件源码直接分发进项目源码，官方自称「代码分发平台」。普通组件库是装进 node_modules 的依赖，它把源码复制进项目目录，改的是你自己的代码，不因上游更新被迫迁移。首页口号是「The Foundation for your Design System」，源码开源在 GitHub，由 shadcn 在 Vercel 维护。\n\n## 怎么运行\n\n在项目目录里先初始化，再按需添加组件，比如 `button`：\n\n```bash\nnpx shadcn@latest init\nnpx shadcn@latest add button\n```\n\n组件以源文件形式落在项目代码里，可以直接编辑；文档也保留了手动复制源码的路径。站点还提供区块、图表等目录和 Create 搭建工具，走同一种分发方式；Vercel 部署只是可选项。\n\n## 核心机制\n\n- **平铺源码分发**，组件以源文件进入项目，不是打包好的私有依赖，哪一行都能改。\n- **CLI 编排**，按需拉取组件，自动处理样式与依赖注册，避免整包引入。\n- **跨框架**，不限于 React 生态。\n- 样式与可访问性来自 **Tailwind、Radix** 这类成熟方案，组件自带合理默认值。\n\n## 适合谁\n\n想以组件源码为起点、完全掌控样式与逻辑的团队，适合搭内部后台或产品界面；也适合想把自己的设计系统沉淀成可复制组件代码的人。\n\n## 使用边界\n\n项目本身要预先配好对应的框架与样式基础，不是开箱即用的整站框架；组件更新需要手动对比合并，没有自动升级通道。仓库在 GitHub 上以 MIT 许可开源，页面与文档部署在 Vercel，未声明任何收费计划。",
    "links": [
      {
        "label": "官网",
        "url": "https://ui.shadcn.com/",
        "kind": "official"
      },
      {
        "label": "文档",
        "url": "https://ui.shadcn.com/docs",
        "kind": "docs"
      },
      {
        "label": "GitHub 仓库",
        "url": "https://github.com/shadcn-ui/ui",
        "kind": "repository"
      }
    ]
  }
}
---

## 它是什么

shadcn/ui 通过 CLI 把组件源码直接分发进项目源码，官方自称「代码分发平台」。普通组件库是装进 node_modules 的依赖，它把源码复制进项目目录，改的是你自己的代码，不因上游更新被迫迁移。首页口号是「The Foundation for your Design System」，源码开源在 GitHub，由 shadcn 在 Vercel 维护。

## 怎么运行

在项目目录里先初始化，再按需添加组件，比如 `button`：

```bash
npx shadcn@latest init
npx shadcn@latest add button
```

组件以源文件形式落在项目代码里，可以直接编辑；文档也保留了手动复制源码的路径。站点还提供区块、图表等目录和 Create 搭建工具，走同一种分发方式；Vercel 部署只是可选项。

## 核心机制

- **平铺源码分发**，组件以源文件进入项目，不是打包好的私有依赖，哪一行都能改。
- **CLI 编排**，按需拉取组件，自动处理样式与依赖注册，避免整包引入。
- **跨框架**，不限于 React 生态。
- 样式与可访问性来自 **Tailwind、Radix** 这类成熟方案，组件自带合理默认值。

## 适合谁

想以组件源码为起点、完全掌控样式与逻辑的团队，适合搭内部后台或产品界面；也适合想把自己的设计系统沉淀成可复制组件代码的人。

## 使用边界

项目本身要预先配好对应的框架与样式基础，不是开箱即用的整站框架；组件更新需要手动对比合并，没有自动升级通道。仓库在 GitHub 上以 MIT 许可开源，页面与文档部署在 Vercel，未声明任何收费计划。
