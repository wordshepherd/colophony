from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.update_form_page_body import UpdateFormPageBody
from ...models.update_form_page_response_200 import UpdateFormPageResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    page_id: UUID,
    *,
    body: UpdateFormPageBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/forms/{id}/pages/{page_id}".format(id=quote(str(id), safe=""),page_id=quote(str(page_id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> UpdateFormPageResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateFormPageResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[UpdateFormPageResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    page_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFormPageBody | Unset = UNSET,

) -> Response[UpdateFormPageResponse200]:
    """ Update a page

     Update a page in a DRAFT form definition.

    Args:
        id (UUID):
        page_id (UUID):
        body (UpdateFormPageBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[UpdateFormPageResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
page_id=page_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    page_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFormPageBody | Unset = UNSET,

) -> UpdateFormPageResponse200 | None:
    """ Update a page

     Update a page in a DRAFT form definition.

    Args:
        id (UUID):
        page_id (UUID):
        body (UpdateFormPageBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        UpdateFormPageResponse200
     """


    return sync_detailed(
        id=id,
page_id=page_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    page_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFormPageBody | Unset = UNSET,

) -> Response[UpdateFormPageResponse200]:
    """ Update a page

     Update a page in a DRAFT form definition.

    Args:
        id (UUID):
        page_id (UUID):
        body (UpdateFormPageBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[UpdateFormPageResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
page_id=page_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    page_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFormPageBody | Unset = UNSET,

) -> UpdateFormPageResponse200 | None:
    """ Update a page

     Update a page in a DRAFT form definition.

    Args:
        id (UUID):
        page_id (UUID):
        body (UpdateFormPageBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        UpdateFormPageResponse200
     """


    return (await asyncio_detailed(
        id=id,
page_id=page_id,
client=client,
body=body,

    )).parsed
