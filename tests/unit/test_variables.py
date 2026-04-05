"""Tests for wintest.tasks.variables module."""

import pytest

from wintest.tasks.variables import VariableStore
from wintest.tasks.schema import Step


class TestVariableStore:
    def test_set_and_get(self):
        store = VariableStore()
        store.set("foo", "bar")
        assert store.get("foo") == "bar"

    def test_get_missing_returns_none(self):
        store = VariableStore()
        assert store.get("missing") is None

    def test_initial_values(self):
        store = VariableStore({"x": "1", "y": "2"})
        assert store.get("x") == "1"
        assert store.get("y") == "2"

    def test_initial_values_coerced_to_string(self):
        store = VariableStore({"num": 42, "flag": True})
        assert store.get("num") == "42"
        assert store.get("flag") == "True"

    def test_set_overwrites(self):
        store = VariableStore({"x": "old"})
        store.set("x", "new")
        assert store.get("x") == "new"

    def test_all_returns_copy(self):
        store = VariableStore({"a": "1"})
        result = store.all()
        assert result == {"a": "1"}
        result["b"] = "2"
        assert store.get("b") is None


class TestResolveString:
    def test_simple_substitution(self):
        store = VariableStore({"name": "Alice"})
        assert store.resolve_string("Hello {{name}}!") == "Hello Alice!"

    def test_multiple_substitutions(self):
        store = VariableStore({"first": "Hello", "second": "World"})
        assert store.resolve_string("{{first}} {{second}}") == "Hello World"

    def test_undefined_variable_left_as_is(self):
        store = VariableStore()
        assert store.resolve_string("{{missing}}") == "{{missing}}"

    def test_no_placeholders(self):
        store = VariableStore({"x": "1"})
        assert store.resolve_string("no vars here") == "no vars here"

    def test_empty_string(self):
        store = VariableStore()
        assert store.resolve_string("") == ""

    def test_adjacent_placeholders(self):
        store = VariableStore({"a": "X", "b": "Y"})
        assert store.resolve_string("{{a}}{{b}}") == "XY"


class TestResolveStep:
    def _step(self, **kwargs):
        defaults = {"action": "click"}
        defaults.update(kwargs)
        return Step(**defaults)

    def test_resolves_target(self):
        store = VariableStore({"btn": "Submit"})
        step = self._step(target="{{btn}} button")
        resolved = store.resolve_step(step)
        assert resolved.target == "Submit button"

    def test_resolves_text(self):
        store = VariableStore({"msg": "Hello"})
        step = self._step(action="type", text="{{msg}} World")
        resolved = store.resolve_step(step)
        assert resolved.text == "Hello World"

    def test_resolves_description(self):
        store = VariableStore({"what": "login"})
        step = self._step(description="Click the {{what}} button")
        resolved = store.resolve_step(step)
        assert resolved.description == "Click the login button"

    def test_resolves_key(self):
        store = VariableStore({"k": "enter"})
        step = self._step(action="press_key", key="{{k}}")
        resolved = store.resolve_step(step)
        assert resolved.key == "enter"

    def test_resolves_keys_list(self):
        store = VariableStore({"mod": "ctrl"})
        step = self._step(action="hotkey", keys=["{{mod}}", "s"])
        resolved = store.resolve_step(step)
        assert resolved.keys == ["ctrl", "s"]

    def test_resolves_app_path(self):
        store = VariableStore({"app": "notepad.exe"})
        step = self._step(action="launch_application", app_path="{{app}}")
        resolved = store.resolve_step(step)
        assert resolved.app_path == "notepad.exe"

    def test_original_step_unchanged(self):
        store = VariableStore({"x": "resolved"})
        step = self._step(target="{{x}}")
        store.resolve_step(step)
        assert step.target == "{{x}}"

    def test_none_fields_untouched(self):
        store = VariableStore({"x": "1"})
        step = self._step(target=None, text=None)
        resolved = store.resolve_step(step)
        assert resolved.target is None
        assert resolved.text is None

    def test_no_placeholder_fields_untouched(self):
        store = VariableStore({"x": "1"})
        step = self._step(target="plain text")
        resolved = store.resolve_step(step)
        assert resolved.target == "plain text"
