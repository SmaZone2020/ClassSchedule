"""Sanity-check the index for hunks the stager replayed incorrectly.

`stage-hunks.py` rebuilds a file from HEAD plus selected added lines. A wrong
spec can therefore leave a diff marker (`-import ...`) inside the file. This
walks the staged blobs of the touched source files and fails when a line looks
like a leaked patch marker.
"""

import re
import subprocess
import sys

LEAK = re.compile(r"^[+-](import |export |mod |use |const |let |function |///|// |/\*|  )")
EXTENSIONS = (".ts", ".tsx", ".rs", ".mjs", ".py", ".css")


def run(args, text_input=None):
    return subprocess.run(
        args, capture_output=True, text=True, encoding="utf-8", input=text_input
    )


def staged_files():
    result = run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"])
    return [name for name in result.stdout.splitlines() if name.endswith(EXTENSIONS)]


def main():
    bad = []
    for path in staged_files():
        blob = run(["git", "show", f":{path}"])
        if blob.returncode != 0:
            continue
        for number, line in enumerate(blob.stdout.splitlines(), 1):
            if LEAK.match(line):
                bad.append(f"{path}:{number}: {line[:100]}")
    if bad:
        print("leaked patch markers:")
        for item in bad:
            print("  " + item)
        sys.exit(1)
    print("index clean")


main()
