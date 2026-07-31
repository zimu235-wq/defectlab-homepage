# Defect Lab game server homepage

Public Minecraft server hub for Defect Lab. It displays live server status,
player counts, browser-to-server latency, version metadata, and matching
modpack downloads from a read-only public status endpoint.

The public API exposes backup health and retention metadata but never exposes
repository credentials, management links, or restore actions. Backup recovery
remains available only through the authenticated local server manager.

Public AstrBot chat is routed through a server-side gateway with message,
rate, concurrency, and global usage limits; its administrative dashboard is
not embedded.
