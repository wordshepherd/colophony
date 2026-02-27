from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.reorder_form_fields_body import ReorderFormFieldsBody
from ...models.reorder_form_fields_response_200_item import ReorderFormFieldsResponse200Item
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: ReorderFormFieldsBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/forms/{id}/fields/order".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> list[ReorderFormFieldsResponse200Item] | None:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = ReorderFormFieldsResponse200Item.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[list[ReorderFormFieldsResponse200Item]]:
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
    body: ReorderFormFieldsBody,

) -> Response[list[ReorderFormFieldsResponse200Item]]:
    """ Reorder fields

     Set the display order of fields in a DRAFT form definition.

    Args:
        id (UUID): Resource UUID
        body (ReorderFormFieldsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[list[ReorderFormFieldsResponse200Item]]
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
    body: ReorderFormFieldsBody,

) -> list[ReorderFormFieldsResponse200Item] | None:
    """ Reorder fields

     Set the display order of fields in a DRAFT form definition.

    Args:
        id (UUID): Resource UUID
        body (ReorderFormFieldsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        list[ReorderFormFieldsResponse200Item]
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
    body: ReorderFormFieldsBody,

) -> Response[list[ReorderFormFieldsResponse200Item]]:
    """ Reorder fields

     Set the display order of fields in a DRAFT form definition.

    Args:
        id (UUID): Resource UUID
        body (ReorderFormFieldsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[list[ReorderFormFieldsResponse200Item]]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ReorderFormFieldsBody,

) -> list[ReorderFormFieldsResponse200Item] | None:
    """ Reorder fields

     Set the display order of fields in a DRAFT form definition.

    Args:
        id (UUID): Resource UUID
        body (ReorderFormFieldsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        list[ReorderFormFieldsResponse200Item]
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
