import json
import os
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from ..tasks.schema import TestResult


class ReportGenerator:
    """Generates JSON and HTML reports from test results."""

    def __init__(self, report_dir: str):
        self.report_dir = Path(report_dir)

    def generate(self, result: TestResult) -> str:
        """Generate both JSON and HTML reports. Returns the HTML path."""
        self.generate_json(result)
        return self.generate_html(result)

    def generate_json(self, result: TestResult) -> str:
        """Serialize TestResult to a JSON file."""
        data = {
            "test_name": result.test_name,
            "passed": result.passed,
            "summary": result.summary,
            "generated_at": datetime.now().isoformat(),
            "steps": [],
        }

        for r in result.step_results:
            step_data = {
                "description": r.step.description,
                "action": r.step.action,
                "target": r.step.target,
                "passed": r.passed,
                "duration_seconds": round(r.duration_seconds, 2),
                "error": r.error,
                "coordinates": list(r.coordinates) if r.coordinates else None,
                "model_response": r.model_response,
                "screenshot_path": r.screenshot_path,
            }
            data["steps"].append(step_data)

        json_path = self.report_dir / "report.json"
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)

        return str(json_path)

    def generate_html(self, result: TestResult) -> str:
        """Render the Jinja2 HTML template with test results."""
        template_dir = Path(__file__).parent / "templates"
        env = Environment(loader=FileSystemLoader(str(template_dir)))
        template = env.get_template("report.html")

        steps = []
        for i, r in enumerate(result.step_results, 1):
            # Make screenshot path relative to report dir for the HTML
            screenshot_rel = None
            if r.screenshot_path:
                screenshot_rel = os.path.relpath(
                    r.screenshot_path, self.report_dir
                )

            steps.append({
                "number": i,
                "description": r.step.description or r.step.action,
                "action": r.step.action,
                "target": r.step.target,
                "passed": r.passed,
                "duration": round(r.duration_seconds, 1),
                "error": r.error,
                "coordinates": r.coordinates,
                "model_response": r.model_response,
                "screenshot": screenshot_rel,
            })

        html = template.render(
            test_name=result.test_name,
            passed=result.passed,
            summary=result.summary,
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            steps=steps,
        )

        html_path = self.report_dir / "report.html"
        with open(html_path, "w") as f:
            f.write(html)

        return str(html_path)
