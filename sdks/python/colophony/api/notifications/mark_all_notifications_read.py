from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.mark_all_notifications_read_response_200 import MarkAllNotificationsReadResponse200
from ...types import Response


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/notifications/read-all",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> MarkAllNotificationsReadResponse200 | None:
    if response.status_code == 200:
        response_200 = MarkAllNotificationsReadResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[MarkAllNotificationsReadResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[MarkAllNotificationsReadResponse200]:
    """Mark all notifications as read

     Marks every unread notification as read and returns how many changed. Returns the inbox of the user
    this credential acts as. An API key acts as the user who created it, so this is that person’s
    notifications, not an organization-wide feed. To receive organization-level events, register a
    webhook endpoint instead.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[MarkAllNotificationsReadResponse200]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> MarkAllNotificationsReadResponse200 | None:
    """Mark all notifications as read

     Marks every unread notification as read and returns how many changed. Returns the inbox of the user
    this credential acts as. An API key acts as the user who created it, so this is that person’s
    notifications, not an organization-wide feed. To receive organization-level events, register a
    webhook endpoint instead.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        MarkAllNotificationsReadResponse200
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[MarkAllNotificationsReadResponse200]:
    """Mark all notifications as read

     Marks every unread notification as read and returns how many changed. Returns the inbox of the user
    this credential acts as. An API key acts as the user who created it, so this is that person’s
    notifications, not an organization-wide feed. To receive organization-level events, register a
    webhook endpoint instead.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[MarkAllNotificationsReadResponse200]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> MarkAllNotificationsReadResponse200 | None:
    """Mark all notifications as read

     Marks every unread notification as read and returns how many changed. Returns the inbox of the user
    this credential acts as. An API key acts as the user who created it, so this is that person’s
    notifications, not an organization-wide feed. To receive organization-level events, register a
    webhook endpoint instead.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        MarkAllNotificationsReadResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
