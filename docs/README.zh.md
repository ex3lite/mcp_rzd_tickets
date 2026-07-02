# RZD Tickets MCP

`rzd_tickets` 是一个只读 MCP 服务器，让 AI Agent 可以查看
`ticket.rzd.ru` 上的实时火车票信息：车次、车厢、服务等级、下铺/上铺、
侧铺、无障碍特殊座位、相邻的下铺+上铺组合、车厢照片、价格以及官方购票跳转链接。

它不会登录、预订、锁票、付款、取消订单或修改 RZD 账户。

## 工具

| 工具 | 用途 |
|---|---|
| `rzd_station_suggest` | 根据站名查找 `nodeId` 和 `expressCode`。 |
| `rzd_search_trains` | 查询车次、价格、车厢分组和官方链接。 |
| `rzd_train_cars` | 查看指定车次的车厢、空位和照片。 |
| `rzd_find_places` | 按过滤条件返回匹配结果和车厢照片。 |
| `rzd_checkout_url` | 生成官方 RZD 手动购票链接。 |
| `rzd_parse_search_url` | 解析 RZD 搜索 URL。 |
| `rzd_service_classes` | 解释开放式 RZD 服务等级代码，不把它们当成固定 enum。 |

## 安装

```bash
git clone git@github.com:ex3lite/mcp_rzd_tickets.git
cd mcp_rzd_tickets
npm install
npm run build
```

## MCP 配置

适用于 Claude Desktop、Cursor、Windsurf、Cline、Roo Code、Continue
以及其他支持 stdio MCP 的客户端：

通过 GitHub 和 `npx` 直接运行：

```json
{
  "mcpServers": {
    "rzd_tickets": {
      "command": "npx",
      "args": ["-y", "--package", "github:ex3lite/mcp_rzd_tickets", "rzd-tickets-mcp"],
      "env": {
        "RZD_TIMEOUT_MS": "20000"
      }
    }
  }
}
```

```json
{
  "mcpServers": {
    "rzd_tickets": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_rzd_tickets/dist/mcp.js"],
      "env": {
        "RZD_TIMEOUT_MS": "20000"
      }
    }
  }
}
```

使用代理：

```json
{
  "mcpServers": {
    "rzd_tickets": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_rzd_tickets/dist/mcp.js"],
      "env": {
        "RZD_PROXY_URL": "socks5://user:pass@host:1080",
        "RZD_TIMEOUT_MS": "20000"
      }
    }
  }
}
```

## 示例 Agent 指令

```text
Search train 376Ы from Красноярск Пасс to Анзеби on 2026-07-12.
I need an adjacent lower+upper pair in a coupe.
Exclude side places and disabled/special places.
Return the official checkout URL if a match exists.
```

## 服务等级

RZD 服务等级代码不是本地固定 enum。服务器会返回原始 `code`、可读
`description`、官方 `transcript` 和谨慎的提示。Agent 应优先展示原始代码和
description；当 transcript 存在时，以 transcript 为准。

## 车厢照片

`rzd_train_cars` 和 `rzd_find_places` 会返回 `imageInfo`。当 RZD 返回
`HasImages=true` 时，`imageInfo.images[].thumbnailUrl` 是缩略图，
`imageInfo.images[].contentUrl` 是完整照片。如果 RZD 没有发布照片，
`images` 为空，原因会写在 `imageInfo.unavailableReason`。
