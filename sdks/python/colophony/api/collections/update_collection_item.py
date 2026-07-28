from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.update_collection_item_body import UpdateCollectionItemBody
from ...models.update_collection_item_response_200 import UpdateCollectionItemResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    id: UUID,
    item_id: UUID,
    *,
    body: UpdateCollectionItemBody | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/collections/{id}/items/{item_id}".format(
            id=quote(str(id), safe=""),
            item_id=quote(str(item_id), safe=""),
        ),
    }

    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> UpdateCollectionItemResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateCollectionItemResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[UpdateCollectionItemResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    item_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateCollectionItemBody | Unset = UNSET,
) -> Response[UpdateCollectionItemResponse200]:
    """Update collection item

     Update notes, color, or icon on a collection item.

    Args:
        id (UUID): Collection ID
        item_id (UUID): Item ID
        body (UpdateCollectionItemBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[UpdateCollectionItemResponse200]
    """

    kwargs = _get_kwargs(
        id=id,
        item_id=item_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    item_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateCollectionItemBody | Unset = UNSET,
) -> UpdateCollectionItemResponse200 | None:
    """Update collection item

     Update notes, color, or icon on a collection item.

    Args:
        id (UUID): Collection ID
        item_id (UUID): Item ID
        body (UpdateCollectionItemBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        UpdateCollectionItemResponse200
    """

    return sync_detailed(
        id=id,
        item_id=item_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    item_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateCollectionItemBody | Unset = UNSET,
) -> Response[UpdateCollectionItemResponse200]:
    """Update collection item

     Update notes, color, or icon on a collection item.

    Args:
        id (UUID): Collection ID
        item_id (UUID): Item ID
        body (UpdateCollectionItemBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[UpdateCollectionItemResponse200]
    """

    kwargs = _get_kwargs(
        id=id,
        item_id=item_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    item_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateCollectionItemBody | Unset = UNSET,
) -> UpdateCollectionItemResponse200 | None:
    """Update collection item

     Update notes, color, or icon on a collection item.

    Args:
        id (UUID): Collection ID
        item_id (UUID): Item ID
        body (UpdateCollectionItemBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        UpdateCollectionItemResponse200
    """

    return (
        await asyncio_detailed(
            id=id,
            item_id=item_id,
            client=client,
            body=body,
        )
    ).parsed
