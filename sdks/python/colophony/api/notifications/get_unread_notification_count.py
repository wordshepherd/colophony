from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_unread_notification_count_response_200 import GetUnreadNotificationCountResponse200
from ...types import Response


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/notifications/unread-count",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetUnreadNotificationCountResponse200 | None:
    if response.status_code == 200:
        response_200 = GetUnreadNotificationCountResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetUnreadNotificationCountResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetUnreadNotificationCountResponse200]:
    """Get unread notification count

     Returns the number of unread in-app notifications. Returns the inbox of the user this credential
    acts as. An API key acts as the user who created it, so this is that person’s notifications, not an
    organization-wide feed. To receive organization-level events, register a webhook endpoint instead.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetUnreadNotificationCountResponse200]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> GetUnreadNotificationCountResponse200 | None:
    """Get unread notification count

     Returns the number of unread in-app notifications. Returns the inbox of the user this credential
    acts as. An API key acts as the user who created it, so this is that person’s notifications, not an
    organization-wide feed. To receive organization-level events, register a webhook endpoint instead.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetUnreadNotificationCountResponse200
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetUnreadNotificationCountResponse200]:
    """Get unread notification count

     Returns the number of unread in-app notifications. Returns the inbox of the user this credential
    acts as. An API key acts as the user who created it, so this is that person’s notifications, not an
    organization-wide feed. To receive organization-level events, register a webhook endpoint instead.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetUnreadNotificationCountResponse200]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> GetUnreadNotificationCountResponse200 | None:
    """Get unread notification count

     Returns the number of unread in-app notifications. Returns the inbox of the user this credential
    acts as. An API key acts as the user who created it, so this is that person’s notifications, not an
    organization-wide feed. To receive organization-level events, register a webhook endpoint instead.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetUnreadNotificationCountResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
