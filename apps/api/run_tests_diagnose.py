import subprocess

r = subprocess.run(
    [".venv/Scripts/pytest", "-vv", "tests/test_api_integration.py"],
    capture_output=True,
    text=True,
    encoding="utf-8"
)

with open("pytest_diagnose.txt", "w", encoding="utf-8") as f:
    f.write(r.stdout)
    f.write("\n=== STDERR ===\n")
    f.write(r.stderr)

print("Test run diagnostic complete, saved to pytest_diagnose.txt")
