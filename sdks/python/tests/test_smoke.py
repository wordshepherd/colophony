"""Smoke tests for the generated Colophony Python SDK.

These verify that the generated code imports without errors
and that basic client instantiation works.
"""


def test_package_imports():
    """Top-level package exports Client and AuthenticatedClient."""
    from colophony import Client, AuthenticatedClient

    assert Client is not None
    assert AuthenticatedClient is not None


def test_client_instantiation():
    """Client can be created with a base URL."""
    from colophony import Client

    client = Client(base_url="http://localhost:4000")
    assert client._base_url == "http://localhost:4000"


def test_authenticated_client_instantiation():
    """AuthenticatedClient can be created with a base URL and token."""
    from colophony import AuthenticatedClient

    client = AuthenticatedClient(base_url="http://localhost:4000", token="test-token")
    assert client._base_url == "http://localhost:4000"
    assert client.token == "test-token"


def test_errors_module():
    """Error classes are importable."""
    from colophony.errors import UnexpectedStatus

    assert issubclass(UnexpectedStatus, Exception)


def test_types_module():
    """Response type wrappers are importable."""
    from colophony.types import Response

    assert Response is not None


def test_api_modules_importable():
    """At least one API module can be imported without errors."""
    import colophony.api  # noqa: F401


def test_models_importable():
    """At least one model module can be imported without errors."""
    import colophony.models  # noqa: F401
