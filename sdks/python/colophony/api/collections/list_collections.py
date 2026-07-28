from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.list_collections_response_200 import ListCollectionsResponse200
from ...models.list_collections_type_hint import ListCollectionsTypeHint
from ...models.list_collections_visibility import ListCollectionsVisibility
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    type_hint: ListCollectionsTypeHint | Unset = UNSET,
    visibility: ListCollectionsVisibility | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_type_hint: str | Unset = UNSET
    if not isinstance(type_hint, Unset):
        json_type_hint = type_hint.value

    params["typeHint"] = json_type_hint

    json_visibility: str | Unset = UNSET
    if not isinstance(visibility, Unset):
        json_visibility = visibility.value

    params["visibility"] = json_visibility

    params["search"] = search

    params["page"] = page

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/collections",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ListCollectionsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListCollectionsResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[ListCollectionsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    type_hint: ListCollectionsTypeHint | Unset = UNSET,
    visibility: ListCollectionsVisibility | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> Response[ListCollectionsResponse200]:
    """List collections

     Returns a paginated list of collections visible to the current user.

    Args:
        type_hint (ListCollectionsTypeHint | Unset): Filter by type
        visibility (ListCollectionsVisibility | Unset): Filter by visibility
        search (str | Unset): Search by name
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListCollectionsResponse200]
    """

    kwargs = _get_kwargs(
        type_hint=type_hint,
        visibility=visibility,
        search=search,
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
    type_hint: ListCollectionsTypeHint | Unset = UNSET,
    visibility: ListCollectionsVisibility | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> ListCollectionsResponse200 | None:
    """List collections

     Returns a paginated list of collections visible to the current user.

    Args:
        type_hint (ListCollectionsTypeHint | Unset): Filter by type
        visibility (ListCollectionsVisibility | Unset): Filter by visibility
        search (str | Unset): Search by name
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListCollectionsResponse200
    """

    return sync_detailed(
        client=client,
        type_hint=type_hint,
        visibility=visibility,
        search=search,
        page=page,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    type_hint: ListCollectionsTypeHint | Unset = UNSET,
    visibility: ListCollectionsVisibility | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> Response[ListCollectionsResponse200]:
    """List collections

     Returns a paginated list of collections visible to the current user.

    Args:
        type_hint (ListCollectionsTypeHint | Unset): Filter by type
        visibility (ListCollectionsVisibility | Unset): Filter by visibility
        search (str | Unset): Search by name
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListCollectionsResponse200]
    """

    kwargs = _get_kwargs(
        type_hint=type_hint,
        visibility=visibility,
        search=search,
        page=page,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    type_hint: ListCollectionsTypeHint | Unset = UNSET,
    visibility: ListCollectionsVisibility | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,
) -> ListCollectionsResponse200 | None:
    """List collections

     Returns a paginated list of collections visible to the current user.

    Args:
        type_hint (ListCollectionsTypeHint | Unset): Filter by type
        visibility (ListCollectionsVisibility | Unset): Filter by visibility
        search (str | Unset): Search by name
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListCollectionsResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            type_hint=type_hint,
            visibility=visibility,
            search=search,
            page=page,
            limit=limit,
        )
    ).parsed
