from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_file_body import DeleteFileBody
from ...models.delete_file_response_200 import DeleteFileResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    file_id: UUID,
    *,
    body: DeleteFileBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/files/{file_id}".format(file_id=quote(str(file_id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DeleteFileResponse200 | None:
    if response.status_code == 200:
        response_200 = DeleteFileResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DeleteFileResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    file_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DeleteFileBody | Unset = UNSET,

) -> Response[DeleteFileResponse200]:
    """ Delete a file

     Delete a file from a manuscript version. Only the manuscript owner can delete files.

    Args:
        file_id (UUID): File UUID
        body (DeleteFileBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteFileResponse200]
     """


    kwargs = _get_kwargs(
        file_id=file_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    file_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DeleteFileBody | Unset = UNSET,

) -> DeleteFileResponse200 | None:
    """ Delete a file

     Delete a file from a manuscript version. Only the manuscript owner can delete files.

    Args:
        file_id (UUID): File UUID
        body (DeleteFileBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteFileResponse200
     """


    return sync_detailed(
        file_id=file_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    file_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DeleteFileBody | Unset = UNSET,

) -> Response[DeleteFileResponse200]:
    """ Delete a file

     Delete a file from a manuscript version. Only the manuscript owner can delete files.

    Args:
        file_id (UUID): File UUID
        body (DeleteFileBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteFileResponse200]
     """


    kwargs = _get_kwargs(
        file_id=file_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    file_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DeleteFileBody | Unset = UNSET,

) -> DeleteFileResponse200 | None:
    """ Delete a file

     Delete a file from a manuscript version. Only the manuscript owner can delete files.

    Args:
        file_id (UUID): File UUID
        body (DeleteFileBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteFileResponse200
     """


    return (await asyncio_detailed(
        file_id=file_id,
client=client,
body=body,

    )).parsed
