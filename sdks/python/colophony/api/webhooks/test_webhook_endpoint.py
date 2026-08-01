from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.test_webhook_endpoint_response_201 import TestWebhookEndpointResponse201
from ...types import Response


def _get_kwargs(
    id: UUID,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/webhooks/{id}/test".format(
            id=quote(str(id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> TestWebhookEndpointResponse201 | None:
    if response.status_code == 201:
        response_201 = TestWebhookEndpointResponse201.from_dict(response.json())

        return response_201

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[TestWebhookEndpointResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[TestWebhookEndpointResponse201]:
    """Send a test delivery

     Queues a `webhook.test` delivery to the endpoint and returns its id. Delivery is asynchronous — poll
    `GET /webhook-deliveries` for the outcome. Rejected with 400 if the endpoint is disabled.

    Args:
        id (UUID): Resource UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[TestWebhookEndpointResponse201]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> TestWebhookEndpointResponse201 | None:
    """Send a test delivery

     Queues a `webhook.test` delivery to the endpoint and returns its id. Delivery is asynchronous — poll
    `GET /webhook-deliveries` for the outcome. Rejected with 400 if the endpoint is disabled.

    Args:
        id (UUID): Resource UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        TestWebhookEndpointResponse201
    """

    return sync_detailed(
        id=id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[TestWebhookEndpointResponse201]:
    """Send a test delivery

     Queues a `webhook.test` delivery to the endpoint and returns its id. Delivery is asynchronous — poll
    `GET /webhook-deliveries` for the outcome. Rejected with 400 if the endpoint is disabled.

    Args:
        id (UUID): Resource UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[TestWebhookEndpointResponse201]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> TestWebhookEndpointResponse201 | None:
    """Send a test delivery

     Queues a `webhook.test` delivery to the endpoint and returns its id. Delivery is asynchronous — poll
    `GET /webhook-deliveries` for the outcome. Rejected with 400 if the endpoint is disabled.

    Args:
        id (UUID): Resource UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        TestWebhookEndpointResponse201
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
        )
    ).parsed
