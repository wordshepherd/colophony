from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.reorder_collection_items_body import ReorderCollectionItemsBody
from ...models.reorder_collection_items_response_200_item import ReorderCollectionItemsResponse200Item
from ...types import Response


def _get_kwargs(
    id: UUID,
    *,
    body: ReorderCollectionItemsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/collections/{id}/items/reorder".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> list[ReorderCollectionItemsResponse200Item] | None:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = ReorderCollectionItemsResponse200Item.from_dict(response_200_item_data)

            response_200.append(response_200_item)

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[list[ReorderCollectionItemsResponse200Item]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ReorderCollectionItemsBody,
) -> Response[list[ReorderCollectionItemsResponse200Item]]:
    """Reorder collection items

     Update the sort positions of items in a collection.

    Args:
        id (UUID): Resource UUID
        body (ReorderCollectionItemsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[list[ReorderCollectionItemsResponse200Item]]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ReorderCollectionItemsBody,
) -> list[ReorderCollectionItemsResponse200Item] | None:
    """Reorder collection items

     Update the sort positions of items in a collection.

    Args:
        id (UUID): Resource UUID
        body (ReorderCollectionItemsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        list[ReorderCollectionItemsResponse200Item]
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ReorderCollectionItemsBody,
) -> Response[list[ReorderCollectionItemsResponse200Item]]:
    """Reorder collection items

     Update the sort positions of items in a collection.

    Args:
        id (UUID): Resource UUID
        body (ReorderCollectionItemsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[list[ReorderCollectionItemsResponse200Item]]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ReorderCollectionItemsBody,
) -> list[ReorderCollectionItemsResponse200Item] | None:
    """Reorder collection items

     Update the sort positions of items in a collection.

    Args:
        id (UUID): Resource UUID
        body (ReorderCollectionItemsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        list[ReorderCollectionItemsResponse200Item]
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
