import unittest

from primate_market.errors import MarketError
from primate_market.signatures import HALF_N, N, is_low_s, require_low_s, split, twin

LOW = "0x" + "11" * 32 + "%064x" % 12345 + "1b"


class SignaturesTest(unittest.TestCase):
    def test_low_s_passes_and_its_twin_is_refused(self):
        self.assertTrue(is_low_s(LOW))
        require_low_s(LOW)
        high = twin(LOW)
        self.assertEqual(split(high)[1], N - 12345)
        self.assertEqual(split(high)[2], 28)
        self.assertFalse(is_low_s(high))
        with self.assertRaises(MarketError) as e:
            require_low_s(high)
        self.assertEqual(e.exception.code, "bad-signature")

    def test_boundary_is_half_the_order(self):
        self.assertTrue(is_low_s("0x" + "11" * 32 + "%064x" % HALF_N + "00"))
        self.assertFalse(is_low_s("0x" + "11" * 32 + "%064x" % (HALF_N + 1) + "00"))

    def test_malformed_signatures(self):
        for bad in ("0x1234", "0x" + "zz" * 65, "0x" + "00" * 32 + "%064x" % 5 + "1b", "0x" + "11" * 32 + "%064x" % 5 + "05"):
            with self.assertRaises(MarketError):
                split(bad)


if __name__ == "__main__":
    unittest.main()
