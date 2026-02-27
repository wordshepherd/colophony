from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_pipeline_items_response_200 import ListPipelineItemsResponse200
from ...models.list_pipeline_items_stage import ListPipelineItemsStage
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    stage: ListPipelineItemsStage | Unset = UNSET,
    publication_id: UUID | Unset = UNSET,
    assigned_copyeditor_id: UUID | Unset = UNSET,
    assigned_proofreader_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_stage: str | Unset = UNSET
    if not isinstance(stage, Unset):
        json_stage = stage.value

    params["stage"] = json_stage

    json_publication_id: str | Unset = UNSET
    if not isinstance(publication_id, Unset):
        json_publication_id = str(publication_id)
    params["publicationId"] = json_publication_id

    json_assigned_copyeditor_id: str | Unset = UNSET
    if not isinstance(assigned_copyeditor_id, Unset):
        json_assigned_copyeditor_id = str(assigned_copyeditor_id)
    params["assignedCopyeditorId"] = json_assigned_copyeditor_id

    json_assigned_proofreader_id: str | Unset = UNSET
    if not isinstance(assigned_proofreader_id, Unset):
        json_assigned_proofreader_id = str(assigned_proofreader_id)
    params["assignedProofreaderId"] = json_assigned_proofreader_id

    params["search"] = search

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/pipeline",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListPipelineItemsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListPipelineItemsResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListPipelineItemsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    stage: ListPipelineItemsStage | Unset = UNSET,
    publication_id: UUID | Unset = UNSET,
    assigned_copyeditor_id: UUID | Unset = UNSET,
    assigned_proofreader_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListPipelineItemsResponse200]:
    """ List pipeline items

     Returns a paginated list of pipeline items in the organization.

    Args:
        stage (ListPipelineItemsStage | Unset): Filter by pipeline stage
        publication_id (UUID | Unset): Filter by publication
        assigned_copyeditor_id (UUID | Unset): Filter by assigned copyeditor
        assigned_proofreader_id (UUID | Unset): Filter by assigned proofreader
        search (str | Unset): Search by submission title
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListPipelineItemsResponse200]
     """


    kwargs = _get_kwargs(
        stage=stage,
publication_id=publication_id,
assigned_copyeditor_id=assigned_copyeditor_id,
assigned_proofreader_id=assigned_proofreader_id,
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
    stage: ListPipelineItemsStage | Unset = UNSET,
    publication_id: UUID | Unset = UNSET,
    assigned_copyeditor_id: UUID | Unset = UNSET,
    assigned_proofreader_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListPipelineItemsResponse200 | None:
    """ List pipeline items

     Returns a paginated list of pipeline items in the organization.

    Args:
        stage (ListPipelineItemsStage | Unset): Filter by pipeline stage
        publication_id (UUID | Unset): Filter by publication
        assigned_copyeditor_id (UUID | Unset): Filter by assigned copyeditor
        assigned_proofreader_id (UUID | Unset): Filter by assigned proofreader
        search (str | Unset): Search by submission title
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListPipelineItemsResponse200
     """


    return sync_detailed(
        client=client,
stage=stage,
publication_id=publication_id,
assigned_copyeditor_id=assigned_copyeditor_id,
assigned_proofreader_id=assigned_proofreader_id,
search=search,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    stage: ListPipelineItemsStage | Unset = UNSET,
    publication_id: UUID | Unset = UNSET,
    assigned_copyeditor_id: UUID | Unset = UNSET,
    assigned_proofreader_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListPipelineItemsResponse200]:
    """ List pipeline items

     Returns a paginated list of pipeline items in the organization.

    Args:
        stage (ListPipelineItemsStage | Unset): Filter by pipeline stage
        publication_id (UUID | Unset): Filter by publication
        assigned_copyeditor_id (UUID | Unset): Filter by assigned copyeditor
        assigned_proofreader_id (UUID | Unset): Filter by assigned proofreader
        search (str | Unset): Search by submission title
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListPipelineItemsResponse200]
     """


    kwargs = _get_kwargs(
        stage=stage,
publication_id=publication_id,
assigned_copyeditor_id=assigned_copyeditor_id,
assigned_proofreader_id=assigned_proofreader_id,
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
    stage: ListPipelineItemsStage | Unset = UNSET,
    publication_id: UUID | Unset = UNSET,
    assigned_copyeditor_id: UUID | Unset = UNSET,
    assigned_proofreader_id: UUID | Unset = UNSET,
    search: str | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListPipelineItemsResponse200 | None:
    """ List pipeline items

     Returns a paginated list of pipeline items in the organization.

    Args:
        stage (ListPipelineItemsStage | Unset): Filter by pipeline stage
        publication_id (UUID | Unset): Filter by publication
        assigned_copyeditor_id (UUID | Unset): Filter by assigned copyeditor
        assigned_proofreader_id (UUID | Unset): Filter by assigned proofreader
        search (str | Unset): Search by submission title
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListPipelineItemsResponse200
     """


    return (await asyncio_detailed(
        client=client,
stage=stage,
publication_id=publication_id,
assigned_copyeditor_id=assigned_copyeditor_id,
assigned_proofreader_id=assigned_proofreader_id,
search=search,
page=page,
limit=limit,

    )).parsed
