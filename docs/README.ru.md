# RZD Tickets MCP

Read-only MCP-сервер для агентов, которым нужно видеть наличие билетов на
`ticket.rzd.ru`: поезда, вагоны, классы, нижние/верхние места, боковые места,
спецместа, соседние пары `нижнее+верхнее`, цены и ссылку для ручного перехода
к оформлению.

Сервер не логинится, не бронирует, не создает холд, не оплачивает, не отменяет
заказы и не меняет личный кабинет РЖД.

## Инструменты

| Инструмент | Что делает |
|---|---|
| `rzd_station_suggest` | Ищет `nodeId` и `expressCode` станции по названию. |
| `rzd_search_trains` | Показывает поезда, цены, группы вагонов и ссылку РЖД. |
| `rzd_train_cars` | Проваливается в вагоны и места выбранных поездов. |
| `rzd_find_places` | Возвращает только совпадения по фильтрам. |
| `rzd_checkout_url` | Строит официальную ссылку РЖД для ручного оформления. |
| `rzd_parse_search_url` | Разбирает URL поиска РЖД. |
| `rzd_service_classes` | Расшифровывает классы `2Ш`, `2К`, `2А`, `3Э`. |

## Установка

```bash
git clone git@github.com:ex3lite/mcp_rzd_tickets.git
cd mcp_rzd_tickets
npm install
npm run build
```

## Конфиг MCP-клиента

Один и тот же stdio-конфиг подходит для Claude Desktop, Cursor, Windsurf,
Cline, Roo Code, Continue и других MCP-host:

Прямо из GitHub через `npx`:

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

С прокси:

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

## Пример запроса агенту

```text
Найди поезд 376Ы Красноярск Пасс — Анзеби на 2026-07-12.
Нужна соседняя пара нижнее+верхнее в купе.
Боковые и спецместа не учитывать.
Если есть совпадение, дай ссылку РЖД для оформления.
```

## Фильтры

- `trains`: точные номера поездов, например `["097Э"]`.
- `departureFrom` / `departureTo`: окно отправления `HH:mm`.
- `carType`: `coupe`, `platz` или сырой тип РЖД.
- `service`: класс `2К`, `2А`, `2Ш`, `3Э`.
- `placeKind`: `lower`, `upper`, `other`.
- `requirePair`: соседняя пара `нижнее+верхнее` в одном отсеке.
- `includeSide`: учитывать боковые места.
- `includeAccessible`: учитывать спецместа для инвалидов/сопровождающих.
- `maxPrice`, `minPlaces`: цена и минимальное количество мест.
