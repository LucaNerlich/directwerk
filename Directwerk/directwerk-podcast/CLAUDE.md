# CLAUDE.md

## Commands

```sh
./gradlew :directwerk-podcast:build
./gradlew :directwerk-app:test --tests "*Episode*" --tests "*Series*" --tests "*Format*"
```

Tests for this module live in `directwerk-app` (same pattern as subscription/digital).

## Architecture

Optional podcast vertical slice — series, episodes, formats (Formate), categories, and publication
workflow. Depends on `directwerk-digital` (media attach/promote) and transitively `directwerk-core`.

- `PodcastModule.KEY` (`PODCAST`) — use with `@RequiresModule`; never hardcode the string elsewhere.
- Domain concepts and shipped Phase 3 slices: see **README.md** in this directory.
- Flyway migration `V28__create_podcast_content.sql` is owned by `directwerk-app`.
- HTTP controllers live in `directwerk-app` (`controller.podcast`, `controller.tenant`, `controller.publicapi`).
- Audio validation/promotion goes through `directwerk-digital`'s `EpisodeMediaApi`.
- Scheduled publish is wired by `PodcastQuartzConfig` when the queue/Quartz scheduler is enabled.

Read `README.md` before implementing or changing taxonomy / entitlement behaviour.
