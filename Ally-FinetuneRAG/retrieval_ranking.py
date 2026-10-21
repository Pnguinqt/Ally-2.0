"""Pure retrieval ranking and bounded diagnostics; does not verify legal claims."""
import math
import re
from collections import Counter
from functools import lru_cache
from scripts.staging_sources import canonical_case_identity, number_key, date_key, DATE

CONCEPTS = {
    "employment": r"\b(?:employ\w*|worker\w*|staff|workman|workmen)\b",
    "dismissal": r"\b(?:dismiss\w*|terminat\w*|fired|resign\w*)\b",
    "misconduct": r"\b(?:misconduct|misbehav\w*|disciplin\w*)\b",
    "procedure": r"\b(?:due process|notice|hearing|opportunity to explain)\b",
    "illness": r"\b(?:illness|sick\w*|disease|medical|hospital\w*)\b",
    "drugs": r"\b(?:drug\w*|marijuana|shabu|methamphetamine|sachet\w*|chain of custody)\b",
    "sexual_assault": r"\b(?:rape|sexual\w*|sexually|molest\w*)\b",
    "homicide": r"\b(?:murder|homicide|kill\w*|fatal|death)\b",
    "property": r"\b(?:land|property|ownership|title|reconvey\w*)\b",
    "lease": r"\b(?:lease\w*|tenant\w*|landlord|rent\w*|eject\w*|detainer)\b",
    "credit": r"\b(?:loan\w*|borrow\w*|mortgage\w*|foreclos\w*|debt\w*)\b",
    "contract": r"\b(?:contract\w*|agreement\w*|bargain\w*)\b",
    "negligence": r"\b(?:negligen\w*|careless\w*|reckless\w*|quasi.delict)\b",
    "profession": r"\b(?:lawyer\w*|counsel|attorney\w*|disbar\w*|notari\w*)\b",
    "corruption": r"\b(?:graft|corrupt\w*|procurement|bids and awards|public funds)\b",
    "jurisdiction": r"\b(?:jurisdiction|res judicata|certiorari|reconsideration|appeal\w*)\b",
    "marriage": r"\b(?:marri\w*|spouse\w*|husband|wife|matrimonial)\b",
}
BOILERPLATE = frozenset("involved examined established followed find case concerning dispute concern which whether after before".split())


def concepts(text):
    return {name for name, pattern in CONCEPTS.items() if re.search(pattern, text, re.I)}


def identity_fields(metadata):
    return {key: value if isinstance(value, str) else "" for key, value in
            ((key, metadata.get(key)) for key in ("case_number", "case_title", "decision_date"))}


@lru_cache(maxsize=2048)
def requested_docket(query):
    query = re.sub(r"\b(G\s*\.?\s*R)\s*[-:]\s*", r"\1 ", query, flags=re.I)
    return canonical_case_identity(dict(case_number=query, case_title=""))[0]


@lru_cache(maxsize=8192)
def _canonical_fields(number, title, date):
    return canonical_case_identity(dict(case_number=number, case_title=title, decision_date=date))


def canonical_metadata(metadata):
    fields = identity_fields(metadata)
    return _canonical_fields(fields['case_number'], fields['case_title'], fields['decision_date'])


def identity_key(metadata, vector_id=None):
    key = canonical_metadata(metadata)
    return ("case", *key) if all(key) else ("vector", vector_id) if vector_id else None


def exact_docket(query, metadata):
    query = re.sub(r"\b(G\s*\.?\s*R)\s*[-:]\s*", r"\1 ", query, flags=re.I)
    query_number = requested_docket(query)
    if not query_number:
        return False
    metadata = identity_fields(metadata)
    candidate_number = canonical_metadata(metadata)[0]
    if not query_number or not candidate_number:
        return False
    # Full docket sets are normalized by the same helper as strict verification.
    requested = set(query_number.split("+"))
    available = set(candidate_number.split("+"))
    date_match = DATE.search(query) or re.search(r"\b\d{4}-\d{2}-\d{2}\b", query)
    requested_date = date_key(date_match.group()) if date_match else ""
    return requested <= available and (not requested_date or requested_date == date_key(metadata.get("decision_date", "")))


def catalog_matches(query, catalog, limit=20):
    """Resolve explicit dockets or complete captions, never infer a legal match."""
    if requested_docket(query):
        return [row for row in catalog if exact_docket(query, row)][:limit]
    caption = lambda value: re.sub(r'[^\w]+', ' ', str(value).casefold()).strip()
    wanted = caption(query)
    if len(wanted.split()) < 2:
        return []
    return [row for row in catalog if caption(row.get('case_title', '')) == wanted][:limit]


def rank(query, candidates, tokens, fields, metadata_text):
    query_tokens = tokens(query)
    query_concepts = concepts(query)
    rows = [dict(c) if isinstance(c, dict) else c.to_dict() for c in candidates]
    documents = [tokens(" ".join(metadata_text((r.get("metadata") or {}).get(f)) for f in fields)) for r in rows]
    # Duplicate chunks must not influence rarity weights.
    unique_documents, seen = [], set()
    for row, document in zip(rows, documents):
        key = identity_key(row.get("metadata") or {}, row.get("id"))
        if key is None or key not in seen:
            unique_documents.append(document)
            seen.add(key)
    frequencies = Counter(t for document in unique_documents for t in document)
    weights = {t: 1 + math.log((len(unique_documents)+1)/(frequencies[t]+1)) for t in query_tokens}
    result = []
    for position, (row, document) in enumerate(zip(rows, documents), 1):
        semantic = float(row.get("score", 0))
        if not math.isfinite(semantic) or not -1 <= semantic <= 1:
            raise ValueError("Invalid semantic score")
        md = row.get("metadata") or {}
        text = " ".join(metadata_text(md.get(f)) for f in fields)
        matches = query_tokens & document
        coverage = len(matches)/max(1,len(query_tokens))
        matched_concepts = query_concepts & concepts(text)
        concept_coverage = len(matched_concepts)/max(1,len(query_concepts))
        exact = exact_docket(query, md)
        title = tokens(md.get("case_title", ""))
        title_match = bool(title and len(title & query_tokens)/len(title) >= .9 and len(title & query_tokens) >= 2)
        # A short material-name query must be entirely present in the caption,
        # and must not merely be a recognized legal concept.
        party_match = bool(not query_concepts and 1 <= len(query_tokens) <= 5 and
                           query_tokens <= title and any(len(t) >= 4 for t in query_tokens))
        # Preserve the original lexical corroboration policy. A tested 70%
        # semantic/concept blend admitted unsupported matches on held-out data.
        # Source context improves recall without relaxing this acceptance rule.
        weighted = sum(weights[t] for t in sorted(matches))/max(1,sum(weights.values()))
        score = .50*semantic + .15*coverage + .35*weighted + 2*exact + .15*(title_match or party_match)
        result.append(dict(row, candidate_position=position, semantic_score=semantic, rerank_score=score, combined_score=score,
            lexical_coverage=coverage, weighted_lexical_coverage=weighted,
            matched_fields={f: sorted(found) for f in fields
                            if (found := query_tokens & tokens(metadata_text(md.get(f))))},
            matched_keywords=sorted(matches), matched_concepts=sorted(matched_concepts),
            exact_docket=exact, docket_requested=bool(requested_docket(query)), exact_caption=title_match or party_match,
            missing_concepts=bool(query_concepts and not matched_concepts),
            keyword_tiebreak=sum(weights[t] for t in matches)/max(1,sum(weights.values()))))
    return sorted(result, key=lambda r: (-r["rerank_score"], -r["keyword_tiebreak"], -r["semantic_score"], str(r.get("id", ""))))


def select(ranked, cutoff=.52, semantic_floor=.54, limit=3, verified_check=None):
    if not all(math.isfinite(v) and 0 <= v <= 1 for v in (cutoff, semantic_floor)):
        raise ValueError("Invalid relevance threshold")
    selected, trace, seen = [], [], set()
    for row in ranked:
        key = identity_key(row.get("metadata") or {}, row.get("id"))
        verification_passed = verified_check(row.get('metadata') or {}) if verified_check is not None else None
        checks = dict(verification_passed=verification_passed,
            requested_identity_passed=not row.get('docket_requested') or row['exact_docket'],
            semantic_passed=row['semantic_score'] >= semantic_floor or row['exact_docket'],
            concept_passed=not row['missing_concepts'] or row['exact_docket'] or row['exact_caption'],
            combined_passed=row['rerank_score'] >= cutoff,
            duplicate_of_retained=key is not None and key in seen,
            final_limit_reached=len(selected) >= limit)
        if verification_passed is False:
            reason = 'unverified_source_or_disposition'
        elif row.get("docket_requested") and not row["exact_docket"]:
            reason = "requested_docket_or_date_mismatch"
        elif row["semantic_score"] < semantic_floor and not row["exact_docket"]:
            reason = "below_semantic_cutoff"
        elif row["missing_concepts"] and not (row["exact_docket"] or row["exact_caption"]):
            reason = "no_requested_legal_concept_supported"
        elif row["rerank_score"] < cutoff:
            reason = "below_combined_cutoff"
        elif key is not None and key in seen:
            reason = "duplicate_canonical_identity"
        elif len(selected) >= limit:
            reason = "outside_final_limit"
        else:
            reason = "retained"
            selected.append(row)
            if key is not None:
                seen.add(key)
        trace.append(dict(row, decision_reason=reason, filter_checks=checks))
    return selected, trace


def safe_diagnostics(raw, trace):
    """Public case identity and numerical scores only: no vectors/raw metadata."""
    by_position = {r["candidate_position"]: r for r in trace}
    output = []
    for position, original in enumerate(raw[:100], 1):
        original = original if isinstance(original, dict) else original.to_dict()
        row = by_position.get(position, {})
        md = original.get("metadata") or {}
        output.append(dict(raw_rank=position, vector_id=original.get("id"),
            case_id=md.get("case_id"), case_number=md.get("case_number"),
            case_title=md.get("case_title"), decision_date=md.get("decision_date"),
            semantic_score=original.get("score"), rerank_score=row.get("rerank_score"),
            lexical_coverage=row.get('lexical_coverage'),
            weighted_lexical_coverage=row.get('weighted_lexical_coverage'),
            matched_fields=row.get('matched_fields', {}),
            verification_status=md.get('verification_status'),
            filter_checks=row.get('filter_checks', {}),
            final_combined_score=row.get("combined_score"), matched_keywords=row.get("matched_keywords", []),
            matched_concepts=row.get("matched_concepts", []),
            canonical_identity=identity_key(md), exact_docket_boost=2.0 if row.get('exact_docket') else 0.,
            caption_boost=.15 if row.get('exact_caption') else 0., kept=row.get('decision_reason')=='retained',
            reason=row.get("decision_reason", "not_ranked")))
    return output
