import json
from collections import Counter

FILE = "processed-for-rag/juris_chunks.jsonl"

ids = set()
duplicates = []
years = Counter()
total = 0

print("Checking Juris JSONL...")
print("This may take a while because the file is ~1.35 GB.\n")

with open(FILE, "r", encoding="utf-8") as f:
    for line in f:
        if not line.strip():
            continue

        record = json.loads(line)

        total += 1

        chunk_id = record["chunk_id"]

        if chunk_id in ids:
            duplicates.append(chunk_id)
        else:
            ids.add(chunk_id)

        year = record.get("metadata", {}).get("source_year", "")
        years[year] += 1

print("\n" + "=" * 60)
print("JURIS DATA INTEGRITY CHECK")
print("=" * 60)

print(f"Total records : {total}")
print(f"Unique IDs    : {len(ids)}")
print(f"Duplicates    : {len(duplicates)}")

print("\nYear range:")
for year, count in sorted(years.items()):
    print(f"{year}: {count}")

if duplicates:
    print("\nWARNING: Duplicate IDs found!")
    print(duplicates[:10])
else:
    print("\nSUCCESS: No duplicate IDs found.")

print("=" * 60)