"""Tests for S3 client configuration."""

from unittest.mock import patch

from sams.services import s3


@patch("sams.services.s3.boto3.client")
def test_s3_client_uses_extended_timeout_and_retries(mock_client, monkeypatch):
    monkeypatch.setattr(s3.settings, "S3_CONNECT_TIMEOUT_SECONDS", 7)
    monkeypatch.setattr(s3.settings, "S3_READ_TIMEOUT_SECONDS", 123)
    monkeypatch.setattr(s3.settings, "S3_MAX_ATTEMPTS", 4)

    s3.get_s3_client()

    config = mock_client.call_args.kwargs["config"]
    assert config.connect_timeout == 7
    assert config.read_timeout == 123
    assert config.retries["max_attempts"] == 4


@patch("sams.services.s3.boto3.client")
def test_public_s3_client_keeps_v4_signature(mock_client, monkeypatch):
    monkeypatch.setattr(s3.settings, "S3_PUBLIC_ENDPOINT", "https://example.test")

    s3.get_public_s3_client()

    assert mock_client.call_args.kwargs["endpoint_url"] == "https://example.test"
    config = mock_client.call_args.kwargs["config"]
    assert config.signature_version == "s3v4"
