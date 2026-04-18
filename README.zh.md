# Aerodrome AI Launchpad

基于 Base 链的 AI 模型代币发行平台 MVP，集成 Aerodrome 流动性协议，帮助用户一键完成代币部署与初始流动性注入。

🌐 **线上演示**：[aerodrome-ai-launchpad.vercel.app](https://aerodrome-ai-launchpad-git-main-mxdu-techs-projects.vercel.app/)

🎬 **演示视频**：

[![演示视频](https://img.youtube.com/vi/-3AtUVxy95w/maxresdefault.jpg)](https://www.youtube.com/watch?v=-3AtUVxy95w)

---

## 项目简介

Aerodrome AI Launchpad 是一个面向 AI 模型代币发行的最小可行产品（MVP）。用户只需填写基础参数，即可在 Base Sepolia 测试网上完成以下完整的链上操作流程：

1. 部署标准 ERC20 代币合约
2. 授权路由器使用代币
3. 在 Aerodrome DEX 上创建流动性池并注入初始流动性
4. 展示发行结果（代币地址、Pool 地址、LP Token 余额等）

---

## 技术栈

- **框架**：Next.js 16 + TypeScript
- **样式**：Tailwind CSS
- **链交互**：[viem](https://viem.sh/) + [wagmi](https://wagmi.sh/)
- **钱包连接**：RainbowKit
- **目标链**：Base Sepolia（测试网）
- **DEX 协议**：[Aerodrome Finance](https://aerodrome.finance/)（Velodrome 架构）

---

## 功能模块

### Launch 页面（`/launch`）

- 填写代币名称、符号、初始供应量、初始 ETH 注入量及描述
- 表单验证后一键部署 ERC20 合约
- 自动检测并创建 Aerodrome Pool
- 自动 Approve 并调用 `addLiquidityETH` 注入流动性
- 实时展示每一步执行状态（部署中 / 授权中 / 添加流动性中）
- 显示最终结果：Token 地址、Tx Hash、Pool 地址、LP Token 余额

### Trade 页面（`/trade`）

- 支持三种模式：**Buy**（ETH → Token）、**Sell**（Token → ETH）、**Swap**（Token → Token）
- 实时报价（调用路由器 `getAmountsOut`）
- 价格影响计算（基于 AMM 储备量）
- 滑点设置与最小收到量保护
- 余额不足时友好提示，不直接抛出合约错误

---

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm 或 npm

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 合约地址（Base Sepolia）

部署配置位于 `deployments/baseSepolia.json`：

| 合约 | 地址 |
|------|------|
| Router | `0x65E6dCab69A049eC2c319d59f4e6BF600079fc16` |
| Factory | `0xD6a0348b93F0FF2Ce8314875E40549844BF0d020` |
| WETH | `0x04C41560cf85C8948C39Cc2cB8b3b1069D5aF722` |

---

## 项目结构

```
├── app/
│   ├── launch/          # 代币发行页面
│   └── trade/           # 交易页面
├── components/
│   └── Header.tsx       # 导航栏组件
├── deployments/
│   └── baseSepolia.json # 合约地址配置
├── lib/
│   └── contracts/
│       └── LaunchToken  # ERC20 合约 ABI 与字节码
```

---

## 主要流程说明

### 添加流动性流程

```
验证表单 → 部署 ERC20 → 检查/创建 Pool → Approve Router → addLiquidityETH → 读取 LP 余额
```

Pool 地址通过解析 `createPool` 交易回执的 `logs[0].data` 字段获取（前32字节为 Pool 地址）。

### Swap 流程

```
输入金额 → getAmountsOut 报价 → 检查余额 → Approve → swap
```

- Buy 模式：调用 `swapExactETHForTokens`
- Sell 模式：调用 `swapExactTokensForETH`
- Swap 模式：调用 `swapExactTokensForTokens`（双跳路由经 WETH）

---

## 注意事项

- 本项目仅运行在 **Base Sepolia 测试网**，请确保钱包切换到正确网络
- 添加流动性需要持有足够的测试网 ETH，可从 [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet) 获取
- LP Token 余额读取有约 2 秒延迟，等待链上状态同步后自动更新

---

## License

MIT