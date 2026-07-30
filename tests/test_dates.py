from datetime import date
import unittest

from travel_deals.config import DateHorizon
from travel_deals.dates import generate_date_windows


class DateWindowTests(unittest.TestCase):
    def test_generate_date_windows_respects_horizon_and_stay_lengths(self):
        windows = generate_date_windows(
            date(2026, 7, 4),
            DateHorizon(start_months_from_now=3, end_months_from_now=3, step_days=21),
            (2, 6),
        )

        self.assertEqual([window.nights for window in windows], [2, 6])
        self.assertEqual(windows[0].check_in, date(2026, 10, 4))
        self.assertEqual(windows[1].check_out, date(2026, 10, 10))


if __name__ == "__main__":
    unittest.main()
