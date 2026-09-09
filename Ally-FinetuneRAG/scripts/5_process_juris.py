import json
import re
import hashlib
from pathlib import Path

from datasets import load_dataset


# ============================================================
# CONFIGURATION
# ============================================================

DATASET_NAME = "bettergovph/gov-library"

OUTPUT_DIR = Path("./processed-for-rag")
OUTPUT_FILE = OUTPUT_DIR / "juris_chunks.jsonl"

# For the first test, process only a small number of cases.
# Change this to None later for the full dataset.
MAX_CASES = None



# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clean_text(text):
    """
    Clean unnecessary whitespace while preserving the legal text.
    """
    if not text:
        return ""

    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")

    # Remove excessive spaces
    text = re.sub(r"[ \t]+", " ", text)

    # Remove excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_case_number(content, basename):
    """
    Extract the G.R. number from the beginning of the case.

    Example:
        G.R. No. 17 August 26, 1901

    Returns:
        G.R. No. 17
    """

    match = re.search(
        r"G\.R\.\s*No\.\s*([0-9]+)",
        content,
        re.IGNORECASE
    )

    if match:
        return f"G.R. No. {match.group(1)}"

    # Fallback to filename
    match = re.search(
        r"gr_(\d+)_\d{4}",
        basename,
        re.IGNORECASE
    )

    if match:
        return f"G.R. No. {match.group(1)}"

    return basename


def extract_case_date(content):
    """
    Extract the date following the G.R. number.

    Example:
        G.R. No. 17 August 26, 1901

    Returns:
        August 26, 1901
    """

    match = re.search(
        r"G\.R\.\s*No\.\s*\d+\s+"
        r"([A-Z][a-z]+\s+\d{1,2},\s+\d{4})",
        content,
        re.IGNORECASE
    )

    if match:
        return match.group(1)

    return ""


def extract_case_title(content):
    """
    Extract the case caption from the beginning of the document.

    The Juris documents generally place the parties immediately
    after the G.R. number/date.

    Example:
        DON LUCIANO CORDOBA, plaintiff-appellant, vs.
        WARNER, BARNES & CO., defendants-appellees.
    """

    # Find the G.R. header first
    gr_match = re.search(
        r"G\.R\.\s*No\.\s*\d+.*?\n",
        content,
        re.IGNORECASE
    )

    if not gr_match:
        return ""

    start = gr_match.end()

    # Look at the next few lines
    remaining = content[start:]

    lines = remaining.splitlines()

    candidate_lines = []

    for line in lines[:8]:
        line = line.strip()

        if not line:
            continue

        # Stop if we reach counsel information
        if line.startswith("*") or "for appellant" in line.lower():
            break

        # Ignore court heading leftovers
        if line.upper() in ["EN BANC", "SUPREME COURT", "MANILA"]:
            continue

        candidate_lines.append(line)

        # A case caption normally contains "vs."
        if re.search(r"\bvs\.?\b", line, re.IGNORECASE):
            break

    if not candidate_lines:
        return ""

    title = " ".join(candidate_lines)

    # Clean markdown emphasis
    title = title.replace("**", "")
    title = title.replace("*", "")

    title = re.sub(r"\s+", " ", title)

    return title.strip()


def determine_category(content):
    """
    Basic category classification.

    This is intentionally simple for the first ingestion.
    The existing ALLY retrieval system can still search
    the complete legal text semantically.
    """

    text = content.lower()

    criminal_keywords = [
        "crime",
        "criminal",
        "penal code",
        "accused",
        "murder",
        "homicide",
        "robbery",
        "theft",
        "malversation",
        "estafa",
    ]

    civil_keywords = [
        "contract",
        "damages",
        "property",
        "lease",
        "ownership",
        "debt",
        "civil action",
        "plaintiff",
        "defendant",
    ]

    constitutional_keywords = [
        "constitution",
        "constitutional",
        "bill of rights",
        "due process",
        "equal protection",
    ]

    labor_keywords = [
        "labor",
        "employment",
        "employee",
        "employer",
        "dismissal",
        "wages",
    ]

    family_keywords = [
        "marriage",
        "divorce",
        "custody",
        "support",
        "family",
        "adoption",
    ]

    if any(keyword in text for keyword in constitutional_keywords):
        return "constitutional"

    if any(keyword in text for keyword in labor_keywords):
        return "labor"

    if any(keyword in text for keyword in family_keywords):
        return "family"

    if any(keyword in text for keyword in criminal_keywords):
        return "criminal"

    if any(keyword in text for keyword in civil_keywords):
        return "civil"

    return "jurisprudence"


# ============================================================
# PROCESSOR
# ============================================================

def process_juris():
    print("=" * 70)
    print("JURIS DATASET PROCESSOR")
    print("=" * 70)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("\nLoading Hugging Face dataset in streaming mode...")
    print(f"Dataset: {DATASET_NAME}")

    dataset = load_dataset(
    DATASET_NAME,
    data_files="juris.parquet",
    streaming=True
)

    print("Dataset loaded successfully.")

    processed_count = 0
    skipped_count = 0
    seen_chunk_ids = set()

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as output:

        for record in dataset["train"]:

            basename = record.get("basename", "")

            # ------------------------------------------------
            # Only process actual G.R. case documents
            # ------------------------------------------------

            if not basename.startswith("gr_"):
                skipped_count += 1
                continue

            content = clean_text(
                record.get("content", "")
            )

            if not content:
                skipped_count += 1
                continue

            # ------------------------------------------------
            # Extract metadata
            # ------------------------------------------------

            case_number = extract_case_number(
                content,
                basename
            )

            case_date = extract_case_date(content)

            case_title = extract_case_title(
                content
            )

            year = record.get("year")

            if year:
                try:
                    year = int(float(year))
                except (ValueError, TypeError):
                    year = ""
            else:
                year = ""

            category = "jurisprudence"

            # ------------------------------------------------
            # Create globally unique Juris ID
            # ------------------------------------------------

            case_id = f"juris_{basename}"

            base_chunk_id = f"{case_id}_decision"
            chunk_id = base_chunk_id

            # Handle cases where the same G.R. number/file name
            # appears more than once in the dataset.
            if chunk_id in seen_chunk_ids:
                source_path = record.get("path", "") or basename

                source_hash = hashlib.sha1(
                    source_path.encode("utf-8")
                ).hexdigest()[:8]

                chunk_id = f"{base_chunk_id}_{source_hash}"

            seen_chunk_ids.add(chunk_id)

            # ------------------------------------------------
            # Create ALLY-compatible chunk
            # ------------------------------------------------

            chunk = {
                "chunk_id": chunk_id,

                "case_id": case_id,

                "case_number": case_number,

                "case_title": case_title,

                "chunk_type": "decision",

                "text": (
                    f"Case: {case_title} "
                    f"({case_number})\n\n"
                    f"DECISION:\n"
                    f"{content}"
                ),

                "metadata": {
                    "section": "decision",
                    "category": category,
                    "source_year": str(year),
                    "decision_date": case_date,
                    "source": "juris.ph",
                    "source_path": record.get("path", ""),
                    "juris_id": record.get("id", ""),
                    "priority": "high"
                }
            }

            # ------------------------------------------------
            # Write JSONL
            # ------------------------------------------------

            output.write(
                json.dumps(
                    chunk,
                    ensure_ascii=False
                ) + "\n"
            )

            processed_count += 1

            print(
                f"[{processed_count}] "
                f"{case_number} | "
                f"{case_title}"
            )

            # ------------------------------------------------
            # Stop after test limit
            # ------------------------------------------------

            if (
                MAX_CASES is not None
                and processed_count >= MAX_CASES
            ):
                break

    # ========================================================
    # SUMMARY
    # ========================================================

    print("\n" + "=" * 70)
    print("PROCESSING COMPLETE")
    print("=" * 70)

    print(f"Cases processed : {processed_count}")
    print(f"Records skipped : {skipped_count}")
    print(f"Output file     : {OUTPUT_FILE}")

    if OUTPUT_FILE.exists():
        print(
            f"Output size     : "
            f"{OUTPUT_FILE.stat().st_size:,} bytes"
        )

    print("=" * 70)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    process_juris()
