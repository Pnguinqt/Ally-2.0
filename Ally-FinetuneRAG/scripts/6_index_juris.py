"""
Index Juris.ph legal cases into the existing Pinecone index.

Usage:
    python scripts/6_index_juris.py --dry-run
    python scripts/6_index_juris.py
    python scripts/6_index_juris.py --batch-size 50
    python scripts/6_index_juris.py --force-restart
"""

from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
import json
import os
import argparse
import time
from tqdm import tqdm
from dotenv import load_dotenv
from typing import List, Dict
import urllib3

# Suppress SSL warnings
urllib3.disable_warnings(
    urllib3.exceptions.InsecureRequestWarning
)

load_dotenv()


# ============================================================
# CONFIGURATION
# ============================================================

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

CHUNKS_FILE = "./processed-for-rag/juris_chunks.jsonl"

CHECKPOINT_FILE = (
    "./processed-for-rag/"
    "juris_pinecone_upload_checkpoint.json"
)

MODEL_NAME = "BAAI/bge-large-en-v1.5"

EMBEDDING_DIMENSION = 1024

NAMESPACE = ""

MAX_METADATA_TEXT_LENGTH = 8000


# ============================================================
# HEADER
# ============================================================

def print_header():
    print("=" * 80)
    print("JURIS.PH → PINECONE INDEXING")
    print("=" * 80)
    print(f"Model: {MODEL_NAME}")
    print(f"Dimensions: {EMBEDDING_DIMENSION}")
    print(f"Index: {PINECONE_INDEX_NAME}")
    print("Namespace: default")
    print("=" * 80)


# ============================================================
# CHECKPOINT
# ============================================================

def load_checkpoint() -> int:

    if not os.path.exists(CHECKPOINT_FILE):
        return 0

    try:
        with open(
            CHECKPOINT_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            data = json.load(f)

            last_index = data.get(
                "last_processed_index",
                0
            )

            if last_index > 0:
                print(
                    f"\nCheckpoint found."
                )
                print(
                    f"Resuming from case "
                    f"{last_index}"
                )

            return last_index

    except Exception as e:

        print(
            f"Warning: Could not load checkpoint: {e}"
        )

        return 0


def save_checkpoint(
    index: int,
    total: int
):

    try:

        with open(
            CHECKPOINT_FILE,
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                {
                    "last_processed_index": index,
                    "total_chunks": total,
                    "timestamp": time.strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )
                },
                f,
                indent=2
            )

    except Exception as e:

        print(
            f"Warning: Could not save checkpoint: {e}"
        )


# ============================================================
# TEXT
# ============================================================

def truncate_text(
    text: str,
    max_length: int = MAX_METADATA_TEXT_LENGTH
) -> str:

    if not text:
        return ""

    if len(text) <= max_length:
        return text

    return text[:max_length - 3] + "..."


# ============================================================
# VECTOR PREPARATION
# ============================================================

def prepare_vector_batch(
    chunks: List[Dict],
    model: SentenceTransformer
) -> List[Dict]:

    vectors = []

    for chunk in chunks:

        try:

            case_title = chunk.get(
                "case_title",
                ""
            )

            text = chunk.get(
                "text",
                ""
            )

            # Same embedding strategy as existing
            # Supreme Court indexing script.
            text_to_embed = (
                f"{case_title} {text}"
            )

            embedding = model.encode(
                text_to_embed,
                normalize_embeddings=True,
                show_progress_bar=False
            ).tolist()

            # ------------------------------------------------
            # IMPORTANT:
            # Use the Juris chunk_id directly.
            #
            # Example:
            # juris_gr_12_1901_decision
            #
            # This prevents collisions with existing
            # Supreme Court vectors.
            # ------------------------------------------------

            vector_id = str(
                chunk.get(
                    "chunk_id",
                    ""
                )
            )

            if not vector_id:

                print(
                    "Warning: Missing chunk_id. "
                    "Skipping record."
                )

                continue

            # ------------------------------------------------
            # Metadata
            # ------------------------------------------------

            source_metadata = chunk.get(
                "metadata",
                {}
            )

            metadata = {

                "case_number": truncate_text(
                    str(
                        chunk.get(
                            "case_number",
                            ""
                        )
                    ),
                    200
                ),

                "case_title": truncate_text(
                    str(
                        case_title
                    ),
                    500
                ),

                "chunk_type": str(
                    chunk.get(
                        "chunk_type",
                        "decision"
                    )
                ),

                "text": truncate_text(
                    text
                ),

                "chunk_id": vector_id,

                "case_id": str(
                    chunk.get(
                        "case_id",
                        ""
                    )
                ),

                # --------------------------------------------
                # Juris-specific metadata
                # --------------------------------------------

                "source": "juris.ph",

                "source_path": str(
                    source_metadata.get(
                        "source_path",
                        ""
                    )
                ),

                "juris_id": str(
                    source_metadata.get(
                        "juris_id",
                        ""
                    )
                ),

                "category": str(
                    source_metadata.get(
                        "category",
                        "jurisprudence"
                    )
                ),

                "source_year": str(
                    source_metadata.get(
                        "source_year",
                        ""
                    )
                ),

                "decision_date": str(
                    source_metadata.get(
                        "decision_date",
                        ""
                    )
                ),

                "section": str(
                    source_metadata.get(
                        "section",
                        "decision"
                    )
                ),

                "priority": str(
                    source_metadata.get(
                        "priority",
                        "high"
                    )
                )
            }

            vectors.append(
                {
                    "id": vector_id,
                    "values": embedding,
                    "metadata": metadata
                }
            )

        except Exception as e:

            print(
                f"Warning: Error preparing vector: {e}"
            )

    return vectors


# ============================================================
# LOAD CHUNKS
# ============================================================

def load_chunks() -> List[Dict]:

    if not os.path.exists(CHUNKS_FILE):

        raise FileNotFoundError(
            f"{CHUNKS_FILE} not found."
        )

    chunks = []

    with open(
        CHUNKS_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        for line in f:

            if line.strip():

                chunks.append(
                    json.loads(line)
                )

    return chunks


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Index Juris.ph cases into Pinecone"
        )
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help=(
            "Number of vectors per batch "
            "(default: 50)"
        )
    )

    parser.add_argument(
        "--force-restart",
        action="store_true",
        help=(
            "Ignore checkpoint and start "
            "from beginning"
        )
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Generate embeddings but do not "
            "upload to Pinecone"
        )
    )

    args = parser.parse_args()

    print_header()


    # ========================================================
    # CHECK ENVIRONMENT
    # ========================================================

    print("\nChecking environment...")

    if not PINECONE_API_KEY:

        print(
            "ERROR: PINECONE_API_KEY not found."
        )

        print(
            "Check your .env file."
        )

        return 1

    if not PINECONE_INDEX_NAME:

        print(
            "ERROR: PINECONE_INDEX_NAME not found."
        )

        return 1

    print("Environment variables OK.")


    # ========================================================
    # LOAD MODEL
    # ========================================================

    print(
        "\nLoading embedding model..."
    )

    print(
        f"Model: {MODEL_NAME}"
    )

    try:

        model = SentenceTransformer(
            MODEL_NAME
        )

        print(
            "Embedding model loaded successfully."
        )

        print(
            f"Dimensions: {EMBEDDING_DIMENSION}"
        )

    except Exception as e:

        print(
            f"ERROR loading model: {e}"
        )

        return 1


    # ========================================================
    # LOAD DATA
    # ========================================================

    print(
        f"\nLoading Juris chunks..."
    )

    print(
        f"File: {CHUNKS_FILE}"
    )

    try:

        chunks = load_chunks()

        print(
            f"Loaded {len(chunks):,} Juris cases."
        )

    except Exception as e:

        print(
            f"ERROR loading chunks: {e}"
        )

        return 1


    if not chunks:

        print(
            "ERROR: No Juris chunks found."
        )

        return 1


    # ========================================================
    # CONNECT PINECONE
    # ========================================================

    print(
        "\nConnecting to Pinecone..."
    )

    try:

        pc = Pinecone(
            api_key=PINECONE_API_KEY,
            pool_threads=4
        )

        print(
            "Connected to Pinecone."
        )

        index = pc.Index(
            PINECONE_INDEX_NAME
        )

        print(
            f"Connected to index: "
            f"{PINECONE_INDEX_NAME}"
        )

    except Exception as e:

        print(
            f"ERROR connecting to Pinecone: {e}"
        )

        return 1


    # ========================================================
    # VERIFY INDEX
    # ========================================================

    print(
        "\nChecking Pinecone index..."
    )

    try:

        stats = index.describe_index_stats()

        print(
            f"Current vectors: "
            f"{stats.total_vector_count:,}"
        )

        print(
            f"Index dimension: "
            f"{stats.dimension}"
        )

        if stats.dimension != EMBEDDING_DIMENSION:

            print(
                "\nERROR:"
            )

            print(
                f"Expected dimension "
                f"{EMBEDDING_DIMENSION}"
            )

            print(
                f"but Pinecone reports "
                f"{stats.dimension}"
            )

            return 1

    except Exception as e:

        print(
            f"ERROR checking index: {e}"
        )

        return 1


    # ========================================================
    # CHECKPOINT
    # ========================================================

    if args.force_restart:

        start_idx = 0

        if os.path.exists(
            CHECKPOINT_FILE
        ):

            os.remove(
                CHECKPOINT_FILE
            )

        print(
            "\nForce restart enabled."
        )

    else:

        start_idx = load_checkpoint()


    if start_idx >= len(chunks):

        print(
            "\nAll Juris cases are already processed."
        )

        return 0


    chunks_to_process = chunks[
        start_idx:
    ]


    # ========================================================
    # STATISTICS
    # ========================================================

    batch_size = args.batch_size

    total_batches = (
        len(chunks_to_process)
        + batch_size
        - 1
    ) // batch_size

    print(
        "\n" + "=" * 80
    )

    print(
        "INDEXING STATISTICS"
    )

    print(
        "=" * 80
    )

    print(
        f"Total Juris cases: "
        f"{len(chunks):,}"
    )

    print(
        f"Already processed: "
        f"{start_idx:,}"
    )

    print(
        f"Remaining: "
        f"{len(chunks_to_process):,}"
    )

    print(
        f"Batch size: "
        f"{batch_size}"
    )

    print(
        f"Total batches: "
        f"{total_batches}"
    )

    print(
        "=" * 80
    )


    # ========================================================
    # DRY RUN
    # ========================================================

    if args.dry_run:

        print(
            "\nDRY RUN MODE"
        )

        print(
            "No vectors will be uploaded."
        )

        print(
            "\nGenerating embeddings for "
            "the first 3 Juris cases..."
        )

        test_chunks = chunks_to_process[
            :3
        ]

        vectors = prepare_vector_batch(
            test_chunks,
            model
        )

        print(
            f"\nSuccessfully prepared "
            f"{len(vectors)} vectors."
        )

        if vectors:

            first = vectors[0]

            print(
                "\nSample vector:"
            )

            print(
                f"ID: {first['id']}"
            )

            print(
                f"Dimension: "
                f"{len(first['values'])}"
            )

            print(
                "Metadata fields:"
            )

            print(
                list(
                    first["metadata"].keys()
                )
            )

            print(
                f"Text metadata length: "
                f"{len(first['metadata']['text'])}"
            )

            print(
                f"Source: "
                f"{first['metadata']['source']}"
            )

            print(
                f"Case: "
                f"{first['metadata']['case_number']}"
            )

        print(
            "\nDRY RUN SUCCESSFUL."
        )

        print(
            "No data was uploaded to Pinecone."
        )

        return 0


    # ========================================================
    # CONFIRMATION
    # ========================================================

    print(
        "\n" + "=" * 80
    )

    print(
        "UPLOAD CONFIRMATION"
    )

    print(
        "=" * 80
    )

    print(
        f"You are about to upload "
        f"{len(chunks_to_process):,} Juris vectors."
    )

    print(
        f"Target index: "
        f"{PINECONE_INDEX_NAME}"
    )

    print(
        "\nIMPORTANT:"
    )

    print(
        "These vectors will be added to "
        "your existing index."
    )

    print(
        "Existing vectors will NOT be deleted."
    )

    print(
        "Juris vectors use IDs beginning with "
        "'juris_'."
    )

    print(
        "=" * 80
    )

    response = input(
        "\nReady to upload? [y/N]: "
    )

    if response.lower() not in [
        "y",
        "yes"
    ]:

        print(
            "Upload cancelled."
        )

        return 0


    # ========================================================
    # UPLOAD
    # ========================================================

    print(
        "\nStarting Juris upload..."
    )

    total_uploaded = 0
    failed_batches = []

    start_time = time.time()

    try:

        pbar = tqdm(
            total=len(chunks_to_process),
            desc="Uploading Juris",
            unit=" cases"
        )

        for i in range(
            0,
            len(chunks_to_process),
            batch_size
        ):

            batch = chunks_to_process[
                i:i + batch_size
            ]

            current_idx = (
                start_idx + i
            )

            batch_num = (
                i // batch_size
            ) + 1

            try:

                vectors = prepare_vector_batch(
                    batch,
                    model
                )

                if not vectors:

                    pbar.write(
                        f"Batch "
                        f"{batch_num}/{total_batches}: "
                        f"No valid vectors."
                    )

                    pbar.update(
                        len(batch)
                    )

                    continue


                # ------------------------------------------------
                # Upload asynchronously
                # ------------------------------------------------

                index.upsert(
                    vectors=vectors,
                    namespace=NAMESPACE,
                    async_req=True
                )

                total_uploaded += len(
                    vectors
                )

                pbar.update(
                    len(batch)
                )


                # ------------------------------------------------
                # Save checkpoint
                # ------------------------------------------------

                save_checkpoint(
                    current_idx + len(batch),
                    len(chunks)
                )


                time.sleep(
                    0.05
                )


            except Exception as e:

                pbar.write(
                    f"\nBatch "
                    f"{batch_num}/{total_batches} "
                    f"failed: {e}"
                )

                failed_batches.append(
                    batch_num
                )

                time.sleep(
                    5
                )

                save_checkpoint(
                    current_idx + len(batch),
                    len(chunks)
                )


        pbar.close()


    except KeyboardInterrupt:

        print(
            "\n\nUpload interrupted."
        )

        print(
            "Progress has been saved."
        )

        print(
            "Run the same command again "
            "to resume."
        )

        return 1


    # ========================================================
    # FINAL STATISTICS
    # ========================================================

    elapsed = (
        time.time()
        - start_time
    )

    print(
        "\n" + "=" * 80
    )

    print(
        "JURIS UPLOAD COMPLETE"
    )

    print(
        "=" * 80
    )

    print(
        f"Vectors uploaded: "
        f"{total_uploaded:,}"
    )

    print(
        f"Time: "
        f"{elapsed / 60:.2f} minutes"
    )

    print(
        f"Failed batches: "
        f"{len(failed_batches)}"
    )


    if failed_batches:

        print(
            "\nFailed batch numbers:"
        )

        print(
            failed_batches
        )

        print(
            "\nCheckpoint preserved."
        )

    else:

        # ----------------------------------------------------
        # Cleanup checkpoint
        # ----------------------------------------------------

        if os.path.exists(
            CHECKPOINT_FILE
        ):

            os.remove(
                CHECKPOINT_FILE
            )

        print(
            "\nCheckpoint cleaned up."
        )


    # ========================================================
    # VERIFY
    # ========================================================

    print(
        "\nVerifying Pinecone index..."
    )

    try:

        time.sleep(3)

        stats = index.describe_index_stats()

        print(
            f"Total vectors now: "
            f"{stats.total_vector_count:,}"
        )

        print(
            f"Dimensions: "
            f"{stats.dimension}"
        )

    except Exception as e:

        print(
            f"Could not retrieve index stats: {e}"
        )


    print(
        "\n" + "=" * 80
    )

    print(
        "NEXT STEP"
    )

    print(
        "=" * 80
    )

    print(
        "Test a Juris-related legal query "
        "after indexing."
    )

    print(
        "=" * 80
    )

    return 0 if not failed_batches else 1


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    try:

        exit_code = main()

        exit(
            exit_code
        )

    except Exception as e:

        print(
            f"\nUnexpected error: {e}"
        )

        import traceback

        traceback.print_exc()

        exit(1)