from __future__ import annotations

from datetime import date, timedelta

from .config import DateHorizon
from .models import DateWindow


def add_months(value: date, months: int) -> date:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, _days_in_month(year, month))
    return date(year, month, day)


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        return 31
    return (date(year, month + 1, 1) - timedelta(days=1)).day


def generate_date_windows(
    today: date,
    horizon: DateHorizon,
    stay_lengths: tuple[int, ...],
) -> list[DateWindow]:
    start = add_months(today, horizon.start_months_from_now)
    end = add_months(today, horizon.end_months_from_now)
    current = start
    windows: list[DateWindow] = []
    while current <= end:
        for nights in stay_lengths:
            windows.append(DateWindow(current, current + timedelta(days=nights), nights))
        current += timedelta(days=horizon.step_days)
    return windows
