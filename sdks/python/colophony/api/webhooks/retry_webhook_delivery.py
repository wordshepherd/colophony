from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.retry_webhook_delivery_response_200 import RetryWebhookDeliveryResponse200
from ...types import Response


def _get_kwargs(
    delivery_id: UUID,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/webhook-deliveries/{delivery_id}/retry".format(
            delivery_id=quote(str(delivery_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> RetryWebhookDeliveryResponse200 | None:
    if response.status_code == 200:
        response_200 = RetryWebhookDeliveryResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[RetryWebhookDeliveryResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    delivery_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[RetryWebhookDeliveryResponse200]:
    """Retry a webhook delivery

     Requeues a delivery, clearing the previous attempt’s status and error. Responds 404 if the delivery
    or its endpoint is not in this organization.

    Args:
        delivery_id (UUID): Webhook delivery UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[RetryWebhookDeliveryResponse200]
    """

    kwargs = _get_kwargs(
        delivery_id=delivery_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    delivery_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> RetryWebhookDeliveryResponse200 | None:
    """Retry a webhook delivery

     Requeues a delivery, clearing the previous attempt’s status and error. Responds 404 if the delivery
    or its endpoint is not in this organization.

    Args:
        delivery_id (UUID): Webhook delivery UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        RetryWebhookDeliveryResponse200
    """

    return sync_detailed(
        delivery_id=delivery_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    delivery_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[RetryWebhookDeliveryResponse200]:
    """Retry a webhook delivery

     Requeues a delivery, clearing the previous attempt’s status and error. Responds 404 if the delivery
    or its endpoint is not in this organization.

    Args:
        delivery_id (UUID): Webhook delivery UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[RetryWebhookDeliveryResponse200]
    """

    kwargs = _get_kwargs(
        delivery_id=delivery_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    delivery_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> RetryWebhookDeliveryResponse200 | None:
    """Retry a webhook delivery

     Requeues a delivery, clearing the previous attempt’s status and error. Responds 404 if the delivery
    or its endpoint is not in this organization.

    Args:
        delivery_id (UUID): Webhook delivery UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        RetryWebhookDeliveryResponse200
    """

    return (
        await asyncio_detailed(
            delivery_id=delivery_id,
            client=client,
        )
    ).parsed
