"""Official-only, read-only source discovery and conservative identity evidence.

HTTP and lookup failures are cached as well as successes. Remove the cache file
explicitly to retry an unavailable source. No Firebase/Pinecone clients are used.
"""
from datetime import datetime, timezone
from collections import Counter
import base64
from email.utils import parsedate_to_datetime
import hashlib
from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
import re
import time
from types import SimpleNamespace
import unicodedata
from urllib.parse import quote, urlencode, urljoin, urlsplit

HOSTS = {"elibrary.judiciary.gov.ph", "sc.judiciary.gov.ph"}
USER_AGENT = "ALLY-Academic-Verifier/3.0 (Philippine jurisprudence research; read-only)"
REQUEST_HEADERS = {
    "html": {"User-Agent": USER_AGENT, "Accept": "text/html, application/xhtml+xml;q=0.9",
             "Accept-Language": "en-PH,en;q=0.9"},
    "pdf": {"User-Agent": USER_AGENT, "Accept": "application/pdf",
            "Accept-Language": "en-PH,en;q=0.9", "Referer": "https://elibrary.judiciary.gov.ph/"},
    "lookup": {"User-Agent": USER_AGENT, "Accept": "text/html, application/xhtml+xml;q=0.9",
               "Accept-Language": "en-PH,en;q=0.9"},
}
DIAGNOSTIC_FIELDS = ("status", "outcome", "reason", "cache_hit", "http_status", "content_type",
                     "final_url", "retry_after", "classification", "pdf_signature", "attempts")


def diagnostic(response):
    result = {k: response[k] for k in DIAGNOSTIC_FIELDS if k in response}
    result.setdefault("outcome", "ok" if response.get("status") == "ok" else "unknown_failure")
    return result


def retry_after_seconds(value, now=None):
    """RFC delay-seconds or HTTP-date; invalid values do not invent a delay."""
    if not value:
        return 0
    if re.fullmatch(r"\d+", value.strip()):
        return int(value.strip())
    try:
        when = parsedate_to_datetime(value)
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return max(0, (when - (now or datetime.now(timezone.utc))).total_seconds())
    except (ValueError, TypeError, OverflowError):
        return 0


def proposed_pdf_url(record):
    """A bounded filename hypothesis, not a discovered URL or identity evidence.

    A single normalized docket and decision year determine one candidate.
    Never guess aliases, consolidated filename separators or missing years.
    """
    key = number_key(record.get("case_number"))
    supplied_date = record.get("decision_date", "")
    if not supplied_date:
        embedded = DATE.search(record.get("case_number", ""))
        supplied_date = embedded.group() if embedded else ""
    date = date_key(supplied_date)
    year = date[:4] or str(record.get("source_year", ""))
    match = NUMBER.search(record.get("case_number", ""))
    if not match or "+" in key or not re.fullmatch(r"(?:19|20)\d{2}", year):
        return ""
    prefix = re.sub(r"\W", "", match[1].upper())
    if prefix not in {"GR", "AM", "AC"}:
        return ""
    number = re.sub(r"\s+", "", match[2]).replace("\u2013", "-").upper()
    filename = quote(".".join(prefix) + ". No. " + number + ".pdf", safe=".")
    return f"https://elibrary.judiciary.gov.ph/assets/pdf/philrep/{year}/{filename}"


def pdf_bytes(response):
    data = base64.b64decode(response.get("pdf_base64", ""), validate=True)
    if (response.get("content_type", "").split(";", 1)[0].strip().lower() != "application/pdf"
            or not data.startswith(b"%PDF-")
            or hashlib.sha256(data).hexdigest() != response.get("pdf_sha256")):
        raise ValueError("PDF media type, signature or SHA-256 validation failed.")
    return data


def extract_pdf_text(data, parser_version=1):
    # Imported only for PDFs so existing HTML verification remains independent.
    from pypdf import PdfReader
    from pypdf.errors import PyPdfError
    try:
        reader = PdfReader(BytesIO(data), strict=True)
        # pypdf opens public, empty-user-password PDFs automatically. Respect
        # extraction permissions; never supply passwords or override restrictions.
        if reader.is_encrypted and not (reader.user_access_permissions & reader.user_access_permissions.EXTRACT):
            raise ValueError("PDF permissions prohibit text extraction.")
        if len(reader.pages) > 500:
            raise ValueError("Excessive-page PDF requires manual review.")
        if parser_version in {2, 3}:
            from official_pdf import layout_text
            text = layout_text(reader)
        else:
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except PyPdfError as error:
        raise ValueError("PDF parser rejected document.") from error
    if not text.strip() or len(text) > 4_000_000:
        raise ValueError("PDF has no usable text or exceeds extraction limits.")
    return text


def parse_pdf_decision(text, url):
    """Only a bounded decision header is identity; citations are never identity."""
    header = re.split(r"(?im)^\s*(?:SYLLABUS|D\s*E\s*C\s*I\s*S\s*I\s*O\s*N|R\s*E\s*S\s*O\s*L\s*U\s*T\s*I\s*O\s*N)\s*$", text[:6000])[0]
    # PhilRep uses a dated docket line before the all-capital party caption.
    match = re.search(r"(?im)^\s*\[?\s*(?:G\.?\s*R|A\.?\s*[CM])\.?\s+Nos?\.", header)
    docket = ""
    caption = ""
    date = ""
    if match:
        start = match.start()
        tail = header[start:]
        dated = DATE.search(tail)
        if dated and dated.start() < 250:
            docket = tail[:dated.start()].strip(" [],\n")
            date = dated.group()
            caption = tail[dated.end():].strip(" ].\n")
            caption = re.split(r"\n\s*[A-Z][A-Z .,-]+,\s*(?:J\.|C\.J\.)", caption)[0]
            caption = " ".join(caption.split())
            if not re.search(r"\b(?:vs\.?|versus|v\.)\s", caption, re.I):
                caption = ""
    # A PhilRep file can contain the next case's opening pages. Do not treat
    # another decision or a text-order artifact as this case's disposition.
    headers = re.findall(r"(?im)^\s*\[?\s*((?:G\.?\s*R|A\.?\s*[CM])\.?\s+Nos?\.[^\n]+)", text)
    ambiguous = any(number_key(h) != number_key(docket) for h in headers)
    reason = "PDF includes additional decision docket headings; terminal passage cannot be safely assigned to one decision." if ambiguous else ""
    starts = list(re.finditer(r"(?im)^\s*WHEREFORE\b", text))
    if starts and re.search(r"(?:dispositive portion|modified Decision).*?(?:reads|follows)\s*:\s*$",
                            text[max(0, starts[-1].start() - 300):starts[-1].start()], re.I | re.S):
        reason = reason or "PDF terminal passage includes a nested dispositive quotation; manual review required."
    return dict(case_number=docket, case_title=caption, decision_date=date, source_url=url,
                decision_text=text, identity_headings=[header], source_format="pdf",
                disposition_review_reason=reason)


def parse_response(response, parser_version=3):
    if response.get("format") == "pdf":
        text = extract_pdf_text(pdf_bytes(response), parser_version=parser_version)
        if parser_version in {2, 3}:
            if parser_version == 3:
                from official_pdf_v3 import parse
            else:
                from official_pdf import parse
            source = parse(text, response["url"], SimpleNamespace(DATE=DATE, NUMBER=NUMBER, number_key=number_key, date_key=date_key))
            if parser_version == 3:
                from pypdf import PdfReader
                from official_pdf_v3 import remove_caption_superscripts
                source["case_title"] = remove_caption_superscripts(source["case_title"], PdfReader(BytesIO(pdf_bytes(response)), strict=True))
        else:
            source = parse_pdf_decision(text, response["url"])
    else:
        source = parse_decision(response["html"], response["url"])
    source["cache_url"] = response.get("request_url", response["url"])
    return source
DOCKET_ID = r"(?:[A-Z]+\s*[-\u2013]\s*)?\d+(?:[-\u2013][A-Z0-9]+)*(?![\w\u2013-])"
NUMBER = re.compile(r"\b((?:G\s*\.?\s*R|A\s*\.?\s*C|A\s*\.?\s*M|OCA\s+IPI)\s*\.?)\s*(?:Nos?\.?\s*)?(" + DOCKET_ID + r")", re.I)
DATE = re.compile(r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}\b", re.I)


def number_key(value):
    """Canonical complete docket set; dates and explicit former aliases are metadata."""
    if not isinstance(value, str):
        return ""
    value = DATE.sub("", unicodedata.normalize("NFKC", value))
    value = re.sub(r"[\[(]\s*formerly\b[^)\]]*[)\]]", "", value, flags=re.I)
    keys = []
    for match in NUMBER.finditer(value):
        prefix = re.sub(r"\W", "", match[1].upper())
        keys.append(prefix + re.sub(r"\W", "", match[2].upper()))
        tail = value[match.end():]
        while True:
            more = re.match(r"\s*(?:,\s*(?:and\s+)?|&\s*|and\s+)(" + DOCKET_ID + r")", tail, re.I)
            if not more:
                break
            keys.append(prefix + re.sub(r"\W", "", more[1].upper()))
            tail = tail[more.end():]
    return "+".join(sorted(set(keys)))


def caption_tokens(value):
    value = value or ""
    # Repair only reversible UTF-8 sequences misread as Latin-1, not arbitrary names.
    def repair(match):
        try:
            return match.group().encode("latin-1").decode("utf-8")
        except (UnicodeError, ValueError):
            return match.group()
    value = re.sub(r"[\u00c2\u00c3][\u0080-\u00bf]", repair, value)
    value = value.replace("\u00ad", "")
    value = "".join(c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c)).casefold()
    value = re.sub(r"[\[(]\s*formerly\b[^)\]]*[)\]]", " ", value, flags=re.I)
    value = DATE.sub(" ", value)
    value = re.sub(r"\[(?:\d+|[*\u2020]+)\]|[*\u2020]", " ", value)
    value = NUMBER.sub(" ", value)
    # Preserve an explicit party boundary when the caption omits 'vs.' after
    # its petitioner role label. Names on both sides must still agree in order.
    value = re.sub(r"\b(petitioners?|complainants?)\s*,(?!\s*(?:vs?\b|versus\b))\s*", r"\1, v ", value)
    value = re.sub(r'(?<!\w)(?:alias|a\.\s*k\.\s*a\.|@)\s*["\u201c][^"\u201d]*["\u201d]', '', value)
    value = re.sub(r"\b(?:versus|vs)\.?", "v", value)
    value = value.replace("v.", "v ")
    value = re.sub(r"\b(?:petitioner|respondent|complainant|plaintiff|accused|appellant|appellee)s?\b", " ", value)
    # Remove descriptions only; retain the deceased party and every named heir.
    value = re.sub(r"\bdeceased\b|\bsubstituted by (?:his|her|their) heirs(?:,?\s*namely)?", " ", value)
    value = re.sub(r"\b[a-z]\.(?=\s|$)", " ", value)
    # Apostrophes and hyphens are punctuation within names, not new parties.
    value = re.sub(r"\s*-\s*", "", value)
    value = re.sub(r"['\u2019]", "", value)
    return re.findall(r"[^\W_]+", value)


def title_key(value):
    return " ".join(caption_tokens(value))


def docket_key(record):
    # Consolidated captions can carry the second explicit docket heading.
    return number_key(record.get("case_number", "") + " " + record.get("case_title", ""))


def canonical_case_identity(record):
    """Complete normalized docket set plus the independently verified ruling date.

    A later resolution can share a docket and parties with an earlier decision.
    Same-docket, same-date records still collide regardless of their IDs or URLs.
    """
    text = record.get("case_number", "") + " " + record.get("case_title", "")
    def expand(match):
        first, end = match[1], match[2]
        last = int(first[:len(first) - len(end)] + end) if len(end) < len(first) else int(end)
        return ", ".join(str(i) for i in range(int(first), last + 1)) if 0 <= last - int(first) < 100 else match.group()
    text = re.sub(r"(?<![\w-])(\d{5,7})[-\u2013](\d{1,7})(?![\w-])", expand, text)
    return number_key(text), date_key(record.get("decision_date", ""))


def date_key(value):
    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(" ".join(value.split()), fmt).date().isoformat()
        except (ValueError, AttributeError):
            pass
    return ""


def identity(candidate, source):
    title_normalize = title_key
    if max(candidate.get("parser_version", 0), source.get("parser_version", 0)) >= 3:
        from official_pdf_v3 import caption_key
        title_normalize = lambda value: caption_key(value, title_key)
    checks = {"case_number": bool(docket_key(candidate)) and
              docket_key(candidate) == docket_key(source),
              "case_title": bool(title_normalize(candidate.get("case_title"))) and
              title_normalize(candidate.get("case_title")) == title_normalize(source.get("case_title")),
              "decision_date": bool(date_key(candidate.get("decision_date"))) and
              date_key(candidate.get("decision_date")) == date_key(source.get("decision_date"))}
    failed = [k for k, value in checks.items() if not value]
    fields = {}
    for field, normalize in (("case_number", number_key), ("decision_date", date_key), ("case_title", title_normalize)):
        expected, extracted = candidate.get(field, ""), source.get(field, "")
        fields[field] = dict(expected=str(expected)[:2400], extracted=str(extracted)[:2400],
                             expected_normalized=normalize(expected), extracted_normalized=normalize(extracted),
                             matched=checks[field], reason="match" if checks[field] else
                             "missing or unparseable expected field" if not normalize(expected) else
                             "missing or unparseable extracted field" if not normalize(extracted) else "material values differ")
    fields["case_number"].update(expected_normalized=docket_key(candidate), extracted_normalized=docket_key(source))
    fields["case_title"].update(token_match=checks["case_title"],
                               expected_tokens=title_normalize(candidate.get("case_title", "")).split()[:250],
                               extracted_tokens=title_normalize(source.get("case_title", "")).split()[:250])
    return {"matched": not failed, "checks": checks, "fields": fields,
            "reason": "Number, title and date match." if not failed else "; ".join(
                k + ": " + fields[k]["reason"] for k in failed)}


def official_url(value):
    if not isinstance(value, str) or "\\" in value or any(c.isspace() or ord(c) < 32 for c in value):
        return False
    try:
        url = urlsplit(value)
        return (url.scheme == "https" and url.hostname in HOSTS and url.username is None
                and url.password is None and url.port in (None, 443) and bool(url.path))
    except ValueError:
        return False


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.headings, self.links = [], [], []
        self.heading = None
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1
        if self.hidden:
            return
        if tag in {"p", "div", "br", "h1", "h2", "h3", "h4", "title", "li"}:
            self.parts.append("\n")
        if tag in {"h1", "h2", "h3", "h4", "title"}:
            self.heading = []
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)
        if tag in {"h1", "h2", "h3", "h4", "title"} and self.heading is not None:
            self.headings.append(" ".join("".join(self.heading).split()))
            self.heading = None
        if tag in {"p", "div", "h1", "h2", "h3", "h4"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)
            if self.heading is not None:
                self.heading.append(data)

    @property
    def text(self):
        return "\n".join(line.strip() for line in "".join(self.parts).splitlines() if line.strip())


def parse_decision(html, url):
    page = Page()
    page.feed(html)
    # Use explicit headings only; docket citations deep in the body are not identity.
    headings = page.headings
    # Prefer the dated docket heading, never the document's browser title.
    docket = next((h for h in headings if NUMBER.match(h.lstrip("[ ")) and DATE.search(h)
                   and "Supreme Court E-Library" not in h and not re.search(r"\bvs\.", h, re.I)), "")
    date = DATE.search(docket).group() if DATE.search(docket) else ""
    following = headings[headings.index(docket) + 1:] if docket else []
    caption = next((h for h in following if re.search(r"\b(?:vs\.?|versus|v\.)\s|^\(?RE\s*:", h, re.I)), "")
    caption = re.split(r"D\s*E\s*C\s*I\s*S\s*I\s*O\s*N\b|R\s*E\s*S\s*O\s*L\s*U\s*T\s*I\s*O\s*N\b", caption, flags=re.I)[0].strip()
    docket = DATE.sub("", docket).strip(" [],")
    extra = [m.group() for m in NUMBER.finditer(caption)]
    return dict(case_number="; ".join([docket] + extra) if docket else "",
                case_title=caption, decision_date=date, source_url=url, decision_text=page.text,
                identity_headings=headings)



class OfficialClient:
    def __init__(self, cache_dir, session=None, sleep=time.sleep, clock=time.monotonic, interval=1.0, allow_live=True):
        if session is None:
            import requests
            session = requests.Session()
        self.session, self.sleep, self.clock = session, sleep, clock
        self.interval, self.last = max(1.0, interval), None
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.allow_live = allow_live
        self.counts = Counter()
        self.last_discovery = {}
        self.lookup_forbidden = None

    def observed(self, result, cache_hit=False):
        result = dict(result, cache_hit=cache_hit)
        result.setdefault("outcome", {"ok": "ok", "blocked": "blocked_response", "unavailable": "unknown_failure"}.get(result["status"], result["status"]))
        if cache_hit:
            self.counts["cache_hit"] += 1
        if result["outcome"] not in {"ok", "not_cached"}:
            self.counts[result["outcome"]] += 1
        return result

    def get(self, url, *, max_attempts=3, max_redirects=4):
        if not official_url(url):
            return self.observed({"status": "blocked", "reason": "URL is outside the official HTTPS allowlist."})
        path = self.cache_dir / (hashlib.sha256(url.encode()).hexdigest() + ".json")
        if path.exists():
            return self.observed(json.loads(path.read_text(encoding="utf-8")), cache_hit=True)
        if not self.allow_live:
            return self.observed({"status": "not_cached", "reason": "No cached response; live lookup disabled."})
        current, history = url, []
        retry = 0
        result = {"status": "unavailable", "outcome": "http_failure", "reason": "Official request failed."}
        for request_number in range(max_attempts + 5):
            if self.last is not None:
                self.sleep(max(0, self.interval - (self.clock() - self.last)))
            self.last = self.clock()
            kind = "pdf" if urlsplit(current).path.lower().endswith(".pdf") else "lookup" if urlsplit(current).query else "html"
            response = None
            delay = None
            meta = dict(http_status=None, content_type="", final_url=current,
                        retry_after="", pdf_signature=False)
            try:
                response = self.session.get(current, timeout=(5, 30), allow_redirects=False,
                                            stream=True, verify=True, headers=dict(REQUEST_HEADERS[kind]))
                status = response.status_code
                content_type = response.headers.get("Content-Type", "")[:200]
                retry_after = response.headers.get("Retry-After", "")[:200]
                final_url = response.url if isinstance(response.url, str) else current
                meta = dict(http_status=status, content_type=content_type, final_url=final_url,
                            retry_after=retry_after, pdf_signature=False)
                if not official_url(final_url):
                    result = dict(meta, status="blocked", outcome="blocked_response",
                                  classification="untrusted_final_url", reason="Final URL is outside the official HTTPS allowlist.")
                    break
                if status in {301, 302, 303, 307, 308}:
                    target = urljoin(current, response.headers.get("Location", ""))
                    if not official_url(target) or request_number >= max_redirects:
                        result = dict(meta, status="blocked", outcome="blocked_response", classification="redirect_rejected",
                                      reason="Redirect is outside official HTTPS allowlist or exceeds redirect limit.")
                        break
                    history.append(dict(meta, classification="redirect"))
                    current = target
                    continue
                # Bound all reads, including block pages, and close every response.
                limit = 20_000_000 if kind == "pdf" else 4_000_000
                if status != 200:
                    limit = 16_384
                chunks, size, oversized = [], 0, False
                for chunk in response.iter_content(chunk_size=16_384):
                    if not chunk:
                        continue
                    size += len(chunk)
                    if size > limit:
                        oversized = True
                        break
                    chunks.append(chunk)
                body = b"".join(chunks)
                signature = body.startswith(b"%PDF-")
                meta["pdf_signature"] = signature
                block = bool(re.search(rb"access denied|forbidden|captcha|cf-chl-|challenge-platform|not acceptable", body[:16384], re.I))
                html_body = bool(re.search(rb"<!doctype\s+html|<html|<title", body[:1024], re.I))
                classification = "pdf" if signature else "html_block_page" if block else "html" if html_body else "non_pdf_content"
                meta["classification"] = classification
                if status == 200:
                    media_type = content_type.split(";", 1)[0].strip().lower()
                    if oversized:
                        result = dict(meta, status="unsupported", outcome="unsupported", reason="Source exceeds review download limit.")
                    elif kind == "pdf" or media_type == "application/pdf":
                        if media_type != "application/pdf" or not signature:
                            result = dict(meta, status="unsupported", outcome="unsupported",
                                          reason="PDF requires both application/pdf Content-Type and %PDF- signature.")
                        else:
                            digest = hashlib.sha256(body).hexdigest()
                            evidence_path = self.cache_dir / (digest + ".pdf")
                            if evidence_path.exists() and evidence_path.read_bytes() != body:
                                raise ValueError("Immutable PDF evidence differs.")
                            if not evidence_path.exists():
                                with evidence_path.open("xb") as stream:
                                    stream.write(body)
                            result = dict(meta, status="ok", format="pdf", url=final_url,
                                          pdf_base64=base64.b64encode(body).decode("ascii"), pdf_sha256=digest,
                                          pdf_file=evidence_path.name)
                    elif block:
                        result = dict(meta, status="blocked", outcome="blocked_response", reason="Official host returned an access challenge page.")
                    elif media_type not in {"text/html", "application/xhtml+xml"}:
                        result = dict(meta, status="unsupported", outcome="unsupported", reason="Non-HTML source requires manual review.")
                    else:
                        encoding = response.encoding if isinstance(response.encoding, str) else "utf-8"
                        result = dict(meta, status="ok", format="html", url=final_url, html=body.decode(encoding or "utf-8", errors="replace"))
                    break
                result = dict(meta, status="unavailable", outcome="blocked_response" if status in {401, 403, 429} else "http_failure",
                              reason=f"Official source returned HTTP {status}.")
                # No retries for 403/406, connection errors, TLS errors or timeouts.
                if status not in {429, 500, 502, 503, 504} or retry + 1 >= max_attempts:
                    break
                delay = max(2 ** retry, retry_after_seconds(retry_after))
                if delay > 60:
                    result["reason"] += " Retry-After exceeds this run's wait budget; deferred without retry."
                    break
                retry += 1
                history.append(meta)
            except Exception as error:
                import requests
                outcome = "timeout" if isinstance(error, (requests.exceptions.Timeout, TimeoutError)) else "http_failure"
                result = dict(meta, status="unavailable", outcome=outcome,
                              classification="transport_or_read_failure",
                              reason="Official request timed out." if outcome == "timeout" else "Official HTTP/connection/read request failed.")
                break
            finally:
                if response is not None:
                    response.close()
            if delay is not None:
                self.sleep(delay)
        result.update(request_url=url, attempts=history + [diagnostic(result)])
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        temporary.replace(path)
        return self.observed(result)

    def discover(self, record):
        # Supreme Court's public search; only official-host result links survive.
        # Docket is the discovery term; title/date are mandatory identity checks.
        query = record["case_number"].split(",")[0]
        response = dict(self.lookup_forbidden) if self.lookup_forbidden else self.get("https://sc.judiciary.gov.ph/?" + urlencode({"s": query}))
        if response.get("http_status") == 403:
            self.lookup_forbidden = dict(response)
        self.last_discovery = response
        if response["status"] != "ok":
            # Keep a blocked lookup pending. A filename hypothesis may be
            # reported for review, but is not an automatic bypass of the block.
            self.last_discovery["proposed_pdf_url"] = proposed_pdf_url(record)
            return [], response["reason"]
        page = Page()
        page.feed(response["html"])
        urls = sorted({urljoin(response["url"], link).split("#")[0] for link in page.links})
        urls = [url for url in urls if official_url(url) and not urlsplit(url).query
                and urlsplit(url).path != "/"]
        # Prioritize docket-bearing links and E-Library decisions; bounded scan.
        digits = re.findall(r"\d+", number_key(record["case_number"]))
        urls.sort(key=lambda u: (not any(n in u for n in digits), "/showdocs/1/" not in u, u))
        return urls[:12], "Official search results require identity verification."


def lookup(record, client):
    diagnostics = []
    if record.get("source_url"):
        urls, reason = [record["source_url"]], "Existing URL requires identity verification."
    else:
        urls, reason = client.discover(record)
        discovery = getattr(client, "last_discovery", {})
        if isinstance(discovery, dict) and discovery.get("status") != "ok":
            diagnostics.append(dict(diagnostic(discovery), proposed_pdf_url=discovery.get("proposed_pdf_url", "")))
    matches, evidence = {}, []
    for url in urls:
        response = client.get(url)
        if response["status"] != "ok":
            failure = dict(diagnostic(response), source_url=url, matched=False)
            evidence.append(failure)
            diagnostics.append(failure)
            continue
        diagnostics.append(dict(diagnostic(response), source_url=url))
        try:
            source = parse_response(response)
        except (ValueError, ImportError, KeyError, OSError) as error:
            diagnostics.append(dict(source_url=url, status="unsupported", outcome="unsupported",
                                    reason="PDF text extraction unavailable or invalid; manual review required.",
                                    classification="pdf_extraction_failed"))
            continue
        result = identity(record, source)
        evidence.append(dict(result, source_url=source["source_url"], cache_hit=response.get("cache_hit", False),
                             observed_identity={k: source[k] for k in ("case_number", "case_title", "decision_date")},
                             identity_headings=[h[:2400] for h in source["identity_headings"][:12]]))
        if result["matched"]:
            matches[source["source_url"]] = source
    if len(matches) == 1:
        return {"status": "matched", "source": next(iter(matches.values())), "evidence": evidence,
                "diagnostics": diagnostics, "reason": "Official decision number, title and date match."}
    failures = {d.get("outcome") for d in diagnostics}
    status = next((key for key in ("timeout", "blocked_response", "http_failure", "unknown_failure", "unsupported", "not_cached") if key in failures), "no_match")
    if status == "unknown_failure":
        status = "unavailable"
        reason = "Legacy cached failure; HTTP/timeout cause was not recorded."
    elif diagnostics:
        reason = next((d["reason"] for d in diagnostics if d.get("outcome") != "ok" and d.get("reason")), reason)
    if any(row.get("observed_identity", {}).get("case_number") for row in evidence):
        status, reason = "identity_conflict", next((e["reason"] for e in evidence if e.get("checks") and not e.get("matched")), "Multiple matching source identities.")
    if len(matches) > 1:
        status, reason = "ambiguous", "Multiple official decisions match; manual selection required."
    if status == "no_match":
        reason = "Successful official lookup produced no matching decision."
    return {"status": status, "evidence": evidence, "diagnostics": diagnostics, "reason": reason}


def legal_candidates(text, disposition_extractor):
    """Verbatim excerpts are review candidates, not assertions of SC holdings."""
    output = {key: [] for key in ("legal_issues", "doctrines", "laws_cited", "final_disposition")}
    for match in re.finditer(r"[^\n]+", text):
        paragraph = match.group().strip()
        if len(paragraph) > 3000:
            continue
        key = None
        if re.search(r"\b(?:issue|question)\b.*\bwhether\b", paragraph, re.I):
            key = "legal_issues"
        elif re.search(r"\b(?:doctrine|settled rule|well[- ]settled|we hold)\b", paragraph, re.I):
            key = "doctrines"
        if key and len(output[key]) < 8:
            output[key].append(dict(value=paragraph, excerpt=paragraph, start=match.start(), end=match.end()))
        for law in re.finditer(r"\b(?:Republic Act|Presidential Decree|Commonwealth Act|Batas Pambansa)\s+(?:No\.?\s*)?\d+\b", paragraph, re.I):
            if not any(item["value"] == law.group() for item in output["laws_cited"]):
                output["laws_cited"].append(dict(value=law.group(), excerpt=paragraph, start=match.start(), end=match.end()))
    # Official pages often append thousands of characters of footnotes/signatures.
    # For candidate extraction only, bound the majority text before explicit
    # footnote/separate-opinion headings. Do not discard subsequent reasoning:
    # it can reveal that the WHEREFORE belonged to an intermediate court.
    majority = re.split(r"(?im)^\s*(?:FOOTNOTES|ENDNOTES|(?:DISSENTING|CONCURRING|SEPARATE)\s+OPINION)\s*$", text)[0]
    starts = list(re.finditer(r"(?m)^\s*WHEREFORE\b", majority))
    final = ""
    if starts:
        tail = majority[starts[-1].start():]
        end = re.search(r"\bSO ORDERED\.", tail)
        if end:
            after = tail[end.end():]
            substantive = re.search(r"\b(?:whether|petition|appeal|however|therefore|we (?:hold|find|rule|reverse))\b", after, re.I)
            if not substantive:
                final = disposition_extractor(tail)
    if final:
        start = text.rfind(final)
        output["final_disposition"] = [dict(value=final, excerpt=final, start=start, end=start + len(final))]
    return output
