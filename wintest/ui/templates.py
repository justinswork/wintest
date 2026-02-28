"""Template content for the `wintest init` command."""

TEST_TEMPLATE = """\
# Test definition for wintest (Windows UI Testing)
# Run with: wintest run <this-file>

name: "My Test"

# Application to launch before running steps
# application:
#   path: "notepad.exe"
#   title: "Notepad"
#   wait_after_launch: 3

steps:
  - action: click
    target: "the element to click"
    description: "Click on target element"

  - action: type
    text: "Hello, World!"
    description: "Type some text"

  - action: verify
    target: "text or element to verify"
    description: "Verify expected result"

# Override global settings for this test
# settings:
#   retry_attempts: 3
#   retry_delay: 2
#   fail_fast: true
"""
