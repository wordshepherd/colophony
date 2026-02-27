from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_api_key_body import DeleteApiKeyBody
from ...models.delete_api_key_response_200 import DeleteApiKeyResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    key_id: UUID,
    *,
    body: DeleteApiKeyBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/api-keys/{key_id}".format(key_id=quote(str(key_id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DeleteApiKeyResponse200 | None:
    if response.status_code == 200:
        response_200 = DeleteApiKeyResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DeleteApiKeyResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DeleteApiKeyBody | Unset = UNSET,

) -> Response[DeleteApiKeyResponse200]:
    """ Delete an API key

     Permanently delete an API key. Requires ADMIN role.

    Args:
        key_id (UUID):
        body (DeleteApiKeyBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteApiKeyResponse200]
     """


    kwargs = _get_kwargs(
        key_id=key_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DeleteApiKeyBody | Unset = UNSET,

) -> DeleteApiKeyResponse200 | None:
    """ Delete an API key

     Permanently delete an API key. Requires ADMIN role.

    Args:
        key_id (UUID):
        body (DeleteApiKeyBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteApiKeyResponse200
     """


    return sync_detailed(
        key_id=key_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DeleteApiKeyBody | Unset = UNSET,

) -> Response[DeleteApiKeyResponse200]:
    """ Delete an API key

     Permanently delete an API key. Requires ADMIN role.

    Args:
        key_id (UUID):
        body (DeleteApiKeyBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteApiKeyResponse200]
     """


    kwargs = _get_kwargs(
        key_id=key_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DeleteApiKeyBody | Unset = UNSET,

) -> DeleteApiKeyResponse200 | None:
    """ Delete an API key

     Permanently delete an API key. Requires ADMIN role.

    Args:
        key_id (UUID):
        body (DeleteApiKeyBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteApiKeyResponse200
     """


    return (await asyncio_detailed(
        key_id=key_id,
client=client,
body=body,

    )).parsed
