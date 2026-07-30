from __future__ import annotations

import json
from pathlib import Path


class SeenStore:
    def __init__(self, path: Path):
        self.path = path
        self._seen = self._load()

    def _load(self) -> set[str]:
        if not self.path.exists():
            return set()
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return set(data.get("seen_keys", []))

    def is_new(self, key: str) -> bool:
        return key not in self._seen

    def mark_many(self, keys: list[str]) -> None:
        self._seen.update(keys)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"seen_keys": sorted(self._seen)}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
