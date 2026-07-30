from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.list_notifications_response_200 import ListNotificationsResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    page: int | Unset = 1,
    limit: int | Unset = 20,
    unread_only: bool | Unset = False,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["page"] = page

    params["limit"] = limit

    params["unreadOnly"] = unread_only

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/notifications",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ListNotificationsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListNotificationsResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[ListNotificationsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,
    unread_only: bool | Unset = False,
) -> Response[ListNotificationsResponse200]:
    """List notifications

     Returns a paginated list of in-app notifications, newest first. Returns the inbox of the user this
    credential acts as. An API key acts as the user who created it, so this is that person’s
    notifications, not an organization-wide feed. To receive organization-level events, register a
    webhook endpoint instead.

    Args:
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-50, default 20) Default: 20.
        unread_only (bool | Unset): Return only notifications that have not been read Default:
            False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListNotificationsResponse200]
    """

    kwargs = _get_kwargs(
        page=page,
        limit=limit,
        unread_only=unread_only,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,
    unread_only: bool | Unset = False,
) -> ListNotificationsResponse200 | None:
    """List notifications

     Returns a paginated list of in-app notifications, newest first. Returns the inbox of the user this
    credential acts as. An API key acts as the user who created it, so this is that person’s
    notifications, not an organization-wide feed. To receive organization-level events, register a
    webhook endpoint instead.

    Args:
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-50, default 20) Default: 20.
        unread_only (bool | Unset): Return only notifications that have not been read Default:
            False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListNotificationsResponse200
    """

    return sync_detailed(
        client=client,
        page=page,
        limit=limit,
        unread_only=unread_only,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,
    unread_only: bool | Unset = False,
) -> Response[ListNotificationsResponse200]:
    """List notifications

     Returns a paginated list of in-app notifications, newest first. Returns the inbox of the user this
    credential acts as. An API key acts as the user who created it, so this is that person’s
    notifications, not an organization-wide feed. To receive organization-level events, register a
    webhook endpoint instead.

    Args:
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-50, default 20) Default: 20.
        unread_only (bool | Unset): Return only notifications that have not been read Default:
            False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListNotificationsResponse200]
    """

    kwargs = _get_kwargs(
        page=page,
        limit=limit,
        unread_only=unread_only,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,
    unread_only: bool | Unset = False,
) -> ListNotificationsResponse200 | None:
    """List notifications

     Returns a paginated list of in-app notifications, newest first. Returns the inbox of the user this
    credential acts as. An API key acts as the user who created it, so this is that person’s
    notifications, not an organization-wide feed. To receive organization-level events, register a
    webhook endpoint instead.

    Args:
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-50, default 20) Default: 20.
        unread_only (bool | Unset): Return only notifications that have not been read Default:
            False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListNotificationsResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            page=page,
            limit=limit,
            unread_only=unread_only,
        )
    ).parsed
