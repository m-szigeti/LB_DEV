"""Unicode-safe input/output helpers for CSV and GeoJSON files."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

CSV_READ_ENCODINGS = ("utf-8", "utf-8-sig", "cp1256", "cp1252")
GEOJSON_READ_ENCODINGS = ("utf-8", "utf-8-sig", "cp1256", "cp1252")


def read_csv_flexible(path: Path) -> pd.DataFrame:
    last_error: Exception | None = None
    for encoding in CSV_READ_ENCODINGS:
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError as exc:
            last_error = exc
    if last_error:
        raise last_error
    return pd.read_csv(path)


def write_csv_unicode(df: pd.DataFrame, path: Path, index: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=index, encoding="utf-8-sig")


def read_geojson_flexible(path: Path) -> dict:
    raw = path.read_bytes()
    last_error: Exception | None = None
    for encoding in GEOJSON_READ_ENCODINGS:
        try:
            return json.loads(raw.decode(encoding))
        except UnicodeDecodeError as exc:
            last_error = exc
    if last_error:
        raise last_error
    return json.loads(raw.decode("utf-8", errors="replace"))


def write_geojson_unicode(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False)
