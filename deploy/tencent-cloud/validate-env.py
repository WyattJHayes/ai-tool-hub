#!/usr/bin/env python3

import re
import sys


REQUIRED = (
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DEEPSEEK_API_KEY",
    "DAILY_QUOTA",
)
OPTIONAL = (
    "XDDPAY_APP_ID",
    "XDDPAY_SECRET",
    "XDDPAY_GATEWAY",
    "XDDPAY_NOTIFY_URL",
)
TRACKED = set(REQUIRED + OPTIONAL)
ASSIGNMENT = re.compile(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")


class EnvError(Exception):
    def __init__(self, key, reason):
        super().__init__(reason)
        self.key = key
        self.reason = reason


def parse_quoted(raw, quote):
    value = []
    escaped = False
    for index in range(1, len(raw)):
        character = raw[index]
        if quote == '"' and escaped:
            value.append({"n": "\n", "r": "\r", "t": "\t"}.get(character, character))
            escaped = False
            continue
        if quote == '"' and character == "\\":
            escaped = True
            continue
        if character == quote:
            tail = raw[index + 1 :].strip()
            if tail and not tail.startswith("#"):
                raise ValueError("trailing content")
            return "".join(value)
        value.append(character)
    raise ValueError("unterminated quote")


def parse_value(raw):
    value = raw.strip()
    if not value:
        return "", True
    if value[0] in ("'", '"'):
        quote = value[0]
        return parse_quoted(value, quote), quote != "'"
    value = re.split(r"\s+#", value, maxsplit=1)[0]
    return value.strip(), True


def parse_env(path):
    interpolates = {}
    values = {}
    seen = set()
    with open(path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            match = ASSIGNMENT.fullmatch(line)
            if not match:
                malformed_key = next(
                    (key for key in TRACKED if re.match(rf"^(?:export\s+)?{re.escape(key)}(?:\s|$)", line)),
                    None,
                )
                if malformed_key:
                    raise EnvError(malformed_key, "malformed")
                raise EnvError("file", "malformed")
            key, raw_value = match.groups()
            if key not in TRACKED:
                continue
            if key in seen:
                raise EnvError(key, "duplicate")
            seen.add(key)
            try:
                values[key], interpolates[key] = parse_value(raw_value)
            except ValueError:
                raise EnvError(key, "malformed") from None
    return values, interpolates


def validate(path):
    try:
        values, interpolates = parse_env(path)
        for key in REQUIRED + OPTIONAL:
            if interpolates.get(key, False) and "$" in values.get(key, ""):
                raise EnvError(key, "interpolation_unsupported")
        for key in REQUIRED:
            if key not in values:
                raise EnvError(key, "missing")
            if not values[key].strip():
                raise EnvError(key, "empty")
        if values["DAILY_QUOTA"] != "10":
            raise EnvError("DAILY_QUOTA", "not_exactly_10")
    except (OSError, UnicodeError):
        print("env_file=unreadable", file=sys.stderr)
        return 1
    except EnvError as error:
        print(f"env_{error.key}={error.reason}", file=sys.stderr)
        return 1

    for key in REQUIRED:
        if key == "DAILY_QUOTA":
            print("env_DAILY_QUOTA=present_exact_10")
        else:
            print(f"env_{key}=present")
    for key in OPTIONAL:
        state = "present" if values.get(key, "").strip() else "absent"
        print(f"env_{key}={state}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage=validate-env.py_env-file", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(validate(sys.argv[1]))
