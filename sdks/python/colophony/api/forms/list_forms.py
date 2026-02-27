from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_forms_response_200 import ListFormsResponse200
from ...models.list_forms_status import ListFormsStatus
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    status: ListFormsStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params["search"] = search

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/forms",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListFormsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListFormsResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListFormsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    status: ListFormsStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListFormsResponse200]:
    """ List form definitions

     Returns a paginated list of form definitions in the organization.

    Args:
        status (ListFormsStatus | Unset): Filter by form status
        search (str | Unset): Search by name (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListFormsResponse200]
     """


    kwargs = _get_kwargs(
        status=status,
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
    status: ListFormsStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListFormsResponse200 | None:
    """ List form definitions

     Returns a paginated list of form definitions in the organization.

    Args:
        status (ListFormsStatus | Unset): Filter by form status
        search (str | Unset): Search by name (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListFormsResponse200
     """


    return sync_detailed(
        client=client,
status=status,
search=search,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    status: ListFormsStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListFormsResponse200]:
    """ List form definitions

     Returns a paginated list of form definitions in the organization.

    Args:
        status (ListFormsStatus | Unset): Filter by form status
        search (str | Unset): Search by name (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListFormsResponse200]
     """


    kwargs = _get_kwargs(
        status=status,
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
    status: ListFormsStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListFormsResponse200 | None:
    """ List form definitions

     Returns a paginated list of form definitions in the organization.

    Args:
        status (ListFormsStatus | Unset): Filter by form status
        search (str | Unset): Search by name (max 200 chars)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListFormsResponse200
     """


    return (await asyncio_detailed(
        client=client,
status=status,
search=search,
page=page,
limit=limit,

    )).parsed
