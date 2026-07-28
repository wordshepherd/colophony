from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.remove_collection_item_response_200_type_0 import RemoveCollectionItemResponse200Type0
from ...types import Response


def _get_kwargs(
    id: UUID,
    item_id: UUID,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/collections/{id}/items/{item_id}".format(
            id=quote(str(id), safe=""),
            item_id=quote(str(item_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> None | RemoveCollectionItemResponse200Type0 | None:
    if response.status_code == 200:

        def _parse_response_200(data: object) -> None | RemoveCollectionItemResponse200Type0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                response_200_type_0 = RemoveCollectionItemResponse200Type0.from_dict(data)

                return response_200_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | RemoveCollectionItemResponse200Type0, data)

        response_200 = _parse_response_200(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[None | RemoveCollectionItemResponse200Type0]:
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
) -> Response[None | RemoveCollectionItemResponse200Type0]:
    """Remove item from collection

     Remove a submission from a collection.

    Args:
        id (UUID): Collection ID
        item_id (UUID): Item ID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[None | RemoveCollectionItemResponse200Type0]
    """

    kwargs = _get_kwargs(
        id=id,
        item_id=item_id,
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
) -> None | RemoveCollectionItemResponse200Type0 | None:
    """Remove item from collection

     Remove a submission from a collection.

    Args:
        id (UUID): Collection ID
        item_id (UUID): Item ID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        None | RemoveCollectionItemResponse200Type0
    """

    return sync_detailed(
        id=id,
        item_id=item_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    item_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[None | RemoveCollectionItemResponse200Type0]:
    """Remove item from collection

     Remove a submission from a collection.

    Args:
        id (UUID): Collection ID
        item_id (UUID): Item ID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[None | RemoveCollectionItemResponse200Type0]
    """

    kwargs = _get_kwargs(
        id=id,
        item_id=item_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    item_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> None | RemoveCollectionItemResponse200Type0 | None:
    """Remove item from collection

     Remove a submission from a collection.

    Args:
        id (UUID): Collection ID
        item_id (UUID): Item ID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        None | RemoveCollectionItemResponse200Type0
    """

    return (
        await asyncio_detailed(
            id=id,
            item_id=item_id,
            client=client,
        )
    ).parsed
