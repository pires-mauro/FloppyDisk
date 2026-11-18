# Running the critical-component tests

The tests use Python's built-in `unittest`. They also need the application's packages (FastAPI and Pydantic v2), plus HTTPX for API testing.

## First-time setup (Windows)

Open a terminal in `FloppyDisk/apps/critical`, then run:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tests/requirements.txt
```

If `.venv` already exists, skip the first command. Repeat the installation command when test dependencies change. Do not commit the `.venv` folder.

## Run the tests

From the same folder:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

To run only the calculation tests:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_scoring.py -v
```

No running server, Docker containers or database is needed.

## Reading the results

- `ok`: the test passed.
- `FAIL`: the code's result did not match the assertion.
- `ERROR`: the test could not complete, for example because a dependency is missing.

The latest run has **25 test methods: 21 pass and 4 contain failures**. Unittest reports 8 failures because several methods contain failing subtests. The agreed range is 0-5 and scores must be floored to two decimals. The application still rounds to nearest, which causes the failures. FR-09 override tests still pass.

The HTTPX deprecation warning does not prevent the current tests from running.

If you see `cannot import name 'model_validator'`, you are using Pydantic v1. Install the test requirements and run with the `.venv` Python command above.

## Without a virtual environment

If you already have a Python environment dedicated to this project, you can use:

```powershell
python -m pip install -r tests/requirements.txt
python -m unittest discover -s tests -v
```

This installs packages into that Python environment and may affect other projects using it. The existing tests cannot run with the standard library alone because they import the real application and its dependencies.


