from http import HTTPStatus
from typing import Any
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.list_webhook_deliveries_response_200 import ListWebhookDeliveriesResponse200
from ...models.list_webhook_deliveries_status import ListWebhookDeliveriesStatus
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    endpoint_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    status: ListWebhookDeliveriesStatus | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_endpoint_id: str | Unset = UNSET
    if not isinstance(endpoint_id, Unset):
        json_endpoint_id = str(endpoint_id)
    params["endpointId"] = json_endpoint_id

    params["eventType"] = event_type

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params["page"] = page

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/webhook-deliveries",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ListWebhookDeliveriesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListWebhookDeliveriesResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[ListWebhookDeliveriesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    endpoint_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    status: ListWebhookDeliveriesStatus | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> Response[ListWebhookDeliveriesResponse200]:
    """List webhook deliveries

     Returns delivery attempts across the organization’s endpoints, newest first. Filter by endpoint,
    event type, or status to narrow it.

    Args:
        endpoint_id (UUID | Unset):
        event_type (str | Unset):
        status (ListWebhookDeliveriesStatus | Unset):
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListWebhookDeliveriesResponse200]
    """

    kwargs = _get_kwargs(
        endpoint_id=endpoint_id,
        event_type=event_type,
        status=status,
        page=page,
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    endpoint_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    status: ListWebhookDeliveriesStatus | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> ListWebhookDeliveriesResponse200 | None:
    """List webhook deliveries

     Returns delivery attempts across the organization’s endpoints, newest first. Filter by endpoint,
    event type, or status to narrow it.

    Args:
        endpoint_id (UUID | Unset):
        event_type (str | Unset):
        status (ListWebhookDeliveriesStatus | Unset):
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListWebhookDeliveriesResponse200
    """

    return sync_detailed(
        client=client,
        endpoint_id=endpoint_id,
        event_type=event_type,
        status=status,
        page=page,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    endpoint_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    status: ListWebhookDeliveriesStatus | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> Response[ListWebhookDeliveriesResponse200]:
    """List webhook deliveries

     Returns delivery attempts across the organization’s endpoints, newest first. Filter by endpoint,
    event type, or status to narrow it.

    Args:
        endpoint_id (UUID | Unset):
        event_type (str | Unset):
        status (ListWebhookDeliveriesStatus | Unset):
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListWebhookDeliveriesResponse200]
    """

    kwargs = _get_kwargs(
        endpoint_id=endpoint_id,
        event_type=event_type,
        status=status,
        page=page,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    endpoint_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    status: ListWebhookDeliveriesStatus | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> ListWebhookDeliveriesResponse200 | None:
    """List webhook deliveries

     Returns delivery attempts across the organization’s endpoints, newest first. Filter by endpoint,
    event type, or status to narrow it.

    Args:
        endpoint_id (UUID | Unset):
        event_type (str | Unset):
        status (ListWebhookDeliveriesStatus | Unset):
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListWebhookDeliveriesResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            endpoint_id=endpoint_id,
            event_type=event_type,
            status=status,
            page=page,
            limit=limit,
        )
    ).parsed
