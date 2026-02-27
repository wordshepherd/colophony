from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.update_form_field_body import UpdateFormFieldBody
from ...models.update_form_field_response_200 import UpdateFormFieldResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    field_id: UUID,
    *,
    body: UpdateFormFieldBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/forms/{id}/fields/{field_id}".format(id=quote(str(id), safe=""),field_id=quote(str(field_id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> UpdateFormFieldResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateFormFieldResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[UpdateFormFieldResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    field_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFormFieldBody | Unset = UNSET,

) -> Response[UpdateFormFieldResponse200]:
    """ Update a field

     Update a field in a DRAFT form definition.

    Args:
        id (UUID):
        field_id (UUID):
        body (UpdateFormFieldBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[UpdateFormFieldResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
field_id=field_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    field_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFormFieldBody | Unset = UNSET,

) -> UpdateFormFieldResponse200 | None:
    """ Update a field

     Update a field in a DRAFT form definition.

    Args:
        id (UUID):
        field_id (UUID):
        body (UpdateFormFieldBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        UpdateFormFieldResponse200
     """


    return sync_detailed(
        id=id,
field_id=field_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    field_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFormFieldBody | Unset = UNSET,

) -> Response[UpdateFormFieldResponse200]:
    """ Update a field

     Update a field in a DRAFT form definition.

    Args:
        id (UUID):
        field_id (UUID):
        body (UpdateFormFieldBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[UpdateFormFieldResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
field_id=field_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    field_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFormFieldBody | Unset = UNSET,

) -> UpdateFormFieldResponse200 | None:
    """ Update a field

     Update a field in a DRAFT form definition.

    Args:
        id (UUID):
        field_id (UUID):
        body (UpdateFormFieldBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        UpdateFormFieldResponse200
     """


    return (await asyncio_detailed(
        id=id,
field_id=field_id,
client=client,
body=body,

    )).parsed
