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
      "en": "The CLI drops component source into your project; you own and edit it. Works across frameworks.",
      "zh": "CLI 把组件源码分发进项目，代码归你随意改，跨框架可用。"
    },
    "body": "## 它是什么\n\nshadcn/ui 是一个组件库，但安装方式不是往 package.json 加依赖：通过 CLI 把组件源码直接复制进你的项目。一次典型操作是在已配好框架与样式基础的项目里先跑初始化，再按需 add 组件，跑完后组件以可编辑的源文件落在你自己的代码里，而不是依赖目录里打包好的模块。\n\n这跟常见组件库的用法正好相反——后者从 npm 安装，组件进 node_modules，改样式靠覆盖、定制受组件对外 API 限制；shadcn/ui 把源码交给你，哪一行都能直接改，代价是更新得自己手动对比合并。GitHub 官方描述是「一组设计精良、可访问的组件，加上一个代码分发平台」，首页口号是「The Foundation for your Design System」，源码以 MIT 许可开源在 GitHub。\n\n## 怎么运行\n\n在已经配好对应框架与样式基础的项目里初始化，再按需添加组件：\n\n```bash\nnpx shadcn@latest init\nnpx shadcn@latest add button\n```\n\n组件以源文件形式落入项目代码，可以直接编辑；站点同时保留手动复制源码的路径。区块、图表等目录走同一种分发方式。\n\n## 核心机制\n\n- **源码分发**：组件以可编辑源码进入项目，不是打包好的私有依赖，哪一行都能改。\n- **CLI 编排**：按需拉取组件，自动处理样式与依赖注册，避免整包引入。\n- **跨框架**：README 写明「Works with your favorite frameworks」，核心是 React/TypeScript，生态覆盖 Next.js、Vite、Laravel 等。\n- **成熟底座**：样式与可访问性来自 Tailwind、Radix 这类方案，组件自带合理默认值。\n\n## 适合谁\n\n想以组件源码为起点、完全掌控样式与逻辑的团队，适合搭内部后台或产品界面；也适合想把自己的设计系统沉淀成可复制组件代码的人。\n\n## 使用边界\n\nMIT 许可开源，目前没有收费计划。项目要预先配好对应的框架与样式基础，不是开箱即用的整站框架；组件更新需要手动对比合并，没有自动升级通道。",
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

shadcn/ui 是一个组件库，但安装方式不是往 package.json 加依赖：通过 CLI 把组件源码直接复制进你的项目。一次典型操作是在已配好框架与样式基础的项目里先跑初始化，再按需 add 组件，跑完后组件以可编辑的源文件落在你自己的代码里，而不是依赖目录里打包好的模块。

这跟常见组件库的用法正好相反——后者从 npm 安装，组件进 node_modules，改样式靠覆盖、定制受组件对外 API 限制；shadcn/ui 把源码交给你，哪一行都能直接改，代价是更新得自己手动对比合并。GitHub 官方描述是「一组设计精良、可访问的组件，加上一个代码分发平台」，首页口号是「The Foundation for your Design System」，源码以 MIT 许可开源在 GitHub。

## 怎么运行

在已经配好对应框架与样式基础的项目里初始化，再按需添加组件：

```bash
npx shadcn@latest init
npx shadcn@latest add button
```

组件以源文件形式落入项目代码，可以直接编辑；站点同时保留手动复制源码的路径。区块、图表等目录走同一种分发方式。

## 核心机制

- **源码分发**：组件以可编辑源码进入项目，不是打包好的私有依赖，哪一行都能改。
- **CLI 编排**：按需拉取组件，自动处理样式与依赖注册，避免整包引入。
- **跨框架**：README 写明「Works with your favorite frameworks」，核心是 React/TypeScript，生态覆盖 Next.js、Vite、Laravel 等。
- **成熟底座**：样式与可访问性来自 Tailwind、Radix 这类方案，组件自带合理默认值。

## 适合谁

想以组件源码为起点、完全掌控样式与逻辑的团队，适合搭内部后台或产品界面；也适合想把自己的设计系统沉淀成可复制组件代码的人。

## 使用边界

MIT 许可开源，目前没有收费计划。项目要预先配好对应的框架与样式基础，不是开箱即用的整站框架；组件更新需要手动对比合并，没有自动升级通道。
