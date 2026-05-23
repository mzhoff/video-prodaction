# Stage 1 Contract Review (Video Action)

## Scope
This document фиксирует модель данных этапа 1 до старта UI-разработки.

## Covered contracts
- `VideoProject`
- `RenderRequest`
- `RenderJob`
- `RenderResult`

Source of truth:
- `packages/api/src/contracts/models.ts`
- `packages/api/src/contracts/validation.ts`
- `packages/api/src/contracts/examples.ts`

## Business-level meaning (simple)
- `VideoProject` хранит проект целиком: версии, сцены, дорожки, ассеты, эффекты и экспортные пресеты.
- `RenderRequest` описывает "что рендерим сейчас" (какую версию и какой экспортный пресет).
- `RenderJob` описывает жизненный цикл фоновой задачи рендера (`queued/running/done/failed`).
- `RenderResult` описывает итог: ссылка на файл, артефакты и ошибки.

## Validation policy
Runtime-валидации добавлены в `packages/api/src/contracts/validation.ts` и проверяют:
- обязательные поля и типы;
- перечисления (статусы, форматы, типы ассетов/треков/эффектов);
- корректность дат и URL;
- связность ссылок внутри версии проекта (scene/track/asset/effect ids);
- обязательный `result` для завершенных и упавших render-job.

## Contract examples and tests
- Позитивные и негативные примеры: `packages/api/src/contracts/examples.ts`
- Авто-проверка: `packages/api/tests/contracts.test.ts`
- Команда: `pnpm --filter @repo/api test`

## Review checklist with business
- [ ] Состав полей `VideoProject` согласован с продуктом
- [ ] Статусы рендера и их смысл согласованы
- [ ] Формат `RenderResult` согласован (какие ссылки и ошибки обязательны)
- [ ] Приоритеты рендера (`low/normal/high`) согласованы

## Current status
- Engineering: ready
- Business review: pending PM confirmation in PR conversation
