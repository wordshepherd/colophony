from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_file_download_url_response_200 import GetFileDownloadUrlResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    file_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/files/{file_id}/download".format(file_id=quote(str(file_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> GetFileDownloadUrlResponse200 | None:
    if response.status_code == 200:
        response_200 = GetFileDownloadUrlResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[GetFileDownloadUrlResponse200]:
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

) -> Response[GetFileDownloadUrlResponse200]:
    """ Get file download URL

     Returns a pre-signed download URL for a file. Only available for files with CLEAN scan status.

    Args:
        file_id (UUID): File UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetFileDownloadUrlResponse200]
     """


    kwargs = _get_kwargs(
        file_id=file_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    file_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> GetFileDownloadUrlResponse200 | None:
    """ Get file download URL

     Returns a pre-signed download URL for a file. Only available for files with CLEAN scan status.

    Args:
        file_id (UUID): File UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetFileDownloadUrlResponse200
     """


    return sync_detailed(
        file_id=file_id,
client=client,

    ).parsed

async def asyncio_detailed(
    file_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[GetFileDownloadUrlResponse200]:
    """ Get file download URL

     Returns a pre-signed download URL for a file. Only available for files with CLEAN scan status.

    Args:
        file_id (UUID): File UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetFileDownloadUrlResponse200]
     """


    kwargs = _get_kwargs(
        file_id=file_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    file_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> GetFileDownloadUrlResponse200 | None:
    """ Get file download URL

     Returns a pre-signed download URL for a file. Only available for files with CLEAN scan status.

    Args:
        file_id (UUID): File UUID

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetFileDownloadUrlResponse200
     """


    return (await asyncio_detailed(
        file_id=file_id,
client=client,

    )).parsed
