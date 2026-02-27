from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_manuscripts_response_200 import ListManuscriptsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["search"] = search

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/manuscripts",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListManuscriptsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListManuscriptsResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListManuscriptsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListManuscriptsResponse200]:
    """ List manuscripts

     Returns all manuscripts owned by the authenticated user.

    Args:
        search (str | Unset): Search by title (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListManuscriptsResponse200]
     """


    kwargs = _get_kwargs(
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
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListManuscriptsResponse200 | None:
    """ List manuscripts

     Returns all manuscripts owned by the authenticated user.

    Args:
        search (str | Unset): Search by title (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListManuscriptsResponse200
     """


    return sync_detailed(
        client=client,
search=search,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListManuscriptsResponse200]:
    """ List manuscripts

     Returns all manuscripts owned by the authenticated user.

    Args:
        search (str | Unset): Search by title (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListManuscriptsResponse200]
     """


    kwargs = _get_kwargs(
        search=search,
page=page,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListManuscriptsResponse200 | None:
    """ List manuscripts

     Returns all manuscripts owned by the authenticated user.

    Args:
        search (str | Unset): Search by title (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListManuscriptsResponse200
     """


    return (await asyncio_detailed(
        client=client,
search=search,
page=page,
limit=limit,

    )).parsed
