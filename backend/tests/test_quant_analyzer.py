import pytest
from backend.services.quant_analyzer import calculate_metrics, calculate_signal


def test_forward_pe():
    result = calculate_metrics(current_price=334.63, forward_eps=4.47, bps=None, eps_growth_rate=None, target_pe=80)
    assert abs(result["forward_pe"] - 74.86) < 0.1


def test_graham_number():
    result = calculate_metrics(current_price=100, forward_eps=5.0, bps=20.0, eps_growth_rate=None, target_pe=30)
    assert abs(result["fair_value_graham"] - 47.43) < 0.1


def test_graham_none_when_no_bps():
    result = calculate_metrics(current_price=100, forward_eps=5.0, bps=None, eps_growth_rate=None, target_pe=30)
    assert result["fair_value_graham"] is None


def test_fair_value_pe():
    result = calculate_metrics(current_price=100, forward_eps=5.0, bps=None, eps_growth_rate=None, target_pe=30)
    assert result["fair_value_pe"] == 150.0


def test_fair_value_peg():
    result = calculate_metrics(current_price=100, forward_eps=5.0, bps=None, eps_growth_rate=20.0, target_pe=30)
    assert result["fair_value_peg"] == 100.0


def test_signal_buy():
    result = calculate_metrics(current_price=50, forward_eps=5.0, bps=None, eps_growth_rate=None, target_pe=30)
    assert calculate_signal(result, current_price=50) == "buy"


def test_signal_sell():
    result = calculate_metrics(current_price=300, forward_eps=5.0, bps=None, eps_growth_rate=None, target_pe=30)
    assert calculate_signal(result, current_price=300) == "sell"
