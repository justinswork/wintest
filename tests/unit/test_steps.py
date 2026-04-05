"""Tests for the step registry and individual step validate() functions."""

import pytest

from wintest.steps import registry
from wintest.tasks.schema import Step, TestDefinition
from wintest.tasks.validator import validate_test

EXPECTED_ACTIONS = {
    "click", "double_click", "hotkey", "launch_application",
    "press_key", "right_click", "scroll", "set_variable", "type", "verify", "wait",
}

RUNNER_STEPS = {"launch_application", "set_variable"}


class TestRegistry:
    def test_all_expected_actions_registered(self):
        names = set(registry.action_names())
        assert names == EXPECTED_ACTIONS

    def test_get_known_action(self):
        defn = registry.get("click")
        assert defn is not None
        assert defn.name == "click"

    def test_get_unknown_action(self):
        assert registry.get("nonexistent") is None

    def test_all_definitions_count_matches(self):
        assert len(registry.all_definitions()) == len(registry.action_names())

    def test_definitions_have_required_attributes(self):
        for defn in registry.all_definitions():
            assert defn.name
            assert defn.description
            assert callable(defn.validate)
            assert callable(defn.execute)

    def test_runner_steps(self):
        for defn in registry.all_definitions():
            if defn.name in RUNNER_STEPS:
                assert defn.is_runner_step is True, f"{defn.name} should be a runner step"
            else:
                assert defn.is_runner_step is False, f"{defn.name} should not be a runner step"


class TestClickValidation:
    def test_valid(self):
        assert registry.get("click").validate(Step(action="click", target="OK"), 1) == []

    def test_missing_target(self):
        issues = registry.get("click").validate(Step(action="click"), 1)
        assert len(issues) == 1
        assert "target" in issues[0].lower()


class TestDoubleClickValidation:
    def test_valid(self):
        assert registry.get("double_click").validate(Step(action="double_click", target="icon"), 1) == []

    def test_missing_target(self):
        issues = registry.get("double_click").validate(Step(action="double_click"), 1)
        assert len(issues) == 1


class TestRightClickValidation:
    def test_valid(self):
        assert registry.get("right_click").validate(Step(action="right_click", target="desktop"), 1) == []

    def test_missing_target(self):
        issues = registry.get("right_click").validate(Step(action="right_click"), 1)
        assert len(issues) == 1


class TestVerifyValidation:
    def test_valid(self):
        assert registry.get("verify").validate(Step(action="verify", target="button"), 1) == []

    def test_missing_target(self):
        issues = registry.get("verify").validate(Step(action="verify"), 1)
        assert len(issues) == 1


class TestTypeValidation:
    def test_valid(self):
        assert registry.get("type").validate(Step(action="type", text="hello"), 1) == []

    def test_missing_text(self):
        issues = registry.get("type").validate(Step(action="type"), 1)
        assert len(issues) == 1

    def test_empty_text(self):
        issues = registry.get("type").validate(Step(action="type", text=""), 1)
        assert len(issues) == 1


class TestPressKeyValidation:
    def test_valid(self):
        assert registry.get("press_key").validate(Step(action="press_key", key="enter"), 1) == []

    def test_missing_key(self):
        issues = registry.get("press_key").validate(Step(action="press_key"), 1)
        assert len(issues) == 1


class TestHotkeyValidation:
    def test_valid(self):
        assert registry.get("hotkey").validate(
            Step(action="hotkey", keys=["ctrl", "c"]), 1
        ) == []

    def test_missing_keys(self):
        issues = registry.get("hotkey").validate(Step(action="hotkey"), 1)
        assert len(issues) == 1

    def test_single_key_insufficient(self):
        issues = registry.get("hotkey").validate(
            Step(action="hotkey", keys=["ctrl"]), 1
        )
        assert len(issues) == 1

    def test_empty_keys(self):
        issues = registry.get("hotkey").validate(
            Step(action="hotkey", keys=[]), 1
        )
        assert len(issues) == 1


class TestScrollValidation:
    def test_valid_positive(self):
        assert registry.get("scroll").validate(Step(action="scroll", scroll_amount=3), 1) == []

    def test_valid_negative(self):
        assert registry.get("scroll").validate(Step(action="scroll", scroll_amount=-3), 1) == []

    def test_zero_invalid(self):
        issues = registry.get("scroll").validate(Step(action="scroll", scroll_amount=0), 1)
        assert len(issues) == 1


class TestWaitValidation:
    def test_valid(self):
        assert registry.get("wait").validate(Step(action="wait", wait_seconds=1.0), 1) == []

    def test_zero_invalid(self):
        issues = registry.get("wait").validate(Step(action="wait", wait_seconds=0.0), 1)
        assert len(issues) == 1

    def test_negative_invalid(self):
        issues = registry.get("wait").validate(Step(action="wait", wait_seconds=-1.0), 1)
        assert len(issues) == 1


class TestLaunchApplicationValidation:
    def test_valid(self):
        assert registry.get("launch_application").validate(
            Step(action="launch_application", app_path="notepad.exe"), 1
        ) == []

    def test_missing_app_path(self):
        issues = registry.get("launch_application").validate(
            Step(action="launch_application"), 1
        )
        assert len(issues) == 1


class TestSetVariableValidation:
    def test_valid(self):
        assert registry.get("set_variable").validate(
            Step(action="set_variable", variable_name="x", variable_value="1"), 1
        ) == []

    def test_missing_variable_name(self):
        issues = registry.get("set_variable").validate(
            Step(action="set_variable", variable_value="1"), 1
        )
        assert len(issues) == 1
        assert "variable_name" in issues[0]

    def test_missing_variable_value(self):
        issues = registry.get("set_variable").validate(
            Step(action="set_variable", variable_name="x"), 1
        )
        assert len(issues) == 1
        assert "variable_value" in issues[0]

    def test_missing_both(self):
        issues = registry.get("set_variable").validate(
            Step(action="set_variable"), 1
        )
        assert len(issues) == 2


class TestValidateTest:
    def test_valid_test(self):
        test = TestDefinition(
            name="Valid",
            steps=[Step(action="click", target="OK"), Step(action="type", text="hi")],
        )
        assert validate_test(test) == []

    def test_unknown_action(self):
        test = TestDefinition(name="Bad", steps=[Step(action="fly")])
        issues = validate_test(test)
        assert len(issues) == 1
        assert "unknown step type" in issues[0]

    def test_multiple_issues_accumulated(self):
        test = TestDefinition(
            name="Bad",
            steps=[Step(action="click"), Step(action="type")],  # both missing required fields
        )
        issues = validate_test(test)
        assert len(issues) == 2

    def test_step_numbers_are_1_indexed(self):
        test = TestDefinition(name="Bad", steps=[Step(action="click")])
        issues = validate_test(test)
        assert "Step 1" in issues[0]
