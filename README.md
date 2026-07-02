<p align="center">
  <img src="./assets/logo.png" alt="RZD Tickets MCP logo" width="140" />
</p>

# RZD Tickets MCP

Read-only MCP-сервер, который дает агентам живые “глаза” на `ticket.rzd.ru`:
поезда, вагоны, цены, нижние/верхние места, боковые места, спецместа, соседние
пары `нижнее+верхнее` и официальные ссылки РЖД для ручного оформления.

Сервер не логинится, не бронирует, не создает холд, не оплачивает, не отменяет
заказы и не меняет личный кабинет РЖД.

## Инструменты

| Инструмент | Что делает |
|---|---|
| `rzd_station_suggest` | Ищет `nodeId` и `expressCode` станции по названию. |
| `rzd_search_trains` | Показывает поезда, цены, группы вагонов и ссылку РЖД. |
| `rzd_train_cars` | Проваливается в `CarPricing`: вагоны, места, статистика верх/низ. |
| `rzd_find_places` | Возвращает только совпадения по фильтрам. |
| `rzd_checkout_url` | Строит официальную ссылку РЖД для ручного оформления. |
| `rzd_parse_search_url` | Разбирает URL поиска РЖД. |
| `rzd_service_classes` | Объясняет, как читать открытые коды классов РЖД. |

## Установка

```bash
git clone git@github.com:ex3lite/mcp_rzd_tickets.git
cd mcp_rzd_tickets
npm install
npm run build
```

Запуск MCP stdio-сервера:

```bash
node dist/mcp.js
```

Быстрая CLI-проверка:

```bash
node dist/cli.js --suggest "Красноярск"
node dist/cli.js --origin 2038000 --destination 2054275 --date 2026-07-12 --train 376Ы --require-pair --car-type coupe
```

## Конфиг MCP-клиента

Один и тот же stdio-конфиг подходит для Claude Desktop, Cursor, Windsurf,
Cline, Roo Code, Continue, Codex-compatible MCP hosts и других клиентов MCP.

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

Локальный checkout:

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

С SOCKS-прокси:

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

## Примеры запросов агенту

```text
Найди поезд 376Ы Красноярск Пасс — Анзеби на 2026-07-12.
Нужна соседняя пара нижнее+верхнее в купе.
Боковые и спецместа не учитывать.
Если есть совпадение, дай ссылку РЖД для оформления.
```

```text
Через rzd_station_suggest найди коды Анзеби и Красноярск.
Потом проверь 2 пассажиров на 2026-07-03 по поезду 097Э.
Ищу пару нижнее+верхнее в одном отсеке.
```

## Фильтры

- `trains`: точные номера поездов, например `["097Э"]`.
- `departureFrom` / `departureTo`: окно отправления `HH:mm`.
- `carType`: `coupe`, `platz` или сырой тип РЖД.
- `service`: сырой код класса РЖД, например `2Ш`; список кодов открыт.
- `placeKind`: `lower`, `upper`, `other`.
- `requirePair`: соседняя пара `нижнее+верхнее` в одном отсеке.
- `includeSide`: учитывать боковые места.
- `includeAccessible`: учитывать спецместа для инвалидов/сопровождающих.
- `maxPrice`, `minPlaces`: цена и минимальное количество мест.

## Классы вагонов РЖД

Класс обслуживания РЖД не моделируется как enum. Это намеренно.

РЖД может добавлять и менять коды, поэтому сервер отдает агенту:

- `code`: сырой код РЖД, например `2Ш`;
- `title`: человекочитаемый заголовок из ответа РЖД, типа вагона или общего семейства;
- `tags`: факты из официального `ServiceClassTranscript` и осторожные подсказки;
- `transcript`: официальный текст РЖД, если он пришел в `CarPricing`;
- `description`: готовая строка для показа человеку.

Агент должен показывать сырой код вместе с `description`, а точный смысл брать
из `transcript`, когда он есть. Так не нужно расширять локальный enum каждый
раз, когда РЖД вводит новый вариант.

## Переменные окружения

| Переменная | Описание |
|---|---|
| `RZD_PROXY_URL` | Опциональный `http://`, `https://`, `socks4://` или `socks5://` прокси. |
| `RZD_TIMEOUT_MS` | Таймаут запроса. По умолчанию `20000`. |

## Языки

- [English](./docs/README.en.md)
- [中文](./docs/README.zh.md)

## Ограничения

RZD может менять приватные web-endpoint без предупреждения. Этот сервер
использует те же read-only pricing endpoint, что и публичный web-app, и
браузероподобные заголовки. Если payload РЖД изменится, ошибка должна быть
видна агенту, а не скрыта.
