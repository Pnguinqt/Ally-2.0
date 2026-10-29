import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Avoid loading ML libraries or contacting external services in unit tests.
sys.modules["sentence_transformers"] = MagicMock()
sys.modules["pinecone"] = MagicMock()
import main
from fastapi.testclient import TestClient

class RetrievalTests(unittest.TestCase):
    def setUp(self):
        main.embedding_model = MagicMock()
        main.embedding_model.encode.return_value.tolist.return_value = [0.0] * 384
        main.pinecone_index = MagicMock()
        self.classifier = patch.object(main, "classify_with_deepseek", return_value=(True, "LEGAL", "", .9))
        self.classifier.start()
        self.addCleanup(self.classifier.stop)
        self.client = TestClient(main.app)

    def record(self, **metadata):
        return {"score": .99, "metadata": {"case_title": "Isican", "text": "MTC convicted the accused", "chunk_type": "verdict", **metadata}}

    def search(self, records, top_k=3):
        main.pinecone_index.query.return_value = {"matches": records}
        return self.client.post("/search", json={"query": "Isican", "top_k": top_k})

    def test_environment_startup(self):
        with patch.dict(os.environ, {"PINECONE_INDEX_NAME": "configured-small", "EMBEDDING_MODEL": "BAAI/bge-small-en-v1.5", "PINECONE_API_KEY": "test"}), patch.object(main, "SentenceTransformer") as model, patch.object(main, "Pinecone") as pc:
            model.return_value.get_sentence_embedding_dimension.return_value = 384
            pc.return_value.describe_index.return_value = MagicMock(dimension=384, metric="cosine")
            asyncio.run(main.startup_event())
            model.assert_called_once_with("BAAI/bge-small-en-v1.5")
            pc.return_value.Index.assert_called_once_with("configured-small")

    def test_invalid_configuration(self):
        with patch.dict(os.environ, {"PINECONE_INDEX_NAME": "", "EMBEDDING_MODEL": "wrong"}):
            with self.assertRaises(RuntimeError): asyncio.run(main.startup_event())

    def test_decision_date_preserved_without_inferring_from_year(self):
        result = self.search([self.record(decision_date=" 2023-01-18 ")]).json()
        self.assertEqual(result["cases"][0]["decision_date"], "2023-01-18")
        result = self.search([self.record(source_year=2023)]).json()
        self.assertEqual(result["cases"][0]["decision_date"], "")

    def test_missing_metadata_high_score_and_verdict_unverified(self):
        result = self.search([self.record()]).json()
        self.assertFalse(result["can_state_final_outcome"])
        self.assertEqual(result["validation_warning"], main.VALIDATION_WARNING)
        self.assertEqual(result["cases"][0]["source_url"], "")
        self.assertEqual(result["cases"][0]["content"], "MTC convicted the accused")
        self.assertTrue({"cases", "count", "query", "rejected", "confidence"} <= result.keys())

    def test_verified_and_url_spoofing(self):
        metadata = dict(source_url="https://elibrary.judiciary.gov.ph/decision/1", court_level="Supreme Court", disposition="Petition granted", chunk_type="final_disposition")
        self.assertTrue(self.search([self.record(**metadata)]).json()["can_state_final_outcome"])
        for url in ["https://elibrary.judiciary.gov.ph.evil.test/", "http://sc.judiciary.gov.ph/", "https://user@sc.judiciary.gov.ph/"]:
            metadata["source_url"] = url
            self.assertFalse(self.search([self.record(**metadata)]).json()["can_state_final_outcome"])

    def test_cap_dimension_and_no_results(self):
        result = self.search([self.record()] * 5, 20).json()
        self.assertEqual(result["count"], 3)
        self.assertEqual(main.pinecone_index.query.call_args.kwargs["top_k"], 3)
        self.assertEqual(len(main.pinecone_index.query.call_args.kwargs["vector"]), 384)
        self.assertEqual(self.search([]).json()["count"], 0)
        main.embedding_model.encode.return_value.tolist.return_value = [0.0] * 1024
        self.assertEqual(self.search([]).status_code, 503)

    def test_upstream_failure(self):
        main.pinecone_index.query.side_effect = RuntimeError("secret upstream details")
        response = self.search([])
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret", response.text)

    def test_pinecone_query_has_bounded_pool_and_timeout(self):
        with patch.dict(os.environ, {
            "RAG_CANDIDATE_POOL": "8",
            "PINECONE_QUERY_TIMEOUT": "12",
        }):
            response = self.search([])

        self.assertEqual(response.status_code, 200)
        query_options = main.pinecone_index.query.call_args.kwargs
        self.assertEqual(query_options["top_k"], 8)
        self.assertEqual(query_options["timeout"], 12.0)
        self.assertTrue(query_options["include_metadata"])

if __name__ == "__main__": unittest.main()
