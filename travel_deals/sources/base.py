from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable

from travel_deals.models import CityConfig, DateWindow, Listing


class SourceAdapter(ABC):
    name: str

    @abstractmethod
    def search(self, cities: Iterable[CityConfig], windows: Iterable[DateWindow]) -> list[Listing]:
        raise NotImplementedError
