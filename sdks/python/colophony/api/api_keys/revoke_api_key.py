from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.revoke_api_key_body import RevokeApiKeyBody
from ...models.revoke_api_key_response_200 import RevokeApiKeyResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    key_id: UUID,
    *,
    body: RevokeApiKeyBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api-keys/{key_id}/revoke".format(key_id=quote(str(key_id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> RevokeApiKeyResponse200 | None:
    if response.status_code == 200:
        response_200 = RevokeApiKeyResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[RevokeApiKeyResponse200]:
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
    body: RevokeApiKeyBody | Unset = UNSET,

) -> Response[RevokeApiKeyResponse200]:
    """ Revoke an API key

     Revoke an API key so it can no longer be used for authentication. Requires ADMIN role.

    Args:
        key_id (UUID):
        body (RevokeApiKeyBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[RevokeApiKeyResponse200]
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
    body: RevokeApiKeyBody | Unset = UNSET,

) -> RevokeApiKeyResponse200 | None:
    """ Revoke an API key

     Revoke an API key so it can no longer be used for authentication. Requires ADMIN role.

    Args:
        key_id (UUID):
        body (RevokeApiKeyBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        RevokeApiKeyResponse200
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
    body: RevokeApiKeyBody | Unset = UNSET,

) -> Response[RevokeApiKeyResponse200]:
    """ Revoke an API key

     Revoke an API key so it can no longer be used for authentication. Requires ADMIN role.

    Args:
        key_id (UUID):
        body (RevokeApiKeyBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[RevokeApiKeyResponse200]
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
    body: RevokeApiKeyBody | Unset = UNSET,

) -> RevokeApiKeyResponse200 | None:
    """ Revoke an API key

     Revoke an API key so it can no longer be used for authentication. Requires ADMIN role.

    Args:
        key_id (UUID):
        body (RevokeApiKeyBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        RevokeApiKeyResponse200
     """


    return (await asyncio_detailed(
        key_id=key_id,
client=client,
body=body,

    )).parsed
