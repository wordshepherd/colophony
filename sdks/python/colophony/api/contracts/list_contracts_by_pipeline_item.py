from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_contracts_by_pipeline_item_response_200_item import ListContractsByPipelineItemResponse200Item
from typing import cast
from uuid import UUID



def _get_kwargs(
    pipeline_item_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/pipeline/{pipeline_item_id}/contracts".format(pipeline_item_id=quote(str(pipeline_item_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> list[ListContractsByPipelineItemResponse200Item] | None:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = ListContractsByPipelineItemResponse200Item.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[list[ListContractsByPipelineItemResponse200Item]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    pipeline_item_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[list[ListContractsByPipelineItemResponse200Item]]:
    """ List contracts for a pipeline item

     Retrieve all contracts linked to a pipeline item.

    Args:
        pipeline_item_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[list[ListContractsByPipelineItemResponse200Item]]
     """


    kwargs = _get_kwargs(
        pipeline_item_id=pipeline_item_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    pipeline_item_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> list[ListContractsByPipelineItemResponse200Item] | None:
    """ List contracts for a pipeline item

     Retrieve all contracts linked to a pipeline item.

    Args:
        pipeline_item_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        list[ListContractsByPipelineItemResponse200Item]
     """


    return sync_detailed(
        pipeline_item_id=pipeline_item_id,
client=client,

    ).parsed

async def asyncio_detailed(
    pipeline_item_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[list[ListContractsByPipelineItemResponse200Item]]:
    """ List contracts for a pipeline item

     Retrieve all contracts linked to a pipeline item.

    Args:
        pipeline_item_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[list[ListContractsByPipelineItemResponse200Item]]
     """


    kwargs = _get_kwargs(
        pipeline_item_id=pipeline_item_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    pipeline_item_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> list[ListContractsByPipelineItemResponse200Item] | None:
    """ List contracts for a pipeline item

     Retrieve all contracts linked to a pipeline item.

    Args:
        pipeline_item_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        list[ListContractsByPipelineItemResponse200Item]
     """


    return (await asyncio_detailed(
        pipeline_item_id=pipeline_item_id,
client=client,

    )).parsed
