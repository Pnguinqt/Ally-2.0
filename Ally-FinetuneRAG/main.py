"""
ALLY FastAPI Server - DeepSeek Classification
Run with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Render RAG env vars:
PINECONE_API_KEY=<your-pinecone-api-key>
PINECONE_INDEX_NAME=ally-supreme-court-cases-small-v3
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
DEEPSEEK_API_KEY=<your-deepseek-api-key>
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field
from typing import List, Optional
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
import os
import logging
import math
import secrets
import time
import retrieval_ranking
import retrieval_catalog
import unicodedata
from collections import Counter
from dotenv import load_dotenv
import re
import requests
from pathlib import Path
from urllib.parse import urlsplit

load_dotenv(Path(__file__).with_name(".env"))

app = FastAPI(
    title="ALLY Legal Assistant API",
    description="RAG with DeepSeek Classification",
    version="7.0.0"
)

logger = logging.getLogger("uvicorn.error")

@app.get("/ping")
async def ping():
    """Immediate ping response"""
    return {"ping": "pong"}

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# REQUEST/RESPONSE MODELS
# ==========================================
class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=3, ge=1)
    diagnostics: bool = False

class ValidationRequest(BaseModel):
    query: str

class ValidationResponse(BaseModel):
    is_valid: bool
    rejection_reason: Optional[str] = None
    confidence: Optional[float] = None
    method: str
    details: Optional[dict] = None

class SourceInfo(BaseModel):
    case_number: str
    case_title: str
    chunk_type: str
    score: str
    category: str
    source_url: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    sources: List[SourceInfo]
    confidence: float
    query: str
    warning: Optional[str] = None
    rejected: bool = False
    rejection_stage: Optional[str] = None
    rejection_reason: Optional[str] = None

# ==========================================
# GLOBAL VARIABLES
# ==========================================
embedding_model = None
pinecone_index = None
deepseek_api_key = None
deepseek_base_url = "https://api.deepseek.com"
deepseek_model = "deepseek-v4-flash"

# ==========================================
# DEEPSEEK CLASSIFIER
# ==========================================
def classify_with_deepseek(query: str) -> tuple[bool, str, str, float]:
    """
    Use DeepSeek to classify queries before RAG search.
    
    Returns:
        (is_valid, category, reason, confidence)
    """
    if not deepseek_api_key:
        raise HTTPException(503, "Legal intent classification is temporarily unavailable.")
    
    prompt = f"""You are a classifier for a Philippine legal assistant chatbot named ALLY.

Classify this user query into ONE category:

QUERY: "{query}"

Be warm and encouraging in your responses. Remember:
- If it's legal → help them
- If it's a greeting → be friendly
- If it's off-topic → politely redirect with personality

CATEGORIES:
1. LEGAL - Questions about Philippine law, court cases, legal rights, lawsuits, crimes, contracts, legal procedures
2. GREETING - Simple greetings like "hi", "hello", "how are you", "good morning"
3. META - Questions about the chatbot itself (who are you, what can you do, who created you, what is ALLY)
4. COOKING - Recipes, food preparation, cooking instructions
5. WEATHER - Weather forecasts, temperature, climate
6. ENTERTAINMENT - Movies, music, games (unless about copyright/legal aspects)
7. TECHNOLOGY - Programming, coding, tech troubleshooting (unless about cyber law)
8. MEDICAL - Health symptoms, medical advice (unless about malpractice)
9. OTHER - General knowledge, math, travel, shopping

Accept ordinary-language legal situations, doctrine questions, descriptions of
disputes, questions about laws/procedures, and exact case identities as LEGAL.
No party name, docket, date, statutory citation, formal terminology, or phrase
such as "find a case" is required. For example, a worker describing being fired
without a chance to explain, or a tenant describing being locked out, is LEGAL.
Clearly unrelated questions remain non-LEGAL. A LEGAL classification indicates
only research intent; it does not assert that a matching case exists.

RESPONSE FORMAT (respond ONLY with this):
CATEGORY: [category name]
CONFIDENCE: [0.0-1.0]
REASON: [brief explanation]

Examples:
- "Can I sue my landlord?" → LEGAL
- "I was scammed" → LEGAL (victim needs legal help)
- "Hello" → GREETING
- "What is ALLY?" → META
- "Recipe for adobo" → COOKING
- "What planet is closest to sun?" → OTHER

Your classification:"""

    try:
        response = requests.post(
            f"{deepseek_base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {deepseek_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": deepseek_model,
                "temperature": 0.1,
                "max_tokens": 150,
                "messages": [
                    {
                        "role": "system",
                        "content": "Classify the user's message. Reply only with CATEGORY, CONFIDENCE, and REASON lines.",
                    },
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=30,
        )
        response.raise_for_status()
        
        text = response.json()["choices"][0]["message"]["content"].strip()
        
        # Parse response
        category_match = re.search(r'CATEGORY:\s*(\w+)', text, re.IGNORECASE)
        confidence_match = re.search(r'CONFIDENCE:\s*([\d.]+)', text, re.IGNORECASE)
        reason_match = re.search(r'REASON:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        
        if not category_match or not confidence_match:
            raise ValueError("Incomplete classification")
        category = category_match.group(1).upper()
        confidence = float(confidence_match.group(1))
        if category not in {"LEGAL", "GREETING", "META", "COOKING", "WEATHER", "ENTERTAINMENT", "TECHNOLOGY", "MEDICAL", "OTHER"} or not 0 <= confidence <= 1:
            raise ValueError("Invalid classification")
        reason = reason_match.group(1).strip() if reason_match else "Classification completed"
        
        # Determine if valid
        is_valid = category in ["LEGAL", "GREETING", "META"]
        
        return is_valid, category, reason, confidence
        
    except Exception:
        raise HTTPException(503, "Legal intent classification is temporarily unavailable.") from None


# ==========================================
# STARTUP EVENT
# ==========================================
@app.on_event("startup")
async def startup_event():
    """Initialize models on startup"""
    global embedding_model, pinecone_index, deepseek_api_key, deepseek_base_url, deepseek_model
    
    embedding_model = None
    pinecone_index = None
    index_name = os.getenv("PINECONE_INDEX_NAME", "").strip()
    model_name = os.getenv("EMBEDDING_MODEL", "").strip()
    if not index_name or not os.getenv("PINECONE_API_KEY"):
        raise RuntimeError("RAG configuration requires PINECONE_INDEX_NAME and PINECONE_API_KEY.")
    if model_name != "BAAI/bge-small-en-v1.5":
        raise RuntimeError("EMBEDDING_MODEL must be BAAI/bge-small-en-v1.5 for the 384-dimensional index.")
    try:
        model = SentenceTransformer(model_name)
        if model.get_sentence_embedding_dimension() != 384:
            raise ValueError("embedding dimension")
        pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
        description = pc.describe_index(index_name)
        if description.dimension != 384 or description.metric != "cosine":
            raise ValueError("index dimension or metric")
        index = pc.Index(index_name)
    except Exception:
        raise RuntimeError("RAG startup failed. Check the configured index exists, its dimension is 384 and metric is cosine, credentials, connectivity, and embedding model availability.") from None
    embedding_model, pinecone_index = model, index

    # Initialize DeepSeek for classification.
    print("   Configuring DeepSeek classifier...")
    deepseek_api_key = os.getenv('DEEPSEEK_API_KEY')
    deepseek_base_url = os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
    deepseek_model = os.getenv('DEEPSEEK_MODEL', 'deepseek-v4-flash')

    if deepseek_api_key:
        print(f"   DeepSeek classifier configured: {deepseek_model}")
    else:
        print("   DEEPSEEK_API_KEY not found; classification will report unavailable")
    
    print("ALLY ready.")
    
# ==========================================
# VALIDATION ENDPOINT
# ==========================================
@app.post("/api/validate", response_model=ValidationResponse)
async def validate_question(request: ValidationRequest):
    """
    Validate using DeepSeek
    Fast and accurate classification
    """
    try:
        query = request.query
        
        print(f"\n🔍 Validating (DeepSeek): {query}")
        
        # Classify with DeepSeek
        is_valid, category, reason, confidence = classify_with_deepseek(query)
        
        print(f"   📊 Category: {category}")
        print(f"   📊 Confidence: {confidence:.3f}")
        print(f"   📝 Reason: {reason}")
        
        if not is_valid:
            print(f"   ❌ Rejected by DeepSeek classifier")
            
            # Context-aware rejection messages
            rejection_messages = {
                "COOKING": (
                    "I noticed you're asking about cooking or recipes. "
                    "I specialize in Philippine legal matters, not culinary advice.\n\n"
                    "💡 However, if you have questions about food business permits, "
                    "health regulations, or restaurant legal compliance, I can help with those!"
                ),
                "WEATHER": (
                    "I see you're asking about weather. "
                    "I specialize in Philippine legal matters.\n\n"
                    "💡 If you need legal information about natural disaster laws, "
                    "force majeure in contracts, or weather-related insurance claims, "
                    "I can help with those legal aspects!"
                ),
                "ENTERTAINMENT": (
                    "I noticed you're asking about entertainment. "
                    "I specialize in Philippine legal matters.\n\n"
                    "💡 If you have questions about copyright law, piracy, "
                    "entertainment contracts, or defamation, I can help with those legal topics!"
                ),
                "TECHNOLOGY": (
                    "I see you're asking about technology or programming. "
                    "I specialize in Philippine legal matters.\n\n"
                    "💡 If you need information about the Cybercrime Prevention Act, "
                    "Data Privacy Act, or tech-related legal issues, I can help with those!"
                ),
                "MEDICAL": (
                    "I noticed you're asking about health or medical topics. "
                    "I specialize in Philippine legal matters, not medical advice.\n\n"
                    "💡 If you have questions about medical malpractice, "
                    "patient rights, or healthcare-related legal matters, I can help!"
                ),
                "FINANCE": (
                    "It seems you're asking about business, money, or financial topics. "
                    "I specialize in Philippine legal matters, not investment or financial advice.\n\n"
                    "💡 But if you need help with the legal side—such as loan agreements, debt collection laws, "
                    "business registration, BIR requirements, consumer protection, or corporate compliance—"
                    "I can assist with those legal aspects!"
                ),
                "RELATIONSHIP": (
                    "It looks like you're asking for personal or relationship advice. "
                    "While I specialize in legal information, I can't provide emotional or psychological guidance.\n\n"
                    "💡 However, if your concern involves legal matters such as adultery, VAWC, child custody, "
                    "annulment, or property issues between partners, I can help explain the legal processes."
                ),
                "TRAVEL": (
                    "It seems you're asking about travel plans or tourism. "
                    "I specialize in Philippine legal matters, not general travel advice.\n\n"
                    "💡 If you have questions about immigration rules, visa requirements, airport regulations, "
                    "or travel-related legal issues, I can help explain those!"
                ),
                "SHOPPING": (
                    "It appears you're asking about shopping, product choices, or general consumer topics. "
                    "I specialize in legal matters.\n\n"
                    "💡 But if your situation involves consumer rights, online scam issues, refund disputes, "
                    "warranty laws, or DTI complaints, I can help with the legal side!"
                ),
                "SPORTS": (
                    "It looks like you're asking about sports or fitness. "
                    "I specialize in Philippine legal matters, not athletic guidance.\n\n"
                    "💡 But if the topic involves contracts, liabilities, injuries, or sports-related legal concerns, "
                    "I can guide you legally."
                ),
                "INAPPROPRIATE": (
                    "I noticed inappropriate or aggressive language in your message. "
                    "I'm here to provide helpful and respectful legal information.\n\n"
                    "💡 If you have a legal concern or need help understanding your rights, "
                    "I'm ready to assist."
                ),
                "OTHER": (
                    "Your question doesn't appear to be about law or legal matters. "
                    "I specialize in helping with:\n\n"
                    "• Legal rights and obligations\n"
                    "• Filing lawsuits and complaints\n"
                    "• Court procedures and cases\n"
                    "• Philippine laws and regulations\n"
                    "• Legal remedies and penalties\n\n"
                    "Feel free to ask me anything about legal matters!"
                )
            }
            
            rejection_msg = rejection_messages.get(category, rejection_messages["OTHER"])
            
            return ValidationResponse(
                is_valid=False,
                rejection_reason=rejection_msg,
                confidence=confidence,
                method="deepseek",
                details={"category": category, "reason": reason}
            )
        
        print(f"   ✅ Passed DeepSeek classifier")
        
        return ValidationResponse(
            is_valid=True,
            rejection_reason=None,
            confidence=confidence,
            method="deepseek",
            details={"category": category, "reason": reason}
        )
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Legal intent classification is temporarily unavailable.") from None


# ==========================================
# SEARCH ENDPOINT
# ==========================================
VALIDATION_WARNING = "ALLY found potentially relevant case records, but the final Supreme Court disposition could not be verified from the currently indexed metadata. The retrieved text may include rulings from lower courts. Please review the official Supreme Court or E-Library decision before relying on the legal outcome."
NO_RESULT_MESSAGE = "No sufficiently relevant case was found in ALLY’s current verified collection. This does not mean that no applicable Supreme Court decision exists. Consider searching the official Supreme Court E-Library or consulting a qualified legal professional."


def clean(value):
    return value.strip() if isinstance(value, str) else ""


def section_name(value):
    return re.sub(r"[\s-]+", "_", clean(value).lower())


def metadata_true(value):
    if isinstance(value, bool):
        return value
    return clean(value).lower() in {"true", "1", "yes"}


def legally_verified(metadata):
    try:
        source = urlsplit(clean(metadata.get("source_url")))
        official = (source.scheme == "https" and source.hostname in
                    {"elibrary.judiciary.gov.ph", "sc.judiciary.gov.ph"}
                    and source.username is None and source.password is None
                    and source.port in (None, 443))
    except ValueError:
        official = False
    court = section_name(metadata.get("court_level"))
    disposition = clean(metadata.get("final_disposition")) or clean(metadata.get("disposition"))
    identity = retrieval_ranking.identity_key(metadata)
    return bool(identity and identity[0] == 'case' and clean(metadata.get('case_title'))
                and official and court in {"supreme_court", "supreme_court_of_the_philippines"}
                and disposition.lower() not in {"", "unknown", "n/a", "null", "none", "ambiguous"}
                and "final_disposition" in {section_name(metadata.get("section")),
                                             section_name(metadata.get("chunk_type"))}
                and metadata_true(metadata.get("disposition_verified"))
                and metadata_true(metadata.get("source_verified"))
                and section_name(metadata.get("verification_status")) == "verified")


def retrieval_response(query, cases, confidence=0.0, **extra):
    verified = bool(cases) and all(c["can_state_final_outcome"] for c in cases)
    return dict(cases=cases, count=len(cases), query=query, rejected=False,
                confidence=confidence,
                legal_validation_status="verified" if verified else "unverified",
                can_state_final_outcome=verified,
                validation_warning=None if verified or not cases else VALIDATION_WARNING,
                message=NO_RESULT_MESSAGE if not cases else "Potentially relevant verified research material. Similarity does not establish legal applicability.",
                **extra)


RERANK_FIELDS = (
    "text", "case_title", "case_number", "disposition_summary",
    "final_disposition", "section", "chunk_type",
    "retrieval_text", "facts_summary", "legal_issues", "doctrines", "laws_cited", "keywords",
)
RERANK_STOPWORDS = frozenset("""
    a an and are as at be because been being but by can could did do does for from had
    has have how i if in into is it its may me my not of on or our shall should
    so some than that the their them there these they this those to under up
    us was we were what when where which who why will with would you your
    about find give please retrieve show tell case cases court courts supreme
    petition petitions petitioner petitioners respondent respondents accused
    prosecution decision decisions ruling rulings philippines philippine people
    versus vs v gr g r no nos number final disposition legal law
    granted denied plaintiff plaintiffs similar
""".split())


def retrieval_tokens(text):
    normalized = unicodedata.normalize("NFKC", clean(text)).casefold()
    return {token for token in re.findall(r"[^\W_]+", normalized)
            if token not in RERANK_STOPWORDS}


def gr_numbers(text, allow_bare=False):
    """Extract full G.R. identifiers, preserving the historical L- prefix.

    Only case_number metadata may use a bare numeric identifier; unrelated
    numbers in the query or decision text must not trigger an exact boost.
    """
    normalized = unicodedata.normalize("NFKC", clean(text)).upper()
    pattern = (r"(?<!\w)G\s*\.?\s*R\s*\.?\s*[-:]?\s*"
               r"(?:NOS?\.?\s*)?((?:L\s*[-–]?\s*)?\d+)(?!\w)")
    identifiers = re.findall(pattern, normalized)
    if allow_bare and re.fullmatch(r"(?:L\s*[-–]?\s*)?\d+", normalized):
        identifiers.append(normalized)
    return {re.sub(r"[^A-Z0-9]", "", identifier) for identifier in identifiers}


def rerank_candidates(query, candidates):
    """Semantic-first ranking; keyword and legal-concept contributions are bounded."""
    return retrieval_ranking.rank(query, candidates, retrieval_tokens, RERANK_FIELDS, metadata_text)


def metadata_text(value):
    return " ".join(clean(v) for v in value) if isinstance(value, list) else clean(value)


def relevant_candidates(query, candidates, cutoff):
    matches, _ = retrieval_ranking.select(rerank_candidates(query, candidates), cutoff, limit=len(candidates))
    return matches


@app.post("/search")
def search_cases(request: SearchRequest):
    if os.getenv("LOCAL_DEV", "").strip().lower() == "true":
        logger.info("RAG /search received: top_k=%d query=%r", request.top_k, request.query[:200])
    else:
        logger.info("RAG /search received: top_k=%d", request.top_k)
    if request.diagnostics:
        raise HTTPException(403, "Diagnostics are not available through this endpoint.")
    return _search_cases(request)


@app.post('/dev/retrieval-diagnostics', include_in_schema=False)
def development_diagnostics(request: SearchRequest, x_ally_diagnostics_key: Optional[str] = Header(default=None)):
    if os.getenv('ALLY_ENV') != 'development':
        raise HTTPException(404, 'Not found')
    configured = os.getenv('RAG_DIAGNOSTICS_TOKEN', '')
    if len(configured) < 24 or not isinstance(x_ally_diagnostics_key, str) or not secrets.compare_digest(configured, x_ally_diagnostics_key):
        raise HTTPException(403, 'Development diagnostics require authorization.')
    return _search_cases(request.model_copy(update={'diagnostics':True}))


def _search_cases(request: SearchRequest):
    if pinecone_index is None or embedding_model is None:
        raise HTTPException(503, "Case retrieval unavailable: RAG is not initialized.")
    is_valid, category, reason, confidence = classify_with_deepseek(request.query)
    if not is_valid:
        response = retrieval_response(request.query, [], confidence)
        response.update(rejected=True, rejection_stage="deepseek_filter", rejection_reason=reason)
        return response
    try:
        search_started = time.perf_counter()
        vector = embedding_model.encode(request.query, normalize_embeddings=True).tolist()
        if len(vector) != 384:
            raise HTTPException(503, "Case retrieval unavailable: query dimension must be 384.")
        result_limit = min(request.top_k, 3)
        configured_pool = int(os.getenv("RAG_CANDIDATE_POOL", "3"))
        candidate_pool = max(result_limit, min(configured_pool, 25))
        pinecone_timeout = max(1.0, min(float(os.getenv("PINECONE_QUERY_TIMEOUT", "20")), 25.0))
        options = dict(
            vector=vector,
            top_k=candidate_pool,
            include_metadata=True,
            timeout=pinecone_timeout,
        )
        namespace = os.getenv("PINECONE_NAMESPACE")
        if namespace:
            options["namespace"] = namespace
        results = pinecone_index.query(**options)
        candidates = list(results.get("matches", []))[:candidate_pool]
        logger.info(
            "RAG Pinecone query completed: candidates=%d elapsed=%.2fs",
            len(candidates),
            time.perf_counter() - search_started,
        )
        raw_candidates = list(candidates)
        identities = retrieval_catalog.candidates(request.query, namespace or "")
        if identities:
            fetched = pinecone_index.fetch(
                ids=[r["id"] for r in identities],
                namespace=namespace or "",
                timeout=pinecone_timeout,
            )
            fetched = fetched.to_dict() if hasattr(fetched, "to_dict") else fetched
            known = {r["id"]: r for r in identities}
            for identifier, row in fetched.get("vectors", {}).items():
                md = row.get("metadata") or {}
                if identifier not in known or retrieval_ranking.identity_key(md) != retrieval_ranking.identity_key(known[identifier]):
                    continue
                values = row.get("values", [])
                if len(values) != 384:
                    raise ValueError("Invalid fetched vector dimension")
                score = sum(float(a)*float(b) for a,b in zip(vector, values))
                candidates.append(dict(id=identifier, metadata=md, score=max(-1.,min(1.,score))))
        cutoff = float(os.getenv("RAG_RERANK_CUTOFF", "0.52"))
        matches, trace = retrieval_ranking.select(rerank_candidates(request.query, candidates),
            cutoff=cutoff, semantic_floor=0.54, limit=min(request.top_k, 3), verified_check=legally_verified)
        cases = []
        for match in matches:
            metadata = match.get("metadata") or {}
            verified = legally_verified(metadata)
            cases.append(dict(
                title=clean(metadata.get("case_title")),
                case_number=clean(metadata.get("case_number")),
                decision_date=clean(metadata.get("decision_date")),
                final_disposition=clean(metadata.get("final_disposition")) or clean(metadata.get("disposition")),
                court_level=clean(metadata.get("court_level")),
                source_provider=clean(metadata.get("source_provider")),
                score=round(match["score"] * 100, 1),
                semantic_score=match["semantic_score"],
                rerank_score=match["rerank_score"],
                content=metadata.get("content") if isinstance(metadata.get("content"), str)
                    else metadata.get("text") if isinstance(metadata.get("text"), str) else "",
                citation=clean(metadata.get("case_number")),
                section=section_name(metadata.get("section")) or section_name(metadata.get("chunk_type")),
                source_url=clean(metadata.get("source_url")),
                relevance_explanation=("The saved record discusses " + ", ".join(match['matched_concepts']) + ", which overlaps this research question. "
                    if match['matched_concepts'] else "The case identity or saved text matches terms in this research question. ")
                    + "Similarity does not establish legal applicability or mean that this decision controls your situation.",
                legal_validation_status="verified" if verified else "unverified",
                can_state_final_outcome=verified,
                validation_warning=None if verified else VALIDATION_WARNING))
        extra = {}
        if request.diagnostics:
            extra["diagnostics"] = dict(
                stage="retrieval", classification_accepted=True,
                index=os.getenv("PINECONE_INDEX_NAME"), namespace=namespace or "",
                model=os.getenv("EMBEDDING_MODEL"), dimension=len(vector),
                semantic_cutoff=0.54, combined_cutoff=cutoff, candidate_pool=candidate_pool,
                raw_candidate_count=len(raw_candidates), identity_candidates_count=len(identities),
                candidates=retrieval_ranking.safe_diagnostics(raw_candidates, trace))
        return retrieval_response(request.query, cases, max((m["score"] for m in matches), default=0.0), **extra)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Case retrieval unavailable. Please try again later.") from None


# ==========================================
# HEALTH CHECK
# ==========================================
@app.get("/health")
async def health_check():
    """Health check"""
    try:
        if not pinecone_index:
            return {
                "status": "unhealthy",
                "error": "Pinecone not initialized"
            }
        
        stats = pinecone_index.describe_index_stats()
        
        return {
            "status": "healthy",
            "vector_db": "pinecone",
            "embedding_model": os.getenv("EMBEDDING_MODEL"),
            "vectors_count": stats.total_vector_count,
            "classifier": "DeepSeek V4 Flash",
            "classification_type": "LLM-based",
            "relevance_threshold": "54%",
            "rerank_cutoff": os.getenv("RAG_RERANK_CUTOFF", "0.52"),
            "index": os.getenv("PINECONE_INDEX_NAME"),
            "namespace": os.getenv("PINECONE_NAMESPACE", ""),
            "embedding_dimension": 384
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": "RAG health check failed"
        }


@app.get("/")
async def root():
    return {
        "message": "ALLY Legal Assistant API",
        "version": "7.0.0",
        "classifier": "DeepSeek V4 Flash",
        "deployment": "Vercel-compatible",
        "features": ["LLM classification", "context-aware", "fast and cheap"]
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("ALLY Legal Assistant API")
    print("Version: 7.0.0 (DeepSeek Classification)")
    print("="*60 + "\n")
    
    port = int(os.environ.get("PORT", 8000))  # default to 8000 if PORT isn't set
    uvicorn.run(app, host="0.0.0.0", port=port)
