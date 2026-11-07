"""Stage a subset of the hunks of one file.

`git add -p` is interactive and `git apply --cached` breaks once a file is
touched twice, so this script rebuilds the staged blob directly: it takes the
HEAD content and replays only the selected hunks of the working-tree diff.

Hunk indices come from `--list`. A plain index stages the whole hunk. Adding
`:0,2` after it keeps only those added lines of that hunk, which is how shared
blocks (for example a run of command registrations) get split between commits.

    py scripts/stage-hunks.py src/widget/Widget.tsx --list
    py scripts/stage-hunks.py src/widget/Widget.tsx 0,3,4:0,1
"""

import re
import subprocess
import sys

HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


def run(args, text_input=None):
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        input=text_input,
    )


def head_content(path):
    result = run(["git", "show", f"HEAD:{path}"])
    if result.returncode != 0:
        return None
    return result.stdout


def diff_hunks(path):
    # Diff against HEAD, not the index: staging part of a file changes the
    # index-vs-worktree diff, which would shift every later hunk index.
    result = run(["git", "diff", "HEAD", "-U0", "--no-color", "--", path])
    if result.returncode != 0:
        sys.exit(result.stderr)
    lines = result.stdout.splitlines(keepends=True)

    hunks, current = [], None
    for line in lines:
        match = HUNK.match(line)
        if match:
            current = {
                "header": line,
                "old_start": int(match.group(1)),
                "old_count": int(match.group(2) or 1),
                "body": [],
            }
            hunks.append(current)
            continue
        if current is not None:
            current["body"].append(line)
    return hunks


def parse_spec(parts):
    """Specs are separated by `;` because `,` lists the added lines.

    `3`      -> whole hunk
    `3:0,2`  -> only those added lines, deletions left untouched
    `3:0,2-` -> those added lines plus the hunk's deletions
    """
    selected = {}
    for part in parts.split(";"):
        part = part.strip()
        if not part:
            continue
        if ":" not in part:
            selected[int(part)] = (None, True)
            continue
        index, lines = part.split(":", 1)
        drop = lines.endswith("-")
        if drop:
            lines = lines[:-1]
        selected[int(index)] = ({int(item) for item in lines.split(",") if item}, drop)
    return selected


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    hunks = diff_hunks(path)
    if not hunks:
        sys.exit(f"no unstaged diff for {path}")

    if len(sys.argv) == 3 and sys.argv[2] == "--list":
        for index, hunk in enumerate(hunks):
            print(f"[{index}] {hunk['header'].strip()}")
            added = 0
            for line in hunk["body"][:16]:
                marker = ""
                if line.startswith("+"):
                    marker = f" +{added}"
                    added += 1
                print(f"     {marker:<4}{line.rstrip()[:130]}")
        return

    selected = parse_spec(sys.argv[2])
    base = head_content(path)
    if base is None:
        sys.exit(f"{path} has no HEAD version; use git add")

    text = base.splitlines(keepends=True)
    for index in sorted(selected, reverse=True):
        hunk = hunks[index]
        keep, drop = selected[index]
        body, added = [], 0
        for line in hunk["body"]:
            if line.startswith("\\"):
                continue
            if line.startswith("+"):
                if keep is None or added in keep:
                    body.append(line[1:])
                added += 1
                continue
            if line.startswith("-"):
                # `drop` means the spec asked to apply the deletion, so the old
                # line disappears; otherwise it is kept without the patch marker.
                if drop:
                    continue
                body.append(line[1:])
                continue
            # Context line (only present with -U0 when a hunk needs it).
            body.append(line[1:])
        start = hunk["old_start"] - 1 if hunk["old_count"] else hunk["old_start"]
        end = start + hunk["old_count"]
        text[start:end] = body

    blob = run(["git", "hash-object", "-w", "--path", path, "--stdin"], "".join(text))
    if blob.returncode != 0:
        sys.exit(blob.stderr)
    sha = blob.stdout.strip()

    tracked = run(["git", "ls-files", "-s", "--", path]).stdout.split()
    mode = tracked[0] if tracked else "100644"
    stage = run(["git", "update-index", "--add", "--cacheinfo", f"{mode},{sha},{path}"])
    if stage.returncode != 0:
        sys.exit(stage.stderr)

    # A wrong spec leaves a diff marker inside the file, so fail loudly instead
    # of committing a broken source file.
    leaked = [
        line
        for line in run(["git", "show", f":{path}"]).stdout.splitlines()
        if line[:1] in "+-" and line[1:2] in (" ", "+")
    ]
    if leaked:
        print(f"error: {path} has leaked patch markers: {leaked[0][:80]}")
        sys.exit(1)
    print(f"staged {sorted(selected)} of {path}")


main()
