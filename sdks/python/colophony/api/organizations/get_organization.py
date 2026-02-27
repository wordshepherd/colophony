from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.get_organization_response_200 import GetOrganizationResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    org_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/organizations/{org_id}".format(org_id=quote(str(org_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> GetOrganizationResponse200 | None:
    if response.status_code == 200:
        response_200 = GetOrganizationResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[GetOrganizationResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[GetOrganizationResponse200]:
    """ Get an organization

     Retrieve a single organization by its ID.

    Args:
        org_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetOrganizationResponse200]
     """


    kwargs = _get_kwargs(
        org_id=org_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> GetOrganizationResponse200 | None:
    """ Get an organization

     Retrieve a single organization by its ID.

    Args:
        org_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetOrganizationResponse200
     """


    return sync_detailed(
        org_id=org_id,
client=client,

    ).parsed

async def asyncio_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[GetOrganizationResponse200]:
    """ Get an organization

     Retrieve a single organization by its ID.

    Args:
        org_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetOrganizationResponse200]
     """


    kwargs = _get_kwargs(
        org_id=org_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> GetOrganizationResponse200 | None:
    """ Get an organization

     Retrieve a single organization by its ID.

    Args:
        org_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetOrganizationResponse200
     """


    return (await asyncio_detailed(
        org_id=org_id,
client=client,

    )).parsed
