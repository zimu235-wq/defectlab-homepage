# Defect Lab service hub

The root site is a lightweight service directory for Defect Lab. The Minecraft
dashboard lives under `/minecraft/`, while the medical library remains an
independent authenticated service.

The Minecraft dashboard displays live server status, player counts,
browser-to-server latency, version metadata, and matching modpack downloads
from a read-only public status endpoint.

Service-to-service shortcuts live only on the hub page. The Minecraft page
links back to the hub and exposes the authenticated Minecraft administrator
entry; when an admin session is active, the entry changes to “进入管理台”.

The public API exposes backup health and retention metadata but never exposes
repository credentials, management links, or restore actions. Backup recovery
remains available only through the authenticated local server manager.

Public AstrBot chat is routed through a server-side gateway with message,
rate, concurrency, and global usage limits; its administrative dashboard is
not embedded.
