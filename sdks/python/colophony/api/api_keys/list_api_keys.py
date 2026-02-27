from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_api_keys_response_200 import ListApiKeysResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api-keys",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListApiKeysResponse200 | None:
    if response.status_code == 200:
        response_200 = ListApiKeysResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListApiKeysResponse200]:
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

) -> Response[ListApiKeysResponse200]:
    """ List API keys

     Returns all API keys for the current organization. Key values are masked.

    Args:
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListApiKeysResponse200]
     """


    kwargs = _get_kwargs(
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
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListApiKeysResponse200 | None:
    """ List API keys

     Returns all API keys for the current organization. Key values are masked.

    Args:
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListApiKeysResponse200
     """


    return sync_detailed(
        client=client,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListApiKeysResponse200]:
    """ List API keys

     Returns all API keys for the current organization. Key values are masked.

    Args:
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListApiKeysResponse200]
     """


    kwargs = _get_kwargs(
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
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListApiKeysResponse200 | None:
    """ List API keys

     Returns all API keys for the current organization. Key values are masked.

    Args:
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListApiKeysResponse200
     """


    return (await asyncio_detailed(
        client=client,
page=page,
limit=limit,

    )).parsed
