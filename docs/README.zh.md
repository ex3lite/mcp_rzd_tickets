# RZD Tickets MCP

`rzd_tickets` 是一个只读 MCP 服务器，让 AI Agent 可以查看
`ticket.rzd.ru` 上的实时火车票信息：车次、车厢、服务等级、下铺/上铺、
侧铺、无障碍特殊座位、相邻的下铺+上铺组合、价格以及官方购票跳转链接。

它不会登录、预订、锁票、付款、取消订单或修改 RZD 账户。

## 工具

| 工具 | 用途 |
|---|---|
| `rzd_station_suggest` | 根据站名查找 `nodeId` 和 `expressCode`。 |
| `rzd_search_trains` | 查询车次、价格、车厢分组和官方链接。 |
| `rzd_train_cars` | 查看指定车次的车厢和空位。 |
| `rzd_find_places` | 按过滤条件返回匹配结果。 |
| `rzd_checkout_url` | 生成官方 RZD 手动购票链接。 |
| `rzd_parse_search_url` | 解析 RZD 搜索 URL。 |
| `rzd_service_classes` | 解释 `2Ш`、`2К`、`2А`、`3Э` 等服务等级。 |

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
