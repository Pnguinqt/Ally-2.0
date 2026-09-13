import os
from dotenv import load_dotenv
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

load_dotenv()

# Configuration
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv(
    "PINECONE_INDEX_NAME",
    "ally-supreme-court-cases"
)

EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5"

print("=" * 80)
print("ALLY — JURIS.PH RETRIEVAL TEST")
print("=" * 80)

# Check environment
if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY not found in .env")

print(f"Index: {PINECONE_INDEX_NAME}")
print(f"Embedding model: {EMBEDDING_MODEL}")

# Load embedding model
print("\nLoading embedding model...")
model = SentenceTransformer(EMBEDDING_MODEL)
print("Embedding model loaded.")
print(f"Dimensions: {model.get_sentence_embedding_dimension()}")

# Connect to Pinecone
print("\nConnecting to Pinecone...")
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

print(f"Connected to index: {PINECONE_INDEX_NAME}")

# Check index
stats = index.describe_index_stats()
print(f"Current vectors: {stats.total_vector_count}")

# Ask a Juris-related question
query = input("\nEnter your legal query: ").strip()

if not query:
    print("No query entered.")
    exit()

print(f"\nQuery: {query}")
print("Generating query embedding...")

query_vector = model.encode(
    [query],
    normalize_embeddings=True
)[0].tolist()

print(f"Query vector dimension: {len(query_vector)}")

# Search
print("\nSearching Pinecone...")

results = index.query(
    vector=query_vector,
    top_k=5,
    include_metadata=True
)

print("\n" + "=" * 80)
print("RETRIEVAL RESULTS")
print("=" * 80)

matches = results.get("matches", [])

if not matches:
    print("No matches found.")
else:
    for i, match in enumerate(matches, 1):
        metadata = match.get("metadata", {})

        print(f"\n[{i}] Score: {match['score']:.4f}")
        print(f"ID: {match['id']}")
        print(f"Case Number: {metadata.get('case_number', 'N/A')}")
        print(f"Case Title: {metadata.get('case_title', 'N/A')}")
        print(f"Category: {metadata.get('category', 'N/A')}")
        print(f"Source: {metadata.get('source_url', 'N/A')}")
        print(f"Section: {metadata.get('section', 'N/A')}")

        text = metadata.get("text", "")
        print(f"Text preview: {text[:500]}...")

print("\n" + "=" * 80)
print("RETRIEVAL TEST COMPLETE")
print("=" * 80)
