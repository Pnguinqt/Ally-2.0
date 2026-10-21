"""Optional local identity routing catalogue, separate from vector relevance."""
from functools import lru_cache
import json
import os
from pathlib import Path
import retrieval_ranking


@lru_cache(maxsize=4)
def _read(path, modified):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("cases"), list):
        raise ValueError("Invalid identity catalogue")
    if len(data["cases"]) > 100000:
        raise ValueError("Oversized identity catalogue")
    for row in data["cases"]:
        if not isinstance(row, dict) or not all(isinstance(row.get(k), str) for k in
            ("id", "case_number", "case_title", "decision_date")):
            raise ValueError("Invalid catalogue entry")
    return data


def candidates(query, namespace):
    path = Path(os.getenv("RAG_CASE_CATALOG", str(Path(__file__).parent /
                "qa-data/semantic-retrieval-preview/case-catalog.json")))
    if not path.is_file():
        return []
    data = _read(str(path.resolve()), path.stat().st_mtime_ns)
    if data.get("namespace") != namespace or data.get("index") != os.getenv("PINECONE_INDEX_NAME"):
        return []
    return retrieval_ranking.catalog_matches(query, data["cases"])
