from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_manuscript_response_200 import GetManuscriptResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    manuscript_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/manuscripts/{manuscript_id}".format(manuscript_id=quote(str(manuscript_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> GetManuscriptResponse200 | None:
    if response.status_code == 200:
        response_200 = GetManuscriptResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[GetManuscriptResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    manuscript_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[GetManuscriptResponse200]:
    """ Get manuscript by ID

     Returns a single manuscript with versions and files.

    Args:
        manuscript_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetManuscriptResponse200]
     """


    kwargs = _get_kwargs(
        manuscript_id=manuscript_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    manuscript_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> GetManuscriptResponse200 | None:
    """ Get manuscript by ID

     Returns a single manuscript with versions and files.

    Args:
        manuscript_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetManuscriptResponse200
     """


    return sync_detailed(
        manuscript_id=manuscript_id,
client=client,

    ).parsed

async def asyncio_detailed(
    manuscript_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[GetManuscriptResponse200]:
    """ Get manuscript by ID

     Returns a single manuscript with versions and files.

    Args:
        manuscript_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetManuscriptResponse200]
     """


    kwargs = _get_kwargs(
        manuscript_id=manuscript_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    manuscript_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> GetManuscriptResponse200 | None:
    """ Get manuscript by ID

     Returns a single manuscript with versions and files.

    Args:
        manuscript_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetManuscriptResponse200
     """


    return (await asyncio_detailed(
        manuscript_id=manuscript_id,
client=client,

    )).parsed
