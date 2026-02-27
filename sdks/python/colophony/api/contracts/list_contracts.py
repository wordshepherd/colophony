from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_contracts_response_200 import ListContractsResponse200
from ...models.list_contracts_status import ListContractsStatus
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    status: ListContractsStatus | Unset = UNSET,
    pipeline_item_id: UUID | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    json_pipeline_item_id: str | Unset = UNSET
    if not isinstance(pipeline_item_id, Unset):
        json_pipeline_item_id = str(pipeline_item_id)
    params["pipelineItemId"] = json_pipeline_item_id

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/contracts",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListContractsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListContractsResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListContractsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    status: ListContractsStatus | Unset = UNSET,
    pipeline_item_id: UUID | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListContractsResponse200]:
    """ List contracts

     Returns a paginated list of contracts in the organization.

    Args:
        status (ListContractsStatus | Unset): Filter by status
        pipeline_item_id (UUID | Unset): Filter by pipeline item
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListContractsResponse200]
     """


    kwargs = _get_kwargs(
        status=status,
pipeline_item_id=pipeline_item_id,
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
    status: ListContractsStatus | Unset = UNSET,
    pipeline_item_id: UUID | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListContractsResponse200 | None:
    """ List contracts

     Returns a paginated list of contracts in the organization.

    Args:
        status (ListContractsStatus | Unset): Filter by status
        pipeline_item_id (UUID | Unset): Filter by pipeline item
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListContractsResponse200
     """


    return sync_detailed(
        client=client,
status=status,
pipeline_item_id=pipeline_item_id,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    status: ListContractsStatus | Unset = UNSET,
    pipeline_item_id: UUID | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListContractsResponse200]:
    """ List contracts

     Returns a paginated list of contracts in the organization.

    Args:
        status (ListContractsStatus | Unset): Filter by status
        pipeline_item_id (UUID | Unset): Filter by pipeline item
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListContractsResponse200]
     """


    kwargs = _get_kwargs(
        status=status,
pipeline_item_id=pipeline_item_id,
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
    status: ListContractsStatus | Unset = UNSET,
    pipeline_item_id: UUID | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListContractsResponse200 | None:
    """ List contracts

     Returns a paginated list of contracts in the organization.

    Args:
        status (ListContractsStatus | Unset): Filter by status
        pipeline_item_id (UUID | Unset): Filter by pipeline item
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListContractsResponse200
     """


    return (await asyncio_detailed(
        client=client,
status=status,
pipeline_item_id=pipeline_item_id,
page=page,
limit=limit,

    )).parsed
