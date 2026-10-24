import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'services' / 'duel-referee' / 'src'))

from duel_referee import replay, gain_ki, cut_damage  # noqa: E402

FIXTURES = json.loads((ROOT / 'apps' / 'katana-master' / 'test' / 'fixtures' / 'duels.json').read_text())


class SameResultAsTheBrowserRules(unittest.TestCase):
    def test_every_fixture_replays_to_the_same_hash(self):
        for case in FIXTURES['cases']:
            with self.subTest(case['name']):
                got = replay(case['log'], case['cards'], FIXTURES['catalog'])
                self.assertEqual(got['hash'], case['expect']['hash'])
                self.assertEqual(got['winner'], case['expect']['winner'])
                self.assertEqual(got['rounds'], case['expect']['rounds'])

    def test_a_log_with_the_cuts_taken_out_ends_differently(self):
        # a client that reports a win it didn't play: without player 0's cuts the replay can't reach the same end
        case = FIXTURES['cases'][0]
        log = [[k, m0 & ~8, m1] for k, m0, m1 in case['log']]
        got = replay(log, case['cards'], FIXTURES['catalog'])
        self.assertNotEqual(got['hash'], case['expect']['hash'])
        self.assertNotEqual(got['winner'], 0)


class Rules(unittest.TestCase):
    def test_combo_damage_grows_to_the_fifth_hit(self):
        self.assertEqual([cut_damage(n) for n in range(7)], [100, 125, 156, 195, 244, 244, 244])

    def test_ki_gains_bank_their_fractions(self):
        ki, bank = 0, 0
        for _ in range(10):
            ki, bank = gain_ki(ki, bank)
        self.assertEqual(ki, 100)   # 10 gains x 1.3 Ki, capped at 10 Ki
        self.assertEqual(gain_ki(0, 0), (13, 0))

    def test_nobody_moving_is_three_drawn_rounds(self):
        got = replay([[0, 0, 0]])
        self.assertIsNone(got['winner'])
        self.assertEqual([r['how'] for r in got['rounds']], ['time'] * 3)


if __name__ == '__main__':
    unittest.main()
