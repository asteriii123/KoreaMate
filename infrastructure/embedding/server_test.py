import importlib.util
import math
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("server.py")
SPEC = importlib.util.spec_from_file_location("koreamate_embedding_server", MODULE_PATH)
server = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(server)


class FakeModel:
    def encode(self, texts, **_kwargs):
        return {"dense_vecs": [[1.0] + [0.0] * 1023 for _ in texts]}


class EmbeddingServerTest(unittest.TestCase):
    def test_health_does_not_load_model(self):
        with patch.object(server, "embedding_model") as loader:
            payload = server.health()
        loader.assert_not_called()
        self.assertEqual(payload["dimensions"], 1024)
        self.assertFalse(payload["loaded"])

    def test_rejects_empty_oversized_and_blank_batches(self):
        for texts in ([], ["x"] * 33, ["  "], ["x" * 4097]):
            with self.subTest(size=len(texts)):
                with self.assertRaises(ValueError):
                    server.validated_texts(texts)

    def test_normalizes_1024_dimension_vectors(self):
        vector = server.normalized_vector([2.0] + [0.0] * 1023)
        self.assertEqual(len(vector), 1024)
        self.assertTrue(math.isclose(sum(value * value for value in vector), 1.0))

    def test_rejects_invalid_vectors(self):
        for vector in ([1.0], [float("nan")] + [0.0] * 1023, [0.0] * 1024):
            with self.assertRaises(ValueError):
                server.normalized_vector(vector)

    def test_embeds_without_loading_real_weights(self):
        with patch.object(server, "embedding_model", return_value=FakeModel()):
            vectors = server.embed_texts(["首尔", "서울"])
        self.assertEqual(len(vectors), 2)
        self.assertEqual(len(vectors[0]), 1024)


if __name__ == "__main__":
    unittest.main()
