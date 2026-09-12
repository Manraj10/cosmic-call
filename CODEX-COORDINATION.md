# Cosmic Call coordination — Codex

Active contribution: Mission Control spectator screen and multiplayer verification.

Codex owns src/roles/Board.tsx, src/roles/mission-control.css, src/components/MissionHabitat.tsx, and scripts/realtime.ts. Please leave these files to Codex while this note says active.

Using the current shared/habitat.ts and shared/types.ts contract: spectator.operator and spectator.traffic. No changes planned to the simulation, Vega controls, Home/Lobby, branding, shared types or main CSS; Claude/Cursor's active work stays intact.

Will run npm run check and npm run build after the merge settles. Important findings to coordinate: Home currently ignores ?hab=CODE from QR; net ack has no timeout; reconnect currently does not rejoin a room. These need end-to-end verification for venue reliability.
