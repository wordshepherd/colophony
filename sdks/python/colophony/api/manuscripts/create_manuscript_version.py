from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_manuscript_version_body import CreateManuscriptVersionBody
from ...models.create_manuscript_version_response_200 import CreateManuscriptVersionResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    manuscript_id: UUID,
    *,
    body: CreateManuscriptVersionBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/manuscripts/{manuscript_id}/versions".format(manuscript_id=quote(str(manuscript_id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateManuscriptVersionResponse200 | None:
    if response.status_code == 200:
        response_200 = CreateManuscriptVersionResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateManuscriptVersionResponse200]:
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
    body: CreateManuscriptVersionBody | Unset = UNSET,

) -> Response[CreateManuscriptVersionResponse200]:
    """ Create version

     Creates a new version of a manuscript.

    Args:
        manuscript_id (UUID):
        body (CreateManuscriptVersionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateManuscriptVersionResponse200]
     """


    kwargs = _get_kwargs(
        manuscript_id=manuscript_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    manuscript_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateManuscriptVersionBody | Unset = UNSET,

) -> CreateManuscriptVersionResponse200 | None:
    """ Create version

     Creates a new version of a manuscript.

    Args:
        manuscript_id (UUID):
        body (CreateManuscriptVersionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateManuscriptVersionResponse200
     """


    return sync_detailed(
        manuscript_id=manuscript_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    manuscript_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateManuscriptVersionBody | Unset = UNSET,

) -> Response[CreateManuscriptVersionResponse200]:
    """ Create version

     Creates a new version of a manuscript.

    Args:
        manuscript_id (UUID):
        body (CreateManuscriptVersionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateManuscriptVersionResponse200]
     """


    kwargs = _get_kwargs(
        manuscript_id=manuscript_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    manuscript_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateManuscriptVersionBody | Unset = UNSET,

) -> CreateManuscriptVersionResponse200 | None:
    """ Create version

     Creates a new version of a manuscript.

    Args:
        manuscript_id (UUID):
        body (CreateManuscriptVersionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateManuscriptVersionResponse200
     """


    return (await asyncio_detailed(
        manuscript_id=manuscript_id,
client=client,
body=body,

    )).parsed
